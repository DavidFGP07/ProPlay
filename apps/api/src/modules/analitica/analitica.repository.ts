import { Prisma } from "@prisma/client";
import {
  DIMENSIONES_MATCHING,
  JUEGO_PILOTO,
  ZONA_HORARIA_PILOTO,
  type Departamento,
  type EstadoOferta,
  type PosicionLol,
  type RangoLol,
} from "@proplay/shared";
import { prisma } from "../../config/prisma";

/**
 * Acceso a datos del módulo `analitica` (RF-13): el ÚNICO archivo del módulo
 * que importa `prisma`. Sólo lee. Las métricas se agregan en SQL con
 * `$queryRaw` parametrizado; las definiciones están en docs/arquitectura.md,
 * «Analítica».
 *
 * Las columnas `DateTime` de Prisma son `timestamp` sin zona y guardan UTC.
 * Un día natural es la fecha del calendario en `ZONA_HORARIA_PILOTO`:
 * `(col AT TIME ZONE 'UTC')` la vuelve un instante y `AT TIME ZONE <zona>` la
 * lleva a la hora local antes de tomar la fecha.
 */

/** Qué ofertas entran en una métrica. Siempre sólo las publicadas. */
export interface FiltroOfertas {
  /** `PerfilEquipo.id` del equipo dueño. */
  equipoId?: string;
  ofertaId?: string;
}

const zona = Prisma.sql`${ZONA_HORARIA_PILOTO}::text`;

/** Fecha del calendario en la zona del piloto de una columna `timestamp` en UTC. */
function dia(columna: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((${columna} AT TIME ZONE 'UTC') AT TIME ZONE ${zona})::date`;
}

/** Fecha del calendario en la zona del piloto de un instante de JS. */
function diaDe(instante: Date): Prisma.Sql {
  return Prisma.sql`((${instante.toISOString()}::timestamptz) AT TIME ZONE ${zona})::date`;
}

function filtroOfertas(filtro: FiltroOfertas): Prisma.Sql {
  const condiciones = [Prisma.sql`o."publicadaEn" IS NOT NULL`];
  if (filtro.equipoId) condiciones.push(Prisma.sql`o."equipoId" = ${filtro.equipoId}`);
  if (filtro.ofertaId) condiciones.push(Prisma.sql`o.id = ${filtro.ofertaId}`);
  return Prisma.join(condiciones, " AND ");
}

// ------------------------------------------------------------------ ofertas

export async function perfilEquipoDe(usuarioId: string): Promise<{ id: string } | null> {
  return prisma.perfilEquipo.findUnique({ where: { usuarioId }, select: { id: true } });
}

export interface OfertaPermisosDb {
  id: string;
  estado: EstadoOferta;
  equipoId: string;
  equipo: { usuarioId: string };
}

export async function buscarOferta(id: string): Promise<OfertaPermisosDb | null> {
  return prisma.oferta.findUnique({
    where: { id },
    select: { id: true, estado: true, equipoId: true, equipo: { select: { usuarioId: true } } },
  });
}

export interface OfertaTiemposDb {
  id: string;
  titulo: string;
  rol: PosicionLol;
  estado: Exclude<EstadoOferta, "BORRADOR">;
  publicadaEn: Date;
  cerradaEn: Date | null;
  postulaciones: number;
  diasHastaCubrir: number | null;
  diasHastaPrimerTryout: number | null;
  diasAbierta: number | null;
}

/**
 * Una fila por oferta publicada con sus tiempos en días naturales: hasta la
 * primera aceptación (sólo CUBIERTA), hasta el primer tryout (cualquiera que
 * haya llegado a uno) y los que lleva abierta (sólo ABIERTA, hasta `ahora`).
 */
function tiemposPorOferta(filtro: FiltroOfertas, ahora: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT o.id, o.titulo, o.rol::text AS rol, o.estado::text AS estado,
           o."publicadaEn", o."cerradaEn",
           count(p.id)::int AS postulaciones,
           CASE WHEN o.estado = 'CUBIERTA' AND min(p."aceptadaEn") IS NOT NULL
                THEN (${dia(Prisma.sql`min(p."aceptadaEn")`)} - ${dia(Prisma.sql`o."publicadaEn"`)})::int
           END AS "diasHastaCubrir",
           CASE WHEN min(p."entrevistaEn") IS NOT NULL
                THEN (${dia(Prisma.sql`min(p."entrevistaEn")`)} - ${dia(Prisma.sql`o."publicadaEn"`)})::int
           END AS "diasHastaPrimerTryout",
           CASE WHEN o.estado = 'ABIERTA'
                THEN (${diaDe(ahora)} - ${dia(Prisma.sql`o."publicadaEn"`)})::int
           END AS "diasAbierta"
      FROM "Oferta" o
      LEFT JOIN "Postulacion" p ON p."ofertaId" = o.id
     WHERE ${filtroOfertas(filtro)}
     GROUP BY o.id
  `;
}

/** Ofertas publicadas con sus tiempos, de la más reciente a la más antigua. */
export async function ofertasConTiempos(
  filtro: FiltroOfertas,
  ahora: Date,
): Promise<OfertaTiemposDb[]> {
  return prisma.$queryRaw<OfertaTiemposDb[]>`
    SELECT * FROM (${tiemposPorOferta(filtro, ahora)}) t
     ORDER BY t."publicadaEn" DESC, t.id COLLATE "C"
  `;
}

export interface SerieDiasDb {
  n: number;
  mediana: number | null;
  media: number | null;
}

/**
 * Mediana, media y n de los días hasta cubrir y hasta el primer tryout, sobre
 * las ofertas del filtro. Las ofertas sin el dato (nulo) no cuentan:
 * `percentile_cont` y `avg` ignoran los nulos.
 */
export async function resumenTiempos(
  filtro: FiltroOfertas,
  ahora: Date,
): Promise<{ hastaCubrir: SerieDiasDb; hastaPrimerTryout: SerieDiasDb }> {
  const [fila] = await prisma.$queryRaw<
    {
      nCubrir: number;
      medianaCubrir: number | null;
      mediaCubrir: number | null;
      nTryout: number;
      medianaTryout: number | null;
      mediaTryout: number | null;
    }[]
  >`
    SELECT count(t."diasHastaCubrir")::int AS "nCubrir",
           percentile_cont(0.5) WITHIN GROUP (ORDER BY t."diasHastaCubrir") AS "medianaCubrir",
           avg(t."diasHastaCubrir")::float8 AS "mediaCubrir",
           count(t."diasHastaPrimerTryout")::int AS "nTryout",
           percentile_cont(0.5) WITHIN GROUP (ORDER BY t."diasHastaPrimerTryout") AS "medianaTryout",
           avg(t."diasHastaPrimerTryout")::float8 AS "mediaTryout"
      FROM (${tiemposPorOferta(filtro, ahora)}) t
  `;
  return {
    hastaCubrir: { n: fila!.nCubrir, mediana: fila!.medianaCubrir, media: fila!.mediaCubrir },
    hastaPrimerTryout: { n: fila!.nTryout, mediana: fila!.medianaTryout, media: fila!.mediaTryout },
  };
}

// ------------------------------------------------------------------- embudo

export interface EtapaEmbudoDb {
  etapa: string;
  alcanzaron: number;
  enEtapa: number;
  rechazadas: number;
  rechazadasAlCerrar: number;
  n: number;
  mediana: number | null;
  media: number | null;
}

/**
 * Embudo de las postulaciones de las ofertas del filtro, una fila por etapa
 * alcanzada. Cada postulación se despliega en las etapas cuya fecha tiene
 * (`LATERAL (VALUES …)`), con la fecha de la etapa siguiente.
 *
 * - Rechazada en la etapa: `RECHAZADA` sin fecha de la etapa siguiente.
 * - Rechazo al cerrar: su `rechazadaEn` es el `cerradaEn` de la oferta (el
 *   cierre las rechaza en la misma transacción y con la misma fecha).
 * - Tiempo en la etapa: días transcurridos (horas / 24) hasta la etapa
 *   siguiente o el rechazo del equipo; no cuentan las que siguen en la etapa
 *   ni los rechazos al cerrar.
 */
export async function etapasEmbudo(filtro: FiltroOfertas): Promise<EtapaEmbudoDb[]> {
  return prisma.$queryRaw<EtapaEmbudoDb[]>`
    WITH postulaciones AS (
      SELECT p.estado::text AS estado, p."creadoEn", p."revisadaEn", p."entrevistaEn",
             p."aceptadaEn", p."rechazadaEn",
             (p."rechazadaEn" IS NOT NULL AND p."rechazadaEn" = o."cerradaEn") AS "alCerrar"
        FROM "Postulacion" p
        JOIN "Oferta" o ON o.id = p."ofertaId"
       WHERE ${filtroOfertas(filtro)}
    ),
    etapas AS (
      SELECT e.etapa, e.entrada, e.siguiente, p.estado, p."rechazadaEn", p."alCerrar",
             CASE
               WHEN e.siguiente IS NOT NULL THEN e.siguiente
               WHEN p.estado = 'RECHAZADA' AND NOT p."alCerrar" THEN p."rechazadaEn"
             END AS salida
        FROM postulaciones p
        CROSS JOIN LATERAL (VALUES
          ('ENVIADA', p."creadoEn", p."revisadaEn"),
          ('EN_REVISION', p."revisadaEn", p."entrevistaEn"),
          ('ENTREVISTA', p."entrevistaEn", p."aceptadaEn"),
          ('ACEPTADA', p."aceptadaEn", NULL::timestamp)
        ) AS e(etapa, entrada, siguiente)
       WHERE e.entrada IS NOT NULL
    )
    SELECT etapa,
           count(*)::int AS alcanzaron,
           count(*) FILTER (WHERE estado = etapa)::int AS "enEtapa",
           count(*) FILTER (WHERE estado = 'RECHAZADA' AND siguiente IS NULL AND NOT "alCerrar")::int
             AS rechazadas,
           count(*) FILTER (WHERE estado = 'RECHAZADA' AND siguiente IS NULL AND "alCerrar")::int
             AS "rechazadasAlCerrar",
           count(salida)::int AS n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM salida - entrada) / 86400)
             FILTER (WHERE salida IS NOT NULL) AS mediana,
           (avg(extract(epoch FROM salida - entrada) / 86400) FILTER (WHERE salida IS NOT NULL))::float8
             AS media
      FROM etapas
     GROUP BY etapa
  `;
}

// ------------------------------------------------------- dimensión decisiva

export interface GrupoRankingDb {
  top: boolean;
  n: number;
  puntaje: number;
  /** Aporte medio (wₖ·dₖ) de cada dimensión, en el orden de `DIMENSIONES_MATCHING`. */
  aportes: number[];
  /** Peso de cada dimensión con que se calculó, mismo orden. */
  pesos: number[];
  calculadoEn: Date;
  versionFormulas: number;
}

/**
 * Ranking guardado de la oferta partido en dos grupos: los `top` primeros y
 * el resto, con el puntaje medio y el aporte medio de cada dimensión. Mismo
 * orden y mismos candidatos que el ranking (puntaje, técnica e id; jugadores
 * activos). El aporte usa los pesos que aplicó el motor (`explicacion.pesos`),
 * y cada dimensión viaja como parámetro (`desglose->>$n`), nunca como SQL.
 */
export async function gruposDelRanking(ofertaId: string, top: number): Promise<GrupoRankingDb[]> {
  const aportes = Prisma.join(
    DIMENSIONES_MATCHING.map(
      (d) =>
        Prisma.sql`avg((r.desglose->>${d})::float8 * coalesce((r.pesos->>${d})::float8, 0))`,
    ),
  );
  const pesos = Prisma.join(
    DIMENSIONES_MATCHING.map((d) => Prisma.sql`avg(coalesce((r.pesos->>${d})::float8, 0))`),
  );
  return prisma.$queryRaw<GrupoRankingDb[]>`
    WITH r AS (
      SELECT m.puntaje, m.desglose, m.explicacion->'pesos' AS pesos, m."calculadoEn",
             m."versionFormulas",
             row_number() OVER (
               ORDER BY m.puntaje DESC,
                        (m.desglose->>'tecnica')::double precision DESC,
                        m."jugadorId" COLLATE "C" ASC
             ) AS puesto
        FROM "Matching" m
        JOIN "PerfilJugador" pj ON pj.id = m."jugadorId"
        JOIN "Usuario" u ON u.id = pj."usuarioId" AND u.activo
       WHERE m."ofertaId" = ${ofertaId}
    )
    SELECT (r.puesto <= ${top}) AS top,
           count(*)::int AS n,
           avg(r.puntaje)::float8 AS puntaje,
           ARRAY[${aportes}]::float8[] AS aportes,
           ARRAY[${pesos}]::float8[] AS pesos,
           min(r."calculadoEn") AS "calculadoEn",
           min(r."versionFormulas")::int AS "versionFormulas"
      FROM r
     GROUP BY 1
  `;
}

// --------------------------------------------------------- mapa del talento

export interface TalentoDb {
  pais: string | null;
  departamento: Departamento | null;
  posicion: string | null;
  rango: RangoLol | null;
  jugadores: number;
}

/**
 * Jugadores activos con cuenta de Riot verificada, agrupados por ubicación,
 * posición y rango de su última captura verificada (la misma regla que el
 * buscador y el matching). Sólo conteos: ninguna fila identifica a nadie
 * hasta que el servicio aplica el umbral.
 */
export async function talentoVerificado(): Promise<TalentoDb[]> {
  return prisma.$queryRaw<TalentoDb[]>`
    SELECT pj.pais::text AS pais,
           pj.departamento::text AS departamento,
           ultima.rol AS posicion,
           ultima.rango::text AS rango,
           count(*)::int AS jugadores
      FROM "PerfilJugador" pj
      JOIN "Usuario" u ON u.id = pj."usuarioId" AND u.activo
      JOIN "CuentaGaming" cg
        ON cg."jugadorId" = pj.id AND cg.plataforma = 'RIOT' AND cg."verificadaEn" IS NOT NULL
      LEFT JOIN LATERAL (
        SELECT e.rol, e.rango
          FROM "Estadistica" e
         WHERE e."jugadorId" = pj.id
           AND e.fuente = 'RIOT'
           AND e.juego = ${JUEGO_PILOTO}
         ORDER BY e."capturadaEn" DESC, e.id DESC
         LIMIT 1
      ) ultima ON TRUE
     GROUP BY 1, 2, 3, 4
  `;
}

/** Jugadores activos registrados (denominador de la proporción de verificados). */
export async function jugadoresRegistrados(): Promise<number> {
  return prisma.perfilJugador.count({ where: { usuario: { activo: true } } });
}

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  JUEGO_PILOTO,
  POSICIONES_LOL,
  type Departamento,
  type EstadoOferta,
  type EstadoPostulacion,
  type Modalidad,
  type Plataforma,
  type PosicionLol,
  type RangoLol,
} from "@proplay/shared";
import { prisma } from "../../config/prisma";
import { NotImplementedError } from "../../utils/errors";
import type { RangoPrisma } from "../../utils/pagination";
import type { CapturaVerificada, JugadorMotor } from "./motor/tipos";

/**
 * Acceso a datos del módulo `matching`: único archivo del módulo que importa
 * `prisma`. Lee tablas de `perfiles`, `estadisticas` y `ofertas`, de las que
 * `matching` depende en el grafo de CLAUDE.md §3.3, y escribe sólo las suyas
 * (`PerfilVector` y `Matching`). Toda consulta en SQL va con `$queryRaw` o
 * `$executeRaw` parametrizados: nunca `$queryRawUnsafe`.
 */

// ------------------------------------------------------------------ oferta

export interface OfertaDb {
  id: string;
  titulo: string;
  estado: EstadoOferta;
  rol: PosicionLol;
  rangoMinimo: RangoLol | null;
  modalidad: Modalidad;
  pais: string | null;
  departamento: Departamento | null;
  horasSemana: number | null;
  pesoTecnica: number;
  pesoExperiencia: number;
  pesoHabilidadesBlandas: number;
  pesoGeografica: number;
  pesoDisponibilidad: number;
  equipoId: string;
  actualizadoEn: Date;
  equipo: { usuarioId: string };
}

export async function buscarOferta(id: string): Promise<OfertaDb | null> {
  return prisma.oferta.findUnique({
    where: { id },
    select: {
      id: true,
      titulo: true,
      estado: true,
      rol: true,
      rangoMinimo: true,
      modalidad: true,
      pais: true,
      departamento: true,
      horasSemana: true,
      pesoTecnica: true,
      pesoExperiencia: true,
      pesoHabilidadesBlandas: true,
      pesoGeografica: true,
      pesoDisponibilidad: true,
      equipoId: true,
      actualizadoEn: true,
      equipo: { select: { usuarioId: true } },
    },
  });
}

// --------------------------------------------------------------- vectores

/**
 * Jugadores activos cuyo vector falta o está obsoleto: de una versión
 * anterior, calculado antes de la última edición del perfil, de la última
 * captura o de la verificación de la cuenta, o con la marca de verificado
 * (componente 24, posición 25 del array de Postgres) que ya no corresponde.
 */
export async function jugadoresConVectorObsoleto(version: number): Promise<string[]> {
  const filas = await prisma.$queryRaw<{ id: string }[]>`
    SELECT pj.id
      FROM "PerfilJugador" pj
      JOIN "Usuario" u ON u.id = pj."usuarioId" AND u.activo
      LEFT JOIN "PerfilVector" pv ON pv."jugadorId" = pj.id
      LEFT JOIN "CuentaGaming" cg
        ON cg."jugadorId" = pj.id AND cg.plataforma = 'RIOT' AND cg."verificadaEn" IS NOT NULL
     WHERE pv.id IS NULL
        OR pv.embedding IS NULL
        OR pv.version < ${version}
        OR pv."calculadoEn" < pj."actualizadoEn"
        OR pv."calculadoEn" < cg."verificadaEn"
        OR (cg.id IS NOT NULL) <> (COALESCE(pv.dimensiones[25], 0) > 0)
        OR EXISTS (
             SELECT 1 FROM "Estadistica" e
              WHERE e."jugadorId" = pj.id AND e."capturadaEn" > pv."calculadoEn"
           )
  `;
  return filas.map((f) => f.id);
}

/** Todos los jugadores activos (para recalcular sus vectores al cambiar de versión). */
export async function jugadoresActivos(): Promise<string[]> {
  const filas = await prisma.perfilJugador.findMany({
    where: { usuario: { activo: true } },
    select: { id: true },
  });
  return filas.map((f) => f.id);
}

interface FilaJugadorDb {
  id: string;
  pais: string | null;
  departamento: Departamento | null;
  disponibilidadHoras: number | null;
  dispuestoRelocalizar: boolean;
  verificado: boolean;
  posicion: string | null;
  rango: RangoLol | null;
  partidas: number | null;
  kda: number | null;
  winRate: number | null;
  metricas: Prisma.JsonValue | null;
  capturadaEn: Date | null;
}

/**
 * Lo que el motor necesita de cada jugador: perfil, verificación y la última
 * captura de LoL con fuente RIOT, sólo si la cuenta está verificada (la misma
 * regla que el buscador).
 */
export async function datosParaMotor(ids: readonly string[]): Promise<JugadorMotor[]> {
  if (ids.length === 0) return [];
  const [filas, endorsements] = await Promise.all([
    prisma.$queryRaw<FilaJugadorDb[]>`
      SELECT pj.id,
             pj.pais::text AS pais,
             pj.departamento,
             pj."disponibilidadHoras",
             pj."dispuestoRelocalizar",
             (cg.id IS NOT NULL) AS verificado,
             ultima.rol AS posicion,
             ultima.rango,
             ultima.partidas,
             ultima.kda,
             ultima."winRate",
             ultima.metricas,
             ultima."capturadaEn"
        FROM "PerfilJugador" pj
        LEFT JOIN "CuentaGaming" cg
          ON cg."jugadorId" = pj.id AND cg.plataforma = 'RIOT' AND cg."verificadaEn" IS NOT NULL
        LEFT JOIN LATERAL (
          SELECT e.rol, e.rango, e.partidas, e.kda, e."winRate", e.metricas, e."capturadaEn"
            FROM "Estadistica" e
           WHERE cg.id IS NOT NULL
             AND e."jugadorId" = pj.id
             AND e.fuente = 'RIOT'
             AND e.juego = ${JUEGO_PILOTO}
           ORDER BY e."capturadaEn" DESC, e.id DESC
           LIMIT 1
        ) ultima ON TRUE
       WHERE pj.id = ANY(${[...ids]}::text[])
    `,
    endorsementsBlandas(ids),
  ]);
  return filas.map((f) => ({
    jugadorId: f.id,
    verificado: f.verificado,
    captura: f.capturadaEn ? capturaDesdeFila(f, f.capturadaEn) : null,
    pais: f.pais,
    departamento: f.departamento,
    disponibilidadHoras: f.disponibilidadHoras,
    dispuestoRelocalizar: f.dispuestoRelocalizar,
    endorsementsBlandas: endorsements.get(f.id) ?? endorsements.get("")!,
  }));
}

function numero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function esPosicion(valor: unknown): valor is PosicionLol {
  return typeof valor === "string" && (POSICIONES_LOL as readonly string[]).includes(valor);
}

/** Lee con cuidado el Json de `metricas`: lo que no tenga la forma esperada se ignora. */
function capturaDesdeFila(f: FilaJugadorDb, capturadaEn: Date): CapturaVerificada {
  const m = (f.metricas && typeof f.metricas === "object" && !Array.isArray(f.metricas)
    ? f.metricas
    : {}) as Record<string, unknown>;
  const distribucion =
    m.distribucionRoles && typeof m.distribucionRoles === "object"
      ? Object.fromEntries(
          Object.entries(m.distribucionRoles as Record<string, unknown>).filter(
            (par): par is [PosicionLol, number] => esPosicion(par[0]) && numero(par[1]) !== null,
          ),
        )
      : null;
  const soloDuo =
    m.rangoSoloDuo && typeof m.rangoSoloDuo === "object"
      ? (m.rangoSoloDuo as Record<string, unknown>)
      : null;
  const victorias = numero(soloDuo?.victorias);
  const derrotas = numero(soloDuo?.derrotas);
  return {
    posicion: esPosicion(f.posicion) ? f.posicion : null,
    rango: f.rango,
    partidasAnalizadas: numero(m.partidasAnalizadas) ?? f.partidas ?? 0,
    partidasTemporada: victorias !== null && derrotas !== null ? victorias + derrotas : null,
    distribucionRoles: distribucion,
    metricas: {
      winRate: f.winRate ?? 0,
      kda: f.kda ?? 0,
      csPorMinuto: numero(m.csPorMinuto),
      oroPorMinuto: numero(m.oroPorMinuto),
      danoPorMinuto: numero(m.danoPorMinuto),
      visionPorMinuto: numero(m.visionPorMinuto),
      participacionKills: numero(m.participacionKills),
    },
    capturadaEn,
  };
}

/**
 * Endorsements de usuarios con rol EQUIPO a cada habilidad `BLANDA` del
 * catálogo, por jugador, en el orden del catálogo. La clave "" lleva la lista
 * de ceros para quien no tiene ninguno.
 */
async function endorsementsBlandas(ids: readonly string[]): Promise<Map<string, number[]>> {
  const [catalogo, conteos] = await Promise.all([
    prisma.habilidad.findMany({
      where: { categoria: "BLANDA" },
      select: { id: true },
      orderBy: { id: "asc" },
    }),
    prisma.$queryRaw<{ jugadorId: string; habilidadId: string; total: number }[]>`
      SELECT hj."jugadorId", hj."habilidadId", count(*)::int AS total
        FROM "Endorsement" en
        JOIN "HabilidadJugador" hj ON hj.id = en."habilidadJugadorId"
        JOIN "Habilidad" h ON h.id = hj."habilidadId" AND h.categoria = 'BLANDA'
        JOIN "Usuario" autor ON autor.id = en."autorId" AND autor.rol = 'EQUIPO'
       WHERE hj."jugadorId" = ANY(${[...ids]}::text[])
       GROUP BY hj."jugadorId", hj."habilidadId"
    `,
  ]);
  const posicion = new Map(catalogo.map((h, i) => [h.id, i]));
  const mapa = new Map<string, number[]>([["", catalogo.map(() => 0)]]);
  for (const { jugadorId, habilidadId, total } of conteos) {
    const lista = mapa.get(jugadorId) ?? catalogo.map(() => 0);
    const i = posicion.get(habilidadId);
    if (i !== undefined) lista[i] = total;
    mapa.set(jugadorId, lista);
  }
  return mapa;
}

/** Texto que pgvector convierte con `::vector`. Va como parámetro, nunca concatenado. */
function textoVector(v: readonly number[]): string {
  return `[${v.join(",")}]`;
}

/**
 * Guarda los vectores con `INSERT … ON CONFLICT`: atómico, así dos cálculos
 * simultáneos del mismo jugador no chocan con la restricción única. La fecha
 * se pasa en UTC explícito: las columnas son `timestamp` sin zona, como las
 * que escribe Prisma, y la sesión puede tener otra zona horaria.
 */
export async function guardarVectores(
  vectores: readonly { jugadorId: string; dimensiones: number[] }[],
  version: number,
  calculadoEn: Date,
): Promise<void> {
  for (const { jugadorId, dimensiones } of vectores) {
    await prisma.$executeRaw`
      INSERT INTO "PerfilVector" (id, "jugadorId", dimensiones, embedding, version, "calculadoEn")
      VALUES (${randomUUID()}, ${jugadorId}, ${`{${dimensiones.join(",")}}`}::double precision[],
              ${textoVector(dimensiones)}::vector, ${version},
              (${calculadoEn.toISOString()}::timestamptz AT TIME ZONE 'UTC'))
      ON CONFLICT ("jugadorId") DO UPDATE
        SET dimensiones = EXCLUDED.dimensiones,
            embedding = EXCLUDED.embedding,
            version = EXCLUDED.version,
            "calculadoEn" = EXCLUDED."calculadoEn"
    `;
  }
}

// ------------------------------------------------------------- recuperador

export interface Recuperado {
  jugadorId: string;
  similitud: number;
}

/**
 * RF-09 · RNF-01 · Recuperador por contenido: los `k` vecinos más cercanos al
 * vector de requisitos sobre el índice HNSW (`ORDER BY embedding <=> $1`).
 *
 * La cola de candidatos del índice HNSW mide `hnsw.ef_search` (40 por
 * defecto): con un valor menor que `k` el índice devuelve menos filas de las
 * pedidas y pierde vecinos. Se sube a `k` con `SET LOCAL` dentro de la misma
 * transacción que la consulta: fuera de una transacción no tendría efecto.
 * `SET` no admite parámetros; `k` es un entero que se comprueba aquí y nunca
 * viene de la petición.
 *
 * `soloIndice` desactiva el recorrido secuencial dentro de la transacción: con
 * pocos perfiles el planificador lo prefiere al índice, y las pruebas y la
 * medición de RNF-01 necesitan ejercitar el camino del índice.
 */
export async function recuperarCandidatos(
  vector: readonly number[],
  k: number,
  version: number,
  { soloIndice = false, efSearch = k }: { soloIndice?: boolean; efSearch?: number } = {},
): Promise<Recuperado[]> {
  if (!Number.isInteger(k) || k < 1 || !Number.isInteger(efSearch) || efSearch < 1 || efSearch > 1000) {
    throw new Error("k y ef_search deben ser enteros entre 1 y 1000");
  }
  const texto = textoVector(vector);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL hnsw.ef_search = ${Prisma.raw(String(efSearch))}`;
    if (soloIndice) await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
    return tx.$queryRaw<Recuperado[]>`
      SELECT c."jugadorId", c.similitud
        FROM (
          SELECT pv."jugadorId", 1 - (pv.embedding <=> ${texto}::vector) AS similitud
            FROM "PerfilVector" pv
           WHERE pv.version = ${version}
           ORDER BY pv.embedding <=> ${texto}::vector
           LIMIT ${k}
        ) c
        JOIN "PerfilJugador" pj ON pj.id = c."jugadorId"
        JOIN "Usuario" u ON u.id = pj."usuarioId" AND u.activo
    `;
  });
}

// ------------------------------------------------------------- postulaciones

export async function postulacionesDeOferta(ofertaId: string) {
  return prisma.postulacion.findMany({
    where: { ofertaId, jugador: { usuario: { activo: true } } },
    select: { jugadorId: true },
  });
}

// ------------------------------------------------------------------ ranking

export interface EstadoRanking {
  filas: number;
  calculadoEn: Date | null;
  versionMinima: number | null;
  /** Último cambio de algo que mueve el ranking: vectores, postulaciones o endorsements. */
  ultimoCambio: Date | null;
}

export async function estadoRanking(ofertaId: string): Promise<EstadoRanking> {
  const [fila] = await prisma.$queryRaw<EstadoRanking[]>`
    SELECT (SELECT count(*)::int FROM "Matching" WHERE "ofertaId" = ${ofertaId}) AS filas,
           (SELECT min("calculadoEn") FROM "Matching" WHERE "ofertaId" = ${ofertaId}) AS "calculadoEn",
           (SELECT min("versionFormulas") FROM "Matching" WHERE "ofertaId" = ${ofertaId}) AS "versionMinima",
           GREATEST(
             (SELECT max("calculadoEn") FROM "PerfilVector"),
             (SELECT max("creadoEn") FROM "Postulacion" WHERE "ofertaId" = ${ofertaId}),
             (SELECT max("creadoEn") FROM "Endorsement")
           ) AS "ultimoCambio"
  `;
  return fila!;
}

export interface FilaMatchingNueva {
  jugadorId: string;
  puntaje: number;
  desglose: Prisma.InputJsonObject;
  explicacion: Prisma.InputJsonObject;
  similitud: number | null;
}

/**
 * Reemplaza el ranking de la oferta en una transacción: es una instantánea. El
 * bloqueo consultivo por oferta impide que dos recálculos simultáneos se
 * crucen (el segundo espera y reescribe con el mismo resultado).
 */
export async function guardarRanking(
  ofertaId: string,
  filas: readonly FilaMatchingNueva[],
  versionFormulas: number,
  calculadoEn: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matching:${ofertaId}`}))`;
    await tx.matching.deleteMany({ where: { ofertaId } });
    if (filas.length > 0) {
      await tx.matching.createMany({
        data: filas.map((f) => ({ ...f, ofertaId, versionFormulas, calculadoEn })),
      });
    }
  });
}

export interface FilaRankingDb {
  jugadorId: string;
  puntaje: number;
  desglose: Prisma.JsonValue;
  explicacion: Prisma.JsonValue;
  similitud: number | null;
  calculadoEn: Date;
  nombre: string;
  avatarUrl: string | null;
  pais: string | null;
  departamento: Departamento | null;
  disponibilidadHoras: number | null;
  dispuestoRelocalizar: boolean;
  plataforma: Plataforma | null;
  verificadaEn: Date | null;
  posicion: string | null;
  rango: RangoLol | null;
  datosDel: Date | null;
  postulacionId: string | null;
  postulacionEstado: EstadoPostulacion | null;
}

/**
 * Página del ranking guardado con lo que la respuesta muestra de cada jugador
 * (la lista blanca del buscador) y su postulación a la oferta. Mismo orden que
 * `ordenarRanking`: puntaje, técnica e id (con collation binaria, como en JS).
 */
export async function paginaRanking(
  ofertaId: string,
  rango: RangoPrisma,
): Promise<[FilaRankingDb[], number]> {
  const [filas, conteo] = await Promise.all([
    prisma.$queryRaw<FilaRankingDb[]>`
      SELECT m."jugadorId", m.puntaje, m.desglose, m.explicacion, m.similitud, m."calculadoEn",
             u.nombre, pj."avatarUrl", pj.pais::text AS pais, pj.departamento,
             pj."disponibilidadHoras", pj."dispuestoRelocalizar",
             cg.plataforma, cg."verificadaEn",
             ultima.rol AS posicion, ultima.rango, ultima."capturadaEn" AS "datosDel",
             p.id AS "postulacionId", p.estado AS "postulacionEstado"
        FROM "Matching" m
        JOIN "PerfilJugador" pj ON pj.id = m."jugadorId"
        JOIN "Usuario" u ON u.id = pj."usuarioId" AND u.activo
        LEFT JOIN "CuentaGaming" cg
          ON cg."jugadorId" = pj.id AND cg.plataforma = 'RIOT' AND cg."verificadaEn" IS NOT NULL
        LEFT JOIN LATERAL (
          SELECT e.rol, e.rango, e."capturadaEn"
            FROM "Estadistica" e
           WHERE cg.id IS NOT NULL
             AND e."jugadorId" = pj.id
             AND e.fuente = 'RIOT'
             AND e.juego = ${JUEGO_PILOTO}
           ORDER BY e."capturadaEn" DESC, e.id DESC
           LIMIT 1
        ) ultima ON TRUE
        LEFT JOIN "Postulacion" p ON p."ofertaId" = m."ofertaId" AND p."jugadorId" = m."jugadorId"
       WHERE m."ofertaId" = ${ofertaId}
       ORDER BY m.puntaje DESC,
                (m.desglose->>'tecnica')::double precision DESC,
                m."jugadorId" COLLATE "C" ASC
       LIMIT ${rango.take} OFFSET ${rango.skip}
    `,
    prisma.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total
        FROM "Matching" m
        JOIN "PerfilJugador" pj ON pj.id = m."jugadorId"
        JOIN "Usuario" u ON u.id = pj."usuarioId" AND u.activo
       WHERE m."ofertaId" = ${ofertaId}
    `,
  ]);
  return [filas, conteo[0]?.total ?? 0];
}

/** TODO: Devolver las ofertas más compatibles con el jugador autenticado. */
export async function ofertasCompatibles(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "matching.repository.ofertasCompatibles todavía no consulta la base de datos",
  );
}

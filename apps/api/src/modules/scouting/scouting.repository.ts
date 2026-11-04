import { Prisma } from "@prisma/client";
import {
  JUEGO_PILOTO,
  type BusquedaJugadores,
  type Departamento,
  type Plataforma,
  type RangoLol,
} from "@proplay/shared";
import { prisma } from "../../config/prisma";
import { NotImplementedError } from "../../utils/errors";
import type { RangoPrisma } from "../../utils/pagination";

/**
 * Acceso a datos del módulo `scouting`.
 *
 * Único archivo del módulo que importa `prisma`. El buscador lee en una sola
 * consulta tablas de `perfiles` (PerfilJugador, CuentaGaming) y de
 * `estadisticas` (Estadistica): `scouting` es el último módulo del grafo de
 * CLAUDE.md §3.3, depende de esos datos y nadie depende de él, así que no hay
 * ciclo. La ficha ampliada y las búsquedas guardadas siguen en 501 (descartadas
 * en el recorte).
 */

/** Fila del buscador tal como sale de la consulta, antes de la lista blanca. */
export interface JugadorEncontradoDb {
  id: string;
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
}

/**
 * Condiciones del buscador. Cada filtro es un fragmento `Prisma.sql` con su
 * valor como parámetro: nunca se concatena texto ni se usa `$queryRawUnsafe`.
 * Los valores llegan ya validados con `busquedaJugadoresSchema`, pero la
 * consulta no depende de ello: un valor malicioso sería un parámetro más.
 */
function condiciones(filtros: BusquedaJugadores): Prisma.Sql {
  const partes: Prisma.Sql[] = [];
  if (filtros.departamento) {
    partes.push(Prisma.sql`departamento = ${filtros.departamento}::"Departamento"`);
  }
  if (filtros.posicion) {
    partes.push(Prisma.sql`posicion = ${filtros.posicion}`);
  }
  if (filtros.rangoMinimo) {
    partes.push(Prisma.sql`rango >= ${filtros.rangoMinimo}::"RangoLol"`);
  }
  return partes.length > 0 ? Prisma.sql`WHERE ${Prisma.join(partes, " AND ")}` : Prisma.empty;
}

/**
 * Jugadores con su resumen verificado: la cuenta de Riot verificada y, sólo si
 * la tiene, la posición y el rango de su **última** captura de LoL con fuente
 * RIOT. Sin cuenta, posición y rango quedan nulos, así que filtrar por
 * cualquiera de los dos los deja fuera. Las cuentas desactivadas no salen.
 */
const resumen = Prisma.sql`
  WITH resumen AS (
    SELECT pj.id,
           u.nombre,
           pj."avatarUrl",
           pj.pais::text AS pais,
           pj.departamento,
           pj."disponibilidadHoras",
           pj."dispuestoRelocalizar",
           pj."actualizadoEn",
           cg.plataforma,
           cg."verificadaEn",
           ultima.rol AS posicion,
           ultima.rango,
           ultima."capturadaEn" AS "datosDel"
      FROM "PerfilJugador" pj
      JOIN "Usuario" u ON u.id = pj."usuarioId" AND u.activo
      LEFT JOIN "CuentaGaming" cg
        ON cg."jugadorId" = pj.id
       AND cg.plataforma = 'RIOT'
       AND cg."verificadaEn" IS NOT NULL
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
  )
`;

/**
 * RF-08 · Página de resultados y total. Orden: verificados primero, rango de
 * mayor a menor (sin rango al final), dato más reciente (la captura o, sin
 * ella, la última edición del perfil) y el id, que lo hace estable entre
 * páginas.
 */
export async function buscarJugadores(
  filtros: BusquedaJugadores,
  rango: RangoPrisma,
): Promise<[JugadorEncontradoDb[], number]> {
  const donde = condiciones(filtros);
  const [filas, conteo] = await Promise.all([
    prisma.$queryRaw<JugadorEncontradoDb[]>`
      ${resumen}
      SELECT id, nombre, "avatarUrl", pais, departamento, "disponibilidadHoras",
             "dispuestoRelocalizar", plataforma, "verificadaEn", posicion, rango, "datosDel"
        FROM resumen
        ${donde}
       ORDER BY ("verificadaEn" IS NULL),
                rango DESC NULLS LAST,
                COALESCE("datosDel", "actualizadoEn") DESC,
                id DESC
       LIMIT ${rango.take} OFFSET ${rango.skip}
    `,
    prisma.$queryRaw<{ total: number }[]>`
      ${resumen}
      SELECT count(*)::int AS total FROM resumen ${donde}
    `,
  ]);
  return [filas, conteo[0]?.total ?? 0];
}

/** TODO: Devolver la ficha ampliada de un jugador (perfil, habilidades y estadísticas). */
export async function fichaJugador(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "scouting.repository.fichaJugador todavía no consulta la base de datos",
  );
}

/** TODO: Guardar los filtros de una búsqueda para reutilizarla. */
export async function guardarBusqueda(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "scouting.repository.guardarBusqueda todavía no consulta la base de datos",
  );
}

/** TODO: Listar las búsquedas guardadas del usuario autenticado. */
export async function listarBusquedas(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "scouting.repository.listarBusquedas todavía no consulta la base de datos",
  );
}

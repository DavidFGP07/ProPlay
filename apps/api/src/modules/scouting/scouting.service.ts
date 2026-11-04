import { calcularRango, paginar, type OpcionesPaginacion } from "../../utils/pagination";
import * as repositorio from "./scouting.repository";
import { jugadorEncontradoSchema, type BusquedaJugadores } from "./scouting.schema";

/**
 * Lógica de negocio del módulo `scouting`: Búsqueda y descubrimiento de jugadores por parte de scouts y equipos.
 *
 * La ficha ampliada y las búsquedas guardadas siguen en andamiaje: delegan en
 * el repositorio, que lanza NotImplementedError (501).
 */

/**
 * RF-08 · Buscador de talento. Cada resultado pasa por
 * `jugadorEncontradoSchema`, la lista blanca: lo que la consulta traiga de más
 * no sale. La verificación sólo existe si hay cuenta de Riot verificada.
 */
export async function buscarJugadores(query: BusquedaJugadores & OpcionesPaginacion) {
  const { page, pageSize, ...filtros } = query;
  const rango = calcularRango({ page, pageSize });
  const [filas, total] = await repositorio.buscarJugadores(filtros, rango);
  const data = filas.map(({ plataforma, verificadaEn, ...jugador }) =>
    jugadorEncontradoSchema.parse({
      ...jugador,
      verificacion: plataforma && verificadaEn ? { plataforma, verificadaEn } : null,
    }),
  );
  return paginar(data, total, rango);
}

/** TODO: Devolver la ficha ampliada de un jugador (perfil, habilidades y estadísticas). */
export async function fichaJugador(datos?: unknown) {
  return repositorio.fichaJugador(datos);
}

/** TODO: Guardar los filtros de una búsqueda para reutilizarla. */
export async function guardarBusqueda(datos?: unknown) {
  return repositorio.guardarBusqueda(datos);
}

/** TODO: Listar las búsquedas guardadas del usuario autenticado. */
export async function listarBusquedas(datos?: unknown) {
  return repositorio.listarBusquedas(datos);
}

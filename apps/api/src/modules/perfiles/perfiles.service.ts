import type {
  Pais,
  PerfilEquipoRespuesta,
  PerfilJugadorRespuesta,
  PerfilPropioResponse,
  Rol,
} from "@proplay/shared";
import { NotFoundError } from "../../utils/errors";
import * as repositorio from "./perfiles.repository";
import type { PerfilJugadorInput } from "./perfiles.schema";

/**
 * Lógica de negocio del módulo `perfiles`: Perfiles de jugador y de equipo, habilidades, endorsements y cuentas gaming.
 *
 * Andamiaje: las funciones que conservan su TODO delegan en el repositorio,
 * que todavía lanza NotImplementedError (501).
 */

function aRespuestaJugador(
  perfil: repositorio.PerfilJugadorDb,
): PerfilJugadorRespuesta {
  return { ...perfil, pais: perfil.pais as Pais | null };
}

function aRespuestaEquipo(
  perfil: repositorio.PerfilEquipoDb,
): PerfilEquipoRespuesta {
  return perfil;
}

/**
 * Perfil del usuario autenticado. El registro crea el perfil del jugador y el
 * del equipo en la misma transacción que la cuenta; el scout y el
 * administrador no tienen perfil.
 */
export async function obtenerPropio(
  usuarioId: string,
  rol: Rol,
): Promise<PerfilPropioResponse> {
  if (rol === "JUGADOR") {
    const perfil = await repositorio.buscarJugadorPorUsuario(usuarioId);
    if (perfil) return { tipo: "JUGADOR", perfil: aRespuestaJugador(perfil) };
  } else if (rol === "EQUIPO") {
    const perfil = await repositorio.buscarEquipoPorUsuario(usuarioId);
    if (perfil) return { tipo: "EQUIPO", perfil: aRespuestaEquipo(perfil) };
  }
  throw new NotFoundError("Este usuario no tiene perfil");
}

/**
 * Actualización parcial del perfil del jugador: sólo cambian los campos
 * enviados. Cuando llega el país, el departamento se guarda con él (nulo si
 * no se envía), para que nunca quede un departamento de Colombia junto a otro
 * país; el esquema ya garantiza que la pareja es coherente.
 */
export async function actualizarJugador(
  usuarioId: string,
  datos: PerfilJugadorInput,
): Promise<PerfilPropioResponse> {
  const existente = await repositorio.buscarJugadorPorUsuario(usuarioId);
  if (!existente) throw new NotFoundError("Este usuario no tiene perfil");

  const cambios =
    datos.pais === undefined
      ? datos
      : { ...datos, departamento: datos.departamento ?? null };
  const perfil = await repositorio.actualizarJugador(usuarioId, cambios);
  return { tipo: "JUGADOR", perfil: aRespuestaJugador(perfil) };
}

/** TODO: Actualizar el PerfilEquipo del usuario autenticado. */
export async function actualizarEquipo(datos?: unknown) {
  return repositorio.actualizarEquipo(datos);
}

/** TODO: Devolver el catálogo de habilidades (técnicas y blandas). */
export async function catalogoHabilidades(datos?: unknown) {
  return repositorio.catalogoHabilidades(datos);
}

/** TODO: Asociar una habilidad al perfil del jugador con su nivel 1-5. */
export async function asignarHabilidad(datos?: unknown) {
  return repositorio.asignarHabilidad(datos);
}

/** TODO: Registrar el endorsement de una HabilidadJugador por parte de otro usuario. */
export async function endosar(datos?: unknown) {
  return repositorio.endosar(datos);
}

/** TODO: Vincular una cuenta externa vía OAuth y guardar sus tokens cifrados. */
export async function vincularCuenta(datos?: unknown) {
  return repositorio.vincularCuenta(datos);
}

/** TODO: Devolver el perfil público de un usuario por su id. */
export async function obtenerPublico(datos?: unknown) {
  return repositorio.obtenerPublico(datos);
}

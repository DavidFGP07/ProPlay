import {
  ICONO_VERIFICACION_MAX,
  ICONO_VERIFICACION_MIN,
  MINUTOS_DESAFIO_VERIFICACION,
  type Plataforma,
} from "@proplay/shared";
import type {
  CuentaGaming,
  DesafioVerificacionRiot,
  Pais,
  PerfilEquipoRespuesta,
  PerfilJugadorPublico,
  PerfilJugadorRespuesta,
  PerfilPropioResponse,
  Rol,
} from "@proplay/shared";
import { randomInt } from "node:crypto";
import { esServidorLol, obtenerProveedorRiot } from "../../integrations";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../utils/errors";
import { firmarDesafioRiot, verificarDesafioRiot } from "../../utils/jwt";
import * as repositorio from "./perfiles.repository";
import {
  paisDepartamentoSchema,
  perfilJugadorPublicoSchema,
  ubicacionJugadorSchema,
  type PerfilEquipoInput,
  type PerfilJugadorInput,
  type VerificarCuentaRiotInput,
  type VincularCuentaRiotInput,
} from "./perfiles.schema";

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
  return { ...perfil, pais: perfil.pais as Pais | null };
}

/**
 * Perfil del usuario autenticado. El scout y el administrador no tienen perfil
 * y reciben `{ tipo: null, perfil: null }` con 200, no un 404: así una vista
 * común que lo pida no lo trata como error ni lo reintenta. El registro crea el
 * perfil del jugador y el del equipo en la misma transacción que la cuenta, así
 * que si falta es una inconsistencia y sí responde 404.
 */
export async function obtenerPropio(
  usuarioId: string,
  rol: Rol,
): Promise<PerfilPropioResponse> {
  if (rol === "JUGADOR") {
    const perfil = await repositorio.buscarJugadorPorUsuario(usuarioId);
    if (!perfil) throw new NotFoundError("Este usuario no tiene perfil");
    return { tipo: "JUGADOR", perfil: aRespuestaJugador(perfil) };
  }
  if (rol === "EQUIPO") {
    const perfil = await repositorio.buscarEquipoPorUsuario(usuarioId);
    if (!perfil) throw new NotFoundError("Este usuario no tiene perfil");
    return { tipo: "EQUIPO", perfil: aRespuestaEquipo(perfil) };
  }
  return { tipo: null, perfil: null };
}

/**
 * Actualización parcial del perfil del jugador: sólo cambian los campos
 * enviados. La ubicación se valida contra el país resultante:
 * - Si llega el país, el esquema ya comprobó la pareja; el departamento se
 *   guarda con él (nulo si no se envía), para que nunca quede un departamento
 *   de Colombia junto a otro país.
 * - Si llega sólo el departamento, se comprueba contra el país guardado con la
 *   misma regla de `ubicacionJugadorSchema`. Su ZodError sale como 422, igual
 *   que los del middleware validate().
 */
export async function actualizarJugador(
  usuarioId: string,
  datos: PerfilJugadorInput,
): Promise<PerfilPropioResponse> {
  const existente = await repositorio.buscarJugadorPorUsuario(usuarioId);
  if (!existente) throw new NotFoundError("Este usuario no tiene perfil");

  if (datos.pais === undefined && datos.departamento !== undefined) {
    ubicacionJugadorSchema.parse({
      pais: existente.pais,
      departamento: datos.departamento,
    });
  }

  const cambios = {
    ...datos,
    ...(datos.pais !== undefined && { departamento: datos.departamento ?? null }),
    // Una presentación en blanco se guarda como ausente, para que el perfil
    // público muestre su estado vacío y no un párrafo sin texto.
    ...(datos.bio !== undefined && { bio: datos.bio.trim() || null }),
  };
  const perfil = await repositorio.actualizarJugador(usuarioId, cambios);
  return { tipo: "JUGADOR", perfil: aRespuestaJugador(perfil) };
}

/**
 * Actualización parcial del perfil de la organización: un campo ausente no
 * cambia y `null` lo borra. El esquema ya recortó el nombre y el sitio web y
 * sólo admite URL http/https. Una descripción en blanco se guarda como
 * ausente, igual que la presentación del jugador. La sede sigue la misma regla
 * que la ubicación del jugador (ver `actualizarJugador`).
 */
export async function actualizarEquipo(
  usuarioId: string,
  datos: PerfilEquipoInput,
): Promise<PerfilPropioResponse> {
  const existente = await repositorio.buscarEquipoPorUsuario(usuarioId);
  if (!existente) throw new NotFoundError("Este usuario no tiene perfil");

  if (datos.pais === undefined && datos.departamento !== undefined) {
    paisDepartamentoSchema.parse({
      pais: existente.pais,
      departamento: datos.departamento,
    });
  }

  const cambios = {
    ...datos,
    ...(datos.pais !== undefined && { departamento: datos.departamento ?? null }),
    ...(typeof datos.descripcion === "string" && {
      descripcion: datos.descripcion.trim() || null,
    }),
  };
  const perfil = await repositorio.actualizarEquipo(usuarioId, cambios);
  return { tipo: "EQUIPO", perfil: aRespuestaEquipo(perfil) };
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

/**
 * TODO: Vincular una cuenta externa vía OAuth (RSO) y guardar sus tokens
 * cifrados. Requiere una clave de producción de Riot con RSO aprobado; mientras
 * tanto la vinculación usa el desafío del icono (`iniciarVinculacionRiot`).
 */
export async function vincularCuenta(datos?: unknown) {
  return repositorio.vincularCuenta(datos);
}

async function jugadorDelUsuario(usuarioId: string): Promise<repositorio.PerfilJugadorDb> {
  const perfil = await repositorio.buscarJugadorPorUsuario(usuarioId);
  if (!perfil) throw new NotFoundError("Este usuario no tiene perfil de jugador");
  return perfil;
}

/** Cuentas vinculadas del jugador autenticado, con su última sincronización. */
export async function listarCuentas(usuarioId: string): Promise<CuentaGaming[]> {
  const perfil = await jugadorDelUsuario(usuarioId);
  return repositorio.listarCuentas(perfil.id);
}

/** Icono de los básicos, distinto del que tiene puesto ahora. */
function elegirIcono(actual: number): number {
  let icono = actual;
  while (icono === actual) {
    icono = randomInt(ICONO_VERIFICACION_MIN, ICONO_VERIFICACION_MAX + 1);
  }
  return icono;
}

async function comprobarQueNoEsDeOtro(jugadorId: string, puuid: string): Promise<void> {
  const dueno = await repositorio.buscarDuenoCuenta("RIOT", puuid);
  if (dueno && dueno.jugadorId !== jugadorId) {
    throw new ConflictError("Esa cuenta de Riot ya está vinculada a otro jugador de ProPlay");
  }
}

/**
 * Paso 1 de la vinculación con Riot (RF-02): busca el Riot ID en el servidor
 * indicado y devuelve el icono de invocador que el jugador debe ponerse para
 * demostrar que la cuenta es suya. No guarda nada: el desafío viaja firmado.
 */
export async function iniciarVinculacionRiot(
  usuarioId: string,
  datos: VincularCuentaRiotInput,
): Promise<DesafioVerificacionRiot> {
  const perfil = await jugadorDelUsuario(usuarioId);
  const riot = obtenerProveedorRiot();

  const cuenta = await riot.buscarCuenta(datos.gameName, datos.tagLine, datos.servidor);
  if (!cuenta) {
    throw new NotFoundError(
      `No hay ninguna cuenta de League of Legends con el Riot ID ${datos.gameName}#${datos.tagLine} en ${datos.servidor}`,
    );
  }
  await comprobarQueNoEsDeOtro(perfil.id, cuenta.puuid);

  const iconoRequerido = elegirIcono(cuenta.iconoActual);
  const tokenDesafio = firmarDesafioRiot(
    {
      sub: usuarioId,
      puuid: cuenta.puuid,
      riotId: cuenta.riotId,
      servidor: cuenta.servidor,
      icono: iconoRequerido,
    },
    MINUTOS_DESAFIO_VERIFICACION,
  );

  return {
    riotId: cuenta.riotId,
    servidor: cuenta.servidor,
    nivelInvocador: cuenta.nivelInvocador,
    iconoActual: cuenta.iconoActual,
    iconoRequerido,
    iconoRequeridoUrl: riot.urlIcono(iconoRequerido),
    expiraEn: new Date(Date.now() + MINUTOS_DESAFIO_VERIFICACION * 60_000),
    tokenDesafio,
  };
}

/**
 * Paso 2: comprueba en Riot que el invocador lleva el icono pedido y, si es
 * así, guarda la cuenta como verificada. Desde ese momento sus estadísticas
 * cuentan como verificadas (RF-02, RF-05).
 */
export async function verificarCuentaRiot(
  usuarioId: string,
  datos: VerificarCuentaRiotInput,
): Promise<CuentaGaming> {
  const perfil = await jugadorDelUsuario(usuarioId);
  const desafio = verificarDesafioRiot(datos.tokenDesafio, usuarioId);
  if (!desafio || !esServidorLol(desafio.servidor)) {
    throw new BadRequestError(
      "El desafío de verificación no es válido o caducó; vuelve a empezar la vinculación",
    );
  }

  const iconoActual = await obtenerProveedorRiot().iconoActual(desafio.puuid, desafio.servidor);
  if (iconoActual === null) {
    throw new NotFoundError("La cuenta de Riot ya no tiene invocador en ese servidor");
  }
  if (iconoActual !== desafio.icono) {
    throw new AppError(
      409,
      "VERIFICACION_PENDIENTE",
      "Tu invocador todavía no tiene el icono pedido. Cámbialo en el cliente de League of Legends y vuelve a intentarlo (Riot puede tardar uno o dos minutos en reflejarlo)",
      { iconoActual, iconoRequerido: desafio.icono },
    );
  }

  await comprobarQueNoEsDeOtro(perfil.id, desafio.puuid);
  const cuenta = await repositorio.guardarCuentaVerificada({
    jugadorId: perfil.id,
    plataforma: "RIOT",
    externalId: desafio.puuid,
    handle: desafio.riotId,
    servidor: desafio.servidor,
    verificadaEn: new Date(),
  });
  await repositorio.registrarAuditoria({
    usuarioId,
    accion: "VINCULAR_CUENTA",
    entidadId: cuenta.id,
    metadata: { plataforma: "RIOT", servidor: desafio.servidor, metodo: "ICONO" },
  });
  return cuenta;
}

/**
 * Desvincula la cuenta de la plataforma y borra las estadísticas que salieron
 * de ella (en cascada en la base): sin cuenta verificada no son datos
 * verificados, y no deben aparecer como datos de otra cuenta que se vincule
 * después.
 */
export async function desvincularCuenta(
  usuarioId: string,
  plataforma: Plataforma,
): Promise<void> {
  const perfil = await jugadorDelUsuario(usuarioId);
  const borradas = await repositorio.borrarCuenta(perfil.id, plataforma);
  if (borradas === 0) throw new NotFoundError("No tienes una cuenta vinculada en esa plataforma");
  await repositorio.registrarAuditoria({
    usuarioId,
    accion: "DESVINCULAR_CUENTA",
    entidadId: null,
    metadata: { plataforma },
  });
}

/**
 * Perfil público del jugador: sólo los campos de la lista blanca de
 * `perfilJugadorPublicoSchema`. El repositorio ya selecciona sólo esos; el
 * parse final descarta cualquier campo que se añada a la consulta por error.
 * Una cuenta desactivada responde 404, igual que un id que no existe.
 */
export async function obtenerPublico(perfilId: string): Promise<PerfilJugadorPublico> {
  const perfil = await repositorio.buscarJugadorPublico(perfilId);
  if (!perfil) throw new NotFoundError("Perfil no encontrado");
  return perfilJugadorPublicoSchema.parse({
    id: perfil.id,
    nombre: perfil.usuario.nombre,
    bio: perfil.bio,
    pais: perfil.pais,
    departamento: perfil.departamento,
    avatarUrl: perfil.avatarUrl,
    cuentasVerificadas: perfil.cuentasGaming,
  });
}

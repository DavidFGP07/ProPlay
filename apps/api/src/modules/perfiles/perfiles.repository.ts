import type { Plataforma, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { clienteRedis } from "../../config/redis";
import { logger } from "../../config/logger";
import { AppError, NotImplementedError } from "../../utils/errors";

/**
 * Único punto de acceso a Prisma (y a Redis) para el módulo `perfiles`.
 * Ni el controlador ni el servicio hablan con la base de datos directamente.
 */

/** Campos del perfil del jugador que puede ver su dueño. */
const seleccionJugador = {
  id: true,
  usuarioId: true,
  bio: true,
  pais: true,
  departamento: true,
  disponibilidadHoras: true,
  dispuestoRelocalizar: true,
  avatarUrl: true,
  creadoEn: true,
  actualizadoEn: true,
} satisfies Prisma.PerfilJugadorSelect;

/** Campos del perfil del equipo que puede ver su dueño. */
const seleccionEquipo = {
  id: true,
  usuarioId: true,
  nombreOrg: true,
  descripcion: true,
  sitioWeb: true,
  logoUrl: true,
  pais: true,
  departamento: true,
  creadoEn: true,
  actualizadoEn: true,
} satisfies Prisma.PerfilEquipoSelect;

/**
 * Campos del perfil público (lista blanca, RF-05). Sólo las cuentas
 * verificadas, y de ellas plataforma y fecha: nunca el id externo, el handle
 * ni los tokens.
 */
const seleccionJugadorPublico = {
  id: true,
  bio: true,
  pais: true,
  departamento: true,
  avatarUrl: true,
  usuario: { select: { nombre: true } },
  cuentasGaming: {
    where: { verificadaEn: { not: null } },
    select: { plataforma: true, verificadaEn: true },
    orderBy: { verificadaEn: "asc" },
  },
} satisfies Prisma.PerfilJugadorSelect;

export type PerfilJugadorDb = Prisma.PerfilJugadorGetPayload<{
  select: typeof seleccionJugador;
}>;
export type PerfilEquipoDb = Prisma.PerfilEquipoGetPayload<{
  select: typeof seleccionEquipo;
}>;

export type PerfilJugadorPublicoDb = Prisma.PerfilJugadorGetPayload<{
  select: typeof seleccionJugadorPublico;
}>;

/** Perfil público por id de perfil; nulo si no existe o la cuenta está inactiva. */
export async function buscarJugadorPublico(
  perfilId: string,
): Promise<PerfilJugadorPublicoDb | null> {
  return prisma.perfilJugador.findFirst({
    where: { id: perfilId, usuario: { activo: true } },
    select: seleccionJugadorPublico,
  });
}

export async function buscarJugadorPorUsuario(
  usuarioId: string,
): Promise<PerfilJugadorDb | null> {
  return prisma.perfilJugador.findUnique({
    where: { usuarioId },
    select: seleccionJugador,
  });
}

export async function buscarEquipoPorUsuario(
  usuarioId: string,
): Promise<PerfilEquipoDb | null> {
  return prisma.perfilEquipo.findUnique({
    where: { usuarioId },
    select: seleccionEquipo,
  });
}

export async function actualizarJugador(
  usuarioId: string,
  datos: Prisma.PerfilJugadorUpdateInput,
): Promise<PerfilJugadorDb> {
  return prisma.perfilJugador.update({
    where: { usuarioId },
    data: datos,
    select: seleccionJugador,
  });
}

export async function actualizarEquipo(
  usuarioId: string,
  datos: Prisma.PerfilEquipoUpdateInput,
): Promise<PerfilEquipoDb> {
  return prisma.perfilEquipo.update({
    where: { usuarioId },
    data: datos,
    select: seleccionEquipo,
  });
}

/** TODO: Devolver el catálogo de habilidades (técnicas y blandas). */
export async function catalogoHabilidades(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.catalogoHabilidades todavía no consulta la base de datos",
  );
}

/** TODO: Asociar una habilidad al perfil del jugador con su nivel 1-5. */
export async function asignarHabilidad(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.asignarHabilidad todavía no consulta la base de datos",
  );
}

/** TODO: Registrar el endorsement de una HabilidadJugador por parte de otro usuario. */
export async function endosar(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.endosar todavía no consulta la base de datos",
  );
}

/** TODO: Vincular una cuenta externa vía OAuth y guardar sus tokens cifrados. */
export async function vincularCuenta(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.vincularCuenta todavía no consulta la base de datos",
  );
}

/** Campos de `CuentaGaming` que ve su dueño: nunca el puuid ni los tokens. */
const seleccionCuenta = {
  id: true,
  plataforma: true,
  handle: true,
  servidor: true,
  verificadaEn: true,
  sincronizadaEn: true,
  creadoEn: true,
} satisfies Prisma.CuentaGamingSelect;

export type CuentaGamingDb = Prisma.CuentaGamingGetPayload<{
  select: typeof seleccionCuenta;
}>;

export async function listarCuentas(jugadorId: string): Promise<CuentaGamingDb[]> {
  return prisma.cuentaGaming.findMany({
    where: { jugadorId },
    select: seleccionCuenta,
    orderBy: { creadoEn: "asc" },
  });
}

/** Dueño actual de una identidad externa (p. ej. un puuid), si la hay. */
export async function buscarDuenoCuenta(
  plataforma: Plataforma,
  externalId: string,
): Promise<{ jugadorId: string } | null> {
  return prisma.cuentaGaming.findUnique({
    where: { plataforma_externalId: { plataforma, externalId } },
    select: { jugadorId: true },
  });
}

/**
 * Guarda la cuenta verificada. Un jugador tiene como mucho una cuenta por
 * plataforma: si ya tenía otra **distinta** (otro puuid), se borra antes, y con
 * ella sus capturas de `Estadistica` (borrado en cascada por `cuentaId`), para
 * que sus datos no pasen por los de la cuenta nueva. Si es la misma cuenta, se
 * actualiza y sus capturas se conservan.
 */
export async function guardarCuentaVerificada(datos: {
  jugadorId: string;
  plataforma: Plataforma;
  externalId: string;
  handle: string;
  servidor: string;
  verificadaEn: Date;
}): Promise<CuentaGamingDb> {
  const { jugadorId, plataforma, ...resto } = datos;
  return prisma.$transaction(async (tx) => {
    const anterior = await tx.cuentaGaming.findUnique({
      where: { jugadorId_plataforma: { jugadorId, plataforma } },
      select: { id: true, externalId: true },
    });
    if (anterior && anterior.externalId !== resto.externalId) {
      await tx.cuentaGaming.delete({ where: { id: anterior.id } });
    }
    return tx.cuentaGaming.upsert({
      where: { jugadorId_plataforma: { jugadorId, plataforma } },
      create: { jugadorId, plataforma, ...resto },
      update: { ...resto },
      select: seleccionCuenta,
    });
  });
}

/**
 * Borra la cuenta y, en cascada por `cuentaId`, las capturas de `Estadistica`
 * que salieron de ella. Devuelve cuántas cuentas se borraron (0 o 1).
 */
export async function borrarCuenta(jugadorId: string, plataforma: Plataforma): Promise<number> {
  const { count } = await prisma.cuentaGaming.deleteMany({ where: { jugadorId, plataforma } });
  return count;
}

/** Traza de RF-14 / RNF-06: vincular y desvincular cuentas son tratamiento de datos. */
export async function registrarAuditoria(datos: {
  usuarioId: string;
  accion: string;
  entidadId: string | null;
  metadata: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: { ...datos, entidad: "CuentaGaming" },
  });
}

/* ------------------------ Desafío de verificación de Riot ------------------------ */

/**
 * El desafío activo de cada usuario vive en un hash de Redis que caduca con
 * él (docs/decisiones.md, «Desafío de Riot guardado en el servidor»):
 *
 * - `token`: el JWT del desafío (lleva el puuid y el icono pedido, firmados).
 * - `datos`: lo que ve el jugador (Riot ID, servidor, nivel, iconos, fechas).
 * - `comprobaciones`: cuántas veces se miró el icono en Riot.
 * - `ultimaComprobacionEn` (ms) e `iconoVisto`: el resultado de la última.
 *
 * Un usuario tiene como mucho uno: guardar otro lo sustituye.
 */
const claveDesafio = (usuarioId: string) => `proplay:riot:desafio:${usuarioId}`;

/** Lo que se guarda del desafío además del token y de las comprobaciones. */
export interface DatosDesafioRiot {
  riotId: string;
  servidor: string;
  nivelInvocador: number;
  iconoActual: number;
  iconoRequerido: number;
  creadoEn: string;
  expiraEn: string;
}

export interface DesafioRiotGuardado {
  token: string;
  datos: DatosDesafioRiot;
  comprobaciones: number;
  ultimaComprobacionEn: Date | null;
  iconoVisto: number | null;
}

/** Redis caído no es un 500 sin explicación: es un servicio no disponible. */
async function conRedis<T>(operacion: (redis: Awaited<ReturnType<typeof clienteRedis>>) => Promise<T>): Promise<T> {
  try {
    return await operacion(await clienteRedis());
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, "Error de Redis con el desafío de Riot");
    throw new AppError(
      503,
      "SERVICIO_NO_DISPONIBLE",
      "No pudimos acceder al desafío de verificación en este momento; inténtalo en unos segundos",
    );
  }
}

/** Sustituye el desafío del usuario y lo hace caducar en `expiraEn`. */
export async function guardarDesafioRiot(
  usuarioId: string,
  token: string,
  datos: DatosDesafioRiot,
): Promise<void> {
  const clave = claveDesafio(usuarioId);
  await conRedis((redis) =>
    redis
      .multi()
      .del(clave)
      .hset(clave, { token, datos: JSON.stringify(datos), comprobaciones: 0 })
      .pexpireat(clave, new Date(datos.expiraEn).getTime())
      .exec(),
  );
}

export async function leerDesafioRiot(usuarioId: string): Promise<DesafioRiotGuardado | null> {
  const campos = await conRedis((redis) => redis.hgetall(claveDesafio(usuarioId)));
  if (!campos.token || !campos.datos) return null;
  const ultima = Number(campos.ultimaComprobacionEn);
  const visto = Number(campos.iconoVisto);
  return {
    token: campos.token,
    datos: JSON.parse(campos.datos) as DatosDesafioRiot,
    comprobaciones: Number(campos.comprobaciones) || 0,
    ultimaComprobacionEn: ultima > 0 ? new Date(ultima) : null,
    iconoVisto: campos.iconoVisto !== undefined && Number.isInteger(visto) ? visto : null,
  };
}

/**
 * Apunta una comprobación del desafío, de forma atómica: sólo si el token
 * sigue siendo el activo, si la anterior tiene al menos `minimoMs` y si no se
 * agotó el cupo. Así dos pestañas o dos clics a la vez no cuentan doble ni se
 * saltan el máximo.
 */
const SCRIPT_COMPROBACION = `
local token = redis.call('HGET', KEYS[1], 'token')
if not token then return 'NINGUNO' end
if token ~= ARGV[1] then return 'OTRO' end
local ahora = tonumber(ARGV[2])
local ultima = tonumber(redis.call('HGET', KEYS[1], 'ultimaComprobacionEn') or '0')
if ultima > 0 and ahora - ultima < tonumber(ARGV[4]) then return 'PRONTO' end
local hechas = tonumber(redis.call('HGET', KEYS[1], 'comprobaciones') or '0')
if hechas >= tonumber(ARGV[3]) then return 'AGOTADO' end
redis.call('HINCRBY', KEYS[1], 'comprobaciones', 1)
redis.call('HSET', KEYS[1], 'ultimaComprobacionEn', ARGV[2])
return 'OK:' .. tostring(ultima)
`;

export type ResultadoAnotarComprobacion =
  /** Anotada; `anterior` (ms, 0 si no había) sirve para devolverla. */
  | { estado: "OK"; anterior: number }
  | { estado: "NINGUNO" | "OTRO" | "PRONTO" | "AGOTADO" };

export async function anotarComprobacionRiot(
  usuarioId: string,
  token: string,
  opciones: { ahora: Date; maximo: number; minimoMs: number },
): Promise<ResultadoAnotarComprobacion> {
  const resultado = String(
    await conRedis((redis) =>
      redis.eval(
        SCRIPT_COMPROBACION,
        1,
        claveDesafio(usuarioId),
        token,
        opciones.ahora.getTime(),
        opciones.maximo,
        opciones.minimoMs,
      ),
    ),
  );
  if (resultado.startsWith("OK:")) return { estado: "OK", anterior: Number(resultado.slice(3)) || 0 };
  return { estado: resultado as "NINGUNO" | "OTRO" | "PRONTO" | "AGOTADO" };
}

/**
 * Deshace una comprobación anotada que no llegó a consultar a Riot (no había
 * cupo): resta una y repone la hora de la anterior. Sólo si el token sigue
 * siendo el activo.
 */
const SCRIPT_DEVOLVER_COMPROBACION = `
if redis.call('HGET', KEYS[1], 'token') ~= ARGV[1] then return 0 end
redis.call('HINCRBY', KEYS[1], 'comprobaciones', -1)
if tonumber(ARGV[2]) > 0 then
  redis.call('HSET', KEYS[1], 'ultimaComprobacionEn', ARGV[2])
else
  redis.call('HDEL', KEYS[1], 'ultimaComprobacionEn')
end
return 1
`;

export async function devolverComprobacionRiot(
  usuarioId: string,
  token: string,
  anterior: number,
): Promise<void> {
  await conRedis((redis) =>
    redis.eval(SCRIPT_DEVOLVER_COMPROBACION, 1, claveDesafio(usuarioId), token, anterior),
  );
}

/** Guarda el icono que vio Riot, si el desafío sigue siendo el mismo (no lo resucita). */
const SCRIPT_ICONO_VISTO = `
if redis.call('HGET', KEYS[1], 'token') ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[1], 'iconoVisto', ARGV[2])
return 1
`;

export async function anotarIconoVistoRiot(
  usuarioId: string,
  token: string,
  icono: number,
): Promise<void> {
  await conRedis((redis) => redis.eval(SCRIPT_ICONO_VISTO, 1, claveDesafio(usuarioId), token, icono));
}

/** Borra el desafío; con `token`, sólo si sigue siendo ése (no el que lo sustituyó). */
const SCRIPT_BORRAR_SI_ES = `
if redis.call('HGET', KEYS[1], 'token') ~= ARGV[1] then return 0 end
return redis.call('DEL', KEYS[1])
`;

export async function borrarDesafioRiot(usuarioId: string, token?: string): Promise<void> {
  const clave = claveDesafio(usuarioId);
  await conRedis((redis) =>
    token ? redis.eval(SCRIPT_BORRAR_SI_ES, 1, clave, token) : redis.del(clave),
  );
}

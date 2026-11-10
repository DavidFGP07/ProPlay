import { JUEGO_PILOTO, MINUTOS_ENTRE_SINCRONIZACIONES } from "@proplay/shared";
import { env } from "../../config/env";
import { colaIngesta, type OrigenSincronizacion } from "../../ingesta/cola";
import {
  esServidorLol,
  estadoClaveRiot,
  obtenerProveedor,
  obtenerProveedorRiot,
  type NovedadesRiot,
} from "../../integrations";
import { descifrarOpcional } from "../../utils/crypto";
import {
  AppError,
  IntegracionRiotNoDisponibleError,
  NotFoundError,
  NotImplementedError,
  TooManyRequestsError,
} from "../../utils/errors";
import * as repositorio from "./estadisticas.repository";
import type {
  Estadistica,
  EstadoSincronizacion,
  ListarEstadisticasQuery,
  ResumenEstadisticas,
  SincronizarEstadisticasInput,
} from "./estadisticas.schema";

/**
 * Lógica de negocio del módulo `estadisticas`: ingesta desde la plataforma
 * del juego (RF-03), métricas normalizadas (RF-04) y su consulta.
 *
 * La ingesta va por la cola de `src/ingesta/` (docs/decisiones.md, «Cuota de
 * Riot e ingesta»): el jugador la pide y se encola con prioridad; el worker la
 * ejecuta con `sincronizarCuenta` cuando hay cupo en la cuota de Riot, y el
 * planificador encola cada `INGESTA_INTERVALO_HORAS` a todos los verificados.
 */

/** Tope de capturas que devuelve un listado: ~3 meses sincronizando a diario. */
const LIMITE_LISTADO = 100;

function aRespuesta(fila: repositorio.EstadisticaDb): Estadistica {
  const metricas =
    fila.metricas && typeof fila.metricas === "object" && !Array.isArray(fila.metricas)
      ? (fila.metricas as Record<string, unknown>)
      : null;
  return { ...fila, metricas };
}

function comoObjeto(metricas: unknown): Record<string, unknown> {
  return metricas && typeof metricas === "object" && !Array.isArray(metricas)
    ? (metricas as Record<string, unknown>)
    : {};
}

/** Identificador de la partida más reciente analizada en una captura. */
function ultimaPartida(metricas: unknown): unknown {
  return comoObjeto(metricas).ultimaPartidaId;
}

/** Fin de la partida más reciente analizada, si la captura lo trae. */
function finUltimaPartida(metricas: unknown): Date | null {
  const valor = comoObjeto(metricas).ultimaPartidaEn;
  const fecha = typeof valor === "string" || valor instanceof Date ? new Date(valor) : null;
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
}

/** Liga, división y LP de una cola: lo que cambia el rango aunque no se juegue. */
function huellaRango(rango: unknown): string {
  const r = comoObjeto(rango);
  return JSON.stringify([r.liga ?? null, r.division ?? null, r.puntosLiga ?? null]);
}

/**
 * true si el rango (solo/dúo o Flex, con LP) cambió respecto a la captura.
 * Puede cambiar sin partidas nuevas: pérdida de LP por inactividad.
 */
function rangoCambio(
  anterior: unknown,
  actual: { rangoSoloDuo?: unknown; rangoFlex?: unknown },
): boolean {
  const previa = comoObjeto(anterior);
  return (
    huellaRango(previa.rangoSoloDuo) !== huellaRango(actual.rangoSoloDuo) ||
    huellaRango(previa.rangoFlex) !== huellaRango(actual.rangoFlex)
  );
}

/** Captura nueva igual a la anterior salvo el rango (sin partidas nuevas). */
function capturaConRango(
  anterior: repositorio.EstadisticaDb,
  rangos: NovedadesRiot["rangos"],
  ahora: Date,
): repositorio.NuevaEstadistica {
  return {
    juego: anterior.juego,
    rol: anterior.rol,
    rango: rangos.rango,
    partidas: anterior.partidas,
    victorias: anterior.victorias,
    kda: anterior.kda,
    winRate: anterior.winRate,
    metricas: JSON.parse(
      JSON.stringify({
        ...comoObjeto(anterior.metricas),
        rangoSoloDuo: rangos.rangoSoloDuo,
        rangoFlex: rangos.rangoFlex,
      }),
    ) as repositorio.NuevaEstadistica["metricas"],
    capturadaEn: ahora,
  };
}

async function cuentaRiotDelUsuario(usuarioId: string, datos: SincronizarEstadisticasInput) {
  const jugadorId = await repositorio.idJugadorDeUsuario(usuarioId);
  if (!jugadorId) throw new NotFoundError("Este usuario no tiene perfil de jugador");

  if (datos.plataforma !== "RIOT") {
    throw new NotImplementedError("Por ahora sólo se sincroniza desde Riot (League of Legends)");
  }

  const cuenta = await repositorio.cuentaVerificada(jugadorId, datos.plataforma);
  if (!cuenta) {
    throw new AppError(
      409,
      "CUENTA_NO_VINCULADA",
      "Primero vincula y verifica tu cuenta de Riot en «Cuentas vinculadas»",
    );
  }
  return { jugadorId, cuenta };
}

/**
 * RF-03 · El jugador pide sincronizar: se encola con prioridad sobre las
 * periódicas y se responde enseguida con el estado (202). Si ya estaba en la
 * cola no se añade otra. Sin clave de Riot válida, «inténtalo más tarde»; la
 * espera de `MINUTOS_ENTRE_SINCRONIZACIONES` sigue valiendo.
 */
export async function solicitarSincronizacion(
  usuarioId: string,
  datos: SincronizarEstadisticasInput,
): Promise<EstadoSincronizacion> {
  const { jugadorId, cuenta } = await cuentaRiotDelUsuario(usuarioId, datos);
  if ((await estadoClaveRiot.estado(env.RIOT_API_KEY)) !== "ok") {
    throw new IntegracionRiotNoDisponibleError();
  }

  const cola = colaIngesta();
  const actual = await cola.estado(jugadorId, cuenta.sincronizadaEn);
  if (actual.estado !== "INACTIVA") return actual;

  const esperaMs = MINUTOS_ENTRE_SINCRONIZACIONES * 60_000;
  const ultimo = cuenta.intentoSincronizacionEn;
  const faltaMs = ultimo ? ultimo.getTime() + esperaMs - Date.now() : 0;
  if (faltaMs > 0) {
    throw new TooManyRequestsError(
      `Ya intentaste sincronizar hace poco; puedes volver a hacerlo en ${Math.ceil(faltaMs / 60_000)} min`,
      { reintentarEnSegundos: Math.ceil(faltaMs / 1000) },
    );
  }

  await cola.encolar(jugadorId, "MANUAL");
  return cola.estado(jugadorId, cuenta.sincronizadaEn);
}

/** RF-03 · Estado de la sincronización del jugador autenticado. */
export async function consultarSincronizacion(
  usuarioId: string,
  datos: SincronizarEstadisticasInput,
): Promise<EstadoSincronizacion> {
  const { jugadorId, cuenta } = await cuentaRiotDelUsuario(usuarioId, datos);
  return colaIngesta().estado(jugadorId, cuenta.sincronizadaEn);
}

/** Jugadores a los que toca la sincronización periódica. */
export async function jugadoresPendientesDeSincronizar(): Promise<string[]> {
  const antesDe = new Date(Date.now() - env.INGESTA_INTERVALO_HORAS * 3_600_000);
  return repositorio.jugadoresParaSincronizar("RIOT", antesDe);
}

export type ResultadoSincronizarCuenta = "NUEVAS" | "SIN_CAMBIOS" | "OMITIDA";

/**
 * Sincroniza la cuenta de Riot del jugador; lo ejecuta el worker de la cola.
 * Cada sincronización con datos nuevos crea una **captura nueva** y nunca
 * sobrescribe las anteriores: la tendencia y la analítica salen de ese
 * historial. Hay captura nueva si hay partidas nuevas **o si cambió el rango**
 * (con LP; puede bajar sin jugar, por inactividad). Si no cambió nada, sólo se
 * actualiza `sincronizadaEn`.
 *
 * La periódica empieza por la comprobación barata (`novedades`, 3 peticiones):
 * sin partidas nuevas no descarga las 20. Como mucho una vez cada
 * `MINUTOS_ENTRE_SINCRONIZACIONES`, contando también los intentos fallidos
 * (`OMITIDA` si llega antes). Los errores de Riot se propagan: el worker
 * decide si reprograma (sin cupo, clave caducada) o reintenta.
 */
export async function sincronizarCuenta(
  jugadorId: string,
  origen: OrigenSincronizacion,
): Promise<ResultadoSincronizarCuenta> {
  const cuenta = await repositorio.cuentaVerificada(jugadorId, "RIOT");
  if (!cuenta) return "OMITIDA";

  const ahora = new Date();
  const reservado = await repositorio.reservarIntentoSincronizacion(
    cuenta.id,
    ahora,
    new Date(ahora.getTime() - MINUTOS_ENTRE_SINCRONIZACIONES * 60_000),
  );
  if (!reservado) return "OMITIDA";

  const anterior = await repositorio.ultimaEstadistica(jugadorId, JUEGO_PILOTO, "RIOT");
  const desde = anterior ? finUltimaPartida(anterior.metricas) : null;

  if (origen === "PERIODICA" && anterior && desde && esServidorLol(cuenta.servidor)) {
    const novedades = await obtenerProveedorRiot().novedades(
      cuenta.externalId,
      cuenta.servidor,
      desde,
    );
    if (!novedades.partidasNuevas) {
      const nuevas = rangoCambio(anterior.metricas, novedades.rangos)
        ? [capturaConRango(anterior, novedades.rangos, ahora)]
        : [];
      await repositorio.guardarSincronizacion({
        jugadorId,
        cuentaId: cuenta.id,
        fuente: "RIOT",
        nuevas,
        sincronizadaEn: ahora,
      });
      return nuevas.length > 0 ? "NUEVAS" : "SIN_CAMBIOS";
    }
  }

  const externas = await obtenerProveedor("RIOT").obtenerEstadisticas({
    externalId: cuenta.externalId,
    accessToken: descifrarOpcional(cuenta.accessToken),
    juego: JUEGO_PILOTO,
    region: cuenta.servidor,
  });

  const nuevas: repositorio.NuevaEstadistica[] = [];
  for (const externa of externas) {
    const previa =
      externa.juego === JUEGO_PILOTO
        ? anterior
        : await repositorio.ultimaEstadistica(jugadorId, externa.juego, "RIOT");
    const partidaNueva =
      ultimaPartida(externa.metricas) === undefined ||
      ultimaPartida(previa?.metricas) !== ultimaPartida(externa.metricas);
    if (previa && !partidaNueva && !rangoCambio(previa.metricas, comoObjeto(externa.metricas))) {
      continue;
    }
    nuevas.push({
      juego: externa.juego,
      rol: externa.rol,
      rango: externa.rango,
      partidas: externa.partidas,
      victorias: externa.victorias,
      kda: externa.kda,
      winRate: externa.winRate,
      // Pasa por JSON para que las fechas queden como texto ISO en la columna Json.
      metricas: JSON.parse(JSON.stringify(externa.metricas)) as repositorio.NuevaEstadistica["metricas"],
      capturadaEn: externa.capturadaEn,
    });
  }

  await repositorio.guardarSincronizacion({
    jugadorId,
    cuentaId: cuenta.id,
    fuente: "RIOT",
    nuevas,
    sincronizadaEn: ahora,
  });
  return nuevas.length > 0 ? "NUEVAS" : "SIN_CAMBIOS";
}

async function exigirJugador(jugadorId: string): Promise<void> {
  if (!(await repositorio.existeJugadorActivo(jugadorId))) {
    throw new NotFoundError("Jugador no encontrado");
  }
}

/** Histórico de capturas de un jugador (id de `PerfilJugador`), filtrable. */
export async function listarPorJugador(
  jugadorId: string,
  filtro: ListarEstadisticasQuery,
): Promise<Estadistica[]> {
  await exigirJugador(jugadorId);
  const filas = await repositorio.listarPorJugador(jugadorId, filtro, LIMITE_LISTADO);
  return filas.map(aRespuesta);
}

const diferencia = (actual: number | null, anterior: number | null): number | null =>
  actual === null || anterior === null ? null : Math.round((actual - anterior) * 10_000) / 10_000;

const numeroDeMetricas = (metricas: Record<string, unknown> | null, clave: string) => {
  const valor = metricas?.[clave];
  return typeof valor === "number" ? valor : null;
};

/**
 * Última captura de cada juego con la variación frente a la anterior: es la
 * tendencia del rendimiento (indicador de analítica de Mis estadísticas).
 */
export async function resumenPorJugador(jugadorId: string): Promise<ResumenEstadisticas> {
  await exigirJugador(jugadorId);
  const filas = (await repositorio.dosUltimasPorJuego(jugadorId)).map(aRespuesta);

  const grupos = new Map<string, Estadistica[]>();
  for (const fila of filas) {
    const clave = `${fila.fuente}:${fila.juego}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), fila]);
  }

  const juegos = [...grupos.values()].map((grupo) => {
    const [actual, anterior = null] = [...grupo].sort(
      (a, b) => b.capturadaEn.getTime() - a.capturadaEn.getTime(),
    ) as [Estadistica, Estadistica?];
    return {
      juego: actual.juego,
      fuente: actual.fuente,
      actual,
      anterior,
      tendencia: {
        winRate: diferencia(actual.winRate, anterior?.winRate ?? null),
        kda: diferencia(actual.kda, anterior?.kda ?? null),
        csPorMinuto: diferencia(
          numeroDeMetricas(actual.metricas, "csPorMinuto"),
          anterior ? numeroDeMetricas(anterior.metricas, "csPorMinuto") : null,
        ),
      },
    };
  });

  return { jugadorId, juegos };
}

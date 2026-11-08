import { MINUTOS_ENTRE_SINCRONIZACIONES } from "@proplay/shared";
import { obtenerProveedor } from "../../integrations";
import { descifrarOpcional } from "../../utils/crypto";
import {
  AppError,
  NotFoundError,
  NotImplementedError,
  TooManyRequestsError,
} from "../../utils/errors";
import * as repositorio from "./estadisticas.repository";
import type {
  Estadistica,
  ListarEstadisticasQuery,
  ResumenEstadisticas,
  SincronizarEstadisticasInput,
  SincronizarEstadisticasRespuesta,
} from "./estadisticas.schema";

/**
 * Lógica de negocio del módulo `estadisticas`: ingesta desde la plataforma
 * del juego (RF-03), métricas normalizadas (RF-04) y su consulta.
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

/** Identificador de la partida más reciente analizada en una captura. */
function ultimaPartida(metricas: unknown): unknown {
  return metricas && typeof metricas === "object"
    ? (metricas as Record<string, unknown>).ultimaPartidaId
    : undefined;
}

/**
 * Descarga las estadísticas del jugador autenticado desde la plataforma y
 * guarda una captura nueva por juego. Si la plataforma no tiene partidas
 * nuevas desde la última captura, no duplica la fila: sólo actualiza la fecha
 * de sincronización.
 */
export async function sincronizar(
  usuarioId: string,
  datos: SincronizarEstadisticasInput,
): Promise<SincronizarEstadisticasRespuesta> {
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

  const ahora = new Date();
  if (cuenta.sincronizadaEn) {
    const faltaMs =
      cuenta.sincronizadaEn.getTime() + MINUTOS_ENTRE_SINCRONIZACIONES * 60_000 - ahora.getTime();
    if (faltaMs > 0) {
      throw new TooManyRequestsError(
        `Ya sincronizaste hace poco; puedes volver a hacerlo en ${Math.ceil(faltaMs / 60_000)} min`,
        { reintentarEnSegundos: Math.ceil(faltaMs / 1000) },
      );
    }
  }

  const externas = await obtenerProveedor(datos.plataforma).obtenerEstadisticas({
    externalId: cuenta.externalId,
    accessToken: descifrarOpcional(cuenta.accessToken),
    juego: datos.juego,
    region: cuenta.servidor,
  });

  const nuevas: repositorio.NuevaEstadistica[] = [];
  const sinCambios: repositorio.EstadisticaDb[] = [];
  for (const externa of externas) {
    const anterior = await repositorio.ultimaEstadistica(jugadorId, externa.juego, datos.plataforma);
    const mismaPartida =
      anterior !== null &&
      ultimaPartida(externa.metricas) !== undefined &&
      ultimaPartida(anterior.metricas) === ultimaPartida(externa.metricas);
    if (anterior && mismaPartida) {
      sinCambios.push(anterior);
      continue;
    }
    nuevas.push({
      juego: externa.juego,
      rol: externa.rol,
      partidas: externa.partidas,
      victorias: externa.victorias,
      kda: externa.kda,
      winRate: externa.winRate,
      // Pasa por JSON para que las fechas queden como texto ISO en la columna Json.
      metricas: JSON.parse(JSON.stringify(externa.metricas)) as repositorio.NuevaEstadistica["metricas"],
      capturadaEn: externa.capturadaEn,
    });
  }

  const creadas = await repositorio.guardarSincronizacion({
    jugadorId,
    cuentaId: cuenta.id,
    fuente: datos.plataforma,
    nuevas,
    sincronizadaEn: ahora,
  });

  return {
    estadisticas: [...creadas, ...sinCambios].map(aRespuesta),
    hayDatosNuevos: creadas.length > 0,
    sincronizadaEn: ahora,
  };
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

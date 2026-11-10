import type {
  Departamento,
  Modalidad,
  MotivoDimension,
  PesosMatching,
  PosicionLol,
  RangoLol,
} from "@proplay/shared";

/**
 * Entradas y salidas del motor de matching. Son datos planos, ya leídos de la
 * base por el repositorio: el motor no consulta nada ni llama a la red.
 */

/** Métricas de la última captura verificada que usa el motor. */
export interface MetricasCaptura {
  winRate: number;
  kda: number;
  csPorMinuto: number | null;
  oroPorMinuto: number | null;
  danoPorMinuto: number | null;
  visionPorMinuto: number | null;
  participacionKills: number | null;
}

/** Última captura de LoL con fuente RIOT de una cuenta verificada. */
export interface CapturaVerificada {
  /** Posición más jugada en solo/dúo (`Estadistica.rol`). */
  posicion: PosicionLol | null;
  rango: RangoLol | null;
  /** Partidas en que se calcularon las métricas (`metricas.partidasAnalizadas` o `partidas`). */
  partidasAnalizadas: number;
  /** Partidas de solo/dúo de la temporada (victorias + derrotas de league-v4), si se conocen. */
  partidasTemporada: number | null;
  /** Partidas de solo/dúo por posición (`metricas.distribucionRoles`). */
  distribucionRoles: Partial<Record<PosicionLol, number>> | null;
  metricas: MetricasCaptura;
  capturadaEn: Date;
}

export interface JugadorMotor {
  jugadorId: string;
  /** Tiene una `CuentaGaming` RIOT con `verificadaEn`. */
  verificado: boolean;
  /** Nula si no está verificado o aún no tiene captura. */
  captura: CapturaVerificada | null;
  pais: string | null;
  departamento: Departamento | null;
  disponibilidadHoras: number | null;
  dispuestoRelocalizar: boolean;
  /**
   * Endorsements de usuarios con rol EQUIPO a cada habilidad `BLANDA` del
   * catálogo (un número por habilidad del catálogo, aunque sea 0).
   */
  endorsementsBlandas: number[];
}

export interface OfertaMotor {
  ofertaId: string;
  rol: PosicionLol;
  rangoMinimo: RangoLol | null;
  modalidad: Modalidad;
  pais: string | null;
  departamento: Departamento | null;
  horasSemana: number | null;
  pesos: PesosMatching;
}

/** Lo común a la salida de cada dimensión. */
export interface ResultadoBase {
  valor: number;
  faltanDatos: boolean;
  motivo: MotivoDimension | null;
}

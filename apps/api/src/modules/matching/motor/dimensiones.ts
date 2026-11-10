import {
  MACROREGION_POR_DEPARTAMENTO,
  VALOR_NEUTRO_DIMENSION,
  type CercaniaGeografica,
  type Departamento,
  type ExplicacionDisponibilidad,
  type ExplicacionExperiencia,
  type ExplicacionGeografica,
  type ExplicacionHabilidadesBlandas,
  type Modalidad,
} from "@proplay/shared";
import { clamp01 } from "./escalas";
import type { JugadorMotor, OfertaMotor } from "./tipos";

/**
 * RF-09 · Experiencia, habilidades blandas, geográfica y disponibilidad. La
 * técnica, que es la más larga, vive en `tecnica.ts`.
 */

// ------------------------------------------------------------ experiencia

/**
 * Experiencia: sin modelo de trayectoria (equipos, torneos, logros) en el
 * piloto, vale 0 con `SIN_DATOS_PILOTO`. Peso 0 por defecto (decisión «Motor de
 * matching»); queda en la ecuación para cuando haya datos.
 */
export function evaluarExperiencia(): { valor: number; explicacion: ExplicacionExperiencia } {
  return { valor: 0, explicacion: { faltanDatos: true, motivo: "SIN_DATOS_PILOTO" } };
}

// ---------------------------------------------------- habilidades blandas

/** Endorsements de equipos con los que una habilidad blanda cuenta entera. */
export const ENDORSEMENTS_PARA_SATURAR = 3;

/**
 * Habilidades blandas: media, sobre las habilidades `BLANDA` del catálogo, de
 * min(1, endorsements de equipos / 3). El nivel autodeclarado no cuenta. Sin
 * ningún endorsement, 0 con `SIN_ENDORSEMENTS`.
 */
export function evaluarHabilidadesBlandas(jugador: JugadorMotor): {
  valor: number;
  explicacion: ExplicacionHabilidadesBlandas;
} {
  const conteos = jugador.endorsementsBlandas;
  const total = conteos.reduce((s, n) => s + n, 0);
  if (conteos.length === 0 || total === 0) {
    return {
      valor: 0,
      explicacion: { faltanDatos: true, motivo: "SIN_ENDORSEMENTS", endorsementsDeEquipos: 0 },
    };
  }
  const valor =
    conteos.reduce((s, n) => s + Math.min(1, n / ENDORSEMENTS_PARA_SATURAR), 0) / conteos.length;
  return {
    valor: clamp01(valor),
    explicacion: { faltanDatos: false, motivo: null, endorsementsDeEquipos: total },
  };
}

// --------------------------------------------------------------- geográfica

/** Puntaje por cercanía en las ofertas con ubicación. */
export const PUNTAJE_CERCANIA: Record<Exclude<Modalidad, "REMOTA">, Record<CercaniaGeografica, number>> = {
  HIBRIDA: { MISMO_DEPARTAMENTO: 1, MISMA_MACRORREGION: 0.8, MISMO_PAIS: 0.5, OTRO_PAIS: 0.2 },
  PRESENCIAL: { MISMO_DEPARTAMENTO: 1, MISMA_MACRORREGION: 0.6, MISMO_PAIS: 0.3, OTRO_PAIS: 0.1 },
};

/** Mínimo con disposición a relocalizarse: no iguala al local, pero no lo deja lejos. */
export const MINIMO_CON_RELOCALIZACION: Record<Exclude<Modalidad, "REMOTA">, number> = {
  HIBRIDA: 0.85,
  PRESENCIAL: 0.75,
};

/**
 * Cercanía entre dos ubicaciones. En Colombia el nivel más fino es el
 * departamento; fuera de Colombia, el país (no hay departamento), así que el
 * mismo país cuenta como «mismo departamento».
 */
export function cercania(
  jugador: { pais: string; departamento: Departamento | null },
  oferta: { pais: string; departamento: Departamento | null },
): CercaniaGeografica {
  if (jugador.pais !== oferta.pais) return "OTRO_PAIS";
  if (jugador.pais !== "CO") return "MISMO_DEPARTAMENTO";
  if (jugador.departamento && jugador.departamento === oferta.departamento) {
    return "MISMO_DEPARTAMENTO";
  }
  if (
    jugador.departamento &&
    oferta.departamento &&
    MACROREGION_POR_DEPARTAMENTO[jugador.departamento] ===
      MACROREGION_POR_DEPARTAMENTO[oferta.departamento]
  ) {
    return "MISMA_MACRORREGION";
  }
  return "MISMO_PAIS";
}

/**
 * Geográfica: la ubicación del jugador frente a la modalidad y la ubicación de
 * la oferta, más la disposición a relocalizarse. Una oferta remota (o sin
 * ubicación) vale 1. Un jugador sin ubicación completa vale el neutro 0,5
 * con `SIN_UBICACION`.
 */
export function evaluarGeografica(
  jugador: JugadorMotor,
  oferta: OfertaMotor,
): { valor: number; explicacion: ExplicacionGeografica } {
  const modalidad = oferta.modalidad;
  if (modalidad === "REMOTA" || !oferta.pais) {
    return {
      valor: 1,
      explicacion: {
        faltanDatos: false,
        motivo: "OFERTA_REMOTA",
        modalidad,
        cercania: null,
        relocalizacionAplicada: false,
      },
    };
  }
  const ubicacionCompleta =
    jugador.pais !== null && (jugador.pais !== "CO" || jugador.departamento !== null);
  if (!ubicacionCompleta) {
    return {
      valor: VALOR_NEUTRO_DIMENSION,
      explicacion: {
        faltanDatos: true,
        motivo: "SIN_UBICACION",
        modalidad,
        cercania: null,
        relocalizacionAplicada: false,
      },
    };
  }
  const nivel = cercania(
    { pais: jugador.pais!, departamento: jugador.departamento },
    { pais: oferta.pais, departamento: oferta.departamento },
  );
  const base = PUNTAJE_CERCANIA[modalidad][nivel];
  const minimo = MINIMO_CON_RELOCALIZACION[modalidad];
  const relocalizacionAplicada = jugador.dispuestoRelocalizar && base < minimo;
  return {
    valor: relocalizacionAplicada ? minimo : base,
    explicacion: {
      faltanDatos: false,
      motivo: null,
      modalidad,
      cercania: nivel,
      relocalizacionAplicada,
    },
  };
}

// ----------------------------------------------------------- disponibilidad

/**
 * Disponibilidad: min(1, horas del jugador / horas que pide la oferta). Si la
 * oferta no pide horas, 1 (`OFERTA_SIN_HORAS`); si el jugador no las declaró,
 * el neutro 0,5 (`SIN_HORAS`).
 */
export function evaluarDisponibilidad(
  jugador: JugadorMotor,
  oferta: OfertaMotor,
): { valor: number; explicacion: ExplicacionDisponibilidad } {
  const horasJugador = jugador.disponibilidadHoras;
  const horasOferta = oferta.horasSemana;
  if (!horasOferta || horasOferta <= 0) {
    return {
      valor: 1,
      explicacion: { faltanDatos: false, motivo: "OFERTA_SIN_HORAS", horasJugador, horasOferta },
    };
  }
  if (horasJugador === null) {
    return {
      valor: VALOR_NEUTRO_DIMENSION,
      explicacion: { faltanDatos: true, motivo: "SIN_HORAS", horasJugador, horasOferta },
    };
  }
  return {
    valor: clamp01(horasJugador / horasOferta),
    explicacion: { faltanDatos: false, motivo: null, horasJugador, horasOferta },
  };
}

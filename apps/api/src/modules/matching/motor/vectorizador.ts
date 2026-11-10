import {
  MACROREGIONES,
  MACROREGION_POR_DEPARTAMENTO,
  METRICAS_TECNICA_LOL,
  PERFIL_VECTOR_DIMENSIONES,
  POSICIONES_LOL,
  type PosicionLol,
  type RangoLol,
} from "@proplay/shared";
import {
  INDICE_POSICION,
  INDICE_RANGO_MAXIMO,
  LIGAS_DEL_CATALOGO,
  METRICAS_POR_POSICION,
  PARTIDAS_VOLUMEN_MAXIMO,
  clamp01,
  escalaDe,
  indiceLiga,
  indiceRango,
  normalizar,
  winRateAjustado,
} from "./escalas";
import type { JugadorMotor, OfertaMotor } from "./tipos";

/**
 * RF-09 · Vectorizador de perfil, versión 2 (`PERFIL_VECTOR_VERSION`).
 *
 * El vector sirve para **recuperar** candidatos plausibles con el índice HNSW,
 * no para puntuar: el puntaje sale de las fórmulas de cada dimensión. Jugador y
 * oferta viven en el mismo espacio de 64 dimensiones:
 *
 *   0–4    posición: distribución de partidas (jugador) / la pedida (oferta)
 *   5      rango ordinal en el catálogo (0 a 1)
 *   6–15   liga, suavizada: ±1 liga = 0,5
 *   16–22  las 7 métricas de METRICAS_TECNICA_LOL, normalizadas (jugador) /
 *          1 en las que cuentan para la posición pedida (oferta)
 *   23     volumen de solo/dúo de la temporada (jugador) / 0,5 (oferta)
 *   24     cuenta verificada
 *   25–29  macrorregión (MACROREGIONES)
 *   30     fuera de Colombia
 *   31     dispuesto a relocalizarse (jugador) / oferta con ubicación (oferta)
 *   32     horas por semana / 40
 *   33     sesgo constante: ningún vector es nulo (pgvector no indexa vectores
 *          nulos con la distancia coseno)
 *   34–63  reservadas a 0 (trayectoria, endorsements, texto del perfil)
 *
 * En el vector de la oferta, cada bloque se multiplica por el peso de su
 * dimensión: la recuperación ya respeta lo que prioriza el equipo.
 */

export const BLOQUES = {
  posicion: 0,
  rango: 5,
  liga: 6,
  metricas: 16,
  volumen: 23,
  verificado: 24,
  macrorregion: 25,
  fueraDeColombia: 30,
  relocalizacion: 31,
  horas: 32,
  sesgo: 33,
} as const;

const SESGO = 0.1;
const HORAS_REFERENCIA = 40;

function vacio(): number[] {
  return new Array<number>(PERFIL_VECTOR_DIMENSIONES).fill(0);
}

/** Normaliza a norma 1 (la distancia coseno no lo necesita, pero deja el vector comparable). */
export function normaL2(v: number[]): number[] {
  const norma = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norma === 0 ? v : v.map((x) => x / norma);
}

function escribirLiga(v: number[], rango: RangoLol): void {
  const liga = indiceLiga(rango);
  for (let i = 0; i < LIGAS_DEL_CATALOGO; i++) {
    const distancia = Math.abs(i - liga);
    v[BLOQUES.liga + i] = distancia === 0 ? 1 : distancia === 1 ? 0.5 : 0;
  }
}

function escribirUbicacion(v: number[], pais: string | null, departamento: string | null): void {
  if (!pais) return;
  if (pais !== "CO") {
    v[BLOQUES.fueraDeColombia] = 1;
    return;
  }
  const macro = departamento
    ? MACROREGION_POR_DEPARTAMENTO[departamento as keyof typeof MACROREGION_POR_DEPARTAMENTO]
    : undefined;
  if (macro) v[BLOQUES.macrorregion + MACROREGIONES.indexOf(macro)] = 1;
}

/** Vector de un jugador a partir de su última captura verificada y su perfil. */
export function vectorizarJugador(jugador: JugadorMotor): number[] {
  const v = vacio();
  const captura = jugador.verificado ? jugador.captura : null;

  if (captura) {
    const distribucion = captura.distribucionRoles;
    const total = distribucion
      ? Object.values(distribucion).reduce((s, n) => s + (n ?? 0), 0)
      : 0;
    if (distribucion && total > 0) {
      for (const posicion of POSICIONES_LOL) {
        v[BLOQUES.posicion + INDICE_POSICION[posicion]] = (distribucion[posicion] ?? 0) / total;
      }
    } else if (captura.posicion) {
      v[BLOQUES.posicion + INDICE_POSICION[captura.posicion]] = 1;
    }
    if (captura.rango) {
      v[BLOQUES.rango] = indiceRango(captura.rango) / INDICE_RANGO_MAXIMO;
      escribirLiga(v, captura.rango);
    }
    METRICAS_TECNICA_LOL.forEach((metrica, i) => {
      const bruto = captura.metricas[metrica];
      if (typeof bruto !== "number" || !Number.isFinite(bruto)) return;
      const valor =
        metrica === "winRate" ? winRateAjustado(bruto, captura.partidasAnalizadas) : bruto;
      v[BLOQUES.metricas + i] = normalizar(valor, escalaDe(metrica, captura.posicion));
    });
    const partidas = captura.partidasTemporada ?? captura.partidasAnalizadas;
    v[BLOQUES.volumen] = clamp01(Math.log1p(partidas) / Math.log1p(PARTIDAS_VOLUMEN_MAXIMO));
  }
  v[BLOQUES.verificado] = jugador.verificado ? 1 : 0;

  escribirUbicacion(v, jugador.pais, jugador.departamento);
  v[BLOQUES.relocalizacion] = jugador.dispuestoRelocalizar ? 1 : 0;
  v[BLOQUES.horas] =
    jugador.disponibilidadHoras === null
      ? 0
      : clamp01(jugador.disponibilidadHoras / HORAS_REFERENCIA);
  v[BLOQUES.sesgo] = SESGO;
  return normaL2(v);
}

/** Vector de requisitos de una oferta, en el espacio de los jugadores. */
export function vectorizarOferta(oferta: OfertaMotor): number[] {
  const v = vacio();
  const { pesos } = oferta;

  v[BLOQUES.posicion + INDICE_POSICION[oferta.rol as PosicionLol]] = 1;
  if (oferta.rangoMinimo) {
    v[BLOQUES.rango] = indiceRango(oferta.rangoMinimo) / INDICE_RANGO_MAXIMO;
    escribirLiga(v, oferta.rangoMinimo);
  } else {
    v[BLOQUES.rango] = 0.5;
  }
  METRICAS_TECNICA_LOL.forEach((metrica, i) => {
    if (METRICAS_POR_POSICION[oferta.rol].includes(metrica)) v[BLOQUES.metricas + i] = 1;
  });
  v[BLOQUES.volumen] = 0.5;
  v[BLOQUES.verificado] = 1;
  for (let i = BLOQUES.posicion; i <= BLOQUES.verificado; i++) v[i] = v[i]! * pesos.tecnica;

  const conUbicacion = oferta.modalidad !== "REMOTA" && oferta.pais !== null;
  if (conUbicacion) {
    escribirUbicacion(v, oferta.pais, oferta.departamento);
    v[BLOQUES.relocalizacion] = 1;
  }
  for (let i = BLOQUES.macrorregion; i <= BLOQUES.relocalizacion; i++) {
    v[i] = v[i]! * pesos.geografica;
  }

  v[BLOQUES.horas] =
    (oferta.horasSemana ? clamp01(oferta.horasSemana / HORAS_REFERENCIA) : 0.5) *
    pesos.disponibilidad;
  v[BLOQUES.sesgo] = SESGO;
  return normaL2(v);
}

/** Similitud coseno, la misma que `1 - (a <=> b)` en pgvector. */
export function similitudCoseno(a: readonly number[], b: readonly number[]): number {
  let punto = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    punto += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na === 0 || nb === 0 ? 0 : punto / Math.sqrt(na * nb);
}

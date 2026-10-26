import {
  DIMENSIONES,
  PESOS_POR_DEFECTO,
  clamp01,
  evaluarDimension,
  normalizarPesos,
} from '@/lib/matching'
import {
  construirInteracciones,
  hayHistorialSuficiente,
  puntajeColaborativo,
  type Interaccion,
} from '@/lib/collaborative'
import {
  buscarPorSimilitud,
  vectorizarOferta,
  vectorizarPerfil,
} from '@/lib/vector'
import type {
  DesgloseDimension,
  DimensionKey,
  Endorsement,
  Estadistica,
  Habilidad,
  HabilidadJugador,
  Oferta,
  PerfilJugador,
  Pesos,
  Postulacion,
  ResultadoMatching,
} from '@/mocks/modelos'

/**
 * Orquestador del motor de matching (Nivel 3 del modelo C4).
 *
 * Reproduce el recorrido descrito en la Seccion VIII-C:
 *   Orquestador -> Vectorizador -> Recuperador por contenido (pgvector/HNSW)
 *               -> Componente colaborativo -> Ponderador de 5 dimensiones
 */

export interface MatchingContexto {
  perfiles: PerfilJugador[]
  estadisticas: Estadistica[]
  habilidades: Habilidad[]
  habilidadesJugador: HabilidadJugador[]
  endorsements: Endorsement[]
  postulaciones: Postulacion[]
  /** Ofertas publicadas: permiten resolver a que equipo pertenece cada postulacion. */
  ofertas: Oferta[]
}

export interface OpcionesRanking {
  pesos: Pesos
  /** Cuantos candidatos devuelve el recuperador por contenido (top-K del HNSW). */
  topK?: number
  /** Restringe el pool de candidatos (filtros de la UI de scouting). */
  candidatosIds?: string[]
}

export interface ResultadoRanking {
  resultados: ResultadoMatching[]
  /** Traza de ejecucion, mostrada en la UI para evidenciar el recorrido. */
  traza: {
    totalPerfiles: number
    recuperadosPorContenido: number
    coincidenciasVectoriales: number
    pesoColaborativo: number
    modo: 'hibrido' | 'contenido'
    latenciaMs: number
    indice: 'HNSW (pgvector)'
  }
}

/** Cache de embeddings por perfil (equivalente a la tabla PerfilVector). */
const cacheEmbeddings = new Map<string, number[]>()

/**
 * Invalida los embeddings calculados. Se invoca cuando el worker de ingesta
 * actualiza las estadisticas: el vector de perfil deriva de ellas, de modo que
 * un snapshot nuevo exige recalcular la representacion vectorial.
 */
export function invalidarCacheEmbeddings(): void {
  cacheEmbeddings.clear()
}

export function embeddingsDe(
  ctx: MatchingContexto,
  perfilId: string,
): number[] {
  const cached = cacheEmbeddings.get(perfilId)
  if (cached) return cached
  const perfil = ctx.perfiles.find((p) => p.id === perfilId)
  if (!perfil) return new Array(64).fill(0)
  const stats = ctx.estadisticas.filter((s) => s.perfilId === perfilId)
  const emb = vectorizarPerfil(perfil, stats)
  cacheEmbeddings.set(perfilId, emb)
  return emb
}

export function mapaEmbeddings(ctx: MatchingContexto): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (const p of ctx.perfiles) map.set(p.id, embeddingsDe(ctx, p.id))
  return map
}

export function calcularRanking(
  ctx: MatchingContexto,
  oferta: Oferta,
  opciones: OpcionesRanking,
): ResultadoRanking {
  const t0 = performance.now()
  const pesos = normalizarPesos(opciones.pesos)
  const topK = opciones.topK ?? 50

  const pool = opciones.candidatosIds
    ? ctx.perfiles.filter((p) => opciones.candidatosIds!.includes(p.id))
    : ctx.perfiles

  // 1) Recuperador por contenido: consulta de similitud sobre el indice HNSW.
  const vectorOferta = vectorizarOferta(oferta)
  const candidatos = pool.map((p) => ({
    perfil: p,
    embedding: embeddingsDe(ctx, p.id),
  }))
  const recuperados = buscarPorSimilitud(vectorOferta, candidatos, topK)
  // 2) Componente colaborativo: historial equipo-jugador.
  const equipoDeOferta = (ofertaId: string) =>
    ctx.ofertas.find((o) => o.id === ofertaId)?.equipoId
  const interacciones: Interaccion[] = construirInteracciones(
    ctx.postulaciones,
    equipoDeOferta,
  )
  const conHistorial = hayHistorialSuficiente(interacciones, oferta.equipoId)
  const colaborativo = conHistorial
    ? puntajeColaborativo(
        oferta.equipoId,
        mapaEmbeddings(ctx),
        interacciones,
      )
    : new Map<string, number>()
  const pesoColaborativo = conHistorial ? 0.15 : 0

  // 3) Ponderador: promedio ponderado de las cinco dimensiones.
  const resultados: ResultadoMatching[] = recuperados.map(({ item, similitud }) => {
    const perfil = item.perfil
    const stats = ctx.estadisticas.filter((s) => s.perfilId === perfil.id)
    const skills = ctx.habilidadesJugador
      .filter((h) => h.perfilId === perfil.id)
      .map((h) => ({ nivel: h.nivel, verificada: h.verificada }))
    const endoIds = new Set(
      ctx.habilidadesJugador
        .filter((h) => h.perfilId === perfil.id)
        .map((h) => h.id),
    )
    const endorsementCount = ctx.endorsements.filter((e) =>
      endoIds.has(e.habilidadJugadorId),
    ).length

    const desglose: DesgloseDimension[] = DIMENSIONES.map((d) => {
      const { valor, detalle } = evaluarDimension(d.key, {
        perfil,
        oferta,
        stats,
        endorsementCount,
        skills,
      })
      return {
        key: d.key,
        valor,
        peso: pesos[d.key],
        contribucion: valor * pesos[d.key],
        detalle,
      }
    })

    const base = desglose.reduce((acc, d) => acc + d.contribucion, 0)
    const colab = colaborativo.get(perfil.id) ?? 0
    const puntaje = clamp01(base * (1 - pesoColaborativo) + colab * pesoColaborativo)

    return {
      ofertaId: oferta.id,
      perfilId: perfil.id,
      puntaje,
      desglose,
      similitudVectorial: similitud,
      colaborativo: colab,
      pesoColaborativo,
      modo: conHistorial ? 'hibrido' : 'contenido',
      embedding: [],
    }
  })

  resultados.sort((a, b) => b.puntaje - a.puntaje)

  const latenciaMs = Math.round(performance.now() - t0)

  return {
    resultados,
    traza: {
      totalPerfiles: ctx.perfiles.length,
      recuperadosPorContenido: recuperados.length,
      coincidenciasVectoriales: recuperados.filter(
        (r) => r.similitud > 0.45,
      ).length,
      pesoColaborativo,
      modo: conHistorial ? 'hibrido' : 'contenido',
      latenciaMs,
      indice: 'HNSW (pgvector)',
    },
  }
}

/**
 * Calculador exacto: delega las operaciones numericas finales a un interprete
 * de Python aislado, siguiendo el patron de modelos de lenguaje asistidos por
 * programa (PAL). En el prototipo se replica la logica del calculador.
 */
export function calculoExacto(puntajes: number[]): number[] {
  // Redondeo a 6 decimales, equivalente a la precision del sandbox.
  return puntajes.map((p) => Math.round(p * 1e6) / 1e6)
}

export const PESOS_INICIALES = PESOS_POR_DEFECTO
export type { DimensionKey }

import type { Estadistica, Oferta, PerfilJugador } from '@/types'

/**
 * Capa de vectorizacion de perfiles.
 *
 * En el sistema real (Seccion IX) el perfil se persiste como `vector(64)` en
 * PostgreSQL con la extension pgvector y se recupera mediante un indice HNSW.
 * En este prototipo el embedding se calcula de forma determinista a partir de
 * las caracteristicas del perfil y la busqueda por similitud se ejecuta en
 * memoria, conservando exactamente la semantica cosine_distance <-> operators.
 */

export const DIMENSION_EMBEDDING = 64

const ROLES = [
  'Top lane',
  'Jungle',
  'Mid lane',
  'Bot lane',
  'Support',
  'Duelista',
  'Iniciador',
  'Controlador',
  'Sentinel',
  'Doble rol',
  'AWPer',
  'IGL',
  'Supporto',
  'Tanque',
  'Flex',
]

const REGIONES = [
  'Barranquilla',
  'Cartagena',
  'Santa Marta',
  'Cucuta',
  'Bucaramanga',
  'Medellin',
  'Bogota',
  'Cali',
]

const JUEGOS = [
  'League of Legends',
  'Valorant',
  'Counter-Strike 2',
  'Rocket League',
  'Dota 2',
]

/** PRNG determinista (mulberry32) para que el embedding sea reproducible. */
function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function l2Normalizar(v: number[]): number[] {
  const norma = Math.sqrt(v.reduce((a, b) => a + b * b, 0))
  if (norma === 0) return v
  return v.map((x) => x / norma)
}

/**
 * Construye el vector de perfil (64 dims) a partir de las caracteristicas
 * relevantes: juego, rol, rendimiento, experiencia, region y habilidades blandas.
 */
export function vectorizarPerfil(
  perfil: PerfilJugador,
  stats: Estadistica[],
): number[] {
  const v = new Array(DIMENSION_EMBEDDING).fill(0)
  const principal = stats[0]
  const rand = prng(hash(perfil.id))

  // Bloque 0-7: juego principal (one-hot).
  const juegoIdx = principal ? JUEGOS.indexOf(principal.juego) : -1
  if (juegoIdx >= 0) v[juegoIdx] = 1

  // Bloque 8-22: rol preferida (one-hot).
  const rol = principal?.rol ?? perfil.rolesPreferidos[0] ?? 'Flex'
  const rolIdx = ROLES.indexOf(rol)
  if (rolIdx >= 0) v[8 + rolIdx] = 1

  // Bloque 23-26: escalares de desempenho.
  v[23] = principal ? principal.winRate : 0
  v[24] = principal ? Math.min(principal.kda / 6, 1) : 0
  v[25] = principal ? Math.min(principal.partidas / 800, 1) : 0
  v[26] = Math.min(perfil.aniosExperiencia / 5, 1)

  // Bloque 27-34: region (one-hot).
  const regIdx = REGIONES.findIndex(
    (r) =>
      r.toLowerCase() ===
      perfil.region
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
  )
  if (regIdx >= 0) v[27 + regIdx] = 1

  // Bloque 35-38: contexto.
  v[35] = Math.min(perfil.horasDisponibles / 40, 1)
  v[36] = perfil.dispuestoARelocalizarse ? 1 : 0
  v[37] = Math.min(perfil.logros.length / 5, 1)
  v[38] = Math.min(perfil.equiposAnteriores.length / 4, 1)

  // Bloque 39-63: componente latente semantico (simula el texto del CV
  // codificado por el modelo de embeddings del proyecto real).
  for (let i = 39; i < DIMENSION_EMBEDDING; i++) {
    v[i] = rand() * 0.35
  }

  return l2Normalizar(v)
}

/** Vector de requisitos de una oferta, en el mismo espacio que los perfiles. */
export function vectorizarOferta(oferta: Oferta): number[] {
  const v = new Array(DIMENSION_EMBEDDING).fill(0)
  const rand = prng(hash(oferta.id))
  const juegoIdx = JUEGOS.indexOf(oferta.juego)
  if (juegoIdx >= 0) v[juegoIdx] = 1
  const rolIdx = ROLES.indexOf(oferta.rol)
  if (rolIdx >= 0) v[8 + rolIdx] = 1
  v[25] = 0.8
  v[38] = 0.6
  for (let i = 39; i < DIMENSION_EMBEDDING; i++) {
    v[i] = rand() * 0.35
  }
  return l2Normalizar(v)
}

/** Similitud coseno — equivalente a `1 - cosine_distance` en pgvector. */
export function similitudCoseno(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/**
 * Recuperacion por contenido. En produccion esto resuelve contra el indice
 * HNSW (`ORDER BY embedding <=> $1 LIMIT k`), que evita recorrer la tabla
 * completa. Aqui se ejecuta un barrido en memoria con la misma semantica.
 */
export function buscarPorSimilitud<T extends { embedding: number[] }>(
  consulta: number[],
  candidatos: T[],
  topK = 50,
): { item: T; similitud: number }[] {
  return candidatos
    .map((item) => ({ item, similitud: similitudCoseno(consulta, item.embedding) }))
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, topK)
}

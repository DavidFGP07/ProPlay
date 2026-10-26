import type {
  DimensionDef,
  DimensionKey,
  Oferta,
  PerfilJugador,
  Pesos,
} from '@/mocks/modelos'

/**
 * Las cinco dimensiones del motor de matching (Seccion VIII-C del documento).
 * Cada dimension produce un valor normalizado en [0, 1].
 */
export const DIMENSIONES: DimensionDef[] = [
  {
    key: 'tecnica',
    label: 'Tecnica',
    descripcion:
      'Estadisticas de rendimiento del jugador en los videojuegos y roles en los que participa.',
    icono: 'Crosshair',
  },
  {
    key: 'experiencia',
    label: 'Experiencia',
    descripcion:
      'Historial en equipos, torneos, competencias y logros obtenidos.',
    icono: 'Trophy',
  },
  {
    key: 'blandas',
    label: 'Habilidades blandas',
    descripcion:
      'Endorsements relacionados con comunicacion, trabajo en equipo y liderazgo.',
    icono: 'Users',
  },
  {
    key: 'geografica',
    label: 'Geografica',
    descripcion:
      'Region del jugador y disponibilidad para relocalizacion o participacion en linea.',
    icono: 'MapPin',
  },
  {
    key: 'disponibilidad',
    label: 'Disponibilidad',
    descripcion: 'Horarios de practica y preferencias de compromiso.',
    icono: 'Clock',
  },
]

export const PESOS_POR_DEFECTO: Pesos = {
  tecnica: 0.35,
  experiencia: 0.2,
  blandas: 0.15,
  geografica: 0.15,
  disponibilidad: 0.15,
}

/** Normaliza los pesos para que sumen 1 (restriccion de la ecuacion (1)). */
export function normalizarPesos(pesos: Pesos): Pesos {
  // Un peso negativo no es admisible en la ecuacion (1): se acota a cero
  // antes de calcular el total, de modo que el resultado siga siendo una
  // distribucion valida aunque el payload llegue malformado.
  const valor = (key: DimensionKey) => Math.max(0, pesos[key] || 0)
  const total = DIMENSIONES.reduce((acc, d) => acc + valor(d.key), 0)
  if (total <= 0) return { ...PESOS_POR_DEFECTO }
  const out = {} as Pesos
  for (const d of DIMENSIONES) {
    out[d.key] = valor(d.key) / total
  }
  return out
}

/**
 * Calcula el valor normalizado de una dimension.
 * Retorna { valor, detalle } donde `detalle` explica en lenguaje humano por que
 * quedo en ese valor (se usa luego en la explicacion del matching).
 */
export function evaluarDimension(
  key: DimensionKey,
  ctx: {
    perfil: PerfilJugador
    oferta: Oferta
    stats: import('@/mocks/modelos').Estadistica[]
    endorsementCount: number
    skills: { nivel: number; verificada: boolean }[]
  },
): { valor: number; detalle: string } {
  const { perfil, oferta, stats, endorsementCount, skills } = ctx

  switch (key) {
    case 'tecnica': {
      const s = stats.find((x) => x.juego === oferta.juego)
      if (!s) {
        return {
          valor: 0,
          detalle: `Sin estadisticas verificadas para ${oferta.juego}.`,
        }
      }
      // Componente de rendimiento (win rate) + ajuste por rol y rango.
      const rolCoincide = s.rol.toLowerCase() === oferta.rol.toLowerCase()
      const rangoOk = compararRango(s.rango, oferta.rangoMinimo)
      let v = s.winRate * 0.6 + Math.min(s.kda / 5, 1) * 0.4
      if (rolCoincide) v += 0.08
      if (rangoOk) v += 0.05
      v = clamp01(v)
      return {
        valor: v,
        detalle: `Win rate ${pct(s.winRate)} y KDA ${s.kda.toFixed(2)} en ${s.juego} (${s.rol})${rolCoincide ? ', rol coincidente' : ''}${rangoOk ? ', rango suficiente' : ''}.`,
      }
    }

    case 'experiencia': {
      const anios = Math.min(perfil.aniosExperiencia / 4, 1)
      const equipos = Math.min(perfil.equiposAnteriores.length / 3, 1)
      const logros = Math.min(perfil.logros.length / 4, 1)
      const v = clamp01(anios * 0.4 + equipos * 0.3 + logros * 0.3)
      return {
        valor: v,
        detalle: `${perfil.aniosExperiencia} anos de experiencia, ${perfil.equiposAnteriores.length} equipos previos y ${perfil.logros.length} logros registrados.`,
      }
    }

    case 'blandas': {
      const validadas = skills.filter((s) => s.verificada)
      const promNivel =
        validadas.length > 0
          ? validadas.reduce((a, s) => a + s.nivel, 0) / validadas.length / 5
          : 0
      const conf = Math.min(endorsementCount / 5, 1)
      const v = clamp01(promNivel * 0.6 + conf * 0.4)
      return {
        valor: v,
        detalle:
          validadas.length > 0
            ? `${validadas.length} habilidades validadas por terceros (${endorsementCount} endorsements en total).`
            : 'Sin habilidades blandas validadas por terceros.',
      }
    }

    case 'geografica': {
      let v: number
      if (oferta.regionPreferida === 'Cualquiera') {
        v = 0.85
      } else if (perfil.region === oferta.regionPreferida) {
        v = 1
      } else if (perfil.esCaribe && esCaribe(oferta.regionPreferida)) {
        v = 0.6
      } else {
        v = 0.25
      }
      if (perfil.dispuestoARelocalizarse) v = clamp01(v + 0.15)
      return {
        valor: v,
        detalle:
          oferta.regionPreferida === 'Cualquiera'
            ? `La oferta no restringe region; el jugador esta en ${perfil.region}.`
            : `El jugador esta en ${perfil.region} y la oferta pide ${oferta.regionPreferida}${perfil.dispuestoARelocalizarse ? ', con disposicion a relocalizarse' : ''}.`,
      }
    }

    case 'disponibilidad': {
      const required = oferta.horasSemanales
      const available = perfil.horasDisponibles
      const v = clamp01(available / Math.max(required, 1))
      return {
        valor: v,
        detalle: `${available} h disponibles frente a las ${required} h semanales requeridas por la oferta.`,
      }
    }
  }
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

/** Compara un rango de la oferta contra el rango real del jugador. */
export function compararRango(rango: string, minimo: string): boolean {
  const orden = [
    'Hierro',
    'Bronce',
    'Plata',
    'Oro',
    'Platino',
    'Diamante',
    'Ascendente',
    'Inmortal',
    'Radiante',
    'Gran Maestro',
    'Rey',
  ]
  const normalizar = (r: string) =>
    orden.findIndex((o) => r.toLowerCase().includes(o.toLowerCase()))
  const i = normalizar(rango)
  const j = normalizar(minimo)
  if (i < 0 || j < 0) return true
  return i >= j
}

export function esCaribe(region: string): boolean {
  return ['Barranquilla', 'Cartagena', 'Santa Marta'].includes(region)
}

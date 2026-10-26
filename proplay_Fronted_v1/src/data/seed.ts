import type {
  CuentaGaming,
  Endorsement,
  Estadistica,
  Habilidad,
  HabilidadJugador,
  Logro,
  Mensaje,
  Oferta,
  Partida,
  PerfilEquipo,
  PerfilJugador,
  Postulacion,
  Region,
  Usuario,
} from '@/types'

/* ============================================================================
 * Datos semilla del prototipo.
 *
 * Simulan el contenido persistido en PostgreSQL (Seccion IX). Las estadisticas
 * declaran `fuente: 'api-riot' | 'api-steam'`, es decir, datos obtenidos por
 * ingesta directa desde la API oficial y no declarados por el jugador (RFC 28).
 * ==========================================================================*/

const iso = (d: string) => new Date(d).toISOString()

/* ------------------------------- Usuarios -------------------------------- */

export const usuarios: Usuario[] = [
  {
    id: 'u-admin',
    nombre: 'Andrea Restrepo',
    email: 'admin@proplay.co',
    rol: 'admin',
    activo: true,
    creadoEn: iso('2026-03-02'),
  },
  {
    id: 'u-equipo-1',
    nombre: 'Carlos Mendoza',
    email: 'carlos@atlanticoesports.co',
    rol: 'equipo',
    activo: true,
    creadoEn: iso('2026-03-10'),
  },
  {
    id: 'u-equipo-2',
    nombre: 'Mariana Fuentes',
    email: 'mariana@cartagenovirtual.gg',
    rol: 'equipo',
    activo: true,
    creadoEn: iso('2026-04-01'),
  },
  {
    id: 'u-scout-1',
    nombre: 'Julian Ochoa',
    email: 'julian@talenthub.co',
    rol: 'scout',
    activo: true,
    creadoEn: iso('2026-04-12'),
  },
  {
    id: 'u-scout-2',
    nombre: 'Paula_SYNC',
    email: 'paula@scoutcaribe.co',
    rol: 'scout',
    activo: true,
    creadoEn: iso('2026-05-03'),
  },
  {
    id: 'u-jugador-1',
    nombre: 'Daniel Ocoro',
    email: 'daniel.ocoro@gmail.com',
    rol: 'jugador',
    activo: true,
    creadoEn: iso('2026-03-15'),
  },
]

/* ------------------------------ Habilidades ------------------------------ */

export const habilidades: Habilidad[] = [
  { id: 'h-1', nombre: 'Comunicacion', categoria: 'blanda' },
  { id: 'h-2', nombre: 'Trabajo en equipo', categoria: 'blanda' },
  { id: 'h-3', nombre: 'Liderazgo', categoria: 'blanda' },
  { id: 'h-4', nombre: 'Gestion de presion', categoria: 'blanda' },
  { id: 'h-5', nombre: 'Mecanica de shoot', categoria: 'tecnica' },
  { id: 'h-6', nombre: 'Vision de juego', categoria: 'tecnica' },
  { id: 'h-7', nombre: 'Toma de decisiones', categoria: 'tecnica' },
  { id: 'h-8', nombre: 'Resistencia mental', categoria: 'blanda' },
]

/* -------------------------------- Perfiles ------------------------------- */

interface SeedJugador {
  id: string
  usuarioId: string
  nombre: string
  handle: string
  region: Region
  biografia: string
  horas: number
  relocalizable: boolean
  roles: string[]
  anios: number
  equipos: string[]
  logros: Logro[]
}

const seeds: SeedJugador[] = [
  {
    id: 'p-01',
    usuarioId: 'u-jugador-1',
    nombre: 'Daniel Ocoro',
    handle: 'DanyOcro',
    region: 'Barranquilla',
    biografia:
      'Mid laner del Caribe con tres anos en la competencia local. Especialista en conformance de oleadas y juego de vision. Participo en la Liga Nacional de Barranquilla 2025.',
    horas: 32,
    relocalizable: true,
    roles: ['Mid lane', 'Doble rol'],
    anios: 3,
    equipos: ['Lobos del Caribe', 'Nautilus Gaming'],
    logros: [
      { id: 'l-1', titulo: 'Subcampeon Liga Nacional 2025', juego: 'League of Legends', lugar: 'Barranquilla', anio: 2025 },
      { id: 'l-2', titulo: 'MVP Fase de Grupos', juego: 'League of Legends', lugar: 'Cartagena', anio: 2024 },
    ],
  },
  {
    id: 'p-02',
    usuarioId: 'u-jugador-2',
    nombre: 'Sara Pelaez',
    handle: 'SaraP',
    region: 'Cartagena',
    biografia:
      'Duelista con foco en clutch y apertura de espacio. Dos veces semifinalista en el circuito regional.',
    horas: 28,
    relocalizable: true,
    roles: ['Duelista', 'Iniciador'],
    anios: 2,
    equipos: ['Reales del Norte'],
    logros: [
      { id: 'l-3', titulo: 'Mejor duelista del Semestre', juego: 'Valorant', lugar: 'Barranquilla', anio: 2025 },
    ],
  },
  {
    id: 'p-03',
    usuarioId: 'u-jugador-3',
    nombre: 'Kevin Barrios',
    handle: 'KevB',
    region: 'Santa Marta',
    biografia:
      'AWPer con precision mecanica y disciplina de utilidad. Teoria de economia de armas aplicada en torneo regional.',
    horas: 36,
    relocalizable: false,
    roles: ['AWPer', 'Rifle'],
    anios: 4,
    equipos: ['Manta Rayas'],
    logros: [
      { id: 'l-4', titulo: 'Campeon Copa Norte', juego: 'Counter-Strike 2', lugar: 'Santa Marta', anio: 2025 },
      { id: 'l-5', titulo: 'Top 10 HLTV Amateur', juego: 'Counter-Strike 2', lugar: 'Global', anio: 2024 },
    ],
  },
  {
    id: 'p-04',
    usuarioId: 'u-jugador-4',
    nombre: 'Luis Fernando Cuello',
    handle: 'LFC',
    region: 'Barranquilla',
    biografia:
      'IGL y support con enfasis en estructura de rondas, llamadas de tiempo y control de economia de armas.',
    horas: 22,
    relocalizable: true,
    roles: ['IGL', 'Supporto'],
    anios: 3,
    equipos: ['Nautilus Gaming'],
    logros: [],
  },
  {
    id: 'p-05',
    usuarioId: 'u-jugador-5',
    nombre: 'Tatiana Acosta',
    handle: 'TatiA',
    region: 'Cartagena',
    biografia:
      'Controladora con vision de mapa. Exjugadora de la liga femenina del Caribe con dos temporadas de experiencia.',
    horas: 26,
    relocalizable: true,
    roles: ['Controlador', 'Sentinel'],
    anios: 2,
    equipos: ['Reales del Norte'],
    logros: [
      { id: 'l-6', titulo: 'MVP Liga Femenina', juego: 'Valorant', lugar: 'Cartagena', anio: 2025 },
    ],
  },
  {
    id: 'p-06',
    usuarioId: 'u-jugador-6',
    nombre: 'Andres Lozano',
    handle: 'AndresLz',
    region: 'Barranquilla',
    biografia:
      'Jungle de ritmo alto, especialista en control de objetivos y gankea snapeado sobre el mapa.',
    horas: 30,
    relocalizable: false,
    roles: ['Jungle'],
    anios: 2,
    equipos: ['Lobos del Caribe'],
    logros: [],
  },
  {
    id: 'p-07',
    usuarioId: 'u-jugador-7',
    nombre: 'Camila Vallejo',
    handle: 'CamiV',
    region: 'Santa Marta',
    biografia:
      'Sensitiva con lectura de rotaciones y capacidad de playmaker en mapas de control.',
    horas: 20,
    relocalizable: true,
    roles: ['Sentinel', 'Iniciador'],
    anios: 1,
    equipos: [],
    logros: [],
  },
  {
    id: 'p-08',
    usuarioId: 'u-jugador-8',
    nombre: 'Jose Manuel Marengo',
    handle: 'JMM',
    region: 'Cartagena',
    biografia:
      'Flex de alto nivel en League of Legends, con experiencia secundaria en Dota 2 y participacion en clasificatorias nacionales.',
    horas: 35,
    relocalizable: true,
    roles: ['Flex', 'Top lane'],
    anios: 5,
    equipos: ['Titanes del Sur', 'Lobos del Caribe'],
    logros: [
      { id: 'l-7', titulo: 'Top 3 Clasificatoria Nacional', juego: 'League of Legends', lugar: 'Bogota', anio: 2024 },
    ],
  },
  {
    id: 'p-09',
    usuarioId: 'u-jugador-9',
    nombre: 'Yendry Correa',
    handle: 'YendryC',
    region: 'Barranquilla',
    biografia:
      'Top laner agresivo con comportamiento de split push y lectura de Timing de torre.',
    horas: 24,
    relocalizable: true,
    roles: ['Top lane'],
    anios: 2,
    equipos: [],
    logros: [],
  },
  {
    id: 'p-10',
    usuarioId: 'u-jugador-10',
    nombre: 'Marcelo Ditta',
    handle: 'Marditta',
    region: 'Bucaramanga',
    biografia:
      'Portero en Rocket League con mecanica de salto consistente y lectura de rotaciones aereas.',
    horas: 18,
    relocalizable: true,
    roles: ['Portero'],
    anios: 3,
    equipos: ['Turbo Fuego'],
    logros: [
      { id: 'l-8', titulo: 'Campeon Liga Rocket del Caribe', juego: 'Rocket League', lugar: 'Barranquilla', anio: 2025 },
    ],
  },
  {
    id: 'p-11',
    usuarioId: 'u-jugador-11',
    nombre: 'Gianluca Pombo',
    handle: 'GianP',
    region: 'Cartagena',
    biografia:
      'Creador de espacio en Valorant, con background en Counter-Strike 2 como IGL de escena mediana.',
    horas: 27,
    relocalizable: true,
    roles: ['Duelista', 'IGL'],
    anios: 3,
    equipos: ['Orcas FC'],
    logros: [],
  },
  {
    id: 'p-12',
    usuarioId: 'u-jugador-12',
    nombre: 'Stephania Hoyos',
    handle: 'StephiH',
    region: 'Barranquilla',
    biografia:
      'Soporte flex con foco en gestion de recursos y vision pasiva. Exjugadora de la academia de League of Legends.',
    horas: 25,
    relocalizable: true,
    roles: ['Support', 'Sentinel'],
    anios: 2,
    equipos: ['Nautilus Gaming'],
    logros: [],
  },
  {
    id: 'p-13',
    usuarioId: 'u-jugador-13',
    nombre: 'Ibrahim Saleh',
    handle: 'IbraS',
    region: 'Bogotá',
    biografia:
      'Carry de Dota 2 con experiencia en stack profesional regional y participacion en tinkering de rosters internacionales.',
    horas: 40,
    relocalizable: true,
    roles: ['Carry'],
    anios: 4,
    equipos: ['Suma Positive', 'Orcas FC'],
    logros: [
      { id: 'l-9', titulo: 'Top 8 Liga Sudamericana', juego: 'Dota 2', lugar: 'Global', anio: 2024 },
    ],
  },
  {
    id: 'p-14',
    usuarioId: 'u-jugador-14',
    nombre: 'Dayana Navarro',
    handle: 'DayN',
    region: 'Cartagena',
    biografia:
      'Iniciador en Valorant con alto indice de apertura de espacio en mapa Split.',
    horas: 21,
    relocalizable: true,
    roles: ['Iniciador'],
    anios: 2,
    equipos: [],
    logros: [],
  },
  {
    id: 'p-15',
    usuarioId: 'u-jugador-15',
    nombre: 'Rafael Guzman',
    handle: 'RafGz',
    region: 'Santa Marta',
    biografia:
      'Rifle y entry en Counter-Strike 2, exjugador de academias del interior del pais.',
    horas: 29,
    relocalizable: true,
    roles: ['Rifle', 'Entry'],
    anios: 2,
    equipos: ['Manta Rayas'],
    logros: [],
  },
  {
    id: 'p-16',
    usuarioId: 'u-jugador-16',
    nombre: 'Veronica Ospina',
    handle: 'VeroO',
    region: 'Barranquilla',
    biografia:
      'Mid laner con perfil agresivo y capacidad de clutch en ranked alto. Quinta en el ranking regional de medio.',
    horas: 33,
    relocalizable: false,
    roles: ['Mid lane'],
    anios: 4,
    equipos: ['Titanes del Sur'],
    logros: [
      { id: 'l-10', titulo: 'MVP de la Final Regional', juego: 'League of Legends', lugar: 'Barranquilla', anio: 2025 },
    ],
  },
  {
    id: 'p-17',
    usuarioId: 'u-jugador-17',
    nombre: 'Nelson Arango',
    handle: 'NelsonA',
    region: 'Medellín',
    biografia:
      'Duelista con mucha experiencia en FACEIT nivel 10 y participacion en finales de la Liga Nacional.',
    horas: 38,
    relocalizable: true,
    roles: ['Duelista'],
    anios: 5,
    equipos: ['Titanes del Sur'],
    logros: [],
  },
  {
    id: 'p-18',
    usuarioId: 'u-jugador-18',
    nombre: 'Bryan Ortiz',
    handle: 'BryanO',
    region: 'Cali',
    biografia:
      'Soporte de League of Legends con enfasis en vision, control de objetivos y rotura consistente de oleadas.',
    horas: 24,
    relocalizable: true,
    roles: ['Support'],
    anios: 3,
    equipos: [],
    logros: [],
  },
  {
    id: 'p-19',
    usuarioId: 'u-jugador-19',
    nombre: 'Laura Villanueva',
    handle: 'LauriV',
    region: 'Cartagena',
    biografia:
      'Sentinel con perfil de IGL, enfoque en macros y estructuras de ronda en mapas de control.',
    horas: 16,
    relocalizable: true,
    roles: ['Sentinel', 'IGL'],
    anios: 2,
    equipos: ['Reales del Norte'],
    logros: [],
  },
  {
    id: 'p-20',
    usuarioId: 'u-jugador-20',
    nombre: 'Andres Lozano Jr',
    handle: 'Andrez',
    region: 'Barranquilla',
    biografia:
      'Bot laner estable, con participacion continua en la cola de la division de oro regional.',
    horas: 28,
    relocalizable: true,
    roles: ['Bot lane'],
    anios: 2,
    equipos: [],
    logros: [],
  },
]

const CARIBE: Region[] = ['Barranquilla', 'Cartagena', 'Santa Marta']

/* --------------------------- Portafolio de partidas ------------------------ */

/** Mapas por juego: el portafolio muestra las ultimas partidas del jugador. */
const MAPAS: Record<string, string[]> = {
  'League of Legends': ['Grieta del Invocador', 'Rift del Escarpador'],
  Valorant: ['Ascent', 'Haven', 'Bind', 'Lotus'],
  'Counter-Strike 2': ['Mirage', 'Inferno', 'Dust II', 'Nuke'],
  'Rocket League': ['DFH Stadium', 'Wasteland', 'Neo Tokyo'],
  'Dota 2': ['Radiant', 'Roshan', 'Diretide'],
}

/** PRNG determinista (mulberry32) para que el portafolio sea reproducible. */
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

/**
 * Construye el portafolio del jugador a partir de la serie de resultados
 * recientes (`tendencia`) de su estadistica principal: el portafolio y la
 * tendencia siempre describen las mismas partidas, de modo que la interfaz
 * no puede mostrar dos verdades distintas.
 */
function generarPortafolio(
  perfilId: string,
  tendencia: number[],
  juego: string,
  fechaIso: string,
): Partida[] {
  const rand = prng(hash(perfilId))
  const mapas = MAPAS[juego] ?? ['Mapa desconocido']
  const n = Math.min(6, tendencia.length)
  const partidas: Partida[] = []
  const base = new Date(fechaIso).getTime()

  for (let i = 0; i < n; i++) {
    const victoria = tendencia[tendencia.length - 1 - i] === 1
    const rating = Number(
      (victoria ? 1.05 : 0.78 + rand() * 0.35).toFixed(2),
    )
    partidas.push({
      id: `pa-${perfilId}-${i}`,
      juego: juego as Partida['juego'],
      mapa: mapas[Math.floor(rand() * mapas.length)],
      fecha: new Date(base - i * 86_400_000 * 2).toISOString().slice(0, 10),
      resultado: victoria ? 'victoria' : 'derrota',
      mvp: victoria && rand() > 0.62,
      rating,
    })
  }
  return partidas
}

export const perfilesJugador: PerfilJugador[] = seeds.map((s) => ({
  id: s.id,
  usuarioId: s.usuarioId,
  nombre: s.nombre,
  handle: s.handle,
  foto: '',
  region: s.region,
  esCaribe: CARIBE.includes(s.region),
  biografia: s.biografia,
  horasDisponibles: s.horas,
  dispuestoARelocalizarse: s.relocalizable,
  rolesPreferidos: s.roles,
  aniosExperiencia: s.anios,
  equiposAnteriores: s.equipos,
  logros: s.logros,
  portafolio: [],
}))

/* --------------------------- Estadisticas (API) -------------------------- */

interface SeedStat {
  id: string
  perfilId: string
  juego: Estadistica['juego']
  rol: string
  partidas: number
  victorias: number
  kda: number
  rango: string
  fuente: Estadistica['fuente']
  sync: string
  tendencia: number[]
}

const statSeeds: SeedStat[] = [
  { id: 'e-01', perfilId: 'p-01', juego: 'League of Legends', rol: 'Mid lane', partidas: 1240, victorias: 706, kda: 4.62, rango: 'Diamante II', fuente: 'api-riot', sync: '2026-10-19T08:12:00Z', tendencia: [1,1,0,1,1,1,0,1,1,1] },
  { id: 'e-02', perfilId: 'p-01', juego: 'Valorant', rol: 'Duelista', partidas: 380, victorias: 199, kda: 3.85, rango: 'Ascendente II', fuente: 'api-riot', sync: '2026-10-19T08:12:00Z', tendencia: [1,0,1,1,0,1,1,1,0,1] },
  { id: 'e-03', perfilId: 'p-02', juego: 'Valorant', rol: 'Duelista', partidas: 910, victorias: 549, kda: 4.31, rango: 'Inmortal I', fuente: 'api-riot', sync: '2026-10-19T07:40:00Z', tendencia: [1,1,1,0,1,1,1,1,1,0] },
  { id: 'e-04', perfilId: 'p-03', juego: 'Counter-Strike 2', rol: 'AWPer', partidas: 1580, victorias: 862, kda: 4.98, rango: 'Global Elite', fuente: 'api-steam', sync: '2026-10-19T06:05:00Z', tendencia: [1,1,1,1,0,1,1,1,1,1] },
  { id: 'e-05', perfilId: 'p-03', juego: 'Valorant', rol: 'Rifle', partidas: 210, victorias: 108, kda: 3.21, rango: 'Oro I', fuente: 'api-riot', sync: '2026-10-19T07:40:00Z', tendencia: [0,1,1,0,0,1,1,0,1,0] },
  { id: 'e-06', perfilId: 'p-04', juego: 'Counter-Strike 2', rol: 'Supporto', partidas: 1120, victorias: 547, kda: 3.72, rango: 'Global Elite', fuente: 'api-steam', sync: '2026-10-19T06:05:00Z', tendencia: [1,0,1,1,1,0,1,1,0,1] },
  { id: 'e-07', perfilId: 'p-05', juego: 'Valorant', rol: 'Controlador', partidas: 640, victorias: 358, kda: 3.94, rango: 'Inmortal II', fuente: 'api-riot', sync: '2026-10-19T07:40:00Z', tendencia: [1,1,0,1,1,0,1,1,1,1] },
  { id: 'e-08', perfilId: 'p-06', juego: 'League of Legends', rol: 'Jungle', partidas: 870, victorias: 452, kda: 4.08, rango: 'Platino I', fuente: 'api-riot', sync: '2026-10-19T08:12:00Z', tendencia: [1,0,1,0,1,1,0,1,1,0] },
  { id: 'e-09', perfilId: 'p-07', juego: 'Valorant', rol: 'Sentinel', partidas: 260, victorias: 128, kda: 3.05, rango: 'Diamante III', fuente: 'api-riot', sync: '2026-10-19T07:40:00Z', tendencia: [0,1,0,1,0,0,1,1,0,1] },
  { id: 'e-10', perfilId: 'p-08', juego: 'League of Legends', rol: 'Top lane', partidas: 2100, victorias: 1155, kda: 4.55, rango: 'Master', fuente: 'api-riot', sync: '2026-10-19T08:12:00Z', tendencia: [1,1,1,1,0,1,1,1,1,1] },
  { id: 'e-11', perfilId: 'p-09', juego: 'League of Legends', rol: 'Top lane', partidas: 540, victorias: 259, kda: 3.61, rango: 'Platino II', fuente: 'api-riot', sync: '2026-10-19T08:12:00Z', tendencia: [1,0,0,1,1,0,1,1,0,1] },
  { id: 'e-12', perfilId: 'p-10', juego: 'Rocket League', rol: 'Portero', partidas: 1450, victorias: 855, kda: 3.4, rango: 'Champions II', fuente: 'api-steam', sync: '2026-10-19T06:05:00Z', tendencia: [1,1,0,1,1,1,0,1,1,1] },
  { id: 'e-13', perfilId: 'p-11', juego: 'Valorant', rol: 'Duelista', partidas: 480, victorias: 254, kda: 3.58, rango: 'Ascendente I', fuente: 'api-riot', sync: '2026-10-19T07:40:00Z', tendencia: [0,1,1,1,0,1,0,1,1,1] },
  { id: 'e-14', perfilId: 'p-12', juego: 'League of Legends', rol: 'Support', partidas: 730, victorias: 372, kda: 3.9, rango: 'Platino I', fuente: 'api-riot', sync: '2026-10-19T08:12:00Z', tendencia: [1,1,1,0,1,1,1,0,1,1] },
  { id: 'e-15', perfilId: 'p-13', juego: 'Dota 2', rol: 'Carry', partidas: 980, victorias: 539, kda: 4.44, rango: 'Inmortal', fuente: 'api-steam', sync: '2026-10-19T06:05:00Z', tendencia: [1,1,0,1,1,1,1,0,1,1] },
  { id: 'e-16', perfilId: 'p-14', juego: 'Valorant', rol: 'Iniciador', partidas: 350, victorias: 171, kda: 3.3, rango: 'Diamante II', fuente: 'api-riot', sync: '2026-10-19T07:40:00Z', tendencia: [0,1,1,0,1,0,1,1,0,1] },
  { id: 'e-17', perfilId: 'p-15', juego: 'Counter-Strike 2', rol: 'Rifle', partidas: 690, victorias: 334, kda: 3.71, rango: 'Global Elite', fuente: 'api-steam', sync: '2026-10-19T06:05:00Z', tendencia: [1,0,1,1,0,1,1,0,1,0] },
  { id: 'e-18', perfilId: 'p-16', juego: 'League of Legends', rol: 'Mid lane', partidas: 1890, victorias: 1094, kda: 4.87, rango: 'Grandmaster', fuente: 'api-riot', sync: '2026-10-19T08:12:00Z', tendencia: [1,1,1,1,1,0,1,1,1,1] },
  { id: 'e-19', perfilId: 'p-17', juego: 'Valorant', rol: 'Duelista', partidas: 1420, victorias: 823, kda: 4.42, rango: 'Radiante', fuente: 'api-riot', sync: '2026-10-19T07:40:00Z', tendencia: [1,1,0,1,1,1,1,1,0,1] },
  { id: 'e-20', perfilId: 'p-18', juego: 'League of Legends', rol: 'Support', partidas: 960, victorias: 470, kda: 3.66, rango: 'Platino III', fuente: 'api-riot', sync: '2026-10-19T08:12:00Z', tendencia: [1,0,1,0,1,1,0,1,1,0] },
  { id: 'e-21', perfilId: 'p-19', juego: 'Valorant', rol: 'Sentinel', partidas: 520, victorias: 281, kda: 3.77, rango: 'Ascendente III', fuente: 'api-riot', sync: '2026-10-19T07:40:00Z', tendencia: [0,1,1,1,1,0,1,0,1,1] },
  { id: 'e-22', perfilId: 'p-20', juego: 'League of Legends', rol: 'Bot lane', partidas: 620, victorias: 295, kda: 3.49, rango: 'Oro I', fuente: 'api-riot', sync: '2026-10-19T08:12:00Z', tendencia: [1,1,0,0,1,1,0,1,1,0] },
]

export const estadisticas: Estadistica[] = statSeeds.map((s) => ({
  ...s,
  winRate: s.victorias / s.partidas,
  ultimaSync: s.sync,
}))

/**
 * El portafolio se deriva de la tendencia de la estadistica principal: la
 * ultima partida registrada en el portafolio es la mas reciente de la serie.
 */
for (const perfil of perfilesJugador) {
  const stat = estadisticas.find((s) => s.perfilId === perfil.id)
  if (!stat) continue
  perfil.portafolio = generarPortafolio(
    perfil.id,
    stat.tendencia,
    stat.juego,
    stat.ultimaSync,
  )
}

/* ------------------------ Cuentas de juego (OAuth 2.0) -------------------- */

export const cuentasGaming: CuentaGaming[] = [
  { id: 'cg-01', perfilId: 'p-01', plataforma: 'Riot Games', identificadorExterno: 'DanyOcro#CAR', verificada: true, fechaVerificacion: '2026-04-02' },
  { id: 'cg-02', perfilId: 'p-02', plataforma: 'Riot Games', identificadorExterno: 'SaraP#CTA', verificada: true, fechaVerificacion: '2026-04-11' },
  { id: 'cg-03', perfilId: 'p-03', plataforma: 'Steam', identificadorExterno: '76561198kevb', verificada: true, fechaVerificacion: '2026-04-14' },
  { id: 'cg-04', perfilId: 'p-04', plataforma: 'Steam', identificadorExterno: '76561198lfc', verificada: true, fechaVerificacion: '2026-04-18' },
  { id: 'cg-05', perfilId: 'p-05', plataforma: 'Riot Games', identificadorExterno: 'TatiA#CTA', verificada: true, fechaVerificacion: '2026-05-02' },
  { id: 'cg-06', perfilId: 'p-06', plataforma: 'Riot Games', identificadorExterno: 'AndresLz#BAQ', verificada: true, fechaVerificacion: '2026-05-06' },
  { id: 'cg-07', perfilId: 'p-08', plataforma: 'Riot Games', identificadorExterno: 'JMM#CTA', verificada: true, fechaVerificacion: '2026-05-10' },
  { id: 'cg-08', perfilId: 'p-10', plataforma: 'Steam', identificadorExterno: '76561198marditta', verificada: true, fechaVerificacion: '2026-05-15' },
  { id: 'cg-09', perfilId: 'p-11', plataforma: 'Riot Games', identificadorExterno: 'GianP#CTA', verificada: true, fechaVerificacion: '2026-05-21' },
  { id: 'cg-10', perfilId: 'p-12', plataforma: 'Riot Games', identificadorExterno: 'StephiH#BAQ', verificada: true, fechaVerificacion: '2026-06-01' },
  { id: 'cg-11', perfilId: 'p-13', plataforma: 'Steam', identificadorExterno: '76561198ibras', verificada: true, fechaVerificacion: '2026-06-04' },
  { id: 'cg-12', perfilId: 'p-16', plataforma: 'Riot Games', identificadorExterno: 'VeroO#BAQ', verificada: true, fechaVerificacion: '2026-06-08' },
  { id: 'cg-13', perfilId: 'p-17', plataforma: 'Riot Games', identificadorExterno: 'NelsonA#MED', verificada: true, fechaVerificacion: '2026-06-12' },
  { id: 'cg-14', perfilId: 'p-18', plataforma: 'Riot Games', identificadorExterno: 'BryanO#CLO', verificada: true, fechaVerificacion: '2026-06-19' },
  { id: 'cg-15', perfilId: 'p-19', plataforma: 'Riot Games', identificadorExterno: 'LauriV#CTA', verificada: true, fechaVerificacion: '2026-07-02' },
  { id: 'cg-16', perfilId: 'p-20', plataforma: 'Riot Games', identificadorExterno: 'Andrez#BAQ', verificada: true, fechaVerificacion: '2026-07-08' },
]

/* ---------------------------- Habilidades y endoses ----------------------- */

export const habilidadesJugador: HabilidadJugador[] = [
  { id: 'hj-01', perfilId: 'p-01', habilidadId: 'h-1', nivel: 4, verificada: true },
  { id: 'hj-02', perfilId: 'p-01', habilidadId: 'h-6', nivel: 5, verificada: true },
  { id: 'hj-03', perfilId: 'p-01', habilidadId: 'h-7', nivel: 4, verificada: true },
  { id: 'hj-04', perfilId: 'p-02', habilidadId: 'h-5', nivel: 5, verificada: true },
  { id: 'hj-05', perfilId: 'p-02', habilidadId: 'h-7', nivel: 4, verificada: true },
  { id: 'hj-06', perfilId: 'p-02', habilidadId: 'h-1', nivel: 3, verificada: false },
  { id: 'hj-07', perfilId: 'p-03', habilidadId: 'h-5', nivel: 5, verificada: true },
  { id: 'hj-08', perfilId: 'p-03', habilidadId: 'h-8', nivel: 4, verificada: true },
  { id: 'hj-09', perfilId: 'p-04', habilidadId: 'h-3', nivel: 5, verificada: true },
  { id: 'hj-10', perfilId: 'p-04', habilidadId: 'h-1', nivel: 5, verificada: true },
  { id: 'hj-11', perfilId: 'p-04', habilidadId: 'h-2', nivel: 4, verificada: true },
  { id: 'hj-12', perfilId: 'p-05', habilidadId: 'h-1', nivel: 4, verificada: true },
  { id: 'hj-13', perfilId: 'p-05', habilidadId: 'h-6', nivel: 4, verificada: true },
  { id: 'hj-14', perfilId: 'p-08', habilidadId: 'h-6', nivel: 5, verificada: true },
  { id: 'hj-15', perfilId: 'p-08', habilidadId: 'h-1', nivel: 4, verificada: true },
  { id: 'hj-16', perfilId: 'p-10', habilidadId: 'h-8', nivel: 4, verificada: true },
  { id: 'hj-17', perfilId: 'p-11', habilidadId: 'h-1', nivel: 4, verificada: true },
  { id: 'hj-18', perfilId: 'p-11', habilidadId: 'h-3', nivel: 3, verificada: true },
  { id: 'hj-19', perfilId: 'p-12', habilidadId: 'h-2', nivel: 5, verificada: true },
  { id: 'hj-20', perfilId: 'p-12', habilidadId: 'h-1', nivel: 4, verificada: true },
  { id: 'hj-21', perfilId: 'p-13', habilidadId: 'h-7', nivel: 5, verificada: true },
  { id: 'hj-22', perfilId: 'p-16', habilidadId: 'h-6', nivel: 5, verificada: true },
  { id: 'hj-23', perfilId: 'p-16', habilidadId: 'h-7', nivel: 5, verificada: true },
  { id: 'hj-24', perfilId: 'p-17', habilidadId: 'h-5', nivel: 5, verificada: true },
  { id: 'hj-25', perfilId: 'p-17', habilidadId: 'h-8', nivel: 4, verificada: true },
  { id: 'hj-26', perfilId: 'p-18', habilidadId: 'h-2', nivel: 4, verificada: true },
  { id: 'hj-27', perfilId: 'p-19', habilidadId: 'h-3', nivel: 4, verificada: true },
  { id: 'hj-28', perfilId: 'p-19', habilidadId: 'h-1', nivel: 4, verificada: true },
  { id: 'hj-29', perfilId: 'p-20', habilidadId: 'h-5', nivel: 3, verificada: false },
  { id: 'hj-30', perfilId: 'p-09', habilidadId: 'h-5', nivel: 4, verificada: true },
  { id: 'hj-31', perfilId: 'p-14', habilidadId: 'h-1', nivel: 4, verificada: true },
  { id: 'hj-32', perfilId: 'p-15', habilidadId: 'h-5', nivel: 4, verificada: true },
]

export const endorsements: Endorsement[] = [
  { id: 'en-01', habilidadJugadorId: 'hj-01', autorId: 'u-equipo-1', autorNombre: 'Carlos Mendoza', fecha: '2026-05-02', comentario: 'Lidera las reuniones de review con comunicacion muy clara.' },
  { id: 'en-02', habilidadJugadorId: 'hj-02', autorId: 'u-scout-1', autorNombre: 'Julian Ochoa', fecha: '2026-05-08', comentario: 'Vision de juego consistente en ranked alto.' },
  { id: 'en-03', habilidadJugadorId: 'hj-03', autorId: 'u-equipo-2', autorNombre: 'Mariana Fuentes', fecha: '2026-06-01', comentario: 'Decisiones de rotacion muy acertadas.' },
  { id: 'en-04', habilidadJugadorId: 'hj-04', autorId: 'u-scout-1', autorNombre: 'Julian Ochoa', fecha: '2026-06-11', comentario: 'Mecanica de aim superior al promedio del circuito.' },
  { id: 'en-05', habilidadJugadorId: 'hj-05', autorId: 'u-equipo-1', autorNombre: 'Carlos Mendoza', fecha: '2026-06-14', comentario: 'Decisiones acertadas en los momentos de presion.' },
  { id: 'en-06', habilidadJugadorId: 'hj-07', autorId: 'u-scout-2', autorNombre: 'Paula_SYNC', fecha: '2026-06-22', comentario: 'Precision consistente en duelos.' },
  { id: 'en-07', habilidadJugadorId: 'hj-08', autorId: 'u-equipo-2', autorNombre: 'Mariana Fuentes', fecha: '2026-07-03', comentario: 'Mantiene la calma en series inversas.' },
  { id: 'en-08', habilidadJugadorId: 'hj-09', autorId: 'u-scout-1', autorNombre: 'Julian Ochoa', fecha: '2026-07-09', comentario: 'Capaz de estructurar la ronda del equipo.' },
  { id: 'en-09', habilidadJugadorId: 'hj-10', autorId: 'u-equipo-1', autorNombre: 'Carlos Mendoza', fecha: '2026-07-10', comentario: 'Comunica los timings de utilidad sin errores.' },
  { id: 'en-10', habilidadJugadorId: 'hj-11', autorId: 'u-equipo-2', autorNombre: 'Mariana Fuentes', fecha: '2026-07-14', comentario: 'Aporta estabilidad al rol de soporte.' },
  { id: 'en-11', habilidadJugadorId: 'hj-12', autorId: 'u-scout-2', autorNombre: 'Paula_SYNC', fecha: '2026-07-18', comentario: 'Excelente lectura de mapa en control.' },
  { id: 'en-12', habilidadJugadorId: 'hj-14', autorId: 'u-scout-1', autorNombre: 'Julian Ochoa', fecha: '2026-07-22', comentario: 'Nivel Master real, no solo de ranking.' },
  { id: 'en-13', habilidadJugadorId: 'hj-16', autorId: 'u-equipo-1', autorNombre: 'Carlos Mendoza', fecha: '2026-08-01', comentario: 'Salto aereo y lectura de rotacion consistentes.' },
  { id: 'en-14', habilidadJugadorId: 'hj-19', autorId: 'u-equipo-2', autorNombre: 'Mariana Fuentes', fecha: '2026-08-05', comentario: 'Habilidades blandas de primer nivel.' },
  { id: 'en-15', habilidadJugadorId: 'hj-22', autorId: 'u-scout-2', autorNombre: 'Paula_SYNC', fecha: '2026-08-12', comentario: 'Mid laner de elite.' },
  { id: 'en-16', habilidadJugadorId: 'hj-23', autorId: 'u-equipo-1', autorNombre: 'Carlos Mendoza', fecha: '2026-08-15', comentario: 'Decisiones de macro medidas con datos.' },
  { id: 'en-17', habilidadJugadorId: 'hj-24', autorId: 'u-scout-1', autorNombre: 'Julian Ochoa', fecha: '2026-08-20', comentario: 'Duelista de nivel internacional.' },
  { id: 'en-18', habilidadJugadorId: 'hj-27', autorId: 'u-equipo-2', autorNombre: 'Mariana Fuentes', fecha: '2026-09-02', comentario: 'Liderazgo natural en el rol de IGL.' },
]

/* --------------------------------- Equipos ------------------------------- */

export const perfilesEquipo: PerfilEquipo[] = [
  {
    id: 'e-01-team',
    usuarioId: 'u-equipo-1',
    nombre: 'Atlantico Esports',
    organizacion: 'Atlantico Esports SAS',
    descripcion:
      'Organizacion del Caribe colombiano competitive en League of Legends y Valorant. Formacion de roster profesional y academia desde 2024.',
    region: 'Barranquilla',
    sitioWeb: 'https://atlanticoesports.co',
    logo: 'AE',
    fundacion: 2024,
    directorio: ['Carlos Mendoza (Director de operaciones)'],
  },
  {
    id: 'e-02-team',
    usuarioId: 'u-equipo-2',
    nombre: 'Cartagena Virtual',
    organizacion: 'CV Esports',
    descripcion:
      'Equipo con sede en Cartagena, centrado en el ecosistema de Valorant y el desarrollo de talento regional.',
    region: 'Cartagena',
    sitioWeb: 'https://cartagenovirtual.gg',
    logo: 'CV',
    fundacion: 2025,
    directorio: ['Mariana Fuentes (Head of Talent)'],
  },
  {
    id: 'e-03-team',
    usuarioId: 'u-equipo-3',
    nombre: 'Manta Rayas',
    organizacion: 'Manta Rayas Gaming',
    descripcion:
      'Plataforma de Counter-Strike con base en Santa Marta y foco en el circuito regional.',
    region: 'Santa Marta',
    logo: 'MR',
    fundacion: 2023,
    directorio: ['Oscar Nieves (Coach)'],
  },
  {
    id: 'e-04-team',
    usuarioId: 'u-equipo-4',
    nombre: 'Orcas FC',
    organizacion: 'Orcas Football Club eSports',
    descripcion:
      'Division de eSports con presencia en el mercado latino y experiencia en Rocket League.',
    region: 'Bogotá',
    logo: 'OF',
    fundacion: 2022,
    directorio: ['Lucia Prada (Sport Manager)'],
  },
  {
    id: 'e-05-team',
    usuarioId: 'u-equipo-5',
    nombre: 'Nautilus Gaming',
    organizacion: 'Nautilus Gaming SAS',
    descripcion:
      'Academia y equipo profesional de Barranquilla, con presencia en los tres juegos principales del Caribe.',
    region: 'Barranquilla',
    logo: 'NG',
    fundacion: 2024,
    directorio: ['Rafael Acosta (Director)'],
  },
]

/* --------------------------------- Ofertas ------------------------------- */

export const ofertas: Oferta[] = [
  {
    id: 'o-01',
    equipoId: 'e-01-team',
    juego: 'League of Legends',
    rol: 'Mid lane',
    rangoMinimo: 'Platino I',
    experienciaMinima: 2,
    regionPreferida: 'Barranquilla',
    horasSemanales: 25,
    estado: 'abierta',
    publicadaEn: '2026-09-28',
    descripcion:
      'Buscamos mid laner para el roster de Liga Nacional 2026. Requisitos: ranked minimo Platino I, win rate sostenida sobre 55 % y disposicion para scrims tres veces por semana.',
    salario: 'COP 1.800.000 + bonificaciones',
    requisitos: [
      'Ranked minimo Platino I en League of Legends',
      'Win rate sostenida sobre 55 % en las ultimas 100 partidas',
      'Disponibilidad para scrims tres veces por semana',
      'Dos anos de experiencia competitiva documentada',
    ],
  },
  {
    id: 'o-02',
    equipoId: 'e-01-team',
    juego: 'Valorant',
    rol: 'Duelista',
    rangoMinimo: 'Ascendente I',
    experienciaMinima: 1,
    regionPreferida: 'Cualquiera',
    horasSemanales: 20,
    estado: 'abierta',
    publicadaEn: '2026-10-04',
    descripcion:
      'Espacio en el roster de duelistas para el circuito regional. Valoramos comunicacion en called de tiempo y trabajo en equipo.',
  },
  {
    id: 'o-03',
    equipoId: 'e-02-team',
    juego: 'Valorant',
    rol: 'Iniciador',
    rangoMinimo: 'Diamante I',
    experienciaMinima: 1,
    regionPreferida: 'Cartagena',
    horasSemanales: 18,
    estado: 'abierta',
    publicadaEn: '2026-10-09',
    descripcion:
      'Plaza de iniciador con foco en smoked y apertura de espacio. El puesto reporta al IGL y exige coordinacion constante.',
  },
  {
    id: 'o-04',
    equipoId: 'e-02-team',
    juego: 'Valorant',
    rol: 'Sentinel',
    rangoMinimo: 'Diamante II',
    experienciaMinima: 2,
    regionPreferida: 'Cartagena',
    horasSemanales: 16,
    estado: 'abierta',
    publicadaEn: '2026-10-12',
    descripcion:
      'Buscamos sentinel con vision de mapa y juego macro. La plaza es compatible con jugadores que estan en proceso de formacion.',
  },
  {
    id: 'o-05',
    equipoId: 'e-03-team',
    juego: 'Counter-Strike 2',
    rol: 'AWPer',
    rangoMinimo: 'Global Elite',
    experienciaMinima: 3,
    regionPreferida: 'Santa Marta',
    horasSemanales: 30,
    estado: 'abierta',
    publicadaEn: '2026-10-06',
    descripcion:
      'AWPer titular para la proxima etapa del circuito. Se exige precision sobre 55 % en mapas activos y experiencia en eventos LAN regionales.',
    requisitos: [
      'Rango Global Elite activo en Counter-Strike 2',
      'Precision sobre 55 % en mapas activos',
      'Experiencia en eventos LAN regionales',
      'Disponibilidad para asistencia a bootcamp mensual',
    ],
  },
  {
    id: 'o-06',
    equipoId: 'e-03-team',
    juego: 'Counter-Strike 2',
    rol: 'IGL',
    rangoMinimo: 'Global Elite',
    experienciaMinima: 2,
    regionPreferida: 'Cualquiera',
    horasSemanales: 28,
    estado: 'abierta',
    publicadaEn: '2026-10-11',
    descripcion:
      'Lider de equipo para squad en reconstruccion. Perfil interesante para equipos con foco en estructuras de ronda.',
  },
  {
    id: 'o-07',
    equipoId: 'e-04-team',
    juego: 'Rocket League',
    rol: 'Portero',
    rangoMinimo: 'Champions II',
    experienciaMinima: 2,
    regionPreferida: 'Cualquiera',
    horasSemanales: 15,
    estado: 'abierta',
    publicadaEn: '2026-10-13',
    descripcion:
      'Portero para la rama de Rocket League. Se valoran rotaciones y mecanica de suelo.',
  },
  {
    id: 'o-08',
    equipoId: 'e-05-team',
    juego: 'League of Legends',
    rol: 'Support',
    rangoMinimo: 'Oro I',
    experienciaMinima: 1,
    regionPreferida: 'Barranquilla',
    horasSemanales: 22,
    estado: 'abierta',
    publicadaEn: '2026-10-15',
    descripcion:
      'Support para la rama academia. Plaza de formacion con mentoria directa y participacion en scrims del roster principal.',
    requisitos: [
      'Rango minimo Oro I en League of Legends',
      'Disponibilidad de 22 h semanales',
      'Actitud proactiva para aprender en entorno competitivo',
    ],
  },
  {
    id: 'o-09',
    equipoId: 'e-05-team',
    juego: 'League of Legends',
    rol: 'Top lane',
    rangoMinimo: 'Diamante I',
    experienciaMinima: 2,
    regionPreferida: 'Barranquilla',
    horasSemanales: 24,
    estado: 'abierta',
    publicadaEn: '2026-10-16',
    descripcion:
      'Top laner para el roster principal. Buscamos experiencia en split push y comunicacion de oleadas.',
  },
  {
    id: 'o-10',
    equipoId: 'e-02-team',
    juego: 'Valorant',
    rol: 'Controlador',
    rangoMinimo: 'Ascendente II',
    experienciaMinima: 1,
    regionPreferida: 'Cualquiera',
    horasSemanales: 18,
    estado: 'cerrada',
    publicadaEn: '2026-09-20',
    descripcion: 'Plaza de controlador cubierta por un jugador interno del ecosistema.',
  },
]

/* ------------------------------ Postulaciones ----------------------------- */

export const postulaciones: Postulacion[] = [
  { id: 'po-01', ofertaId: 'o-01', perfilId: 'p-01', estado: 'en-revision', mensaje: 'Llevo dos anos como mid en Liga Nacional con win rate sobre 57 %.', fecha: '2026-10-02' },
  { id: 'po-02', ofertaId: 'o-01', perfilId: 'p-16', estado: 'enviada', mensaje: 'Grandmaster con 1.890 partidas en la liga.', fecha: '2026-10-05' },
  { id: 'po-03', ofertaId: 'o-01', perfilId: 'p-09', estado: 'enviada', mensaje: 'Top laner en busca de proyecto profesional.', fecha: '2026-10-06' },
  { id: 'po-04', ofertaId: 'o-03', perfilId: 'p-07', estado: 'entrevista', mensaje: 'Sentinel con enfasis en lectura de rotaciones.', fecha: '2026-10-14' },
  { id: 'po-05', ofertaId: 'o-05', perfilId: 'p-03', estado: 'aceptada', mensaje: 'AWPer con campeon de Copa Norte y 1.580 partidas.', fecha: '2026-10-08' },
  { id: 'po-06', ofertaId: 'o-06', perfilId: 'p-04', estado: 'en-revision', mensaje: 'IGL con dos anos liderando en nivel FACEIT 10.', fecha: '2026-10-13' },
  { id: 'po-07', ofertaId: 'o-08', perfilId: 'p-12', estado: 'enviada', mensaje: 'Support con experiencia en academia y voz activa en called.', fecha: '2026-10-09' },
  { id: 'po-08', ofertaId: 'o-02', perfilId: 'p-02', estado: 'aceptada', mensaje: 'Duelista con dos temporadas en el circuito regional.', fecha: '2026-10-07' },
]

/* -------------------------------- Mensajes ------------------------------- */

export const mensajes: Mensaje[] = [
  { id: 'm-01', emisorId: 'u-equipo-1', emisorNombre: 'Carlos Mendoza', receptorId: 'u-jugador-1', texto: 'Hola Daniel, nos interesa tu perfil para el mid del roster nacional. Tienes disponibilidad el sabado para un scrim de prueba?', leido: false, fecha: '2026-10-17T14:20:00Z' },
  { id: 'm-02', emisorId: 'u-jugador-1', emisorNombre: 'Daniel Ocoro', receptorId: 'u-equipo-1', texto: 'Si, estoy disponible a partir de las 4 de la tarde. Confirmo.', leido: true, fecha: '2026-10-17T14:42:00Z' },
  { id: 'm-03', emisorId: 'u-equipo-2', emisorNombre: 'Mariana Fuentes', receptorId: 'u-jugador-1', texto: 'Revisamos tu perfil, el desglose por dimension nos resulto muy util. Te escribo con detalles del proceso.', leido: false, fecha: '2026-10-18T09:10:00Z' },
]

/* ----------------------------- Actividad del feed -------------------------- */

export const actividadFeed = [
  {
    id: 'ac-1',
    tipo: 'oferta' as const,
    titulo: 'Atlantico Esports publico una vacante de Mid lane',
    detalle: 'League of Legends · Rank minimo Platino I · 25 h/semana',
    fecha: '2026-10-16T10:00:00Z',
    color: 'violet' as const,
  },
  {
    id: 'ac-2',
    tipo: 'logro' as const,
    titulo: 'Veronica Ospina fue MVP de la Final Regional',
    detalle: 'League of Legends · Barranquilla',
    fecha: '2026-10-15T18:30:00Z',
    color: 'amber' as const,
  },
  {
    id: 'ac-3',
    tipo: 'sync' as const,
    titulo: 'El worker de ingesta sincronizo 16 perfiles',
    detalle: 'Riot Games + Steam · API oficial, datos verificados',
    fecha: '2026-10-15T06:12:00Z',
    color: 'cyan' as const,
  },
  {
    id: 'ac-4',
    tipo: 'endoso' as const,
    titulo: 'Carlos Mendoza endorso la comunicacion de Daniel Ocoro',
    detalle: 'Endorsement verificado por tercero',
    fecha: '2026-10-14T16:45:00Z',
    color: 'emerald' as const,
  },
  {
    id: 'ac-5',
    tipo: 'oferta' as const,
    titulo: 'Nautilus Gaming busco Support para su rama academia',
    detalle: 'League of Legends · Rank minimo Oro I · 22 h/semana',
    fecha: '2026-10-14T11:05:00Z',
    color: 'violet' as const,
  },
  {
    id: 'ac-6',
    tipo: 'sync' as const,
    titulo: 'Actualizadas las estadisticas de Counter-Strike 2',
    detalle: '1.580 partidas procesadas desde la API de Steam',
    fecha: '2026-10-13T06:05:00Z',
    color: 'cyan' as const,
  },
  {
    id: 'ac-7',
    tipo: 'logro' as const,
    titulo: 'Kevin Barrios fue Campeon de la Copa Norte',
    detalle: 'Counter-Strike 2 · Santa Marta',
    fecha: '2026-10-12T20:00:00Z',
    color: 'amber' as const,
  },
  {
    id: 'ac-8',
    tipo: 'endoso' as const,
    titulo: 'Julian Ochoa endorso la mecanica de shoot de Sara Pelaez',
    detalle: 'Endorsement verificado por tercero',
    fecha: '2026-10-11T13:30:00Z',
    color: 'emerald' as const,
  },
]

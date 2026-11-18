import bcrypt from "bcryptjs";
import { PrismaClient, Prisma } from "@prisma/client";
import { desconectarPrisma } from "../src/config/prisma";
import { revectorizarTodos } from "../src/modules/matching/matching.service";
import {
  CORREO_ADMIN_SEED,
  CORREO_SCOUT_SEED,
  CORREOS_EQUIPOS_SEED,
  PREFIJO_PUUID_SEED,
  correoJugadorSeed,
} from "../src/utils/datosDePrueba";
import {
  COLA_SOLO_DUO,
  PARTIDAS_POR_SINCRONIZACION,
  POSICIONES_LOL,
  metricasLolSchema,
  FECHA_POR_ESTADO_POSTULACION,
  JUEGO_PILOTO,
  PERFIL_VECTOR_VERSION,
  PESOS_MATCHING,
  type Departamento,
  type EstadoOferta,
  type EstadoPostulacion,
  type Modalidad,
  type Pais,
  type PosicionLol,
  type RangoLol,
} from "@proplay/shared";

/**
 * Datos de prueba de ProPlay.
 *
 * Carga: el catálogo de habilidades, 3 equipos, 21 jugadores (16 con cuenta
 * de Riot verificada y estadísticas de LoL con posición y rango; sus vectores
 * los calcula el motor de matching), endorsements de equipos a tres de ellos, 9 ofertas de League of Legends en todos los estados
 * con postulaciones fechadas (para el embudo y la analítica), un scout y un administrador.
 *
 * Es idempotente (usa upsert), así que se puede ejecutar varias veces:
 *   npm run db:seed
 */
const prisma = new PrismaClient();

/** Contraseña común de todas las cuentas de prueba. */
const PASSWORD_DEMO = "ProPlay123";

/** Generador pseudoaleatorio determinista: el seed siempre produce lo mismo. */
function crearAleatorio(semilla: number) {
  let estado = semilla;
  return () => {
    estado = (estado * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return estado / 4_294_967_296;
  };
}

const HABILIDADES_TECNICAS = [
  "Aim",
  "Map awareness",
  "Last hitting",
  "Wave management",
  "Rotaciones",
  "Control de objetivos",
  "Uso de utilidad",
  "Entry fragging",
  "Micro",
  "Macro",
];

const HABILIDADES_BLANDAS = [
  "Comunicación",
  "Liderazgo",
  "Trabajo en equipo",
  "Adaptabilidad",
  "Disciplina",
  "Gestión del tiempo",
];

/**
 * Cuenta de Riot y datos de juego de los 21 jugadores, en orden. Los diez
 * primeros tienen la cuenta verificada y dos capturas de estadísticas (la
 * anterior, un mes antes y con un rango más bajo, para que haya historia); los
 * cinco siguientes no tienen cuenta, como un jugador recién registrado. Los
 * seis últimos, verificados, son de Antioquia y Bogotá: con ellos el mapa del
 * talento tiene celdas fuera del Caribe por encima del umbral de privacidad.
 * Ninguno juega ADC ni MID, para no mover los rankings de la demostración. Sólo
 * League of Legends, el juego del piloto. Los puuid llevan el prefijo `seed-`
 * para que nunca se confundan con uno real.
 */
const DATOS_RIOT: ({ posicion: PosicionLol; rango: RangoLol; rangoAnterior: RangoLol } | null)[] = [
  { posicion: "MID", rango: "DIAMANTE_II", rangoAnterior: "DIAMANTE_IV" },
  { posicion: "SOPORTE", rango: "MAESTRO", rangoAnterior: "DIAMANTE_I" },
  { posicion: "TOP", rango: "PLATINO_I", rangoAnterior: "PLATINO_III" },
  { posicion: "JUNGLA", rango: "ESMERALDA_III", rangoAnterior: "ESMERALDA_IV" },
  { posicion: "ADC", rango: "ORO_II", rangoAnterior: "ORO_IV" },
  { posicion: "MID", rango: "DIAMANTE_IV", rangoAnterior: "ESMERALDA_I" },
  { posicion: "SOPORTE", rango: "PLATA_I", rangoAnterior: "PLATA_III" },
  { posicion: "JUNGLA", rango: "ESMERALDA_I", rangoAnterior: "ESMERALDA_II" },
  { posicion: "ADC", rango: "PLATINO_IV", rangoAnterior: "ORO_I" },
  { posicion: "TOP", rango: "GRAN_MAESTRO", rangoAnterior: "MAESTRO" },
  null,
  null,
  null,
  null,
  null,
  { posicion: "TOP", rango: "ESMERALDA_II", rangoAnterior: "ESMERALDA_IV" },
  { posicion: "JUNGLA", rango: "DIAMANTE_III", rangoAnterior: "DIAMANTE_IV" },
  { posicion: "SOPORTE", rango: "PLATINO_II", rangoAnterior: "PLATINO_IV" },
  { posicion: "TOP", rango: "ORO_I", rangoAnterior: "ORO_III" },
  { posicion: "SOPORTE", rango: "ESMERALDA_IV", rangoAnterior: "PLATINO_I" },
  { posicion: "JUNGLA", rango: "PLATINO_III", rangoAnterior: "ORO_I" },
];


/**
 * Endorsements del seed: índice del jugador → índices de los equipos que
 * avalan su habilidad blanda. Tres jugadores, con uno, dos y tres avales.
 */
const ENDORSEMENTS_SEED: [number, number[]][] = [
  [0, [0, 1, 2]],
  [2, [0, 1]],
  [9, [1]],
];

/**
 * Ubicación de los 21 jugadores, en orden: mayoría del Caribe colombiano (el
 * piloto), algunos del resto del país y uno de fuera, para cubrir los tres
 * niveles de la dimensión geográfica. Los seis últimos, en Antioquia y Bogotá.
 */
const UBICACIONES: { pais: Pais; departamento: Departamento | null }[] = [
  { pais: "CO", departamento: "ATLANTICO" },
  { pais: "CO", departamento: "BOLIVAR" },
  { pais: "CO", departamento: "MAGDALENA" },
  { pais: "CO", departamento: "ATLANTICO" },
  { pais: "CO", departamento: "CESAR" },
  { pais: "CO", departamento: "ANTIOQUIA" },
  { pais: "CO", departamento: "CORDOBA" },
  { pais: "CO", departamento: "ATLANTICO" },
  { pais: "CO", departamento: "SUCRE" },
  { pais: "CO", departamento: "BOGOTA_DC" },
  { pais: "CO", departamento: "LA_GUAJIRA" },
  { pais: "CO", departamento: "BOLIVAR" },
  { pais: "CO", departamento: "VALLE_DEL_CAUCA" },
  { pais: "CO", departamento: "SAN_ANDRES" },
  { pais: "MX", departamento: null },
  { pais: "CO", departamento: "ANTIOQUIA" },
  { pais: "CO", departamento: "ANTIOQUIA" },
  { pais: "CO", departamento: "ANTIOQUIA" },
  { pais: "CO", departamento: "BOGOTA_DC" },
  { pais: "CO", departamento: "BOGOTA_DC" },
  { pais: "CO", departamento: "BOGOTA_DC" },
];

const EQUIPOS: {
  email: string;
  nombre: string;
  nombreOrg: string;
  descripcion: string;
  sitioWeb: string;
  pais: Pais;
  departamento: Departamento;
}[] = [
  {
    email: CORREOS_EQUIPOS_SEED[0],
    nombre: "Caribe eSports",
    nombreOrg: "Caribe eSports",
    descripcion: "Organización de la costa Caribe con divisiones de LoL y VALORANT.",
    sitioWeb: "https://caribeesports.gg",
    pais: "CO",
    departamento: "ATLANTICO",
  },
  {
    email: CORREOS_EQUIPOS_SEED[1],
    nombre: "Andes Gaming",
    nombreOrg: "Andes Gaming",
    descripcion: "Academia de desarrollo de talento para escenas emergentes.",
    sitioWeb: "https://andesgaming.co",
    pais: "CO",
    departamento: "BOGOTA_DC",
  },
  {
    email: CORREOS_EQUIPOS_SEED[2],
    nombre: "Uninorte Legends",
    nombreOrg: "Uninorte Legends",
    descripcion: "Equipo universitario de la Universidad del Norte.",
    sitioWeb: "https://uninortelegends.edu.co",
    pais: "CO",
    departamento: "ATLANTICO",
  },
];

/** Tier de Riot de cada prefijo del catálogo (sólo para el rango detallado). */
const TIER_DE_RANGO: Record<string, string> = {
  HIERRO: "IRON",
  BRONCE: "BRONZE",
  PLATA: "SILVER",
  ORO: "GOLD",
  PLATINO: "PLATINUM",
  ESMERALDA: "EMERALD",
  DIAMANTE: "DIAMOND",
  MAESTRO: "MASTER",
  GRAN_MAESTRO: "GRANDMASTER",
  RETADOR: "CHALLENGER",
};

/** Rango detallado (como league-v4) a partir de un valor del catálogo. */
function rangoColaDeSeed(rango: RangoLol, partidasTemporada: number, victoriasTemporada: number) {
  const partes = rango.match(/^(.*?)(?:_(IV|III|II|I))?$/)!;
  return {
    liga: TIER_DE_RANGO[partes[1]!]!,
    division: partes[2] ?? null,
    puntosLiga: 45,
    victorias: victoriasTemporada,
    derrotas: partidasTemporada - victoriasTemporada,
  };
}

/** El resto de partidas, en la posición siguiente del catálogo. */
function otraPosicion(posicion: PosicionLol, partidas: number) {
  const siguiente = POSICIONES_LOL[(POSICIONES_LOL.indexOf(posicion) + 1) % POSICIONES_LOL.length]!;
  return { [siguiente]: partidas };
}

/**
 * Momento de referencia de todo el seed. Fijo, y no `Date.now()` en cada
 * llamada, para que las fechas del mismo día coincidan al milisegundo: el
 * rechazo automático al cerrar una oferta se reconoce porque su `rechazadaEn`
 * es igual al `cerradaEn` de la oferta.
 */
const AHORA = Date.now();

/** Fecha `dias` días antes del momento del seed. */
function haceDias(dias: number): Date {
  return new Date(AHORA - dias * 24 * 60 * 60 * 1000);
}

/** Paso del recorrido de una postulación: estado y hace cuántos días se alcanzó. */
type Paso = readonly [EstadoPostulacion, number];

/** Fecha de cada estado del recorrido, en su columna de `FECHA_POR_ESTADO_POSTULACION`. */
function fechasDelRecorrido(recorrido: readonly Paso[]) {
  return Object.fromEntries(
    recorrido.map(([estado, dias]) => [FECHA_POR_ESTADO_POSTULACION[estado], haceDias(dias)]),
  ) as Partial<Record<(typeof FECHA_POR_ESTADO_POSTULACION)[EstadoPostulacion], Date>>;
}

interface OfertaSemilla {
  /** Índice en EQUIPOS. */
  equipo: number;
  titulo: string;
  rol: PosicionLol;
  rangoMinimo: RangoLol;
  modalidad: Modalidad;
  pais: Pais | null;
  departamento: Departamento | null;
  horasSemana: number;
  descripcion: string;
  pesos: Record<keyof typeof PESOS_MATCHING, number>;
  estado: EstadoOferta;
  publicadaHaceDias: number | null;
  cerradaHaceDias: number | null;
  /** `jugador` es el índice en NOMBRES_JUGADORES. */
  postulaciones: { jugador: number; recorrido: readonly Paso[] }[];
}

/**
 * Las 9 ofertas, todas de League of Legends, cubren los cuatro estados que el
 * embudo distingue y las tres modalidades. Las postulaciones recorren todos los
 * estados; las de las ofertas cubiertas o cerradas que seguían abiertas al
 * cerrarlas terminan rechazadas en la fecha del cierre, como hace la API.
 */
const OFERTAS: OfertaSemilla[] = [
  {
    equipo: 0,
    titulo: "Buscamos MID para academia de League of Legends",
    rol: "MID",
    rangoMinimo: "DIAMANTE_II",
    modalidad: "PRESENCIAL",
    pais: "CO",
    departamento: "ATLANTICO",
    horasSemana: 25,
    descripcion:
      "Roster de academia con miras al circuito nacional. Entrenamientos de lunes a viernes en Barranquilla y scrims los fines de semana.",
    pesos: { ...PESOS_MATCHING },
    estado: "ABIERTA",
    publicadaHaceDias: 20,
    cerradaHaceDias: null,
    postulaciones: [
      { jugador: 0, recorrido: [["ENVIADA", 19], ["EN_REVISION", 17], ["ENTREVISTA", 14]] },
      { jugador: 1, recorrido: [["ENVIADA", 18], ["EN_REVISION", 16], ["RECHAZADA", 15]] },
      { jugador: 2, recorrido: [["ENVIADA", 10]] },
      { jugador: 3, recorrido: [["ENVIADA", 9], ["EN_REVISION", 6]] },
    ],
  },
  {
    equipo: 1,
    titulo: "Jungla para el roster principal",
    rol: "JUNGLA",
    rangoMinimo: "MAESTRO",
    modalidad: "HIBRIDA",
    pais: "CO",
    departamento: "BOGOTA_DC",
    horasSemana: 30,
    descripcion:
      "Buscamos jungla con experiencia en torneos nacionales y buena comunicación. Bootcamp presencial en Bogotá una semana al mes; el resto, en línea.",
    pesos: {
      tecnica: 0.6,
      experiencia: 0,
      habilidadesBlandas: 0,
      geografica: 0.1,
      disponibilidad: 0.3,
    },
    estado: "ABIERTA",
    publicadaHaceDias: 12,
    cerradaHaceDias: null,
    postulaciones: [
      {
        jugador: 4,
        recorrido: [["ENVIADA", 11], ["EN_REVISION", 9], ["ENTREVISTA", 6], ["ACEPTADA", 2]],
      },
      { jugador: 5, recorrido: [["ENVIADA", 10], ["RECHAZADA", 8]] },
      { jugador: 6, recorrido: [["ENVIADA", 3]] },
    ],
  },
  {
    equipo: 2,
    titulo: "Soporte para la división universitaria",
    rol: "SOPORTE",
    rangoMinimo: "PLATINO_I",
    modalidad: "PRESENCIAL",
    pais: "CO",
    departamento: "ATLANTICO",
    horasSemana: 15,
    descripcion:
      "Programa universitario que busca un soporte con buena lectura de mapa para su plantel. Compatible con los estudios.",
    pesos: {
      tecnica: 0.4,
      experiencia: 0,
      habilidadesBlandas: 0,
      geografica: 0.35,
      disponibilidad: 0.25,
    },
    estado: "CUBIERTA",
    publicadaHaceDias: 40,
    cerradaHaceDias: 10,
    postulaciones: [
      {
        jugador: 7,
        recorrido: [["ENVIADA", 38], ["EN_REVISION", 35], ["ENTREVISTA", 30], ["ACEPTADA", 12]],
      },
      {
        jugador: 8,
        recorrido: [["ENVIADA", 37], ["EN_REVISION", 34], ["ENTREVISTA", 29], ["RECHAZADA", 12]],
      },
      { jugador: 9, recorrido: [["ENVIADA", 36], ["RECHAZADA", 10]] },
      { jugador: 10, recorrido: [["ENVIADA", 25], ["EN_REVISION", 20], ["RECHAZADA", 10]] },
    ],
  },
  {
    equipo: 0,
    titulo: "ADC para la liga en línea",
    rol: "ADC",
    // Al alcance de los ADC del seed (Platino IV y Oro II): con un mínimo que
    // ninguno cumple, el ranking de la demostración no tendría a quién premiar.
    rangoMinimo: "PLATINO_IV",
    modalidad: "REMOTA",
    pais: null,
    departamento: null,
    horasSemana: 20,
    descripcion:
      "Equipo de la liga en línea busca ADC para la temporada. Todo el trabajo es remoto: entrenamientos y partidas desde casa.",
    pesos: {
      tecnica: 0.6,
      experiencia: 0,
      habilidadesBlandas: 0,
      geografica: 0,
      disponibilidad: 0.4,
    },
    estado: "ABIERTA",
    publicadaHaceDias: 5,
    cerradaHaceDias: null,
    postulaciones: [
      { jugador: 11, recorrido: [["ENVIADA", 4]] },
      { jugador: 12, recorrido: [["ENVIADA", 3], ["EN_REVISION", 1]] },
    ],
  },
  {
    equipo: 1,
    titulo: "Top para la temporada de clausura",
    rol: "TOP",
    rangoMinimo: "DIAMANTE_IV",
    modalidad: "HIBRIDA",
    pais: "CO",
    departamento: "BOGOTA_DC",
    horasSemana: 22,
    descripcion:
      "Borrador: buscaremos un top para la temporada de clausura cuando cerremos el roster principal.",
    pesos: { ...PESOS_MATCHING },
    estado: "BORRADOR",
    publicadaHaceDias: null,
    cerradaHaceDias: null,
    postulaciones: [],
  },
  // Historial de Caribe eSports para la analítica (RF-13): tres vacantes
  // cubiertas en 12, 21 y 45 días (de la publicación a la primera aceptación:
  // mediana 21, media 26, así se ve por qué la mediana resiste un caso
  // extremo) y una cerrada sin cubrir. Hay rechazos del equipo en cada etapa y
  // rechazos automáticos al cerrar (fecha igual a la del cierre). Con las dos
  // ofertas abiertas del equipo, el primer tryout llega en 6, 7, 8 y 9 días.
  {
    equipo: 0,
    titulo: "Soporte para la Copa del Caribe",
    rol: "SOPORTE",
    rangoMinimo: "PLATA_I",
    modalidad: "PRESENCIAL",
    pais: "CO",
    departamento: "ATLANTICO",
    horasSemana: 20,
    descripcion:
      "Soporte para el roster de la Copa del Caribe. Entrenamientos presenciales en Barranquilla tres tardes por semana.",
    pesos: { ...PESOS_MATCHING },
    estado: "CUBIERTA",
    publicadaHaceDias: 70,
    cerradaHaceDias: 55,
    postulaciones: [
      { jugador: 1, recorrido: [["ENVIADA", 68], ["EN_REVISION", 66], ["ENTREVISTA", 63], ["ACEPTADA", 58]] },
      { jugador: 6, recorrido: [["ENVIADA", 67], ["EN_REVISION", 65], ["RECHAZADA", 64]] },
      { jugador: 13, recorrido: [["ENVIADA", 60], ["RECHAZADA", 55]] },
    ],
  },
  {
    equipo: 0,
    titulo: "Jungla para la liga universitaria",
    rol: "JUNGLA",
    rangoMinimo: "ESMERALDA_IV",
    modalidad: "HIBRIDA",
    pais: "CO",
    departamento: "ATLANTICO",
    horasSemana: 20,
    descripcion:
      "Jungla para la liga universitaria regional. Partidas en línea y una concentración presencial al mes en Barranquilla.",
    pesos: { ...PESOS_MATCHING },
    estado: "CUBIERTA",
    publicadaHaceDias: 90,
    cerradaHaceDias: 66,
    postulaciones: [
      { jugador: 3, recorrido: [["ENVIADA", 88], ["EN_REVISION", 85], ["ENTREVISTA", 80], ["ACEPTADA", 69]] },
      { jugador: 7, recorrido: [["ENVIADA", 87], ["EN_REVISION", 84], ["ENTREVISTA", 81], ["RECHAZADA", 75]] },
      { jugador: 12, recorrido: [["ENVIADA", 70], ["EN_REVISION", 68], ["RECHAZADA", 66]] },
    ],
  },
  {
    equipo: 0,
    titulo: "Top para el clasificatorio regional",
    rol: "TOP",
    rangoMinimo: "PLATINO_IV",
    modalidad: "REMOTA",
    pais: null,
    departamento: null,
    horasSemana: 15,
    descripcion:
      "Top para el clasificatorio regional en línea. Scrims entre semana y partidas oficiales los sábados.",
    pesos: { tecnica: 0.6, experiencia: 0, habilidadesBlandas: 0, geografica: 0, disponibilidad: 0.4 },
    estado: "CUBIERTA",
    publicadaHaceDias: 120,
    cerradaHaceDias: 70,
    postulaciones: [
      { jugador: 2, recorrido: [["ENVIADA", 115], ["EN_REVISION", 110], ["ENTREVISTA", 100], ["ACEPTADA", 75]] },
      { jugador: 9, recorrido: [["ENVIADA", 118], ["EN_REVISION", 116], ["ENTREVISTA", 112], ["RECHAZADA", 90]] },
    ],
  },
  {
    equipo: 0,
    titulo: "ADC suplente para la temporada",
    rol: "ADC",
    rangoMinimo: "ORO_IV",
    modalidad: "REMOTA",
    pais: null,
    departamento: null,
    horasSemana: 10,
    descripcion: "ADC suplente para cubrir ausencias durante la temporada. Se cerró sin cubrir.",
    pesos: { tecnica: 0.6, experiencia: 0, habilidadesBlandas: 0, geografica: 0, disponibilidad: 0.4 },
    estado: "CERRADA",
    publicadaHaceDias: 50,
    cerradaHaceDias: 35,
    postulaciones: [
      { jugador: 4, recorrido: [["ENVIADA", 48], ["EN_REVISION", 45], ["RECHAZADA", 35]] },
      { jugador: 8, recorrido: [["ENVIADA", 47], ["RECHAZADA", 44]] },
    ],
  },
];

const NOMBRES_JUGADORES = [
  "Andrés Molina",
  "Valentina Ríos",
  "Camilo Ospina",
  "Laura Beltrán",
  "Sebastián Duarte",
  "Mariana Pardo",
  "Julián Castaño",
  "Daniela Quintero",
  "Tomás Herrera",
  "Sofía Naranjo",
  "Emilio Vargas",
  "Isabela Cortés",
  "Nicolás Mejía",
  "Paula Restrepo",
  "Samuel Arango",
  "Juan Pablo Henao",
  "Catalina Gómez",
  "Mateo Salazar",
  "Alejandra Rincón",
  "Santiago Torres",
  "Valeria Cárdenas",
];

async function main() {
  console.log("Sembrando datos de prueba de ProPlay...");
  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 10);
  const aleatorio = crearAleatorio(20_260_910);

  // ---------------------------------------------------------------- catálogo
  const habilidades = await Promise.all([
    ...HABILIDADES_TECNICAS.map((nombre) =>
      prisma.habilidad.upsert({
        where: { nombre },
        update: {},
        create: { nombre, categoria: "TECNICA" },
      }),
    ),
    ...HABILIDADES_BLANDAS.map((nombre) =>
      prisma.habilidad.upsert({
        where: { nombre },
        update: {},
        create: { nombre, categoria: "BLANDA" },
      }),
    ),
  ]);
  console.log(`  · ${habilidades.length} habilidades en el catálogo`);

  const tecnicas = habilidades.filter((h) => h.categoria === "TECNICA");
  const blandas = habilidades.filter((h) => h.categoria === "BLANDA");

  // ------------------------------------------------------- admin y scout demo
  await prisma.usuario.upsert({
    where: { email: CORREO_ADMIN_SEED },
    update: {},
    create: {
      email: CORREO_ADMIN_SEED,
      passwordHash,
      nombre: "Administración ProPlay",
      rol: "ADMIN",
      emailVerificado: true,
    },
  });

  await prisma.usuario.upsert({
    where: { email: CORREO_SCOUT_SEED },
    update: {},
    create: {
      email: CORREO_SCOUT_SEED,
      passwordHash,
      nombre: "Marcela Guzmán",
      rol: "SCOUT",
      emailVerificado: true,
    },
  });

  // ----------------------------------------------------------------- equipos
  const perfilesEquipo = [];
  for (const equipo of EQUIPOS) {
    const usuario = await prisma.usuario.upsert({
      where: { email: equipo.email },
      update: {},
      create: {
        email: equipo.email,
        passwordHash,
        nombre: equipo.nombre,
        rol: "EQUIPO",
        emailVerificado: true,
      },
    });

    // La sede también va en `update`: las bases anteriores a la migración
    // de ofertas guardaban una región de servidor y el seed la repone.
    const sede = { pais: equipo.pais, departamento: equipo.departamento };
    const perfil = await prisma.perfilEquipo.upsert({
      where: { usuarioId: usuario.id },
      update: sede,
      create: {
        usuarioId: usuario.id,
        nombreOrg: equipo.nombreOrg,
        descripcion: equipo.descripcion,
        sitioWeb: equipo.sitioWeb,
        ...sede,
      },
    });
    perfilesEquipo.push(perfil);
  }
  console.log(`  · ${perfilesEquipo.length} equipos`);

  // ---------------------------------------------------------------- jugadores
  let estadisticasCreadas = 0;
  let postulacionesCreadas = 0;
  const perfilesJugador: { id: string; usuarioId: string }[] = [];
  for (const [indice, nombre] of NOMBRES_JUGADORES.entries()) {
    const email = correoJugadorSeed(indice + 1);
    const riot = DATOS_RIOT[indice]!;

    const usuario = await prisma.usuario.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        nombre,
        rol: "JUGADOR",
        emailVerificado: true,
      },
    });

    // La ubicación también va en `update`: las bases anteriores a la migración
    // de ubicación tienen `pais` vacío y el seed lo repone.
    const ubicacion = UBICACIONES[indice % UBICACIONES.length]!;
    const jugador = await prisma.perfilJugador.upsert({
      where: { usuarioId: usuario.id },
      update: { ...ubicacion },
      create: {
        usuarioId: usuario.id,
        bio: riot
          ? `${riot.posicion} de ${JUEGO_PILOTO} buscando equipo competitivo.`
          : `Jugador de ${JUEGO_PILOTO} buscando equipo competitivo.`,
        ...ubicacion,
        fechaNacimiento: new Date(1998 + (indice % 8), indice % 12, 1 + (indice % 27)),
        disponibilidadHoras: 15 + (indice % 4) * 5,
        dispuestoRelocalizar: indice % 3 === 0,
      },
    });
    perfilesJugador.push(jugador);

    // Dos habilidades técnicas y una blanda por jugador.
    const asignaciones = [
      tecnicas[indice % tecnicas.length]!,
      tecnicas[(indice + 3) % tecnicas.length]!,
      blandas[indice % blandas.length]!,
    ];
    for (const [posicion, habilidad] of asignaciones.entries()) {
      await prisma.habilidadJugador.upsert({
        where: {
          jugadorId_habilidadId: {
            jugadorId: jugador.id,
            habilidadId: habilidad.id,
          },
        },
        update: {},
        create: {
          jugadorId: jugador.id,
          habilidadId: habilidad.id,
          nivel: 3 + ((indice + posicion) % 3),
          verificada: posicion === 0,
        },
      });
    }

    // Cuenta de Riot verificada y estadísticas de LoL. Se rehacen en cada
    // ejecución: las bases anteriores guardaban estadísticas de otros juegos
    // y sin rango, y la cuenta de un jugador sin datos de Riot se retira.
    await prisma.estadistica.deleteMany({ where: { jugadorId: jugador.id } });
    if (!riot) {
      await prisma.cuentaGaming.deleteMany({
        where: { jugadorId: jugador.id, plataforma: "RIOT" },
      });
    } else {
      const handle = `${nombre.split(" ")[0]}#SEED`;
      const verificadaEn = haceDias(60 - indice);
      // La última sincronización es la de la captura más reciente (hace
      // `indice` días). La ingesta no vuelve a sincronizar estas cuentas
      // (`esPuuidSeed`), así que la fecha queda fija.
      const sincronizadaEn = haceDias(indice);
      const datosCuenta = {
        externalId: `${PREFIJO_PUUID_SEED}puuid-${indice + 1}`,
        handle,
        servidor: "LA1",
        verificadaEn,
        sincronizadaEn,
        intentoSincronizacionEn: sincronizadaEn,
      };
      const cuenta = await prisma.cuentaGaming.upsert({
        where: { jugadorId_plataforma: { jugadorId: jugador.id, plataforma: "RIOT" } },
        update: datosCuenta,
        create: { jugadorId: jugador.id, plataforma: "RIOT", ...datosCuenta },
      });

      for (const [captura, rango] of [riot.rangoAnterior, riot.rango].entries()) {
        // 20 partidas como en una sincronización real, todas de solo/dúo.
        const partidas = PARTIDAS_POR_SINCRONIZACION;
        const victorias = Math.round(partidas * (0.42 + aleatorio() * 0.24));
        const kills = Number((2 + aleatorio() * 6).toFixed(2));
        const muertes = Number((2 + aleatorio() * 4).toFixed(2));
        const asistencias = Number((4 + aleatorio() * 8).toFixed(2));
        const principal = Math.round(partidas * 0.8);
        const metricas = metricasLolSchema.parse({
          servidor: "LA1",
          nivelInvocador: 120 + indice * 17,
          rangoSoloDuo: rangoColaDeSeed(rango, partidas * 10, victorias * 10),
          rangoFlex: null,
          partidasAnalizadas: partidas,
          colas: { [String(COLA_SOLO_DUO)]: partidas },
          promedioKills: kills,
          promedioMuertes: muertes,
          promedioAsistencias: asistencias,
          csPorMinuto: Number((5.5 + aleatorio() * 3).toFixed(2)),
          oroPorMinuto: Number((330 + aleatorio() * 120).toFixed(2)),
          danoPorMinuto: Number((400 + aleatorio() * 500).toFixed(2)),
          visionPorMinuto: Number((0.6 + aleatorio() * 1.6).toFixed(2)),
          participacionKills: Number((0.45 + aleatorio() * 0.25).toFixed(4)),
          duracionMediaMinutos: Number((26 + aleatorio() * 8).toFixed(2)),
          distribucionRoles: { [riot.posicion]: principal, ...otraPosicion(riot.posicion, partidas - principal) },
          campeonesMasJugados: [
            { campeon: "Ahri", partidas: 8, victorias: 5, kda: 3.2 },
            { campeon: "Lux", partidas: 6, victorias: 3, kda: 2.6 },
            { campeon: "Thresh", partidas: 4, victorias: 2, kda: 2.9 },
          ],
          ultimaPartidaId: `SEED_${indice + 1}_${captura}`,
          ultimaPartidaEn: haceDias(captura === 0 ? 30 + indice : indice).toISOString(),
        });
        await prisma.estadistica.create({
          data: {
            jugadorId: jugador.id,
            cuentaId: cuenta.id,
            juego: JUEGO_PILOTO,
            rol: riot.posicion,
            rango,
            partidas,
            victorias,
            kda: Number(((kills + asistencias) / Math.max(muertes, 1)).toFixed(2)),
            winRate: Number((victorias / partidas).toFixed(4)),
            fuente: "RIOT",
            metricas: JSON.parse(JSON.stringify(metricas)) as Prisma.InputJsonObject,
            // La anterior, un mes antes; la actual, hace (indice) días.
            capturadaEn: haceDias(captura === 0 ? 30 + indice : indice),
          },
        });
        estadisticasCreadas += 1;
      }
    }

    // Sin vector: lo calcula el vectorizador del motor de matching a partir de
    // estas capturas (PERFIL_VECTOR_VERSION). Se borran los de versiones
    // anteriores, que eran aleatorios.
    await prisma.perfilVector.deleteMany({
      where: { jugadorId: jugador.id, version: { lt: PERFIL_VECTOR_VERSION } },
    });
  }
  console.log(
    `  · ${NOMBRES_JUGADORES.length} jugadores (${DATOS_RIOT.filter(Boolean).length} con cuenta de Riot verificada), ${estadisticasCreadas} capturas de estadísticas de LoL`,
  );

  // ------------------------------------------------------------ endorsements
  // Los equipos avalan habilidades blandas de tres jugadores (decisión 0.10:
  // endorsements sólo de equipos), para que la dimensión de habilidades
  // blandas tenga datos en la demostración aunque su peso del piloto sea 0.
  let endorsementsCreados = 0;
  for (const [indiceJugador, equiposQueAvalan] of ENDORSEMENTS_SEED) {
    const blanda = await prisma.habilidadJugador.findFirst({
      where: { jugadorId: perfilesJugador[indiceJugador]!.id, habilidad: { categoria: "BLANDA" } },
    });
    if (!blanda) continue;
    for (const indiceEquipo of equiposQueAvalan) {
      const autorId = perfilesEquipo[indiceEquipo]!.usuarioId;
      await prisma.endorsement.upsert({
        where: { habilidadJugadorId_autorId: { habilidadJugadorId: blanda.id, autorId } },
        update: {},
        create: {
          habilidadJugadorId: blanda.id,
          autorId,
          comentario: "Buena comunicación en las scrims con nuestro equipo.",
        },
      });
      endorsementsCreados += 1;
    }
  }
  console.log(`  · ${endorsementsCreados} endorsements de equipos a habilidades blandas`);

  // ------------------------------------------------------------------ ofertas
  // Las fechas son relativas al momento del seed para que las ofertas parezcan
  // recientes; lo que se mantiene fijo es el recorrido de cada postulación.
  for (const [indice, datos] of OFERTAS.entries()) {
    const {
      equipo: indiceEquipo,
      pesos,
      publicadaHaceDias,
      cerradaHaceDias,
      postulaciones,
      ...campos
    } = datos;
    const equipo = perfilesEquipo[indiceEquipo]!;
    const data = {
      ...campos,
      juego: JUEGO_PILOTO,
      pesoTecnica: pesos.tecnica,
      pesoExperiencia: pesos.experiencia,
      pesoHabilidadesBlandas: pesos.habilidadesBlandas,
      pesoGeografica: pesos.geografica,
      pesoDisponibilidad: pesos.disponibilidad,
      publicadaEn: publicadaHaceDias === null ? null : haceDias(publicadaHaceDias),
      cerradaEn: cerradaHaceDias === null ? null : haceDias(cerradaHaceDias),
      equipoId: equipo.id,
    };
    const existente = await prisma.oferta.findFirst({
      where: { titulo: datos.titulo, equipoId: equipo.id },
    });
    const oferta = existente
      ? await prisma.oferta.update({ where: { id: existente.id }, data })
      : await prisma.oferta.create({ data });

    for (const { jugador, recorrido } of postulaciones) {
      const fechas = fechasDelRecorrido(recorrido);
      const estado = recorrido[recorrido.length - 1]![0];
      const jugadorId = perfilesJugador[jugador]!.id;
      await prisma.postulacion.upsert({
        where: { ofertaId_jugadorId: { ofertaId: oferta.id, jugadorId } },
        update: { estado, ...fechas },
        create: {
          ofertaId: oferta.id,
          jugadorId,
          estado,
          mensaje: `Me interesa la vacante de ${datos.rol} (${indice + 1}).`,
          ...fechas,
        },
      });
      postulacionesCreadas += 1;
    }
  }
  console.log(
    `  · ${OFERTAS.length} ofertas (abiertas, cubiertas, cerrada y borrador) y ${postulacionesCreadas} postulaciones con sus fechas`,
  );

  // ---------------------------------------------------------- notificaciones
  // RF-12 · Unas pocas para el equipo y el jugador de la demostración, sacadas
  // de sus postulaciones reales (hasta tres cada uno, la más antigua ya leída).
  // Se rehacen en cada ejecución.
  const equipoDemo = perfilesEquipo[0]!;
  const jugadorDemo = perfilesJugador[0]!;
  await prisma.notificacion.deleteMany({
    where: { usuarioId: { in: [equipoDemo.usuarioId, jugadorDemo.usuarioId] } },
  });
  const recibidas = await prisma.postulacion.findMany({
    where: { oferta: { equipoId: equipoDemo.id } },
    orderBy: [{ creadoEn: "desc" }, { id: "asc" }],
    take: 3,
    select: { id: true, creadoEn: true, oferta: { select: { id: true, titulo: true } } },
  });
  const propias = await prisma.postulacion.findMany({
    where: { jugadorId: jugadorDemo.id, estado: { not: "ENVIADA" } },
    select: {
      id: true,
      estado: true,
      revisadaEn: true,
      entrevistaEn: true,
      aceptadaEn: true,
      rechazadaEn: true,
      oferta: { select: { id: true, titulo: true, estado: true } },
    },
  });
  // Una por cada paso del recorrido, como las habrían creado los eventos; las tres últimas.
  const pasos = propias
    .flatMap((p) => {
      const porCierre = p.estado === "RECHAZADA" && p.oferta.estado !== "ABIERTA";
      const recorrido: [EstadoPostulacion, Date | null][] = [
        ["EN_REVISION", p.revisadaEn],
        ["ENTREVISTA", p.entrevistaEn],
        ["ACEPTADA", p.aceptadaEn],
        ["RECHAZADA", p.rechazadaEn],
      ];
      return recorrido
        .filter((paso): paso is [EstadoPostulacion, Date] => paso[1] !== null)
        .map(([estado, fecha]) => ({
          p,
          estado,
          fecha,
          origen: estado === "RECHAZADA" && porCierre ? "CIERRE_OFERTA" : "EQUIPO",
        }));
    })
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
    .slice(0, 3);
  const notificaciones = [
    ...recibidas.map((p, i) => ({
      usuarioId: equipoDemo.usuarioId,
      tipo: "NUEVA_POSTULACION",
      payload: { ofertaId: p.oferta.id, ofertaTitulo: p.oferta.titulo, postulacionId: p.id },
      creadoEn: p.creadoEn,
      // La más antigua, leída; las demás, sin leer.
      leidaEn: i > 0 && i === recibidas.length - 1 ? p.creadoEn : null,
    })),
    ...pasos.map(({ p, estado, fecha, origen }, i) => ({
      usuarioId: jugadorDemo.usuarioId,
      tipo: "POSTULACION_ACTUALIZADA",
      payload: {
        ofertaId: p.oferta.id,
        ofertaTitulo: p.oferta.titulo,
        postulacionId: p.id,
        estado,
        origen,
      },
      creadoEn: fecha,
      leidaEn: i > 0 && i === pasos.length - 1 ? fecha : null,
    })),
  ];
  await prisma.notificacion.createMany({ data: notificaciones });
  console.log(`  · ${notificaciones.length} notificaciones (equipo y jugador de la demostración)`);

  // ---------------------------------------------------------------- vectores
  // Con el vectorizador del motor de matching, a partir de las capturas que
  // se acaban de cargar: el ranking de la demostración sale de datos reales
  // del seed, no de vectores aleatorios.
  const vectores = await revectorizarTodos();
  console.log(`  · ${vectores} vectores de perfil (versión ${PERFIL_VECTOR_VERSION})`);

  console.log(
    `\nListo. Todas las cuentas de prueba usan la contraseña ${PASSWORD_DEMO}\n` +
      "  admin@proplay.gg (ADMIN) · scout@proplay.gg (SCOUT)\n" +
      "  equipo@caribeesports.gg (EQUIPO) · jugador1@proplay.gg … jugador21@proplay.gg (JUGADOR)",
  );
}

main()
  .catch((error) => {
    console.error("El seed falló:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
    void desconectarPrisma();
  });

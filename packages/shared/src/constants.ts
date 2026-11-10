/**
 * Constantes compartidas entre api y web.
 */
import type { Departamento, EstadoOferta, EstadoPostulacion } from "./enums";

/** Prefijo de la API REST versionada. */
export const API_PREFIX = "/api/v1";

/** Vigencia del token de acceso (JWT en memoria del cliente). */
export const ACCESS_TOKEN_TTL = "15m";
/** Vigencia del refresh token (cookie httpOnly). */
export const REFRESH_TOKEN_TTL = "7d";
/** Nombre de la cookie httpOnly que transporta el refresh token. */
export const REFRESH_COOKIE_NAME = "proplay_refresh";
/** Vigencia del refresh token en milisegundos (para maxAge de la cookie). */
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Paginación por defecto de los listados. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Versión vigente del aviso de privacidad y los términos de uso (RNF-05).
 * El servidor guarda esta versión al registrar la aceptación; nunca una que
 * envíe el cliente. Súbela cada vez que cambie el texto del aviso, a partir
 * de su primera publicación (antes, el texto se corrige sin subirla).
 */
export const VERSION_AVISO_PRIVACIDAD = "1.0";

/** Reglas de contraseña aplicadas en ambos lados. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // límite de bcrypt

/** Nivel de habilidad declarado por el jugador (1 = básico, 5 = experto). */
export const NIVEL_HABILIDAD_MIN = 1;
export const NIVEL_HABILIDAD_MAX = 5;

/** Dimensiones del vector de características usado por el matching. */
export const PERFIL_VECTOR_DIMENSIONES = 64;
/**
 * Versión del vectorizador que produjo el vector (`PerfilVector.version`).
 * La 1 eran vectores aleatorios del seed; la 2, el vectorizador del motor de
 * matching (docs/arquitectura.md, «Vectorizador»). Un vector de una versión
 * anterior se recalcula antes de usarlo, y `npm run matching:revectorizar -w api`
 * los recalcula todos.
 */
export const PERFIL_VECTOR_VERSION = 2;

/**
 * Pesos POR DEFECTO de las cinco dimensiones del algoritmo de compatibilidad
 * (ecuación (1), Sección VIII del documento). Cada equipo los ajusta al
 * publicar su oferta; estos son los valores iniciales del formulario y los que
 * se aplican si no se ajustan. api y web deben leerlos de aquí (CLAUDE.md
 * §3.1). La suma debe ser 1.
 *
 * Son los del piloto: experiencia y habilidades blandas en 0 porque todavía no
 * hay datos verificables con que medirlas (`DIMENSIONES_SIN_DATOS_PILOTO`;
 * decisión «Motor de matching» en docs/decisiones.md).
 */
export const PESOS_MATCHING = {
  tecnica: 0.5,
  experiencia: 0,
  habilidadesBlandas: 0,
  geografica: 0.25,
  disponibilidad: 0.25,
} as const;

export type DimensionMatching = keyof typeof PESOS_MATCHING;

/** Las cinco dimensiones, en el orden de la ecuación (1). */
export const DIMENSIONES_MATCHING = Object.keys(PESOS_MATCHING) as DimensionMatching[];

/**
 * Dimensiones sin datos en el piloto (arranque en frío, el mismo argumento que
 * el componente colaborativo): la experiencia no tiene modelo de trayectoria y
 * las habilidades blandas no tienen endorsements todavía. El motor las sigue
 * calculando (valen 0 sin datos) y el formulario de la oferta las fija en 0.
 */
export const DIMENSIONES_SIN_DATOS_PILOTO = [
  "experiencia",
  "habilidadesBlandas",
] as const satisfies readonly DimensionMatching[];

/**
 * Versión de las fórmulas de las cinco dimensiones. Se guarda en cada
 * `Matching`: al cambiar una fórmula, una escala o un subpeso se sube, y los
 * rankings calculados con la anterior se recalculan al leerlos.
 */
export const VERSION_FORMULAS_MATCHING = 1;

/**
 * Por qué una dimensión vale lo que vale cuando no sale del cálculo normal.
 * Los que implican «faltan datos» (la dimensión se puntúa con 0 o con el
 * neutro 0,5) están en `MOTIVOS_FALTAN_DATOS`; los otros dos son casos en los
 * que la oferta no pide nada que medir.
 */
export const MOTIVOS_DIMENSION = [
  /** Técnica: el jugador no tiene cuenta de Riot verificada (vale 0). */
  "SIN_CUENTA_VERIFICADA",
  /** Técnica: cuenta verificada, pero todavía sin captura de estadísticas (vale 0). */
  "SIN_CAPTURA",
  /** Experiencia: no hay modelo de trayectoria en el piloto (vale 0). */
  "SIN_DATOS_PILOTO",
  /** Habilidades blandas: ningún equipo ha avalado sus habilidades blandas (vale 0). */
  "SIN_ENDORSEMENTS",
  /** Geográfica: el jugador no tiene ubicación y la oferta no es remota (neutro). */
  "SIN_UBICACION",
  /** Disponibilidad: el jugador no ha declarado sus horas (neutro). */
  "SIN_HORAS",
  /** Geográfica: la oferta es remota, así que la ubicación no cuenta (vale 1). */
  "OFERTA_REMOTA",
  /** Disponibilidad: la oferta no pide horas (vale 1). */
  "OFERTA_SIN_HORAS",
] as const;
export type MotivoDimension = (typeof MOTIVOS_DIMENSION)[number];

/** Motivos que significan «faltan datos»: la interfaz los marca en el desglose. */
export const MOTIVOS_FALTAN_DATOS = [
  "SIN_CUENTA_VERIFICADA",
  "SIN_CAPTURA",
  "SIN_DATOS_PILOTO",
  "SIN_ENDORSEMENTS",
  "SIN_UBICACION",
  "SIN_HORAS",
] as const satisfies readonly MotivoDimension[];

/** Puntaje de una dimensión cuando falta el dato del jugador y no se puede afirmar nada. */
export const VALOR_NEUTRO_DIMENSION = 0.5;

/** Cercanía entre la ubicación del jugador y la de la oferta (dimensión geográfica). */
export const CERCANIAS_GEOGRAFICAS = [
  "MISMO_DEPARTAMENTO",
  "MISMA_MACRORREGION",
  "MISMO_PAIS",
  "OTRO_PAIS",
] as const;
export type CercaniaGeografica = (typeof CERCANIAS_GEOGRAFICAS)[number];

/**
 * Métricas de `metricasLolSchema` y de `Estadistica` que entran en el
 * rendimiento de la dimensión técnica. Qué métricas cuentan para cada posición
 * y contra qué escala se normalizan lo fija el motor (docs/arquitectura.md).
 */
export const METRICAS_TECNICA_LOL = [
  "winRate",
  "kda",
  "csPorMinuto",
  "oroPorMinuto",
  "danoPorMinuto",
  "visionPorMinuto",
  "participacionKills",
] as const;
export type MetricaTecnicaLol = (typeof METRICAS_TECNICA_LOL)[number];

/**
 * Modo del motor: `CONTENIDO` mientras el componente colaborativo tiene peso 0
 * (arranque en frío, Sección VIII-C); `HIBRIDO` cuando lo tenga.
 */
export const MODOS_MATCHING = ["CONTENIDO", "HIBRIDO"] as const;
export type ModoMatching = (typeof MODOS_MATCHING)[number];

/**
 * Margen admitido en la suma de los pesos de una oferta. Los deslizadores
 * trabajan en porcentajes enteros, pero la suma en coma flotante de cinco
 * décimas no siempre da 1 exacto.
 */
export const TOLERANCIA_SUMA_PESOS = 0.001;

/**
 * Transiciones permitidas de la oferta. `CUBIERTA` exige además al menos una
 * postulación `ACEPTADA` (lo comprueba el servidor). Los estados finales no
 * tienen salida: una vacante no se reabre, se publica otra.
 */
export const TRANSICIONES_OFERTA = {
  BORRADOR: ["ABIERTA", "CERRADA"],
  ABIERTA: ["CUBIERTA", "CERRADA"],
  CUBIERTA: [],
  CERRADA: [],
} as const satisfies Record<EstadoOferta, readonly EstadoOferta[]>;

/**
 * Transiciones permitidas de la postulación: el embudo avanza de un paso en
 * uno, sin saltos, y se puede rechazar desde cualquier estado no final. Así
 * cada fecha de `FECHA_POR_ESTADO_POSTULACION` se escribe una sola vez.
 */
export const TRANSICIONES_POSTULACION = {
  ENVIADA: ["EN_REVISION", "RECHAZADA"],
  EN_REVISION: ["ENTREVISTA", "RECHAZADA"],
  ENTREVISTA: ["ACEPTADA", "RECHAZADA"],
  ACEPTADA: [],
  RECHAZADA: [],
} as const satisfies Record<EstadoPostulacion, readonly EstadoPostulacion[]>;

/**
 * Columna de `Postulacion` que guarda la fecha en que se alcanzó cada estado.
 * `ENVIADA` es la creación de la postulación. Es la base del embudo de la
 * vacante y del tiempo hasta cubrirla (H1).
 */
export const FECHA_POR_ESTADO_POSTULACION = {
  ENVIADA: "creadoEn",
  EN_REVISION: "revisadaEn",
  ENTREVISTA: "entrevistaEn",
  ACEPTADA: "aceptadaEn",
  RECHAZADA: "rechazadaEn",
} as const satisfies Record<EstadoPostulacion, string>;

/** Único juego del piloto (decisión «Privacidad y piloto»). */
export const JUEGO_PILOTO = "League of Legends";

/** Umbral a partir del cual un match se considera relevante para el scout. */
export const UMBRAL_MATCH_RELEVANTE = 0.6;

/** Límite de subida de medios a Cloudinary. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Países admitidos en la ubicación del jugador: códigos ISO 3166-1 alfa-2
 * asignados oficialmente. Se guardan en `PerfilJugador.pais` (`CHAR(2)`). No es
 * un enum de Prisma porque la lista es larga y la mantiene ISO.
 */
export const PAISES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW",
  "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ",
  "EC", "EE", "EG", "EH", "ER", "ES", "ET",
  "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT",
  "GU", "GW", "GY",
  "HK", "HM", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
  "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS",
  "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
  "OM",
  "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
  "QA",
  "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
  "UA", "UG", "UM", "US", "UY", "UZ",
  "VA", "VC", "VE", "VG", "VI", "VN", "VU",
  "WF", "WS",
  "YE", "YT",
  "ZA", "ZM", "ZW",
] as const;
export type Pais = (typeof PAISES)[number];

/** País cuya ubicación se precisa por departamento (el piloto es en el Caribe colombiano). */
export const PAIS_CON_DEPARTAMENTO = "CO" satisfies Pais;

/**
 * Macrorregiones de Colombia. No se guardan: se derivan del departamento con
 * `MACROREGION_POR_DEPARTAMENTO`. Las usa la dimensión geográfica del matching
 * (misma macrorregión = coincidencia parcial) y el análisis por segmento del
 * piloto (el Caribe frente al resto del país).
 */
export const MACROREGIONES = [
  "CARIBE",
  "ANDINA",
  "PACIFICA",
  "ORINOQUIA",
  "AMAZONIA",
] as const;
export type Macrorregion = (typeof MACROREGIONES)[number];

/**
 * Macrorregión de cada departamento. Un departamento que abarca varias regiones
 * naturales se asigna a una sola, como en las regiones administrativas de
 * planificación: Cauca, Chocó, Nariño y Valle del Cauca son Pacífica; Antioquia
 * y Norte de Santander, Andina. San Andrés, que en la división natural es
 * Insular, cuenta como Caribe para el piloto.
 */
export const MACROREGION_POR_DEPARTAMENTO = {
  AMAZONAS: "AMAZONIA",
  ANTIOQUIA: "ANDINA",
  ARAUCA: "ORINOQUIA",
  ATLANTICO: "CARIBE",
  BOGOTA_DC: "ANDINA",
  BOLIVAR: "CARIBE",
  BOYACA: "ANDINA",
  CALDAS: "ANDINA",
  CAQUETA: "AMAZONIA",
  CASANARE: "ORINOQUIA",
  CAUCA: "PACIFICA",
  CESAR: "CARIBE",
  CHOCO: "PACIFICA",
  CORDOBA: "CARIBE",
  CUNDINAMARCA: "ANDINA",
  GUAINIA: "AMAZONIA",
  GUAVIARE: "AMAZONIA",
  HUILA: "ANDINA",
  LA_GUAJIRA: "CARIBE",
  MAGDALENA: "CARIBE",
  META: "ORINOQUIA",
  NARINO: "PACIFICA",
  NORTE_DE_SANTANDER: "ANDINA",
  PUTUMAYO: "AMAZONIA",
  QUINDIO: "ANDINA",
  RISARALDA: "ANDINA",
  SAN_ANDRES: "CARIBE",
  SANTANDER: "ANDINA",
  SUCRE: "CARIBE",
  TOLIMA: "ANDINA",
  VALLE_DEL_CAUCA: "PACIFICA",
  VAUPES: "AMAZONIA",
  VICHADA: "ORINOQUIA",
} as const satisfies Record<Departamento, Macrorregion>;

// ------------------------- Integración con Riot ----------------------------

/**
 * Servidores (plataformas) de League of Legends, en el formato que usa la API
 * de Riot. El piloto vive en LA1 (Latinoamérica Norte, donde juega Colombia).
 * No es enum de Prisma: se guarda como texto en `CuentaGaming.servidor`.
 */
export const SERVIDORES_LOL = [
  "LA1",
  "LA2",
  "NA1",
  "BR1",
  "EUW1",
  "EUN1",
  "TR1",
  "RU",
  "ME1",
  "KR",
  "JP1",
  "OC1",
  "SG2",
  "TW2",
  "VN2",
] as const;
export type ServidorLol = (typeof SERVIDORES_LOL)[number];
export const SERVIDOR_LOL_POR_DEFECTO: ServidorLol = "LA1";

/**
 * Ligas (`tier`) de league-v4 tal como las escribe Riot, de menor a mayor. Sólo
 * describen el rango detallado de `metricas` (con LP y victorias); para filtrar
 * y comparar se usa `RangoLol` (enums.ts), que sale de `rangoDesdeRiot`.
 */
export const LIGAS_LOL = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;
export type LigaLol = (typeof LIGAS_LOL)[number];

/** Partidas recientes que se analizan en cada sincronización. */
export const PARTIDAS_POR_SINCRONIZACION = 20;
/** Minutos mínimos entre dos sincronizaciones del mismo jugador (cuota de Riot). */
export const MINUTOS_ENTRE_SINCRONIZACIONES = 10;
/**
 * Vigencia del desafío de verificación de la cuenta de Riot. Riot tarda uno o
 * dos minutos en reflejar un cambio de icono: 15 minutos dejan margen de sobra.
 */
export const MINUTOS_DESAFIO_VERIFICACION = 15;
/** Cada cuánto comprueba sola la vista de Cuentas vinculadas un desafío activo. */
export const SEGUNDOS_COMPROBACION_AUTOMATICA = 45;
/**
 * Comprobaciones de un mismo desafío pegadas a la anterior: la API responde
 * con la última sin volver a consultar a Riot (dos pestañas abiertas, dobles clics).
 */
export const SEGUNDOS_MINIMOS_ENTRE_COMPROBACIONES = 15;
/**
 * Comprobaciones que admite un desafío, aparte del límite de la vinculación.
 * 15 min / 45 s son 20 automáticas; el resto cubre las manuales y una segunda pestaña.
 */
export const MAX_COMPROBACIONES_DESAFIO = 40;
/**
 * Iconos de invocador que toda cuenta tiene desbloqueados (0 a 28): la
 * verificación pide poner uno de ellos, así cualquiera puede completarla.
 */
export const ICONO_VERIFICACION_MIN = 0;
export const ICONO_VERIFICACION_MAX = 28;

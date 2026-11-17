// RF-13 · Métricas del piloto para el informe de la tesis (tareas 3.17 y 4.14).
// Procedimiento en docs/operacion.md.
//
//   local:     npm run metricas:piloto -w api -- [opciones]
//   servidor:  node apps/api/dist/cli/metricasPiloto.js [opciones]
//
// Escribe seis CSV con las mismas definiciones que la analítica de la API
// (docs/arquitectura.md, «Analítica») sobre todas las ofertas del piloto.
// Por defecto deja fuera las cuentas del seed (--excluir-prueba).
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  DIMENSIONES_VISIBLES,
  ETAPAS_EMBUDO,
  LINEA_BASE_SCOUTING_MANUAL,
  ZONA_HORARIA_PILOTO,
  type CeldaTalento,
  type LineaBaseScouting,
  type ResumenDiasRespuesta,
} from "@proplay/shared";
import { desconectarPrisma } from "../config/prisma";
import { metricasPiloto, type MetricasPiloto, type OpcionesPiloto } from "../modules/analitica/analitica.service";

/** Códigos de salida del script. */
export const SALIDA = { OK: 0, ERROR: 1, USO: 2 } as const;

export interface Consola {
  log: (mensaje: string) => void;
  error: (mensaje: string) => void;
}

const USO = [
  "Uso: npm run metricas:piloto -w api -- [opciones]",
  "  --desde AAAA-MM-DD      primer día de publicación de las ofertas (incluido)",
  "  --hasta AAAA-MM-DD      último día de publicación de las ofertas (incluido)",
  "  --salida <carpeta>      dónde escribir los CSV (por defecto, ./metricas-piloto)",
  "  --excluir-prueba        deja fuera las cuentas del seed (por defecto)",
  "  --no-excluir-prueba     las incluye",
].join("\n");

export interface Argumentos extends OpcionesPiloto {
  salida: string;
}

/** Fecha AAAA-MM-DD válida del calendario (no acepta 2026-02-30). */
function esFecha(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

/** Lee los argumentos; devuelve un mensaje de error si no son válidos. */
export function leerArgumentos(argumentos: readonly string[]): Argumentos | string {
  const resultado: Argumentos = { salida: "metricas-piloto", excluirPrueba: true };
  for (let i = 0; i < argumentos.length; i++) {
    const [nombre, enLinea] = argumentos[i]!.split(/=(.*)/s, 2) as [string, string | undefined];
    const valor = () => enLinea ?? argumentos[++i];
    switch (nombre) {
      case "--desde":
      case "--hasta": {
        const fecha = valor();
        if (!fecha || !esFecha(fecha)) return `${nombre} necesita una fecha AAAA-MM-DD válida`;
        resultado[nombre === "--desde" ? "desde" : "hasta"] = fecha;
        break;
      }
      case "--salida": {
        const carpeta = valor();
        if (!carpeta?.trim()) return "--salida necesita una carpeta";
        resultado.salida = carpeta;
        break;
      }
      case "--excluir-prueba":
        if (enLinea !== undefined && enLinea !== "true" && enLinea !== "false") {
          return "--excluir-prueba admite sólo true o false";
        }
        resultado.excluirPrueba = enLinea !== "false";
        break;
      case "--no-excluir-prueba":
        resultado.excluirPrueba = false;
        break;
      default:
        return `Opción desconocida: ${nombre}`;
    }
  }
  if (resultado.desde && resultado.hasta && resultado.desde > resultado.hasta) {
    return "--desde no puede ser posterior a --hasta";
  }
  return resultado;
}

// ---------------------------------------------------------------------- CSV

type Valor = string | number | boolean | null | undefined;

/** Número con hasta 4 decimales, punto decimal y sin ceros sobrantes. */
function numero(n: number): string {
  return String(Number(n.toFixed(4)));
}

function celda(valor: Valor): string {
  if (valor === null || valor === undefined) return "";
  const texto = typeof valor === "number" ? numero(valor) : String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV según RFC 4180: coma como separador, punto decimal, UTF-8, fin de línea CRLF. */
export function aCsv(cabecera: readonly string[], filas: readonly Valor[][]): string {
  return [cabecera, ...filas].map((fila) => fila.map(celda).join(",")).join("\r\n") + "\r\n";
}

const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA_PILOTO });
/** Fecha del calendario en la zona del piloto (AAAA-MM-DD). */
const diaLocal = (fecha: Date | null) => (fecha ? formatoDia.format(fecha) : null);

/** Celda del mapa: el número, u «oculto» si se ocultó por privacidad. */
const talentoCelda = (c: CeldaTalento) => (c === null ? "oculto" : c);

const PENDIENTE = "pendiente";

/** Los seis CSV del piloto, por nombre de archivo. */
export function csvDelPiloto(m: MetricasPiloto): Record<string, string> {
  const etapaFilas = (ambito: string, titulo: string, embudo: MetricasPiloto["embudo"]) =>
    embudo.etapas.map((e) => [
      ambito,
      titulo,
      e.etapa,
      e.alcanzaron,
      e.conversion,
      e.siguen,
      e.rechazadas,
      e.rechazadasAlCerrar,
    ]);
  const tiempoFilas = (ambito: string, embudo: MetricasPiloto["embudo"]) =>
    embudo.etapas
      .filter((e) => e.etapa !== "ACEPTADA")
      .map((e) => [ambito, e.etapa, e.diasEnEtapa.n, e.diasEnEtapa.mediana, e.diasEnEtapa.media]);

  const embudoPorOferta = aCsv(
    ["ambito", "titulo", "etapa", "alcanzaron", "conversion", "siguen", "rechazadas", "rechazadas_al_cerrar"],
    [
      ...etapaFilas("TOTAL", "Todas las ofertas", m.embudo),
      ...m.ofertas.flatMap((o) => etapaFilas(o.id, o.titulo, o.embudo)),
    ],
  );

  const tiemposPorEtapa = aCsv(
    ["ambito", "etapa", "n", "mediana_dias", "media_dias"],
    [...tiempoFilas("TOTAL", m.embudo), ...m.ofertas.flatMap((o) => tiempoFilas(o.id, o.embudo))],
  );

  const tiempoHastaCubrir = aCsv(
    [
      "oferta_id",
      "equipo",
      "titulo",
      "rol",
      "estado",
      "publicada",
      "cerrada",
      "postulaciones",
      "dias_hasta_cubrir",
      "dias_hasta_primer_tryout",
      "dias_abierta",
    ],
    m.ofertas.map((o) => [
      o.id,
      o.equipo,
      o.titulo,
      o.rol,
      o.estado,
      diaLocal(o.publicadaEn),
      diaLocal(o.cerradaEn),
      o.postulaciones,
      o.diasHastaCubrir,
      o.diasHastaPrimerTryout,
      o.diasAbierta,
    ]),
  );

  const dimensionDecisiva = aCsv(
    [
      "oferta_id",
      "titulo",
      "candidatos",
      "suficiente",
      "decisiva",
      "puntaje_medio_top",
      "puntaje_medio_resto",
      "ventaja_total",
      ...DIMENSIONES_VISIBLES.map((d) => `ventaja_${d}`),
      "ventaja_otras",
      "calculado_en",
    ],
    m.ofertas.map(({ id, titulo, dimensionDecisiva: d }) => {
      const ventaja = (clave: string) => d.dimensiones.find((x) => x.dimension === clave)?.ventaja ?? null;
      return [
        id,
        titulo,
        d.candidatos,
        d.suficiente,
        d.decisiva,
        d.puntajeMedioTop,
        d.puntajeMedioResto,
        d.ventajaTotal,
        ...DIMENSIONES_VISIBLES.map(ventaja),
        ventaja("otras"),
        d.calculadoEn.toISOString(),
      ];
    }),
  );

  const t = m.talento;
  const talentoVerificado = aCsv(
    ["tabla", "grupo", "categoria", "jugadores"],
    [
      ["resumen", "TODOS", "registrados", t.jugadoresRegistrados],
      ["resumen", "TODOS", "verificados", t.verificados],
      ["resumen", "TODOS", "proporcion_verificados", t.proporcionVerificados],
      ["ubicacion", "FUERA_DE_COLOMBIA", "total", talentoCelda(t.fueraDeColombia)],
      ["ubicacion", "SIN_UBICACION", "total", talentoCelda(t.sinUbicacion)],
      ...t.grupos.flatMap((g) => [
        ["grupo", g.grupo, "total", talentoCelda(g.total)],
        ...Object.entries(g.porPosicion).map(([p, c]) => ["posicion", g.grupo, p, talentoCelda(c)]),
        ...Object.entries(g.porBanda).map(([b, c]) => ["banda_rango", g.grupo, b, talentoCelda(c)]),
      ]),
      ...t.macrorregiones.flatMap((macro) => [
        ["macrorregion", macro.macrorregion, "total", talentoCelda(macro.total)],
        ...macro.departamentos.map((d) => [
          "departamento",
          macro.macrorregion,
          d.departamento,
          talentoCelda(d.jugadores),
        ]),
      ]),
    ],
  );

  const resumenH1 = aCsv(["metrica", "valor", "n", "nota"], filasResumen(m, LINEA_BASE_SCOUTING_MANUAL));

  return {
    "embudo_por_oferta.csv": embudoPorOferta,
    "tiempos_por_etapa.csv": tiemposPorEtapa,
    "tiempo_hasta_cubrir.csv": tiempoHastaCubrir,
    "dimension_decisiva.csv": dimensionDecisiva,
    "talento_verificado.csv": talentoVerificado,
    "resumen_h1.csv": resumenH1,
  };
}

/**
 * Filas de `resumen_h1.csv`: los tiempos de H1 de ProPlay frente a la línea
 * base, las coincidencias, la cobertura, la adopción y los parámetros con que
 * se generó. Es evidencia descriptiva con su n, no un contraste estadístico.
 */
export function filasResumen(m: MetricasPiloto, lineaBase: LineaBaseScouting | null): Valor[][] {
  const serie = (nombre: string, r: ResumenDiasRespuesta | null, nota: string): Valor[][] =>
    r
      ? [
          [`${nombre}_mediana`, r.mediana, r.n, nota],
          [`${nombre}_media`, r.media, r.n, nota],
        ]
      : [
          [`${nombre}_mediana`, PENDIENTE, null, nota],
          [`${nombre}_media`, PENDIENTE, null, nota],
        ];
  const base = lineaBase
    ? `línea base medida el ${lineaBase.medidaEn} con ${lineaBase.equipos} equipos y ${lineaBase.vacantes} vacantes (${lineaBase.fuente})`
    : "línea base pendiente de medición (tarea 0.2)";
  const etapa = (e: (typeof ETAPAS_EMBUDO)[number]) => m.embudo.etapas.find((x) => x.etapa === e)!;
  return [
    ...serie("proplay_dias_hasta_cubrir", m.diasHastaCubrir, "publicación → primera aceptación, ofertas cubiertas, días naturales en Colombia"),
    ...serie("linea_base_dias_hasta_cubrir", lineaBase?.diasHastaCubrir ?? null, base),
    ...serie("proplay_dias_hasta_primer_tryout", m.diasHastaPrimerTryout, "publicación → primera entrevista, ofertas que llegaron a un tryout"),
    ...serie("linea_base_dias_hasta_primer_tryout", lineaBase?.diasHastaPrimerTryout ?? null, base),
    ["coincidencias_exitosas", m.embudo.coincidenciasExitosas, null, "postulaciones aceptadas"],
    ["postulaciones", m.embudo.postulaciones, null, null],
    ["conversion_enviada_a_aceptada", m.embudo.postulaciones === 0 ? null : etapa("ACEPTADA").alcanzaron / m.embudo.postulaciones, m.embudo.postulaciones, null],
    ["ofertas_abiertas", m.cobertura.abiertas, null, null],
    ["ofertas_cubiertas", m.cobertura.cubiertas, null, null],
    ["ofertas_cerradas_sin_cubrir", m.cobertura.cerradasSinCubrir, null, null],
    ["tasa_cobertura", m.cobertura.tasa, m.cobertura.cubiertas + m.cobertura.cerradasSinCubrir, "cubiertas / (cubiertas + cerradas sin cubrir)"],
    ["registros_jugador", m.registros.JUGADOR ?? 0, null, "cuentas activas"],
    ["registros_equipo", m.registros.EQUIPO ?? 0, null, "cuentas activas"],
    ["registros_scout", m.registros.SCOUT ?? 0, null, "cuentas activas"],
    ["jugadores_verificados", m.talento.verificados, null, null],
    ["proporcion_verificados", m.talento.proporcionVerificados, m.talento.jugadoresRegistrados, "verificados / jugadores registrados"],
    ["parametro_desde", m.opciones.desde ?? "", null, "primer día de publicación incluido"],
    ["parametro_hasta", m.opciones.hasta ?? "", null, "último día de publicación incluido"],
    ["parametro_excluir_prueba", m.opciones.excluirPrueba, null, "true: sin las cuentas del seed"],
    ["generado_en", m.generadoEn.toISOString(), null, null],
  ];
}

// ------------------------------------------------------------------ script

/** Ejecuta el script con sus argumentos y devuelve el código de salida. */
export async function ejecutar(
  argumentos: readonly string[],
  consola: Consola = console,
  ahora = new Date(),
): Promise<number> {
  const leidos = leerArgumentos(argumentos);
  if (typeof leidos === "string") {
    consola.error(`${leidos}\n\n${USO}`);
    return SALIDA.USO;
  }
  const { salida, ...opciones } = leidos;
  const metricas = await metricasPiloto(opciones, ahora);
  const archivos = csvDelPiloto(metricas);
  const carpeta = resolve(salida);
  await mkdir(carpeta, { recursive: true });
  await Promise.all(
    Object.entries(archivos).map(([nombre, contenido]) => writeFile(resolve(carpeta, nombre), contenido, "utf8")),
  );
  consola.log(
    `Métricas del piloto en ${carpeta}: ${metricas.ofertas.length} ofertas, ` +
      `${metricas.embudo.postulaciones} postulaciones, ${metricas.talento.verificados} jugadores verificados` +
      (opciones.excluirPrueba ? " (sin las cuentas del seed)." : " (con las cuentas del seed)."),
  );
  return SALIDA.OK;
}

if (require.main === module) {
  ejecutar(process.argv.slice(2))
    .then((codigo) => {
      process.exitCode = codigo;
    })
    .catch((error: unknown) => {
      console.error("Error inesperado al calcular las métricas del piloto:", error);
      process.exitCode = SALIDA.ERROR;
    })
    .finally(() => desconectarPrisma());
}

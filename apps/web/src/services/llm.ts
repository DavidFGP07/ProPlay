import type {
  ExplicacionMatching,
  FuenteGrounding,
  Oferta,
  PerfilEquipo,
  PerfilJugador,
  ResultadoMatching,
  Estadistica,
} from '@/types'

/**
 * Explicador del matching (componente "Explicador" del Nivel 3 del modelo C4).
 *
 * En el sistema real este componente invoca un modelo de lenguaje de
 * arquitectura Transformer anclado en datos recuperados en tiempo real
 * (generacion aumentada por recuperacion) y delega todo calculo numerico al
 * calculador exacto en sandbox de Python.
 *
 * En el prototipo la redaccion se genera de forma determinista a partir del
 * desglose real del matching, de modo que la explicacion siempre es coherente
 * con los datos mostrados en pantalla y nunca inventa metricas.
 */

const MODELO = 'Transformer + RAG (simulado)'

function fuente(etiqueta: string, url: string, detalle: string): FuenteGrounding {
  return { etiqueta, url, detalle }
}

function fraseDimension(d: ResultadoMatching['desglose'][number]): string {
  return d.detalle
}

export function generarExplicacion(
  resultado: ResultadoMatching,
  oferta: Oferta,
  jugador: PerfilJugador,
  equipo: PerfilEquipo,
  stats: Estadistica[],
  plataformaVinculada: string,
): ExplicacionMatching {
  const porClave = new Map(resultado.desglose.map((d) => [d.key, d]))
  const ordenadas = [...resultado.desglose].sort((a, b) => b.valor - a.valor)
  const masAlta = ordenadas[0]
  const masBaja = ordenadas[ordenadas.length - 1]

  const statPrincipal = stats.find((s) => s.juego === oferta.juego)

  const resumen =
    `${jugador.nombre} (${jugador.handle}) alcanza una compatibilidad del ` +
    `${Math.round(resultado.puntaje * 100)} % con la vacante de ${oferta.rol} en ` +
    `${oferta.juego} publicada por ${equipo.nombre}. La evaluacion se apoya en ` +
    `${stats.length} registro(s) de estadisticas obtenidos por ingesta directa ` +
    `desde la API oficial del juego, no en datos autodeclarados. ` +
    `La dimension que mas pesa es ${masAlta.key} ` +
    `(${Math.round(masAlta.valor * 100)} %) y la que menos "${masBaja.key}" ` +
    `(${Math.round(masBaja.valor * 100)} %). ` +
    (resultado.modo === 'hibrido'
      ? `El ranking se calculo en modo hibrido, incorporando la senal colaborativa del historial de interacciones del equipo (peso ${Math.round(resultado.pesoColaborativo * 100)} %).`
      : `El ranking se calculo en modo de contenido puro: el equipo aun no acumula historial suficiente de interacciones para activar el componente colaborativo, por lo que este contribute con peso cero.`)

  const fortalezas: string[] = []
  const riesgos: string[] = []

  const tecnica = porClave.get('tecnica')
  const experiencia = porClave.get('experiencia')
  const blandas = porClave.get('blandas')
  const geografica = porClave.get('geografica')
  const disponibilidad = porClave.get('disponibilidad')

  if (tecnica && tecnica.valor >= 0.7) {
    fortalezas.push(`Desempeno tecnico por encima del umbral: ${fraseDimension(tecnica)}.`)
  } else if (tecnica) {
    riesgos.push(`El rendimiento tecnico queda por debajo del perfil requerido: ${fraseDimension(tecnica)}.`)
  }

  if (experiencia && experiencia.valor >= 0.6) {
    fortalezas.push(`Trayectoria competitiva coherente con la vacante: ${fraseDimension(experiencia)}.`)
  } else if (experiencia) {
    riesgos.push(`Experiencia limitada frente al minimo solicitado: ${fraseDimension(experiencia)}.`)
  }

  if (blandas && blandas.valor >= 0.6) {
    fortalezas.push(`Habilidades blandas respaldadas por terceros: ${fraseDimension(blandas)}.`)
  } else if (blandas) {
    riesgos.push(`Validacion de terceros limitada: ${fraseDimension(blandas)}.`)
  }

  if (geografica && geografica.valor >= 0.8) {
    fortalezas.push(`Compatibilidad geografica resuelta: ${fraseDimension(geografica)}.`)
  } else if (geografica) {
    riesgos.push(`Restriccion geografica relevante: ${fraseDimension(geografica)}.`)
  }

  if (disponibilidad && disponibilidad.valor >= 0.8) {
    fortalezas.push(`Disponibilidad semanal suficiente: ${fraseDimension(disponibilidad)}.`)
  } else if (disponibilidad) {
    riesgos.push(`Disponibilidad por debajo de lo requerido: ${fraseDimension(disponibilidad)}.`)
  }

  if (statPrincipal && statPrincipal.partidas < 200) {
    riesgos.push(
      `Muestra estadistica reducida (${statPrincipal.partidas} partidas), por lo que la estimacion tiene mayor incertidumbre.`,
    )
  }

  const grounding: FuenteGrounding[] = [
    fuente(
      `API oficial ${statPrincipal?.fuente === 'api-steam' ? 'Steam' : 'Riot Games'}`,
      `https://developer.${statPrincipal?.fuente === 'api-steam' ? 'steampowered.com' : 'riotgames.com'}`,
      statPrincipal
        ? `${statPrincipal.partidas.toLocaleString('es-CO')} partidas · ${statPrincipal.victorias.toLocaleString('es-CO')} victorias · KDA ${statPrincipal.kda.toFixed(2)} · rango ${statPrincipal.rango} (sincronizado ${statPrincipal.ultimaSync.slice(0, 10)})`
        : 'Sin registro sincronizado para esta oferta',
    ),
    fuente(
      'Perfil verificable ProPlay',
      `https://proplay.co/jugadores/${jugador.id}`,
      `Registrada la cuenta de ${plataformaVinculada} mediante OAuth 2.0; token almacenado con cifrado AES-256-GCM.`,
    ),
    fuente(
      'Escalera regional de clasificacion',
      `https://proplay.co/ranking/${oferta.juego.replace(/\s+/g, '-').toLowerCase()}`,
      `Puesto del jugador dentro del ranking regional de ${oferta.juego} calculado sobre el mismo esquema de normalizacion del indice vectorial.`,
    ),
  ]

  return {
    resumen,
    fortalezas,
    riesgos,
    grounding,
    generadoEn: new Date().toISOString(),
    modelo: MODELO,
    latenciaMs: 0,
  }
}

/**
 * Calculador exacto (sandbox de Python). En el prototipo se replica el
 * contrato: recibe los puntajes y devuelve el calculo numerico redondeado,
 * sin permitir que el modelo de lenguaje lo resuelva por si mismo.
 */
export function calculoExactoSandbox(resultados: ResultadoMatching[]): ResultadoMatching[] {
  return resultados.map((r) => ({
    ...r,
    puntaje: Math.round(r.puntaje * 1e6) / 1e6,
  }))
}

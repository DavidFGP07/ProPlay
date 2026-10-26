import {
  cuentasGaming,
  endorsements,
  estadisticas,
  habilidades,
  habilidadesJugador,
  perfilesEquipo,
  perfilesJugador,
  postulaciones as postulacionesSeed,
  ofertas as ofertasSeed,
  usuarios,
  mensajes as mensajesSeed,
  actividadFeed,
} from '@/mocks/seed'
import {
  calcularRanking,
  invalidarCacheEmbeddings,
  type MatchingContexto,
  type OpcionesRanking,
} from '@/services/matching'
import { calculoExactoSandbox, generarExplicacion } from '@/services/llm'
import { esCaribe } from '@/lib/matching'
import { es } from '@/i18n/es'
import type {
  PlataformaJuego,
  AuditLog,
  ConfiguracionPrivacidad,
  CuentaGaming,
  Endorsement,
  Estadistica,
  ExplicacionMatching,
  FiltrosBusqueda,
  Habilidad,
  HabilidadJugador,
  Mensaje,
  NivelHabilidad,
  Notificacion,
  Oferta,
  PerfilEquipo,
  PerfilJugador,
  Postulacion,
  RecomendacionOferta,
  Region,
  ResultadoMatching,
  TipoNotificacion,
  Usuario,
} from '@/mocks/modelos'

/* ============================================================================
 * Capa de integracion / API.
 *
 * Expone las mismas rutas REST que describe la Seccion VIII-B, pero servidas
 * en memoria para que el prototipo funcione sin dependencias externas.
 * Sustituir esta capa por el backend Node.js/Express del proyecto real no
 * requiere cambios en la UI: el contrato es identico.
 *
 * Toda operacion sensible pasa por `registrarAuditoria` (RNF-06) y las que
 * generan un evento de negocio emit una notificacion al actor implicado
 * (RF-12).
 * ==========================================================================*/

/**
 * Latencia simulada de la red. En modo de pruebas se elimina para que la
 * suite sea rapida y determinista; en el prototipo reproduce el tiempo de
 * respuesta de la API REST real.
 */
const MODO_PRUEBAS = import.meta.env.MODE === 'test'

const delay = (ms: number) =>
  MODO_PRUEBAS ? Promise.resolve() : new Promise((r) => setTimeout(r, ms))
const jitter = (base: number, rango = 180) =>
  delay(base + Math.random() * rango)

/* --------------------------- Estado en memoria --------------------------- */

let ofertas: Oferta[] = [...ofertasSeed]
let postulaciones: Postulacion[] = [...postulacionesSeed]
let mensajes: Mensaje[] = [...mensajesSeed]
let estadisticasVivas: Estadistica[] = [...estadisticas]
let cuentasVivas: CuentaGaming[] = [...cuentasGaming]
let habilidadesJugadorVivas: HabilidadJugador[] = [...habilidadesJugador]
let endorsementsVivas: Endorsement[] = [...endorsements]
let notificaciones: Notificacion[] = []
let privacidad: ConfiguracionPrivacidad[] = []
let ultimaSyncGlobal: string | null = null

const auditLog: AuditLog[] = []

function registrarAuditoria(usuario: Usuario, accion: string, entidad: string) {
  auditLog.unshift({
    id: `au-${auditLog.length + 1}`,
    usuarioId: usuario.id,
    usuarioNombre: usuario.nombre,
    accion,
    entidad,
    fecha: new Date().toISOString(),
  })
}

export function obtenerAuditLog(): AuditLog[] {
  return auditLog
}

/* ------------------------------ Notificaciones --------------------------- */

/** Emite un evento de negocio hacia la bandeja del usuario implicado. */
function emitirNotificacion(
  usuarioId: string,
  tipo: TipoNotificacion,
  titulo: string,
  detalle: string,
  enlace?: string,
) {
  notificaciones.unshift({
    id: `nt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    usuarioId,
    tipo,
    titulo,
    detalle,
    enlace,
    fecha: new Date().toISOString(),
    leida: false,
  })
}

/** Semilla la bandeja con los eventos ya occurring en los datos de arranque. */
function sembrarNotificaciones() {
  const base: Omit<Notificacion, 'id' | 'leida'>[] = [
    {
      usuarioId: 'u-jugador-1',
      tipo: 'postulacion',
      titulo: 'Tu postulacion cambio de estado',
      detalle: 'Atlantico Esports reviso tu postulacion para Mid lane en League of Legends.',
      fecha: '2026-10-19T09:12:00Z',
      enlace: '/vacantes/o-01',
    },
    {
      usuarioId: 'u-jugador-1',
      tipo: 'endoso',
      titulo: 'Carlos Mendoza endoso tu comunicacion',
      detalle: 'Endorsement validado sobre una de tus habilidades declaradas.',
      fecha: '2026-10-18T16:45:00Z',
      enlace: '/mi-perfil',
    },
    {
      usuarioId: 'u-jugador-1',
      tipo: 'ingesta',
      titulo: 'Estadisticas sincronizadas',
      detalle: 'El worker de ingesta actualizo tus registros desde la API oficial de Riot Games.',
      fecha: '2026-10-19T08:12:00Z',
      enlace: '/mi-perfil',
    },
    {
      usuarioId: 'u-jugador-1',
      tipo: 'oferta',
      titulo: '3 vacantes nuevas coinciden con tu perfil',
      detalle: 'El motor de matching recalculo el ranking con tu snapshot mas reciente.',
      fecha: '2026-10-19T08:15:00Z',
      enlace: '/vacantes',
    },
    {
      usuarioId: 'u-equipo-1',
      tipo: 'postulacion',
      titulo: 'Nueva postulacion a Mid lane',
      detalle: 'Daniel Ocoro se postulo a la vacante o-01.',
      fecha: '2026-10-18T11:04:00Z',
      enlace: '/panel-equipo',
    },
    {
      usuarioId: 'u-equipo-1',
      tipo: 'ingesta',
      titulo: 'Sincronizacion completada',
      detalle: '16 perfiles actualizados desde Riot Games y Steam.',
      fecha: '2026-10-19T08:12:00Z',
      enlace: '/dashboard',
    },
  ]
  notificaciones = base.map((n, i) => ({
    ...n,
    id: `nt-seed-${i}`,
    leida: false,
  }))
}

sembrarNotificaciones()

export async function listarNotificaciones(
  usuarioId: string,
): Promise<Notificacion[]> {
  await jitter(160)
  return notificaciones.filter((n) => n.usuarioId === usuarioId)
}

export async function contarNoLeidas(usuarioId: string): Promise<number> {
  return notificaciones.filter((n) => n.usuarioId === usuarioId && !n.leida).length
}

export async function marcarNotificacionLeida(id: string) {
  await jitter(80)
  notificaciones = notificaciones.map((n) =>
    n.id === id ? { ...n, leida: true } : n,
  )
}

export async function marcarTodasLeidas(usuarioId: string) {
  await jitter(120)
  notificaciones = notificaciones.map((n) =>
    n.usuarioId === usuarioId ? { ...n, leida: true } : n,
  )
}

/* -------------------------------- Contexto -------------------------------- */

/**
 * Contexto del motor de matching. Se re-sincroniza antes de cada calculo
 * para que los repositorios en memoria queden alineados con el estado vivo de
 * la aplicacion.
 */
export const contexto: MatchingContexto = {
  perfiles: perfilesJugador,
  estadisticas: estadisticasVivas,
  habilidades,
  habilidadesJugador: habilidadesJugadorVivas,
  endorsements: endorsementsVivas,
  postulaciones,
  ofertas,
}

function sincronizarContexto() {
  contexto.estadisticas = estadisticasVivas
  contexto.habilidadesJugador = habilidadesJugadorVivas
  contexto.endorsements = endorsementsVivas
  contexto.postulaciones = postulaciones
  contexto.ofertas = ofertas
}

/* --------------------------------- Auth ---------------------------------- */

export async function iniciarSesion(email: string): Promise<Usuario> {
  await jitter(320)
  const usuario = usuarios.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  )
  if (!usuario) {
    throw new Error('No existe una cuenta registrada con ese correo.')
  }
  if (!usuario.activo) {
    throw new Error('La cuenta esta desactivada. Contacta al administrador.')
  }
  registrarAuditoria(usuario, 'inicio_sesion', 'Usuario')
  return usuario
}

export function usuariosDemo(): Usuario[] {
  return usuarios
}

export interface DatosRegistro {
  nombre: string
  email: string
  rol: Usuario['rol']
  region: Region
  aceptaPrivacidad: boolean
}

/**
 * Alta de cuenta (RF-01). El aviso de privacidad de la Ley 1581 de 2012 es
 * un requisito de aceptacion (RNF-05): sin el, el registro se rechaza.
 */
export async function registrarUsuario(
  datos: DatosRegistro,
): Promise<Usuario> {
  await jitter(620)
  if (!datos.aceptaPrivacidad) {
    throw new Error(
      'Debes aceptar el aviso de privacidad para continuar (Ley 1581 de 2012).',
    )
  }
  if (!datos.nombre.trim()) throw new Error('El nombre es obligatorio.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) {
    throw new Error('El correo electronico no tiene un formato valido.')
  }
  if (usuarios.some((u) => u.email.toLowerCase() === datos.email.toLowerCase())) {
    throw new Error('Ya existe una cuenta registrada con ese correo.')
  }

  const id = `u-${Date.now()}`
  const usuario: Usuario = {
    id,
    nombre: datos.nombre.trim(),
    email: datos.email.trim().toLowerCase(),
    rol: datos.rol,
    activo: true,
    emailVerificado: false,
    creadoEn: new Date(),
  }
  usuarios.push(usuario)

  if (datos.rol === 'JUGADOR') {
    perfilesJugador.push({
      id: `p-${Date.now()}`,
      usuarioId: id,
      nombre: usuario.nombre,
      handle: usuario.nombre.split(' ')[0].toLowerCase(),
      foto: '',
      region: datos.region,
      esCaribe: esCaribe(datos.region),
      biografia: 'Perfil recien creado. Completa tu informacion para aparecer en el directorio de talento.',
      horasDisponibles: 20,
      dispuestoARelocalizarse: false,
      rolesPreferidos: ['Flex'],
      aniosExperiencia: 0,
      equiposAnteriores: [],
      logros: [],
      portafolio: [],
    })
  }

  privacidad.push({
    usuarioId: id,
    visibilidadPerfil: 'publico',
    mostrarEstadisticas: true,
    mostrarPortafolio: true,
    mostrarContacto: true,
    avisoPrivacidadAceptado: true,
    fechaAceptacion: new Date().toISOString(),
  })

  registrarAuditoria(usuario, 'registro', 'Usuario')
  emitirNotificacion(
    id,
    'oferta',
    'Bienvenido a ProPlay',
    'Completa tu perfil y vincula tu cuenta de juego para construir un perfil verificable.',
    '/mi-perfil',
  )
  return usuario
}

/* ------------------------------- Jugadores -------------------------------- */

/** Resuelve el perfil profesional asociado a una cuenta de usuario. */
export function perfilDeUsuario(usuarioId: string): PerfilJugador | undefined {
  return perfilesJugador.find((p) => p.usuarioId === usuarioId)
}

/** Visibilidad configurada por el usuario (RNF-05). */
function privacidadDe(perfilId: string): ConfiguracionPrivacidad | undefined {
  const perfil = perfilesJugador.find((p) => p.id === perfilId)
  if (!perfil) return undefined
  return privacidad.find((p) => p.usuarioId === perfil.usuarioId)
}

export async function listarJugadores(
  filtros: FiltrosBusqueda = {},
): Promise<PerfilJugador[]> {
  await jitter(260)
  let out = [...perfilesJugador]

  // RNF-05: un perfil con visibilidad privada no aparece en el directorio
  // de talento; el resto sigue siendo consultable por enlace directo.
  out = out.filter((p) => privacidadDe(p.id)?.visibilidadPerfil !== 'privado')

  if (filtros.juego && filtros.juego !== 'Todos') {
    out = out.filter((p) =>
      estadisticasVivas.some((s) => s.perfilId === p.id && s.juego === filtros.juego),
    )
  }
  if (filtros.rol && filtros.rol !== 'Todos') {
    out = out.filter((p) =>
      p.rolesPreferidos.some((r) => r.toLowerCase() === filtros.rol!.toLowerCase()),
    )
  }
  if (filtros.rango && filtros.rango !== 'Todos') {
    out = out.filter((p) =>
      estadisticasVivas.some(
        (s) => s.perfilId === p.id && s.rango === filtros.rango,
      ),
    )
  }
  if (filtros.region && filtros.region !== 'Todas') {
    out = out.filter((p) => p.region === filtros.region)
  }
  if (filtros.disponibilidad && filtros.disponibilidad !== 'cualquiera') {
    if (filtros.disponibilidad === 'inmediata') {
      out = out.filter((p) => p.horasDisponibles >= 30)
    } else if (filtros.disponibilidad === 'media') {
      out = out.filter((p) => p.horasDisponibles >= 20 && p.horasDisponibles < 30)
    } else {
      out = out.filter((p) => p.horasDisponibles < 20)
    }
  }
  if (filtros.verificados) {
    out = out.filter((p) =>
      cuentasVivas.some((c) => c.perfilId === p.id && c.verificada),
    )
  }
  if (filtros.query) {
    const q = filtros.query.toLowerCase()
    out = out.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q) ||
        p.region.toLowerCase().includes(q) ||
        p.rolesPreferidos.some((r) => r.toLowerCase().includes(q)),
    )
  }

  return out
}

export async function obtenerPerfil(id: string) {
  await jitter(200)
  const perfil = perfilesJugador.find((p) => p.id === id)
  if (!perfil) throw new Error('Perfil no encontrado')
  const stats = estadisticasVivas.filter((s) => s.perfilId === id)
  const cuentas = cuentasVivas.filter((c) => c.perfilId === id)
  const skills = habilidadesJugadorVivas.filter((h) => h.perfilId === id)
  const endoIds = new Set(skills.map((s) => s.id))
  const endoses = endorsementsVivas.filter((e) => endoIds.has(e.habilidadJugadorId))
  const config = privacidadDe(id)
  return {
    perfil,
    stats,
    cuentas,
    skills,
    endoses,
    // Preferencias de visibilidad: el perfil publico respeta lo que el
    // jugador configuro (RNF-05).
    visibilidad: {
      mostrarEstadisticas: config?.mostrarEstadisticas ?? true,
      mostrarPortafolio: config?.mostrarPortafolio ?? true,
      mostrarContacto: config?.mostrarContacto ?? true,
    },
  }
}

/* ------------------------ Edicion del perfil (RF-05) ---------------------- */

export type CamposPerfil = Partial<
  Pick<
    PerfilJugador,
    | 'biografia'
    | 'region'
    | 'horasDisponibles'
    | 'dispuestoARelocalizarse'
    | 'rolesPreferidos'
    | 'aniosExperiencia'
    | 'equiposAnteriores'
  >
>

export async function actualizarPerfil(
  perfilId: string,
  cambios: CamposPerfil,
  autor: Usuario,
): Promise<PerfilJugador> {
  await jitter(420)
  const idx = perfilesJugador.findIndex((p) => p.id === perfilId)
  if (idx < 0) throw new Error('Perfil no encontrado')
  if (cambios.region) {
    perfilesJugador[idx].esCaribe = esCaribe(cambios.region)
  }
  perfilesJugador[idx] = { ...perfilesJugador[idx], ...cambios }
  registrarAuditoria(autor, 'actualizar_perfil', `Perfil ${perfilId}`)
  return perfilesJugador[idx]
}

/* --------------------------- Habilidades (RF-06) -------------------------- */

export async function registrarHabilidad(
  perfilId: string,
  habilidadId: string,
  nivel: number,
  autor: Usuario,
): Promise<HabilidadJugador> {
  await jitter(380)
  if (!habilidades.some((h) => h.id === habilidadId)) {
    throw new Error('La habilidad seleccionada no existe en el catalogo.')
  }
  if (nivel < 1 || nivel > 5 || !Number.isInteger(nivel)) {
    throw new Error('El nivel debe estar entre 1 y 5.')
  }
  if (
    habilidadesJugadorVivas.some(
      (h) => h.perfilId === perfilId && h.habilidadId === habilidadId,
    )
  ) {
    throw new Error('Ya registraste esa habilidad en tu perfil.')
  }
  const nueva: HabilidadJugador = {
    id: `hj-${Date.now()}`,
    perfilId,
    habilidadId,
    nivel: nivel as NivelHabilidad,
    // Una habilidad declarada por el propio jugador aun no esta validada.
    verificada: false,
  }
  habilidadesJugadorVivas.push(nueva)
  registrarAuditoria(autor, 'registrar_habilidad', `Habilidad ${habilidadId}`)
  return nueva
}

export async function eliminarHabilidad(
  habilidadJugadorId: string,
  autor: Usuario,
) {
  await jitter(240)
  habilidadesJugadorVivas = habilidadesJugadorVivas.filter(
    (h) => h.id !== habilidadJugadorId,
  )
  endorsementsVivas = endorsementsVivas.filter(
    (e) => e.habilidadJugadorId !== habilidadJugadorId,
  )
  registrarAuditoria(autor, 'eliminar_habilidad', `HabilidadJugador ${habilidadJugadorId}`)
}

/**
 * Endosar una habilidad de otro jugador (RF-06). El modelo de datos impone
 * unicidad por (habilidad, autor) y prohibe el autoendos.
 */
export async function endosarHabilidad(
  habilidadJugadorId: string,
  autor: Usuario,
  comentario: string,
): Promise<Endorsement> {
  await jitter(460)
  const habilidad = habilidadesJugadorVivas.find((h) => h.id === habilidadJugadorId)
  if (!habilidad) throw new Error('La habilidad ya no existe.')
  if (habilidad.perfilId === perfilDeUsuario(autor.id)?.id) {
    throw new Error('No puedes endosar tus propias habilidades.')
  }
  if (
    endorsementsVivas.some(
      (e) => e.habilidadJugadorId === habilidadJugadorId && e.autorId === autor.id,
    )
  ) {
    throw new Error('Ya endosaste esta habilidad anteriormente.')
  }
  const nuevo: Endorsement = {
    id: `en-${Date.now()}`,
    habilidadJugadorId,
    autorId: autor.id,
    autorNombre: autor.nombre,
    fecha: new Date().toISOString().slice(0, 10),
    comentario: comentario.trim() || 'Endorsement sin comentario.',
  }
  endorsementsVivas.push(nuevo)
  habilidadesJugadorVivas = habilidadesJugadorVivas.map((h) =>
    h.id === habilidadJugadorId ? { ...h, verificada: true } : h,
  )
  registrarAuditoria(autor, 'endosar_habilidad', `HabilidadJugador ${habilidadJugadorId}`)
  const perfil = perfilesJugador.find((p) => p.id === habilidad.perfilId)
  if (perfil) {
    emitirNotificacion(
      perfil.usuarioId,
      'endoso',
      `${autor.nombre} endoso una de tus habilidades`,
      `Habilidad validada por terceros: ya cuenta como verificada en tu perfil.`,
      '/mi-perfil',
    )
  }
  return nuevo
}

export async function listarEndorsements(
  habilidadJugadorId: string,
): Promise<Endorsement[]> {
  await jitter(140)
  return endorsementsVivas.filter((e) => e.habilidadJugadorId === habilidadJugadorId)
}

/* ---------------------------- Privacidad (RNF-05) ------------------------- */

const PRIVACIDAD_POR_DEFECTO: Omit<ConfiguracionPrivacidad, 'usuarioId'> = {
  visibilidadPerfil: 'publico',
  mostrarEstadisticas: true,
  mostrarPortafolio: true,
  mostrarContacto: true,
  avisoPrivacidadAceptado: false,
}

export async function obtenerPrivacidad(
  usuarioId: string,
): Promise<ConfiguracionPrivacidad> {
  await jitter(120)
  const existente = privacidad.find((p) => p.usuarioId === usuarioId)
  if (existente) return existente
  const nueva: ConfiguracionPrivacidad = {
    usuarioId,
    ...PRIVACIDAD_POR_DEFECTO,
  }
  privacidad.push(nueva)
  return nueva
}

export async function actualizarPrivacidad(
  usuarioId: string,
  cambios: Partial<Omit<ConfiguracionPrivacidad, 'usuarioId'>>,
  autor: Usuario,
): Promise<ConfiguracionPrivacidad> {
  await jitter(260)
  const actual = await obtenerPrivacidad(usuarioId)
  const actualizada: ConfiguracionPrivacidad = {
    ...actual,
    ...cambios,
    usuarioId,
    fechaAceptacion: cambios.avisoPrivacidadAceptado
      ? (actual.fechaAceptacion ?? new Date().toISOString())
      : actual.fechaAceptacion,
  }
  privacidad = privacidad.map((p) => (p.usuarioId === usuarioId ? actualizada : p))
  registrarAuditoria(autor, 'actualizar_privacidad', `Usuario ${usuarioId}`)
  return actualizada
}

/* --------------------------------- Ofertas -------------------------------- */

export async function listarOfertas(filtroEstado?: Oferta['estado']) {
  await jitter(240)
  let out = [...ofertas]
  if (filtroEstado) out = out.filter((o) => o.estado === filtroEstado)
  return out.sort((a, b) => b.publicadaEn.localeCompare(a.publicadaEn))
}

export async function crearOferta(
  datos: Omit<Oferta, 'id' | 'publicadaEn' | 'estado'>,
  autor: Usuario,
): Promise<Oferta> {
  await jitter(520)
  if (autor.rol !== 'EQUIPO' && autor.rol !== 'ADMIN') {
    throw new Error('Solo las organizaciones pueden publicar oportunidades.')
  }
  const nueva: Oferta = {
    ...datos,
    id: `o-${Date.now()}`,
    estado: 'ABIERTA',
    publicadaEn: new Date().toISOString().slice(0, 10),
  }
  ofertas = [nueva, ...ofertas]
  registrarAuditoria(autor, 'crear_oferta', `Oferta ${nueva.id}`)
  return nueva
}

export async function cerrarOferta(id: string, autor: Usuario) {
  await jitter(320)
  const oferta = ofertas.find((o) => o.id === id)
  if (!oferta) throw new Error('La vacante no existe.')
  if (autor.rol !== 'ADMIN' && !autorEsDuenhoDeEquipo(autor, oferta.equipoId)) {
    throw new Error('No puedes cerrar una vacante de otra organizacion.')
  }
  ofertas = ofertas.map((o) => (o.id === id ? { ...o, estado: 'CERRADA' } : o))
  registrarAuditoria(autor, 'cerrar_oferta', `Oferta ${id}`)
}

/** El scout consulta pero no contrata: solo la organizacion o el admin actua. */
function autorEsDuenhoDeEquipo(autor: Usuario, equipoId: string): boolean {
  const equipo = perfilesEquipo.find((e) => e.id === equipoId)
  return Boolean(equipo && equipo.usuarioId === autor.id)
}

export function obtenerEquipoDeOferta(ofertaId: string): PerfilEquipo | undefined {
  const oferta = ofertas.find((o) => o.id === ofertaId)
  if (!oferta) return undefined
  return perfilesEquipo.find((e) => e.id === oferta.equipoId)
}

/* -------------------------------- Matching -------------------------------- */

export async function obtenerRanking(
  ofertaId: string,
  opciones: OpcionesRanking,
): Promise<{
  resultados: ResultadoMatching[]
  traza: ReturnType<typeof calcularRanking>['traza']
  oferta: Oferta
}> {
  await jitter(180, 220)
  const oferta = ofertas.find((o) => o.id === ofertaId)
  if (!oferta) throw new Error('Oferta no encontrada')
  // Se reevalua el contexto porque las postulaciones pueden haber cambiado.
  sincronizarContexto()
  const { resultados, traza } = calcularRanking(contexto, oferta, opciones)
  return { resultados: calculoExactoSandbox(resultados), traza, oferta }
}

/**
 * Ranking de vacantes para un jugador: el motor se ejecuta por cada oferta
 * abierta y se devuelve el mejor puntaje alcanzado por el jugador.
 */
export async function obtenerRecomendaciones(
  perfilId: string,
  opciones: OpcionesRanking,
): Promise<RecomendacionOferta[]> {
  await jitter(220, 260)
  sincronizarContexto()
  const abiertas = ofertas.filter((o) => o.estado === 'ABIERTA')
  const salida: RecomendacionOferta[] = []
  for (const oferta of abiertas) {
    const { resultados } = calcularRanking(contexto, oferta, {
      ...opciones,
      candidatosIds: [perfilId],
    })
    const resultado = resultados[0]
    if (resultado) salida.push({ oferta, resultado })
  }
  return salida.sort((a, b) => b.resultado.puntaje - a.resultado.puntaje)
}

export async function explicarMatching(
  ofertaId: string,
  perfilId: string,
  resultados?: ResultadoMatching[],
): Promise<ExplicacionMatching> {
  const t0 = performance.now()
  await jitter(900, 900)
  const oferta = ofertas.find((o) => o.id === ofertaId)
  const jugador = perfilesJugador.find((p) => p.id === perfilId)
  const equipo = obtenerEquipoDeOferta(ofertaId)
  if (!oferta || !jugador || !equipo) throw new Error('No se pudo generar la explicacion')

  sincronizarContexto()
  const resultado =
    resultados?.find((r) => r.perfilId === perfilId) ??
    calcularRanking(contexto, oferta, opcionesDefault()).resultados.find(
      (r) => r.perfilId === perfilId,
    )
  if (!resultado) throw new Error('No hay resultado de matching para este jugador')

  const stats = estadisticasVivas.filter((s) => s.perfilId === perfilId)
  const cuenta = cuentasVivas.find((c) => c.perfilId === perfilId)
  const explicacion = generarExplicacion(
    resultado,
    oferta,
    jugador,
    equipo,
    stats,
    cuenta ? es.plataforma[cuenta.plataforma] : 'la API oficial',
  )
  return { ...explicacion, latenciaMs: Math.round(performance.now() - t0) }
}

function opcionesDefault(): OpcionesRanking {
  return {
    pesos: {
      tecnica: 0.35,
      experiencia: 0.2,
      blandas: 0.15,
      geografica: 0.15,
      disponibilidad: 0.15,
    },
  }
}

/* ------------------------------ Postulaciones ----------------------------- */

export async function postular(
  ofertaId: string,
  mensaje: string,
  autor: Usuario,
): Promise<Postulacion> {
  await jitter(380)
  if (autor.rol !== 'JUGADOR') {
    throw new Error('Solo los perfiles de jugador pueden postularse a una vacante.')
  }
  const perfil = perfilDeUsuario(autor.id)
  if (!perfil) {
    throw new Error('Tu cuenta no tiene un perfil de jugador asociado.')
  }
  const oferta = ofertas.find((o) => o.id === ofertaId)
  if (!oferta) throw new Error('La vacante ya no esta disponible.')
  if (oferta.estado !== 'ABIERTA') {
    throw new Error('La vacante esta cerrada y no admite nuevas postulaciones.')
  }
  if (
    postulaciones.some(
      (p) => p.ofertaId === ofertaId && p.perfilId === perfil.id,
    )
  ) {
    throw new Error('Ya existe una postulacion activa para esta vacante.')
  }
  const nueva: Postulacion = {
    id: `po-${Date.now()}`,
    ofertaId,
    perfilId: perfil.id,
    estado: 'ENVIADA',
    mensaje,
    fecha: new Date().toISOString().slice(0, 10),
  }
  postulaciones = [nueva, ...postulaciones]
  registrarAuditoria(autor, 'postular', `Oferta ${ofertaId}`)
  const equipo = perfilesEquipo.find((e) => e.id === oferta.equipoId)
  if (equipo) {
    emitirNotificacion(
      equipo.usuarioId,
      'postulacion',
      `Nueva postulacion a ${oferta.rol}`,
      `${perfil.nombre} se postulo a la vacante de ${oferta.juego}.`,
      '/panel-equipo',
    )
  }
  return nueva
}

export async function actualizarEstadoPostulacion(
  id: string,
  estado: Postulacion['estado'],
  autor: Usuario,
) {
  await jitter(300)
  const postulacion = postulaciones.find((p) => p.id === id)
  if (!postulacion) throw new Error('La postulacion no existe.')
  const oferta = ofertas.find((o) => o.id === postulacion.ofertaId)
  const esAdmin = autor.rol === 'ADMIN'
  const esDuenho = Boolean(oferta && autorEsDuenhoDeEquipo(autor, oferta.equipoId))
  if (!esAdmin && !esDuenho) {
    throw new Error(
      'El scout puede consultar el proceso, pero solo la organizacion puede avanzar estados.',
    )
  }
  postulaciones = postulaciones.map((p) => (p.id === id ? { ...p, estado } : p))
  registrarAuditoria(autor, 'actualizar_postulacion', `Postulacion ${id}`)
  const perfil = perfilesJugador.find((p) => p.id === postulacion.perfilId)
  if (perfil && estado !== postulacion.estado) {
    emitirNotificacion(
      perfil.usuarioId,
      'estado_postulacion',
      'Tu postulacion cambio de estado',
      `La vacante de ${oferta?.rol ?? 'tu postulacion'} paso a "${estado}".`,
      '/mi-perfil',
    )
  }
}

export async function listarPostulaciones(perfilId?: string) {
  await jitter(200)
  return perfilId
    ? postulaciones.filter((p) => p.perfilId === perfilId)
    : postulaciones
}

/** Postulaciones que ha enviado un jugador, con la oferta y su estado actual. */
export interface PostulacionConOferta {
  postulacion: Postulacion
  oferta: Oferta
}

export async function listarMisPostulaciones(
  perfilId: string,
): Promise<PostulacionConOferta[]> {
  await jitter(220)
  return postulaciones
    .filter((p) => p.perfilId === perfilId)
    .map((p) => {
      const oferta = ofertas.find((o) => o.id === p.ofertaId)
      return oferta ? { postulacion: p, oferta } : null
    })
    .filter((x): x is PostulacionConOferta => x !== null)
    .sort((a, b) => b.postulacion.fecha.localeCompare(a.postulacion.fecha))
}

/* ------------------------------- Mensajeria -------------------------------- */

export async function listarMensajes(usuarioId: string): Promise<Mensaje[]> {
  await jitter(200)
  return mensajes.filter((m) => m.emisorId === usuarioId || m.receptorId === usuarioId)
}

export async function enviarMensaje(
  emisor: Usuario,
  receptorId: string,
  texto: string,
): Promise<Mensaje> {
  await jitter(280)
  const nuevo: Mensaje = {
    id: `m-${Date.now()}`,
    emisorId: emisor.id,
    emisorNombre: emisor.nombre,
    receptorId,
    texto,
    leido: false,
    fecha: new Date().toISOString(),
  }
  mensajes = [...mensajes, nuevo]
  registrarAuditoria(emisor, 'enviar_mensaje', `Usuario ${receptorId}`)
  emitirNotificacion(
    receptorId,
    'mensaje',
    `${emisor.nombre} te envio un mensaje`,
    texto.slice(0, 90),
    '/mensajes',
  )
  return nuevo
}

/* ------------------------- Worker de ingesta (RF-03) ---------------------- */

export interface ResultadoIngesta {
  perfilesSincronizados: number
  registrosActualizados: number
  duracionMs: number
  detalle: { perfilId: string; juego: string; partidas: number }[]
}

export interface EstadoWorker {
  activo: boolean
  ultimaSync: string | null
  registros: number
  perfiles: number
}

export async function ejecutarIngesta(): Promise<ResultadoIngesta> {
  const t0 = performance.now()
  await jitter(1400, 700)
  const detalle: ResultadoIngesta['detalle'] = []
  let registros = 0
  const perfiles = new Set(estadisticasVivas.map((s) => s.perfilId)).size

  for (const stat of estadisticasVivas) {
    // La API oficial devuelve una variacion menor respecto del snapshot previo.
    const delta = Math.round((Math.random() - 0.45) * 4)
    const victorias = Math.max(
      0,
      Math.min(stat.partidas, stat.victorias + delta),
    )
    const actualizado: Estadistica = {
      ...stat,
      victorias,
      winRate: victorias / stat.partidas,
      ultimaSync: new Date().toISOString(),
    }
    const idx = estadisticasVivas.findIndex((s) => s.id === stat.id)
    if (idx >= 0) estadisticasVivas[idx] = actualizado
    registros += 1
    if (detalle.length < 8) {
      detalle.push({
        perfilId: stat.perfilId,
        juego: stat.juego,
        partidas: stat.partidas,
      })
    }
  }

  // El vector de perfil deriva de las estadisticas: un snapshot nuevo obliga a
  // recalcular la representacion vectorial (equivalente a reindexar en pgvector).
  invalidarCacheEmbeddings()
  ultimaSyncGlobal = new Date().toISOString()

  // Se notifica solo a los usuarios afectados por la sincronizacion, no a todo
  // el ecosistema: el evento es relevante para quien tiene datos propios.
  const usuariosAfectados = new Set(
    estadisticasVivas
      .map((s) => perfilesJugador.find((p) => p.id === s.perfilId)?.usuarioId)
      .filter((id): id is string => Boolean(id) && usuarios.some((u) => u.id === id)),
  )
  for (const usuarioId of usuariosAfectados) {
    emitirNotificacion(
      usuarioId,
      'ingesta',
      'Estadisticas sincronizadas',
      `El worker actualizo tus registros desde las APIs oficiales (${registros} registros en total).`,
      '/mi-perfil',
    )
  }

  return {
    perfilesSincronizados: perfiles,
    registrosActualizados: registros,
    duracionMs: Math.round(performance.now() - t0),
    detalle,
  }
}

export async function obtenerEstadoWorker(): Promise<EstadoWorker> {
  await jitter(80)
  return {
    activo: true,
    ultimaSync:
      ultimaSyncGlobal ??
      estadisticasVivas.reduce<string | null>(
        (max, s) => (!max || s.ultimaSync > max ? s.ultimaSync : max),
        null,
      ),
    registros: estadisticasVivas.length,
    perfiles: new Set(estadisticasVivas.map((s) => s.perfilId)).size,
  }
}

/* -------------------------------- Dashboard -------------------------------- */

export interface MetricasDashboard {
  registrosJugadores: number
  registrosEquipos: number
  perfilesVerificados: number
  ofertasAbiertas: number
  postulacionesTotales: number
  coincidenciasReportadas: number
  tasaActividad: number
  latenciaPromedio: number
  nps: number
  distribucionPorRegion: { region: Region; jugadores: number; esCaribe: boolean }[]
  distribucionPorJuego: { juego: string; jugadores: number }[]
  topRegiones: { region: Region; jugadores: number }[]
}

export async function obtenerMetricas(): Promise<MetricasDashboard> {
  await jitter(300)
  const porRegion = new Map<Region, number>()
  for (const p of perfilesJugador) {
    porRegion.set(p.region, (porRegion.get(p.region) ?? 0) + 1)
  }
  const porJuego = new Map<string, number>()
  for (const s of estadisticasVivas) {
    porJuego.set(s.juego, (porJuego.get(s.juego) ?? 0) + 1)
  }

  const aceptadas = postulaciones.filter(
    (p) => p.estado === 'ACEPTADA' || p.estado === 'ENTREVISTA',
  ).length

  return {
    registrosJugadores: perfilesJugador.length,
    registrosEquipos: perfilesEquipo.length,
    perfilesVerificados: new Set(
      cuentasVivas.filter((c) => c.verificada).map((c) => c.perfilId),
    ).size,
    ofertasAbiertas: ofertas.filter((o) => o.estado === 'ABIERTA').length,
    postulacionesTotales: postulaciones.length,
    coincidenciasReportadas: aceptadas,
    tasaActividad: 0.68,
    latenciaPromedio: 0.42,
    nps: 54,
    distribucionPorRegion: [...porRegion.entries()]
      .map(([region, jugadores]) => ({ region, jugadores, esCaribe: esCaribe(region) }))
      .sort((a, b) => b.jugadores - a.jugadores),
    distribucionPorJuego: [...porJuego.entries()]
      .map(([juego, jugadores]) => ({ juego, jugadores }))
      .sort((a, b) => b.jugadores - a.jugadores),
    topRegiones: [...porRegion.entries()]
      .map(([region, jugadores]) => ({ region, jugadores }))
      .sort((a, b) => b.jugadores - a.jugadores)
      .slice(0, 5),
  }
}

/* -------------------------------- Feed ------------------------------------ */

export async function obtenerFeed() {
  await jitter(180)
  return actividadFeed
}

/* ------------------------------ Endpoints aux ----------------------------- */

export async function listarHabilidades(): Promise<Habilidad[]> {
  await jitter(120)
  return habilidades
}

export async function listarCuentasGaming(perfilId: string) {
  await jitter(120)
  return cuentasVivas.filter((c) => c.perfilId === perfilId)
}

export async function vincularCuenta(
  perfilId: string,
  plataforma: PlataformaJuego,
  identificador: string,
  autor: Usuario,
) {
  await jitter(900, 600)
  if (cuentasVivas.some((c) => c.perfilId === perfilId && c.plataforma === plataforma)) {
    throw new Error(`Ya tienes una cuenta de ${es.plataforma[plataforma]} vinculada.`)
  }
  if (!identificador.trim()) {
    throw new Error('Ingresa el identificador de tu cuenta de juego.')
  }
  const nueva: CuentaGaming = {
    id: `cg-${Date.now()}`,
    perfilId,
    plataforma,
    identificadorExterno: identificador.trim(),
    verificada: true,
    fechaVerificacion: new Date().toISOString().slice(0, 10),
  }
  cuentasVivas.push(nueva)
  registrarAuditoria(autor, 'vincular_cuenta', plataforma)
  return nueva
}

export async function desvincularCuenta(
  cuentaId: string,
  autor: Usuario,
) {
  await jitter(320)
  const cuenta = cuentasVivas.find((c) => c.id === cuentaId)
  if (!cuenta) throw new Error('La cuenta vinculada no existe.')
  cuentasVivas = cuentasVivas.filter((c) => c.id !== cuentaId)
  registrarAuditoria(autor, 'desvincular_cuenta', cuenta.plataforma)
}

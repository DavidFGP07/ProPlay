import {
  JUEGO_PILOTO,
  TRANSICIONES_OFERTA,
  TRANSICIONES_POSTULACION,
  type Departamento,
  type EstadoOferta,
  type EstadoPostulacion,
  type Modalidad,
  type Pais,
  type Rol,
} from "@proplay/shared";
import { AppError, ForbiddenError, NotFoundError } from "../../utils/errors";
import { calcularRango, paginar, type OpcionesPaginacion } from "../../utils/pagination";
import * as repositorio from "./ofertas.repository";
import {
  ubicacionOfertaSchema,
  type ActualizarOfertaInput,
  type CrearOfertaInput,
  type ListarMisOfertasQuery,
  type ListarOfertasQuery,
  type MiPostulacion,
  type Oferta,
  type OfertaPropia,
  type Postulacion,
  type PostulacionRecibida,
} from "./ofertas.schema";

/**
 * Lógica de negocio del módulo `ofertas`: ofertas de los equipos (RF-07) y
 * postulaciones de los jugadores (RF-10).
 *
 * Permisos: un equipo sólo gestiona sus propias ofertas (403 con una ajena) y
 * un borrador sólo lo ve su equipo (404 para los demás). El scout y el
 * administrador sólo leen; las rutas ya les cierran las escrituras.
 */

interface Actor {
  id: string;
  rol: Rol;
}

// ---------------------------------------------------------- respuestas

function aOferta(oferta: repositorio.OfertaDb): Oferta {
  const {
    pesoTecnica,
    pesoExperiencia,
    pesoHabilidadesBlandas,
    pesoGeografica,
    pesoDisponibilidad,
    equipo: { usuarioId: _usuarioId, ...equipo },
    ...campos
  } = oferta;
  return {
    ...campos,
    pais: campos.pais as Pais | null,
    pesos: {
      tecnica: pesoTecnica,
      experiencia: pesoExperiencia,
      habilidadesBlandas: pesoHabilidadesBlandas,
      geografica: pesoGeografica,
      disponibilidad: pesoDisponibilidad,
    },
    equipo,
  };
}

function aPostulacionRecibida(p: repositorio.PostulacionRecibidaDb): PostulacionRecibida {
  const { jugador, ...postulacion } = p;
  return {
    ...postulacion,
    jugador: {
      id: jugador.id,
      nombre: jugador.usuario.nombre,
      avatarUrl: jugador.avatarUrl,
      pais: jugador.pais as Pais | null,
      departamento: jugador.departamento,
    },
  };
}

function transicionNoPermitida(de: string, a: string): AppError {
  return new AppError(
    409,
    "TRANSICION_NO_PERMITIDA",
    `No se puede pasar de ${de} a ${a}`,
    { estadoActual: de, estadoPedido: a },
  );
}

function ofertaNoAbierta(): AppError {
  return new AppError(409, "OFERTA_NO_ABIERTA", "La oferta no está abierta");
}

/** Una oferta es visible si está publicada o si la consulta su propio equipo. */
function esVisible(oferta: repositorio.OfertaDb, actor: Actor): boolean {
  return oferta.estado !== "BORRADOR" || oferta.equipo.usuarioId === actor.id;
}

async function ofertaVisible(id: string, actor: Actor): Promise<repositorio.OfertaDb> {
  const oferta = await repositorio.buscarOferta(id);
  if (!oferta || !esVisible(oferta, actor)) throw new NotFoundError("Oferta no encontrada");
  return oferta;
}

/** Oferta que el equipo autenticado puede gestionar: 404 si no la ve, 403 si es ajena. */
async function ofertaPropia(id: string, actor: Actor): Promise<repositorio.OfertaDb> {
  const oferta = await ofertaVisible(id, actor);
  if (oferta.equipo.usuarioId !== actor.id) {
    throw new ForbiddenError("Sólo el equipo que publicó la oferta puede gestionarla");
  }
  return oferta;
}

function esFinalOferta(estado: EstadoOferta): boolean {
  return TRANSICIONES_OFERTA[estado].length === 0;
}

// --------------------------------------------------------------- ofertas

/** RF-07 · Ofertas abiertas, de la más reciente a la más antigua. */
export async function listar(query: ListarOfertasQuery & OpcionesPaginacion) {
  const { page, pageSize, ...filtros } = query;
  const rango = calcularRango({ page, pageSize });
  const [ofertas, total] = await repositorio.listarAbiertas(filtros, rango);
  return paginar(ofertas.map(aOferta), total, rango);
}

/** RF-07 · Ofertas del equipo autenticado, en cualquier estado. */
export async function listarPropias(
  usuarioId: string,
  query: ListarMisOfertasQuery & OpcionesPaginacion,
) {
  const equipo = await repositorio.buscarEquipoDeUsuario(usuarioId);
  if (!equipo) throw new NotFoundError("Este usuario no tiene perfil de equipo");
  const rango = calcularRango(query);
  const [ofertas, total] = await repositorio.listarDeEquipo(equipo.id, query.estado, rango);
  const data: OfertaPropia[] = ofertas.map(({ _count, ...oferta }) => ({
    ...aOferta(oferta),
    totalPostulaciones: _count.postulaciones,
  }));
  return paginar(data, total, rango);
}

export async function obtener(id: string, actor: Actor): Promise<Oferta> {
  return aOferta(await ofertaVisible(id, actor));
}

/**
 * RF-07 · Crea la oferta del equipo autenticado. El juego es siempre el del
 * piloto; una oferta remota no guarda ubicación, y si se crea ya abierta queda
 * con su fecha de publicación.
 */
export async function crear(usuarioId: string, datos: CrearOfertaInput): Promise<Oferta> {
  const equipo = await repositorio.buscarEquipoDeUsuario(usuarioId);
  if (!equipo) throw new NotFoundError("Este usuario no tiene perfil de equipo");

  const { pesos, pais, departamento, rangoMinimo, horasSemana, ...campos } = datos;
  const remota = datos.modalidad === "REMOTA";
  const oferta = await repositorio.crearOferta(usuarioId, {
    ...campos,
    equipoId: equipo.id,
    juego: JUEGO_PILOTO,
    rangoMinimo: rangoMinimo || null,
    horasSemana: horasSemana ?? null,
    pais: remota ? null : (pais ?? null),
    departamento: remota ? null : (departamento ?? null),
    pesoTecnica: pesos.tecnica,
    pesoExperiencia: pesos.experiencia,
    pesoHabilidadesBlandas: pesos.habilidadesBlandas,
    pesoGeografica: pesos.geografica,
    pesoDisponibilidad: pesos.disponibilidad,
    publicadaEn: datos.estado === "ABIERTA" ? new Date() : null,
  });
  return aOferta(oferta);
}

/**
 * Modalidad y ubicación resultantes de un `PATCH`, con la misma lógica que la
 * ubicación del jugador: si llega el país, el departamento va con él (nulo si
 * no se envía); si llega sólo el departamento, se combina con el país
 * guardado; pasar a remota borra la ubicación. El resultado se valida entero
 * con `ubicacionOfertaSchema` (su ZodError sale como 422).
 */
function ubicacionResultante(guardada: repositorio.OfertaDb, cambios: ActualizarOfertaInput) {
  const modalidad: Modalidad = cambios.modalidad ?? guardada.modalidad;
  let pais: string | null = guardada.pais;
  let departamento: Departamento | null = guardada.departamento;
  if (cambios.pais !== undefined) {
    pais = cambios.pais;
    departamento = cambios.departamento ?? null;
  } else if (cambios.departamento !== undefined) {
    departamento = cambios.departamento;
  } else if (modalidad === "REMOTA") {
    pais = null;
    departamento = null;
  }
  return ubicacionOfertaSchema.parse({ modalidad, pais, departamento });
}

/** RF-07 · Edición parcial de una oferta propia que todavía no está cerrada. */
export async function actualizar(
  id: string,
  actor: Actor,
  cambios: ActualizarOfertaInput,
): Promise<Oferta> {
  const oferta = await ofertaPropia(id, actor);
  if (esFinalOferta(oferta.estado)) {
    throw new AppError(409, "OFERTA_FINALIZADA", "Una oferta cubierta o cerrada no se edita");
  }

  const { pesos, modalidad, pais, departamento, rangoMinimo, ...campos } = cambios;
  const tocaUbicacion =
    modalidad !== undefined || pais !== undefined || departamento !== undefined;
  const datos = {
    ...campos,
    ...(rangoMinimo !== undefined && { rangoMinimo: rangoMinimo || null }),
    ...(tocaUbicacion && ubicacionResultante(oferta, cambios)),
    ...(pesos && {
      pesoTecnica: pesos.tecnica,
      pesoExperiencia: pesos.experiencia,
      pesoHabilidadesBlandas: pesos.habilidadesBlandas,
      pesoGeografica: pesos.geografica,
      pesoDisponibilidad: pesos.disponibilidad,
    }),
  };
  if (Object.keys(datos).length === 0) return aOferta(oferta);
  return aOferta(await repositorio.actualizarOferta(id, actor.id, datos));
}

/**
 * RF-07 · Cambio de estado de una oferta propia según `TRANSICIONES_OFERTA`.
 * `CUBIERTA` exige al menos una postulación aceptada. Al pasar a un estado
 * final, las postulaciones pendientes se rechazan en la misma transacción.
 */
export async function cambiarEstado(
  id: string,
  actor: Actor,
  estado: EstadoOferta,
): Promise<Oferta> {
  const oferta = await ofertaPropia(id, actor);
  const permitidas: readonly EstadoOferta[] = TRANSICIONES_OFERTA[oferta.estado];
  if (!permitidas.includes(estado)) throw transicionNoPermitida(oferta.estado, estado);

  if (estado === "CUBIERTA" && (await repositorio.contarAceptadas(id)) === 0) {
    throw new AppError(
      409,
      "OFERTA_SIN_ACEPTADA",
      "Para marcar la oferta como cubierta, acepta antes al menos una postulación",
    );
  }

  const ahora = new Date();
  const final = esFinalOferta(estado);
  const actualizada = await repositorio.cambiarEstadoOferta(
    id,
    actor.id,
    oferta.estado,
    estado,
    estado === "ABIERTA" ? { publicadaEn: ahora } : final ? { cerradaEn: ahora } : {},
    final,
  );
  return aOferta(actualizada);
}

// ---------------------------------------------------------- postulaciones

/** RF-10 · Postulación del jugador autenticado a una oferta abierta. */
export async function postular(
  ofertaId: string,
  actor: Actor,
  mensaje: string | undefined,
): Promise<Postulacion> {
  const jugador = await repositorio.buscarJugadorDeUsuario(actor.id);
  if (!jugador) throw new NotFoundError("Este usuario no tiene perfil de jugador");
  const oferta = await ofertaVisible(ofertaId, actor);
  if (oferta.estado !== "ABIERTA") throw ofertaNoAbierta();

  return repositorio.crearPostulacion(actor.id, {
    ofertaId,
    jugadorId: jugador.id,
    mensaje: mensaje || null,
  });
}

/**
 * RF-10 · Postulaciones recibidas por una oferta. El equipo sólo ve las de sus
 * ofertas; el scout y el administrador, las de cualquier oferta publicada.
 */
export async function listarPostulaciones(
  ofertaId: string,
  actor: Actor,
): Promise<PostulacionRecibida[]> {
  if (actor.rol === "EQUIPO") await ofertaPropia(ofertaId, actor);
  else await ofertaVisible(ofertaId, actor);
  const postulaciones = await repositorio.listarPostulacionesDeOferta(ofertaId);
  return postulaciones.map(aPostulacionRecibida);
}

/** RF-10 · Postulaciones del jugador autenticado, con su oferta. */
export async function misPostulaciones(usuarioId: string): Promise<MiPostulacion[]> {
  const jugador = await repositorio.buscarJugadorDeUsuario(usuarioId);
  if (!jugador) throw new NotFoundError("Este usuario no tiene perfil de jugador");
  return repositorio.listarPostulacionesDeJugador(jugador.id);
}

/**
 * RF-10 · Cambio de estado de una postulación según
 * `TRANSICIONES_POSTULACION`, con su fecha. Sólo el equipo dueño de la oferta,
 * y sólo mientras la oferta está abierta: al cerrarla, sus postulaciones
 * quedan resueltas.
 */
export async function actualizarPostulacion(
  id: string,
  actor: Actor,
  estado: EstadoPostulacion,
): Promise<Postulacion> {
  const postulacion = await repositorio.buscarPostulacion(id);
  if (!postulacion) throw new NotFoundError("Postulación no encontrada");
  const { oferta, ...datos } = postulacion;
  if (oferta.equipo.usuarioId !== actor.id) {
    throw new ForbiddenError("Sólo el equipo que publicó la oferta puede gestionar sus postulaciones");
  }
  if (oferta.estado !== "ABIERTA") throw ofertaNoAbierta();

  const permitidas: readonly EstadoPostulacion[] = TRANSICIONES_POSTULACION[datos.estado];
  if (!permitidas.includes(estado)) throw transicionNoPermitida(datos.estado, estado);

  return repositorio.cambiarEstadoPostulacion(id, actor.id, datos.estado, estado);
}

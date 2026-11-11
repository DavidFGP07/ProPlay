import {
  PERFIL_VECTOR_VERSION,
  VERSION_FORMULAS_MATCHING,
  candidatoRankingSchema,
  explicacionMatchingSchema,
  desgloseMatchingSchema,
  type CandidatoOferta,
  type CandidatoRanking,
  type EstadoOferta,
  type RankingOferta,
  type RankingOfertaQuery,
  type Rol,
} from "@proplay/shared";
import { logger } from "../../config/logger";
import { AppError, ForbiddenError, NotFoundError } from "../../utils/errors";
import { calcularRango, paginar } from "../../utils/pagination";
import * as repositorio from "./matching.repository";
import { arranqueEnFrio, combinar, modoDe, type ComponenteColaborativo } from "./motor/colaborativo";
import { ordenarRanking, puntuar } from "./motor/ponderador";
import type { OfertaMotor } from "./motor/tipos";
import { vectorizarJugador, vectorizarOferta } from "./motor/vectorizador";

/**
 * Lógica de negocio del módulo `matching` (RF-09): el orquestador del motor
 * (Sección VIII-C). Recalcula los vectores obsoletos, recupera candidatos con
 * el índice HNSW, los puntúa con las fórmulas puras de `motor/` y guarda el
 * ranking en `Matching`.
 *
 * El motor **sólo lee datos guardados** y nunca llama a Riot ni a ningún otro
 * servicio: funciona igual con la clave de desarrollo caducada.
 */

/** Vecinos que se piden al índice HNSW antes de ponderar (y `hnsw.ef_search`). */
export const CANDIDATOS_RECUPERADOR = 200;

/** Componente colaborativo en uso: arranque en frío (peso 0) mientras no haya historial. */
const colaborativo: ComponenteColaborativo = arranqueEnFrio;

export interface Actor {
  id: string;
  rol: Rol;
}

// --------------------------------------------------------------- vectores

/** Recalcula y guarda los vectores de los jugadores indicados. Devuelve cuántos. */
async function vectorizar(ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const jugadores = await repositorio.datosParaMotor(ids);
  await repositorio.guardarVectores(
    jugadores.map((j) => ({ jugadorId: j.jugadorId, dimensiones: vectorizarJugador(j) })),
    PERFIL_VECTOR_VERSION,
    new Date(),
  );
  return jugadores.length;
}

/** RF-09 · Recalcula los vectores que faltan o están obsoletos (se llama antes de cada ranking). */
export async function revectorizarObsoletos(): Promise<number> {
  return vectorizar(await repositorio.jugadoresConVectorObsoleto(PERFIL_VECTOR_VERSION));
}

/** Recalcula el vector de un jugador; lo llama la ingesta tras guardar una captura nueva. */
export async function revectorizarJugador(jugadorId: string): Promise<void> {
  await vectorizar([jugadorId]);
}

/** Recalcula todos los vectores (script `matching:revectorizar`, al cambiar de versión). */
export async function revectorizarTodos(): Promise<number> {
  return vectorizar(await repositorio.jugadoresActivos());
}

// ----------------------------------------------------------------- ranking

function esFinal(estado: EstadoOferta): boolean {
  return estado === "CUBIERTA" || estado === "CERRADA";
}

/**
 * Oferta cuyo ranking puede ver el actor. Un borrador sólo lo ve su equipo
 * (404 para los demás); la oferta publicada de otro equipo responde 403 al
 * rol EQUIPO, y la ven el scout y el administrador. Mismas reglas que `ofertas`.
 */
async function ofertaDelRanking(id: string, actor: Actor): Promise<repositorio.OfertaDb> {
  const oferta = await repositorio.buscarOferta(id);
  const esPropia = oferta?.equipo.usuarioId === actor.id;
  if (!oferta || (oferta.estado === "BORRADOR" && !esPropia)) {
    throw new NotFoundError("Oferta no encontrada");
  }
  if (actor.rol === "EQUIPO" && !esPropia) {
    throw new ForbiddenError("Sólo el equipo que publicó la oferta puede ver su ranking");
  }
  return oferta;
}

function ofertaMotor(oferta: repositorio.OfertaDb): OfertaMotor {
  return {
    ofertaId: oferta.id,
    rol: oferta.rol,
    rangoMinimo: oferta.rangoMinimo,
    modalidad: oferta.modalidad,
    pais: oferta.pais,
    departamento: oferta.departamento,
    horasSemana: oferta.horasSemana,
    pesos: {
      tecnica: oferta.pesoTecnica,
      experiencia: oferta.pesoExperiencia,
      habilidadesBlandas: oferta.pesoHabilidadesBlandas,
      geografica: oferta.pesoGeografica,
      disponibilidad: oferta.pesoDisponibilidad,
    },
  };
}

/**
 * RF-09 · Calcula y guarda el ranking de la oferta: recuperador (HNSW) ∪
 * postulantes → cinco dimensiones → ecuación (1) → `Matching`.
 */
async function calcularRanking(oferta: repositorio.OfertaDb): Promise<void> {
  const inicio = Date.now();
  const motor = ofertaMotor(oferta);
  const recuperados = await repositorio.recuperarCandidatos(
    vectorizarOferta(motor),
    CANDIDATOS_RECUPERADOR,
    PERFIL_VECTOR_VERSION,
  );
  const similitud = new Map(recuperados.map((r) => [r.jugadorId, r.similitud]));
  // Quien se postuló entra aunque el índice no lo traiga.
  const postulantes = await repositorio.postulacionesDeOferta(oferta.id);
  const ids = [...new Set([...similitud.keys(), ...postulantes.map((p) => p.jugadorId)])];

  const jugadores = await repositorio.datosParaMotor(ids);
  const pesoColaborativo = colaborativo.peso(oferta.equipoId);
  const puntajesColaborativos = colaborativo.puntajes(oferta.equipoId, ids);
  const puntuaciones = jugadores.map((j) => {
    const p = puntuar(j, motor);
    return {
      ...p,
      puntaje: combinar(p.puntaje, puntajesColaborativos.get(j.jugadorId) ?? 0, pesoColaborativo),
    };
  });

  await repositorio.guardarRanking(
    oferta.id,
    ordenarRanking(puntuaciones).map((p) => ({
      jugadorId: p.jugadorId,
      puntaje: p.puntaje,
      desglose: { ...p.desglose },
      explicacion: JSON.parse(JSON.stringify(p.explicacion)) as repositorio.FilaMatchingNueva["explicacion"],
      similitud: similitud.get(p.jugadorId) ?? null,
    })),
    VERSION_FORMULAS_MATCHING,
    new Date(),
  );
  logger.debug(
    { ofertaId: oferta.id, candidatos: puntuaciones.length, ms: Date.now() - inicio },
    "ranking de matching calculado",
  );
}

/** El ranking guardado ya no refleja los datos y hay que recalcularlo. */
function estaObsoleto(estado: repositorio.EstadoRanking, oferta: repositorio.OfertaDb): boolean {
  if (estado.filas === 0 || !estado.calculadoEn) return true;
  if ((estado.versionMinima ?? 0) < VERSION_FORMULAS_MATCHING) return true;
  if (oferta.actualizadoEn > estado.calculadoEn) return true;
  return estado.ultimoCambio !== null && estado.ultimoCambio > estado.calculadoEn;
}

/** Fila del ranking guardado → candidato del contrato. */
function aCandidato(f: repositorio.FilaRankingDb): CandidatoRanking {
  return candidatoRankingSchema.parse({
    puesto: f.puesto,
    jugador: {
      id: f.jugadorId,
      nombre: f.nombre,
      avatarUrl: f.avatarUrl,
      pais: f.pais,
      departamento: f.departamento,
      disponibilidadHoras: f.disponibilidadHoras,
      dispuestoRelocalizar: f.dispuestoRelocalizar,
      verificacion:
        f.plataforma && f.verificadaEn ? { plataforma: f.plataforma, verificadaEn: f.verificadaEn } : null,
      posicion: f.posicion,
      rango: f.rango,
      datosDel: f.datosDel,
    },
    puntaje: f.puntaje,
    desglose: desgloseMatchingSchema.parse(f.desglose),
    explicacion: explicacionMatchingSchema.parse(f.explicacion),
    similitud: f.similitud,
    postulacion:
      f.postulacionId && f.postulacionEstado
        ? { id: f.postulacionId, estado: f.postulacionEstado }
        : null,
  });
}

/** La oferta y los datos del cálculo, comunes al ranking y al detalle de un candidato. */
function datosDelCalculo(oferta: repositorio.OfertaDb, calculadoEn: Date) {
  const pesoColaborativo = colaborativo.peso(oferta.equipoId);
  return {
    oferta: {
      id: oferta.id,
      titulo: oferta.titulo,
      estado: oferta.estado,
      rol: oferta.rol,
      pesos: ofertaMotor(oferta).pesos,
    },
    calculadoEn,
    versionFormulas: VERSION_FORMULAS_MATCHING,
    modo: modoDe(pesoColaborativo),
    pesoColaborativo,
  };
}

async function respuesta(
  oferta: repositorio.OfertaDb,
  query: RankingOfertaQuery,
): Promise<RankingOferta> {
  const rango = calcularRango(query);
  const [filas, total] = await repositorio.paginaRanking(oferta.id, rango, {
    soloPostulados: query.soloPostulados,
    // `orden` llega validado contra ORDENES_RANKING: «puntaje» o una dimensión.
    dimension: query.orden === "puntaje" ? null : query.orden,
  });
  // Una página vacía (filtro sin resultados o más allá del final) no trae la fecha.
  const calculadoEn =
    filas[0]?.calculadoEn ?? (await repositorio.estadoRanking(oferta.id)).calculadoEn ?? new Date();
  return {
    ...paginar(filas.map(aCandidato), total, rango),
    ...datosDelCalculo(oferta, calculadoEn),
  };
}

/**
 * Deja el ranking de la oferta al día antes de leerlo: lo recalcula si quedó
 * obsoleto (vectores, postulaciones, endorsements, la oferta o la versión de
 * las fórmulas cambiaron). Una oferta cubierta o cerrada conserva su última
 * instantánea, y sólo se calcula si nunca se calculó.
 */
async function asegurarRanking(oferta: repositorio.OfertaDb): Promise<void> {
  if (esFinal(oferta.estado)) {
    if ((await repositorio.estadoRanking(oferta.id)).filas === 0) {
      await revectorizarObsoletos();
      await calcularRanking(oferta);
    }
    return;
  }
  await revectorizarObsoletos();
  if (estaObsoleto(await repositorio.estadoRanking(oferta.id), oferta)) {
    await calcularRanking(oferta);
  }
}

/**
 * RF-09 · Ranking de candidatos de una oferta, paginado, con el filtro de
 * postulados y el orden pedidos. Se recalcula al leerlo si quedó obsoleto.
 */
export async function ranking(
  ofertaId: string,
  actor: Actor,
  query: RankingOfertaQuery,
): Promise<RankingOferta> {
  const oferta = await ofertaDelRanking(ofertaId, actor);
  await asegurarRanking(oferta);
  return respuesta(oferta, query);
}

/**
 * RF-09 · RF-11 · Un candidato del ranking de la oferta, con su explicación,
 * sus vecinos por puesto y los datos del cálculo. Mismos permisos y mismo
 * recálculo al leer que el ranking; 404 si el jugador no está en él.
 */
export async function candidato(
  ofertaId: string,
  jugadorId: string,
  actor: Actor,
): Promise<CandidatoOferta> {
  const oferta = await ofertaDelRanking(ofertaId, actor);
  await asegurarRanking(oferta);
  const fila = await repositorio.candidatoDelRanking(oferta.id, jugadorId);
  if (!fila) throw new NotFoundError("El jugador no está en el ranking de esta oferta");
  const vecino = (id: string | null, nombre: string | null) =>
    id !== null && nombre !== null ? { id, nombre } : null;
  return {
    candidato: aCandidato(fila),
    anterior: vecino(fila.anteriorId, fila.anteriorNombre),
    siguiente: vecino(fila.siguienteId, fila.siguienteNombre),
    total: fila.total,
    ...datosDelCalculo(oferta, fila.calculadoEn),
  };
}

/** RF-09 · Fuerza el recálculo del ranking y devuelve su primera página (o la pedida). */
export async function recalcular(
  ofertaId: string,
  actor: Actor,
  query: RankingOfertaQuery,
): Promise<RankingOferta> {
  const oferta = await ofertaDelRanking(ofertaId, actor);
  if (esFinal(oferta.estado)) {
    throw new AppError(409, "OFERTA_FINALIZADA", "La oferta está cubierta o cerrada: su ranking ya no cambia");
  }
  await revectorizarObsoletos();
  await calcularRanking(oferta);
  return respuesta(oferta, query);
}

/** TODO: Devolver las ofertas más compatibles con el jugador autenticado. */
export async function ofertasCompatibles(datos?: unknown) {
  return repositorio.ofertasCompatibles(datos);
}

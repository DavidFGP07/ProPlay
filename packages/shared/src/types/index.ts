/**
 * Tipos del contrato. Todos se infieren de los esquemas Zod de
 * `../schemas`: si un esquema cambia, el tipo cambia con él.
 */
export type {
  ErrorResponse,
  Paginacion,
} from "../schemas/common";

export type {
  AuthResponse,
  LoginInput,
  MeResponse,
  RefreshResponse,
  RegisterInput,
  UsuarioPublico,
} from "../schemas/auth";

export type {
  ActualizarUsuarioInput,
  CambioContrasenaInput,
} from "../schemas/usuario";

export type {
  AsignarHabilidadInput,
  Habilidad,
  PerfilEquipoInput,
  PerfilEquipoRespuesta,
  PerfilJugadorInput,
  PerfilJugadorPublico,
  PerfilJugadorRespuesta,
  PerfilPropioResponse,
  UbicacionJugadorInput,
  VincularCuentaGamingInput,
} from "../schemas/perfil";

export type {
  CuentaGaming,
  DesafioActivoRiot,
  DesafioVerificacionRiot,
  ResultadoVerificacionRiot,
  VerificarCuentaRiotInput,
  VincularCuentaRiotInput,
} from "../schemas/cuentaGaming";

export type {
  Estadistica,
  ListarEstadisticasQuery,
  MetricasLol,
  RangoColaLol,
  ResumenEstadisticas,
  SincronizarEstadisticasInput,
  EstadoSincronizacion,
  ResultadoSincronizacion,
} from "../schemas/estadistica";

export type {
  ActualizarOfertaInput,
  ActualizarPostulacionInput,
  CambiarEstadoOfertaInput,
  CrearOfertaInput,
  CrearPostulacionInput,
  ListarMisOfertasQuery,
  ListarOfertasQuery,
  MiPostulacion,
  Oferta,
  OfertaPropia,
  PesosMatching,
  Postulacion,
  PostulacionRecibida,
  UbicacionOfertaInput,
} from "../schemas/oferta";

export type {
  CalcularMatchingInput,
  DesgloseMatching,
  CandidatoRanking,
  ExplicacionDisponibilidad,
  ExplicacionExperiencia,
  ExplicacionGeografica,
  ExplicacionHabilidadesBlandas,
  ExplicacionMatching,
  ExplicacionTecnica,
  Matching,
  RankingOferta,
  RankingOfertaQuery,
} from "../schemas/matching";

export type { BusquedaJugadores, JugadorEncontrado } from "../schemas/scouting";

export type {
  CrearConversacionInput,
  CrearMensajeInput,
  Mensaje,
} from "../schemas/mensajeria";

export type {
  MarcarLeidasInput,
  Notificacion,
} from "../schemas/notificacion";

export type {
  CrearPublicacionInput,
  Publicacion,
} from "../schemas/publicacion";

export type { CambiarRolInput, MetricasAdmin } from "../schemas/admin";

export type { HealthResponse } from "../schemas/health";

/** Página genérica de resultados devuelta por los listados. */
export interface Paginado<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

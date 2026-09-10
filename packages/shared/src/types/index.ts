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
  CambiarPasswordInput,
} from "../schemas/usuario";

export type {
  AsignarHabilidadInput,
  Habilidad,
  PerfilEquipoInput,
  PerfilJugadorInput,
  VincularCuentaGamingInput,
} from "../schemas/perfil";

export type {
  Estadistica,
  ListarEstadisticasQuery,
} from "../schemas/estadistica";

export type {
  ActualizarOfertaInput,
  CrearOfertaInput,
  CrearPostulacionInput,
  ListarOfertasQuery,
  Oferta,
} from "../schemas/oferta";

export type {
  CalcularMatchingInput,
  DesgloseMatching,
  Matching,
} from "../schemas/matching";

export type { BusquedaJugadores } from "../schemas/scouting";

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

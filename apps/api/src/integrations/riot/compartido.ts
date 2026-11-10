import { env } from "../../config/env";
import { clienteRedis } from "../../config/redis";
import { CuotaRiotRedis } from "./cuotaRiot";
import { EstadoClaveRiotRedis } from "./estadoClave";

/**
 * Cuota y estado de la clave de Riot de la aplicación: uno por proceso, con
 * los datos en Redis, así que todos los procesos (API y worker) los comparten.
 */
export const cuotaRiot = new CuotaRiotRedis(clienteRedis, env.riotVentanas, env.RIOT_RESERVA_ALTA);

export const estadoClaveRiot = new EstadoClaveRiotRedis(clienteRedis);

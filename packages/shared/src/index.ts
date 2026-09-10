/**
 * @proplay/shared — contrato único entre apps/api y apps/web.
 *
 * Regla del proyecto: cualquier cosa que viaje por la API (esquemas de
 * request/response, enums del dominio, constantes de negocio) se define aquí
 * una sola vez y se importa en los dos lados. No dupliques definiciones.
 */
export * from "./enums";
export * from "./constants";
export * from "./schemas";
export * from "./types";

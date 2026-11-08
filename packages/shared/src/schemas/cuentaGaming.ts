import { z } from "zod";
import { PLATAFORMAS } from "../enums";
import { SERVIDORES_LOL, SERVIDOR_LOL_POR_DEFECTO } from "../constants";

/**
 * Cuentas de juego vinculadas (RF-02). Con la clave de la API de Riot de que
 * dispone el proyecto no hay Riot Sign On (OAuth), así que la propiedad de la
 * cuenta se demuestra con un desafío: el jugador da su Riot ID, la API le pide
 * poner un icono de invocador concreto y comprueba en Riot que lo hizo
 * (docs/decisiones.md, «Integración con Riot»).
 */

/** Paso 1: el Riot ID (`gameName#tagLine`) y el servidor donde juega. */
export const vincularCuentaRiotSchema = z.object({
  gameName: z.string().trim().min(3).max(16),
  /** Sin la almohadilla: «LAN», «1234». */
  tagLine: z
    .string()
    .trim()
    .transform((valor) => valor.replace(/^#/, ""))
    .pipe(z.string().min(2).max(5)),
  servidor: z.enum(SERVIDORES_LOL).default(SERVIDOR_LOL_POR_DEFECTO),
});

/** Respuesta del paso 1: qué icono debe poner el jugador y hasta cuándo. */
export const desafioVerificacionRiotSchema = z.object({
  riotId: z.string(),
  servidor: z.enum(SERVIDORES_LOL),
  nivelInvocador: z.number().int(),
  iconoActual: z.number().int(),
  iconoRequerido: z.number().int(),
  iconoRequeridoUrl: z.string(),
  expiraEn: z.coerce.date(),
  /** Token firmado por la API que se devuelve en el paso 2. No es secreto del jugador. */
  tokenDesafio: z.string(),
});

/** Paso 2: el jugador ya cambió el icono y pide comprobarlo. */
export const verificarCuentaRiotSchema = z.object({
  tokenDesafio: z.string().min(1),
});

/** Cuenta vinculada tal como la ve su dueño. Nunca lleva tokens ni el puuid. */
export const cuentaGamingSchema = z.object({
  id: z.string(),
  plataforma: z.enum(PLATAFORMAS),
  /** Riot ID visible, `gameName#tagLine`. */
  handle: z.string().nullable(),
  servidor: z.string().nullable(),
  verificadaEn: z.coerce.date().nullable(),
  sincronizadaEn: z.coerce.date().nullable(),
  creadoEn: z.coerce.date(),
});

export const plataformaParamSchema = z.object({
  plataforma: z.enum(PLATAFORMAS),
});

export type VincularCuentaRiotInput = z.infer<typeof vincularCuentaRiotSchema>;
export type DesafioVerificacionRiot = z.infer<typeof desafioVerificacionRiotSchema>;
export type VerificarCuentaRiotInput = z.infer<typeof verificarCuentaRiotSchema>;
export type CuentaGaming = z.infer<typeof cuentaGamingSchema>;

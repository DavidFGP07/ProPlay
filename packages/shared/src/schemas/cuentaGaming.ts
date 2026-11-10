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

/**
 * Desafío de verificación activo: qué icono debe poner el jugador y hasta
 * cuándo. La API lo guarda por usuario (Redis) hasta que caduca o se verifica,
 * así que sobrevive a salir de la vista, recargar o abrir otra pestaña.
 */
export const desafioVerificacionRiotSchema = z.object({
  riotId: z.string(),
  servidor: z.enum(SERVIDORES_LOL),
  nivelInvocador: z.number().int(),
  /** Icono que llevaba el invocador al pedir el desafío. */
  iconoActual: z.number().int(),
  iconoRequerido: z.number().int(),
  iconoRequeridoUrl: z.string(),
  creadoEn: z.coerce.date(),
  expiraEn: z.coerce.date(),
  /** Token firmado por la API que se devuelve al verificar. No es secreto del jugador. */
  tokenDesafio: z.string(),
  /** Última vez que la API miró el icono en Riot; `null` si todavía no lo hizo. */
  ultimaComprobacionEn: z.coerce.date().nullable(),
  /** Icono que vio Riot en esa última comprobación. */
  iconoVisto: z.number().int().nullable(),
  /** Comprobaciones que le quedan a este desafío (`MAX_COMPROBACIONES_DESAFIO`). */
  comprobacionesRestantes: z.number().int().min(0),
});

/** `GET /perfiles/cuentas-gaming/riot/desafio`: el desafío activo, si lo hay. */
export const desafioActivoRiotSchema = z.object({
  desafio: desafioVerificacionRiotSchema.nullable(),
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

/**
 * Resultado de comprobar el icono. Que Riot todavía no refleje el cambio no es
 * un error: tarda unos minutos, así que se responde 200 con el desafío al día.
 */
export const resultadoVerificacionRiotSchema = z.discriminatedUnion("estado", [
  z.object({ estado: z.literal("VERIFICADA"), cuenta: cuentaGamingSchema }),
  z.object({
    estado: z.literal("PENDIENTE"),
    /**
     * `ICONO_DISTINTO`: Riot aún muestra otro icono. `MUCHA_DEMANDA`: no había
     * cupo en la cuota de Riot; no se gastó ninguna comprobación y la vista
     * reintenta sola.
     */
    motivo: z.enum(["ICONO_DISTINTO", "MUCHA_DEMANDA"]),
    desafio: desafioVerificacionRiotSchema,
  }),
]);

export const plataformaParamSchema = z.object({
  plataforma: z.enum(PLATAFORMAS),
});

export type VincularCuentaRiotInput = z.infer<typeof vincularCuentaRiotSchema>;
export type DesafioVerificacionRiot = z.infer<typeof desafioVerificacionRiotSchema>;
export type DesafioActivoRiot = z.infer<typeof desafioActivoRiotSchema>;
export type ResultadoVerificacionRiot = z.infer<typeof resultadoVerificacionRiotSchema>;
export type VerificarCuentaRiotInput = z.infer<typeof verificarCuentaRiotSchema>;
export type CuentaGaming = z.infer<typeof cuentaGamingSchema>;

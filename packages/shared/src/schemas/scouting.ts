import { z } from "zod";
import { DEPARTAMENTOS, PLATAFORMAS, POSICIONES_LOL, RANGOS_LOL } from "../enums";
import { PAISES } from "../constants";
import { perfilJugadorPublicoSchema } from "./perfil";

/**
 * Contrato del buscador de talento (RF-08, versión mínima del recorte):
 * jugadores filtrados por posición, rango mínimo y departamento. Sin puntaje
 * de compatibilidad, que es del motor de matching.
 */

/**
 * Filtros de `GET /scouting/jugadores`, que se combinan con
 * `paginacionQuerySchema`. La posición y el rango salen de los datos
 * verificados de Riot: filtrar por cualquiera de los dos deja fuera a quien no
 * tiene cuenta verificada.
 */
export const busquedaJugadoresSchema = z.object({
  posicion: z.enum(POSICIONES_LOL).optional(),
  rangoMinimo: z.enum(RANGOS_LOL).optional(),
  departamento: z.enum(DEPARTAMENTOS).optional(),
});

/** Búsqueda guardada (descartada en el recorte: el endpoint sigue en 501). */
export const guardarBusquedaSchema = z.object({
  nombre: z.string().min(1).max(80),
  filtros: busquedaJugadoresSchema,
});

/**
 * Jugador en los resultados del buscador. Es una **lista blanca**, como el
 * perfil público: todo lo que no esté aquí no sale. Parte de los campos del
 * perfil público (sin la presentación, que está a un clic) y añade:
 * - el resumen verificado: la cuenta de Riot y, de su última captura, la
 *   posición más jugada y el rango; `null` si no hay cuenta verificada;
 * - la disponibilidad y la disposición a relocalizarse, que no salen en el
 *   perfil público pero sí aquí, para equipos y scouts registrados (lo dice
 *   el aviso de privacidad).
 */
export const jugadorEncontradoSchema = perfilJugadorPublicoSchema
  .pick({ id: true, nombre: true, avatarUrl: true })
  .extend({
    pais: z.enum(PAISES).nullable(),
    departamento: z.enum(DEPARTAMENTOS).nullable(),
    disponibilidadHoras: z.number().int().nullable(),
    dispuestoRelocalizar: z.boolean(),
    verificacion: z
      .object({
        plataforma: z.enum(PLATAFORMAS),
        verificadaEn: z.coerce.date(),
      })
      .nullable(),
    posicion: z.enum(POSICIONES_LOL).nullable(),
    rango: z.enum(RANGOS_LOL).nullable(),
    /** Fecha de la captura de la que salen la posición y el rango. */
    datosDel: z.coerce.date().nullable(),
  });

/** Claves que puede llevar cada resultado: las pruebas comparan contra esta lista. */
export const CAMPOS_JUGADOR_ENCONTRADO = Object.keys(
  jugadorEncontradoSchema.shape,
) as (keyof z.infer<typeof jugadorEncontradoSchema>)[];

export type BusquedaJugadores = z.infer<typeof busquedaJugadoresSchema>;
export type JugadorEncontrado = z.infer<typeof jugadorEncontradoSchema>;

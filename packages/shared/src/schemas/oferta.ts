import { z } from "zod";
import {
  DEPARTAMENTOS,
  ESTADOS_OFERTA,
  ESTADOS_POSTULACION,
  MODALIDADES,
  POSICIONES_LOL,
  RANGOS_LOL,
} from "../enums";
import {
  PAISES,
  PESOS_MATCHING,
  TOLERANCIA_SUMA_PESOS,
  type DimensionMatching,
} from "../constants";
import { validarPaisDepartamento } from "./common";
import { perfilJugadorPublicoSchema } from "./perfil";

/**
 * Contrato del módulo `ofertas` (RF-07) y de las postulaciones (RF-10).
 */

// ---------------------------------------------------------------- pesos

const pesoSchema = z.number().min(0).max(1);

/**
 * Pesos de las cinco dimensiones de la ecuación (1) para una oferta. Cada uno
 * entre 0 y 1 y la suma igual a 1 (con `TOLERANCIA_SUMA_PESOS`). Mismos
 * nombres que `PESOS_MATCHING` y que el desglose del matching.
 */
export const pesosMatchingSchema = z
  .object({
    tecnica: pesoSchema,
    experiencia: pesoSchema,
    habilidadesBlandas: pesoSchema,
    geografica: pesoSchema,
    disponibilidad: pesoSchema,
  } satisfies Record<DimensionMatching, z.ZodNumber>)
  .superRefine((pesos, ctx) => {
    const suma = Object.values(pesos).reduce((total, peso) => total + peso, 0);
    if (Math.abs(suma - 1) > TOLERANCIA_SUMA_PESOS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Los pesos deben sumar 100 %",
      });
    }
  });

// ------------------------------------------------------------- ubicación

/**
 * Modalidad y ubicación de la oferta, insumo de la dimensión geográfica.
 * `REMOTA` es la oferta sin restricción: no lleva ubicación. `PRESENCIAL` e
 * `HIBRIDA` exigen país y, en Colombia, departamento.
 */
function validarUbicacionOferta(
  datos: {
    modalidad?: string;
    pais?: string | null;
    departamento?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  const { modalidad, pais, departamento } = datos;
  if (modalidad === undefined) {
    validarPaisDepartamento(datos, ctx);
    return;
  }
  if (modalidad === "REMOTA") {
    if (pais || departamento) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [pais ? "pais" : "departamento"],
        message: "Una oferta remota no lleva ubicación",
      });
    }
    return;
  }
  if (!pais) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pais"],
      message: "Selecciona el país de la oferta",
    });
    return;
  }
  validarPaisDepartamento({ pais, departamento }, ctx);
}

const camposUbicacionOferta = {
  modalidad: z.enum(MODALIDADES),
  pais: z.enum(PAISES).nullable().optional(),
  departamento: z.enum(DEPARTAMENTOS).nullable().optional(),
};

/**
 * Modalidad y ubicación completas. El servidor lo aplica sobre la combinación
 * de lo enviado en un `PATCH` con lo guardado.
 */
export const ubicacionOfertaSchema = z
  .object(camposUbicacionOferta)
  .superRefine(validarUbicacionOferta);

// ----------------------------------------------------------------- oferta

const camposOferta = {
  titulo: z.string().trim().min(5, "Mínimo 5 caracteres").max(140),
  rol: z.enum(POSICIONES_LOL),
  rangoMinimo: z.enum(RANGOS_LOL).nullable().optional(),
  ...camposUbicacionOferta,
  horasSemana: z.number().int().min(0).max(80).nullable().optional(),
  descripcion: z.string().trim().min(20, "Describe la oferta con más detalle").max(5000),
};

/** Estados con los que se puede crear una oferta. */
export const ESTADOS_OFERTA_INICIALES = ["BORRADOR", "ABIERTA"] as const;

/**
 * Creación de una oferta (`POST /ofertas`). El juego no se envía: el piloto es
 * sólo League of Legends y lo fija el servidor. Sin pesos, se aplican los de
 * `PESOS_MATCHING`.
 */
export const crearOfertaSchema = z
  .object({
    ...camposOferta,
    pesos: pesosMatchingSchema.default({ ...PESOS_MATCHING }),
    estado: z.enum(ESTADOS_OFERTA_INICIALES).default("BORRADOR"),
  })
  .superRefine(validarUbicacionOferta);

/**
 * Edición de una oferta propia (`PATCH /ofertas/:id`): campo ausente, no
 * cambia; `null`, se borra. El estado no se cambia aquí, sino con
 * `PATCH /ofertas/:id/estado`. Si cambian la modalidad o la ubicación, el
 * servidor valida el resultado con `ubicacionOfertaSchema`.
 */
export const actualizarOfertaSchema = z
  .object({
    ...camposOferta,
    pesos: pesosMatchingSchema,
  })
  .partial()
  .superRefine(validarUbicacionOferta);

/** Cambio de estado de una oferta propia (`PATCH /ofertas/:id/estado`). */
export const cambiarEstadoOfertaSchema = z.object({
  estado: z.enum(ESTADOS_OFERTA),
});

/**
 * Filtros de `GET /ofertas`: sólo ofertas `ABIERTA`, de la más reciente a la
 * más antigua mientras no exista el ranking por compatibilidad. Se combina con
 * `paginacionQuerySchema`.
 */
export const listarOfertasQuerySchema = z.object({
  rol: z.enum(POSICIONES_LOL).optional(),
  departamento: z.enum(DEPARTAMENTOS).optional(),
  modalidad: z.enum(MODALIDADES).optional(),
});

/** Filtros de `GET /ofertas/me`: las ofertas del equipo, en cualquier estado. */
export const listarMisOfertasQuerySchema = z.object({
  estado: z.enum(ESTADOS_OFERTA).optional(),
});

/** Oferta tal como la devuelve la API, con el resumen del equipo que la publica. */
export const ofertaSchema = z.object({
  id: z.string(),
  equipoId: z.string(),
  titulo: z.string(),
  juego: z.string(),
  rol: z.enum(POSICIONES_LOL),
  rangoMinimo: z.enum(RANGOS_LOL).nullable(),
  modalidad: z.enum(MODALIDADES),
  pais: z.enum(PAISES).nullable(),
  departamento: z.enum(DEPARTAMENTOS).nullable(),
  horasSemana: z.number().int().nullable(),
  descripcion: z.string(),
  pesos: pesosMatchingSchema,
  estado: z.enum(ESTADOS_OFERTA),
  publicadaEn: z.coerce.date().nullable(),
  cerradaEn: z.coerce.date().nullable(),
  creadoEn: z.coerce.date(),
  actualizadoEn: z.coerce.date(),
  equipo: z.object({
    id: z.string(),
    nombreOrg: z.string(),
    logoUrl: z.string().nullable(),
  }),
});

/** Oferta del propio equipo (`GET /ofertas/me`), con sus postulaciones recibidas. */
export const ofertaPropiaSchema = ofertaSchema.extend({
  totalPostulaciones: z.number().int().min(0),
});

// ----------------------------------------------------------- postulación

export const crearPostulacionSchema = z.object({
  mensaje: z.string().trim().max(1000).optional(),
});

/**
 * Cambio de estado de una postulación (`PATCH /ofertas/postulaciones/:id`).
 * Las transiciones válidas están en `TRANSICIONES_POSTULACION`; una no
 * permitida responde 409.
 */
export const actualizarPostulacionSchema = z.object({
  estado: z.enum(ESTADOS_POSTULACION),
});

/**
 * Postulación con la fecha de cada cambio de estado
 * (`FECHA_POR_ESTADO_POSTULACION`); `creadoEn` es el envío.
 */
export const postulacionSchema = z.object({
  id: z.string(),
  ofertaId: z.string(),
  jugadorId: z.string(),
  estado: z.enum(ESTADOS_POSTULACION),
  mensaje: z.string().nullable(),
  creadoEn: z.coerce.date(),
  revisadaEn: z.coerce.date().nullable(),
  entrevistaEn: z.coerce.date().nullable(),
  aceptadaEn: z.coerce.date().nullable(),
  rechazadaEn: z.coerce.date().nullable(),
  actualizadoEn: z.coerce.date(),
});

/**
 * Postulación recibida (`GET /ofertas/:id/postulaciones`), para el equipo y el
 * scout. Del jugador, sólo campos de su perfil público: el correo no sale aquí.
 */
export const postulacionRecibidaSchema = postulacionSchema.extend({
  jugador: perfilJugadorPublicoSchema.pick({
    id: true,
    nombre: true,
    avatarUrl: true,
    pais: true,
    departamento: true,
  }),
});

/** Postulación propia del jugador (`GET /ofertas/postulaciones/me`), con su oferta. */
export const miPostulacionSchema = postulacionSchema.extend({
  oferta: ofertaSchema.pick({
    id: true,
    titulo: true,
    rol: true,
    modalidad: true,
    estado: true,
    equipo: true,
  }),
});

export type PesosMatching = z.infer<typeof pesosMatchingSchema>;
export type UbicacionOfertaInput = z.infer<typeof ubicacionOfertaSchema>;
export type CrearOfertaInput = z.infer<typeof crearOfertaSchema>;
export type ActualizarOfertaInput = z.infer<typeof actualizarOfertaSchema>;
export type CambiarEstadoOfertaInput = z.infer<typeof cambiarEstadoOfertaSchema>;
export type ListarOfertasQuery = z.infer<typeof listarOfertasQuerySchema>;
export type ListarMisOfertasQuery = z.infer<typeof listarMisOfertasQuerySchema>;
export type Oferta = z.infer<typeof ofertaSchema>;
export type OfertaPropia = z.infer<typeof ofertaPropiaSchema>;
export type CrearPostulacionInput = z.infer<typeof crearPostulacionSchema>;
export type ActualizarPostulacionInput = z.infer<typeof actualizarPostulacionSchema>;
export type Postulacion = z.infer<typeof postulacionSchema>;
export type PostulacionRecibida = z.infer<typeof postulacionRecibidaSchema>;
export type MiPostulacion = z.infer<typeof miPostulacionSchema>;

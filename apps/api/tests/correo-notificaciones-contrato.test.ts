import { describe, expect, it } from "vitest";
import {
  ESTADOS_CON_CORREO_VISIBLE,
  MAXIMO_NOTIFICACIONES_POR_MARCADO,
  candidatoOfertaSchema,
  candidatoRankingSchema,
  contactoPostulanteSchema,
  contadorNotificacionesSchema,
  listarNotificacionesQuerySchema,
  marcarLeidasSchema,
  notificacionSchema,
  notificacionesMarcadasSchema,
  notificacionesSchema,
  postulacionRecibidaSchema,
} from "@proplay/shared";

/**
 * Contratos del correo visible para el equipo (sustituto de la mensajería,
 * decisión 0.10) y de las notificaciones dentro de la app (RF-12, mínima).
 */

describe("correo visible para el equipo", () => {
  it("sólo desde la preselección y mientras el proceso sigue o termina aceptado", () => {
    expect(ESTADOS_CON_CORREO_VISIBLE).toEqual(["EN_REVISION", "ENTREVISTA", "ACEPTADA"]);
  });

  it("el contacto es un correo válido o nulo", () => {
    expect(contactoPostulanteSchema.parse({ email: "jugador@proplay.gg" })).toEqual({ email: "jugador@proplay.gg" });
    expect(contactoPostulanteSchema.parse(null)).toBeNull();
    expect(contactoPostulanteSchema.safeParse({ email: "no-es-un-correo" }).success).toBe(false);
    expect(contactoPostulanteSchema.safeParse(undefined).success).toBe(false);
  });

  it("va en la postulación recibida y en el detalle del candidato, nunca en el ranking", () => {
    expect(postulacionRecibidaSchema.shape).toHaveProperty("contacto");
    expect(candidatoOfertaSchema.shape).toHaveProperty("contacto");
    expect(candidatoRankingSchema.shape).not.toHaveProperty("contacto");
    expect(candidatoRankingSchema.shape.jugador.shape).not.toHaveProperty("email");
  });
});

const comun = { id: "notif-1", leidaEn: null, creadoEn: "2026-11-18T12:00:00.000Z" };

describe("notificacionSchema", () => {
  it("acepta una nueva postulación y convierte las fechas", () => {
    const n = notificacionSchema.parse({
      ...comun,
      tipo: "NUEVA_POSTULACION",
      payload: { ofertaId: "o1", ofertaTitulo: "ADC para la liga", postulacionId: "p1" },
    });
    expect(n.tipo).toBe("NUEVA_POSTULACION");
    expect(n.creadoEn).toBeInstanceOf(Date);
  });

  it("acepta un cambio de estado, también el rechazo al cerrar la oferta", () => {
    for (const origen of ["EQUIPO", "CIERRE_OFERTA"]) {
      const n = notificacionSchema.parse({
        ...comun,
        leidaEn: "2026-11-18T13:00:00.000Z",
        tipo: "POSTULACION_ACTUALIZADA",
        payload: { ofertaId: "o1", ofertaTitulo: "ADC", postulacionId: "p1", estado: "RECHAZADA", origen },
      });
      expect(n.leidaEn).toBeInstanceOf(Date);
    }
  });

  it("rechaza un tipo sin consumidor, un estado o un origen desconocidos y un payload incompleto", () => {
    const payload = { ofertaId: "o1", ofertaTitulo: "ADC", postulacionId: "p1", estado: "ACEPTADA", origen: "EQUIPO" };
    expect(notificacionSchema.safeParse({ ...comun, tipo: "NUEVO_MENSAJE", payload }).success).toBe(false);
    expect(notificacionSchema.safeParse({ ...comun, tipo: "POSTULACION_ACTUALIZADA", payload: { ...payload, estado: "PERDIDA" } }).success).toBe(false);
    expect(notificacionSchema.safeParse({ ...comun, tipo: "POSTULACION_ACTUALIZADA", payload: { ...payload, origen: "ADMIN" } }).success).toBe(false);
    expect(notificacionSchema.safeParse({ ...comun, tipo: "NUEVA_POSTULACION", payload: { ofertaId: "o1" } }).success).toBe(false);
  });

  it("no expone el usuario destinatario", () => {
    const n = notificacionSchema.parse({
      ...comun,
      usuarioId: "u1",
      tipo: "NUEVA_POSTULACION",
      payload: { ofertaId: "o1", ofertaTitulo: "ADC", postulacionId: "p1" },
    });
    expect(n).not.toHaveProperty("usuarioId");
  });
});

describe("rutas de notificaciones", () => {
  it("listar es paginado", () => {
    expect(listarNotificacionesQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    const pagina = notificacionesSchema.parse({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    expect(pagina.data).toEqual([]);
  });

  it("el contador y la respuesta de marcar son enteros no negativos", () => {
    expect(contadorNotificacionesSchema.parse({ noLeidas: 3 })).toEqual({ noLeidas: 3 });
    expect(contadorNotificacionesSchema.safeParse({ noLeidas: -1 }).success).toBe(false);
    expect(notificacionesMarcadasSchema.parse({ marcadas: 0 })).toEqual({ marcadas: 0 });
  });

  it("marcar pide entre 1 y el máximo de ids", () => {
    expect(marcarLeidasSchema.parse({ ids: ["a"] })).toEqual({ ids: ["a"] });
    expect(marcarLeidasSchema.safeParse({ ids: [] }).success).toBe(false);
    const demasiados = Array.from({ length: MAXIMO_NOTIFICACIONES_POR_MARCADO + 1 }, (_, i) => `n${i}`);
    expect(marcarLeidasSchema.safeParse({ ids: demasiados }).success).toBe(false);
  });
});

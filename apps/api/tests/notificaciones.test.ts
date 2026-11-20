import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { API_PREFIX, notificacionesSchema, type Notificacion } from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import { esperarEventos, suscribir } from "../src/eventos";
import { PREFIJO_PRUEBA, app, cerrarConexiones, limpiarUsuariosDePrueba } from "./utils/entorno";
import { RUTA_OFERTAS, conToken, crearOferta, moverPostulacion, postular, registrar } from "./utils/ofertas";

/**
 * RF-12 · Notificaciones dentro de la app: cada evento crea la suya para el
 * destinatario correcto y para nadie más; un fallo al notificar no impide el
 * cambio; cada usuario sólo ve y marca las suyas.
 */

const RUTA = `${API_PREFIX}/notificaciones`;

let tokenEquipo: string;
let tokenOtroEquipo: string;
let tokenScout: string;
let tokenJugador: string;
let tokenOtroJugador: string;
let usuarios: Record<"equipo" | "otroEquipo" | "scout" | "jugador" | "otroJugador", string>;

async function usuarioDe(etiqueta: string): Promise<string> {
  return (await prisma.usuario.findFirstOrThrow({ where: { email: { startsWith: `${PREFIJO_PRUEBA}+${etiqueta}-` } } })).id;
}

async function deUsuario(usuarioId: string) {
  return prisma.notificacion.findMany({ where: { usuarioId }, orderBy: { creadoEn: "asc" } });
}

async function borrarNotificaciones(): Promise<void> {
  await prisma.notificacion.deleteMany({ where: { usuarioId: { in: Object.values(usuarios) } } });
}

async function listar(token: string, query = ""): Promise<Notificacion[]> {
  const respuesta = await conToken(token).get(`${RUTA}${query}`);
  expect(respuesta.status).toBe(200);
  return notificacionesSchema.parse(respuesta.body).data;
}

async function contador(token: string): Promise<number> {
  const respuesta = await conToken(token).get(`${RUTA}/contador`);
  expect(respuesta.status).toBe(200);
  return respuesta.body.noLeidas as number;
}

beforeAll(async () => {
  await limpiarUsuariosDePrueba();
  tokenEquipo = await registrar("notif-equipo", "EQUIPO");
  tokenOtroEquipo = await registrar("notif-otro-equipo", "EQUIPO");
  tokenScout = await registrar("notif-scout", "SCOUT");
  tokenJugador = await registrar("notif-jugador", "JUGADOR");
  tokenOtroJugador = await registrar("notif-otro-jugador", "JUGADOR");
  usuarios = {
    equipo: await usuarioDe("notif-equipo"),
    otroEquipo: await usuarioDe("notif-otro-equipo"),
    scout: await usuarioDe("notif-scout"),
    jugador: await usuarioDe("notif-jugador"),
    otroJugador: await usuarioDe("notif-otro-jugador"),
  };
});

beforeEach(async () => {
  await esperarEventos();
  await borrarNotificaciones();
});

afterAll(async () => {
  await esperarEventos();
  await limpiarUsuariosDePrueba();
  await cerrarConexiones();
});

describe("cada evento notifica a su destinatario y a nadie más", () => {
  it("una postulación nueva notifica al equipo dueño", async () => {
    const oferta = await crearOferta(tokenEquipo, { titulo: "MID para notificaciones" });
    const postulacion = await postular(tokenJugador, oferta.id);
    await esperarEventos();

    const delEquipo = await deUsuario(usuarios.equipo);
    expect(delEquipo).toHaveLength(1);
    expect(delEquipo[0]).toMatchObject({
      tipo: "NUEVA_POSTULACION",
      leidaEn: null,
      payload: {
        ofertaId: oferta.id,
        ofertaTitulo: "MID para notificaciones",
        postulacionId: postulacion,
        jugadorNombre: "Prueba notif-jugador",
      },
    });
    // Del jugador, sólo el nombre: nunca el correo.
    expect(JSON.stringify(delEquipo[0]!.payload)).not.toContain("@");
    for (const otro of [usuarios.otroEquipo, usuarios.scout, usuarios.jugador, usuarios.otroJugador]) {
      expect(await deUsuario(otro)).toHaveLength(0);
    }
  });

  it("un cambio de estado notifica sólo al jugador de esa postulación", async () => {
    const oferta = await crearOferta(tokenEquipo, { titulo: "ADC para notificaciones" });
    const postulacion = await postular(tokenJugador, oferta.id);
    await postular(tokenOtroJugador, oferta.id);
    await esperarEventos();
    await borrarNotificaciones();

    await moverPostulacion(tokenEquipo, postulacion, "EN_REVISION");
    await esperarEventos();

    const delJugador = await deUsuario(usuarios.jugador);
    expect(delJugador).toHaveLength(1);
    expect(delJugador[0]).toMatchObject({
      tipo: "POSTULACION_ACTUALIZADA",
      payload: { ofertaId: oferta.id, postulacionId: postulacion, estado: "EN_REVISION", origen: "EQUIPO" },
    });
    for (const otro of [usuarios.equipo, usuarios.otroEquipo, usuarios.scout, usuarios.otroJugador]) {
      expect(await deUsuario(otro)).toHaveLength(0);
    }
  });

  it("cerrar la oferta notifica el rechazo a cada jugador con la postulación en proceso, no a los ya resueltos", async () => {
    const oferta = await crearOferta(tokenEquipo, { titulo: "Top para notificaciones" });
    const enProceso = await postular(tokenJugador, oferta.id);
    const yaRechazada = await postular(tokenOtroJugador, oferta.id);
    await moverPostulacion(tokenEquipo, enProceso, "EN_REVISION");
    await moverPostulacion(tokenEquipo, yaRechazada, "RECHAZADA");
    await esperarEventos();
    await borrarNotificaciones();

    const cierre = await conToken(tokenEquipo).patch(`${RUTA_OFERTAS}/${oferta.id}/estado`, { estado: "CERRADA" });
    expect(cierre.status).toBe(200);
    await esperarEventos();

    const delJugador = await deUsuario(usuarios.jugador);
    expect(delJugador).toHaveLength(1);
    expect(delJugador[0]).toMatchObject({
      tipo: "POSTULACION_ACTUALIZADA",
      payload: { postulacionId: enProceso, estado: "RECHAZADA", origen: "CIERRE_OFERTA", ofertaTitulo: "Top para notificaciones" },
    });
    // El otro jugador ya estaba rechazado: el cierre no lo vuelve a notificar.
    expect(await deUsuario(usuarios.otroJugador)).toHaveLength(0);
    expect(await deUsuario(usuarios.equipo)).toHaveLength(0);
  });

  it("del jugador, el payload sólo lleva el nombre: ni el correo ni el id de la cuenta", async () => {
    const oferta = await crearOferta(tokenEquipo);
    await postular(tokenJugador, oferta.id);
    await esperarEventos();
    const [notificacion] = await deUsuario(usuarios.equipo);
    const jugador = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarios.jugador } });
    expect(Object.keys(notificacion!.payload as object).sort()).toEqual(
      ["jugadorNombre", "ofertaId", "ofertaTitulo", "postulacionId"].sort(),
    );
    expect((notificacion!.payload as { jugadorNombre: string }).jugadorNombre).toBe(jugador.nombre);
    const texto = JSON.stringify(notificacion!.payload);
    expect(texto).not.toContain(jugador.email);
    expect(texto).not.toContain(usuarios.jugador);
  });
});

describe("un fallo al notificar no impide el cambio", () => {
  it("si crear la notificación falla, el cambio de estado responde 200 y queda guardado", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const postulacion = await postular(tokenJugador, oferta.id);
    await esperarEventos();
    // Sustituye a mano la escritura de la notificación (vi.spyOn no se lleva bien con los
    // delegados de Prisma: al restaurarlo los deja sin el método).
    const delegado = prisma.notificacion as unknown as { create: unknown };
    const original = delegado.create;
    const falla = vi.fn().mockRejectedValue(new Error("base caída"));
    delegado.create = falla;
    try {
      const respuesta = await conToken(tokenEquipo).patch(`${RUTA_OFERTAS}/postulaciones/${postulacion}`, { estado: "EN_REVISION" });
      expect(respuesta.status).toBe(200);
      await esperarEventos();
      expect(falla).toHaveBeenCalled();
    } finally {
      delegado.create = original;
    }
    const guardada = await prisma.postulacion.findUniqueOrThrow({ where: { id: postulacion } });
    expect(guardada.estado).toBe("EN_REVISION");
    expect(await deUsuario(usuarios.jugador)).toHaveLength(0);
  });

  it("un consumidor que lanza no rompe la postulación ni a los demás consumidores", async () => {
    const baja = suscribir(() => Promise.reject(new Error("consumidor roto")));
    try {
      const oferta = await crearOferta(tokenEquipo);
      expect((await conToken(tokenJugador).post(`${RUTA_OFERTAS}/${oferta.id}/postulaciones`, {})).status).toBe(201);
      await esperarEventos();
      expect(await deUsuario(usuarios.equipo)).toHaveLength(1);
    } finally {
      baja();
    }
  });
});

describe("rutas de notificaciones", () => {
  async function sembrar(): Promise<string[]> {
    const ahora = Date.now();
    const crear = (usuarioId: string, i: number, leida = false) =>
      prisma.notificacion.create({
        data: {
          usuarioId,
          tipo: "NUEVA_POSTULACION",
          payload: { ofertaId: `o${i}`, ofertaTitulo: `Oferta ${i}`, postulacionId: `p${i}` },
          creadoEn: new Date(ahora - i * 60_000),
          leidaEn: leida ? new Date() : null,
        },
      });
    const propias = await Promise.all([crear(usuarios.equipo, 1), crear(usuarios.equipo, 2), crear(usuarios.equipo, 3, true)]);
    await crear(usuarios.otroEquipo, 4);
    return propias.map((n) => n.id);
  }

  it("lista sólo las propias, de la más reciente a la más antigua, paginadas", async () => {
    const [n1, n2, n3] = await sembrar();
    const lista = await listar(tokenEquipo);
    expect(lista.map((n) => n.id)).toEqual([n1, n2, n3]);
    expect((await listar(tokenEquipo, "?pageSize=1&page=2")).map((n) => n.id)).toEqual([n2]);
    expect((await listar(tokenOtroEquipo)).map((n) => n.payload.ofertaTitulo)).toEqual(["Oferta 4"]);
    expect(await listar(tokenScout)).toEqual([]);
  });

  it("el contador cuenta las propias sin leer", async () => {
    await sembrar();
    expect(await contador(tokenEquipo)).toBe(2);
    expect(await contador(tokenOtroEquipo)).toBe(1);
    expect(await contador(tokenJugador)).toBe(0);
  });

  it("marcar una la deja leída; un id ajeno se ignora", async () => {
    const [n1] = await sembrar();
    const ajena = (await deUsuario(usuarios.otroEquipo))[0]!.id;
    const respuesta = await conToken(tokenEquipo).post(`${RUTA}/leidas`, { ids: [n1, ajena, "no-existe"] });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ marcadas: 1 });
    expect(await contador(tokenEquipo)).toBe(1);
    // La ajena sigue sin leer para su dueño.
    expect(await contador(tokenOtroEquipo)).toBe(1);
    expect((await prisma.notificacion.findUniqueOrThrow({ where: { id: ajena } })).leidaEn).toBeNull();
  });

  it("marcar todas sólo toca las propias", async () => {
    await sembrar();
    const respuesta = await conToken(tokenEquipo).post(`${RUTA}/leidas/todas`);
    expect(respuesta.body).toEqual({ marcadas: 2 });
    expect(await contador(tokenEquipo)).toBe(0);
    expect(await contador(tokenOtroEquipo)).toBe(1);
    // Repetirlo no cambia nada.
    expect((await conToken(tokenEquipo).post(`${RUTA}/leidas/todas`)).body).toEqual({ marcadas: 0 });
  });

  it("valida la petición: sin ids o con demasiados responde 422", async () => {
    expect((await conToken(tokenEquipo).post(`${RUTA}/leidas`, { ids: [] })).status).toBe(422);
    expect((await conToken(tokenEquipo).post(`${RUTA}/leidas`, {})).status).toBe(422);
    const muchos = Array.from({ length: 101 }, (_, i) => `n${i}`);
    expect((await conToken(tokenEquipo).post(`${RUTA}/leidas`, { ids: muchos })).status).toBe(422);
  });

  it("sin sesión, todas responden 401", async () => {
    expect((await request(app).get(RUTA)).status).toBe(401);
    expect((await request(app).get(`${RUTA}/contador`)).status).toBe(401);
    expect((await request(app).post(`${RUTA}/leidas`).send({ ids: ["x"] })).status).toBe(401);
    expect((await request(app).post(`${RUTA}/leidas/todas`)).status).toBe(401);
  });
});

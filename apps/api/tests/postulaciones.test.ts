import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/prisma";
import { cerrarConexiones, limpiarUsuariosDePrueba } from "./utils/entorno";
import {
  RUTA_OFERTAS,
  conToken,
  crearOferta,
  moverPostulacion,
  postular,
  registrar,
} from "./utils/ofertas";

/**
 * RF-10 · Postulaciones: alta, duplicados, transiciones con la fecha de cada
 * cambio de estado y permisos por rol y por propiedad.
 */

let tokenEquipo: string;
let tokenOtroEquipo: string;
let tokenJugador: string;
let tokenJugador2: string;
let equipo: ReturnType<typeof conToken>;
let jugador: ReturnType<typeof conToken>;
let scout: ReturnType<typeof conToken>;

beforeAll(async () => {
  await limpiarUsuariosDePrueba();
  tokenEquipo = await registrar("post-equipo", "EQUIPO");
  tokenOtroEquipo = await registrar("post-otro-equipo", "EQUIPO");
  tokenJugador = await registrar("post-jugador", "JUGADOR");
  tokenJugador2 = await registrar("post-jugador2", "JUGADOR");
  equipo = conToken(tokenEquipo);
  jugador = conToken(tokenJugador);
  scout = conToken(await registrar("post-scout", "SCOUT"));
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
  await cerrarConexiones();
});

const postulaciones = (ofertaId: string) => `${RUTA_OFERTAS}/${ofertaId}/postulaciones`;
const postulacion = (id: string) => `${RUTA_OFERTAS}/postulaciones/${id}`;

describe(`POST ${RUTA_OFERTAS}/:id/postulaciones`, () => {
  it("registra la postulación como ENVIADA, sin fechas de otros estados, con su traza", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const respuesta = await jugador.post(postulaciones(oferta.id), { mensaje: "  Hola  " });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({
      ofertaId: oferta.id,
      estado: "ENVIADA",
      mensaje: "Hola",
      revisadaEn: null,
      entrevistaEn: null,
      aceptadaEn: null,
      rechazadaEn: null,
    });
    const traza = await prisma.auditLog.findFirst({
      where: { accion: "POSTULACION_CREADA", entidadId: respuesta.body.id },
    });
    expect(traza).not.toBeNull();
  });

  it("no admite postularse dos veces a la misma oferta (409)", async () => {
    const oferta = await crearOferta(tokenEquipo);
    await postular(tokenJugador, oferta.id);
    const respuesta = await jugador.post(postulaciones(oferta.id), {});
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe("POSTULACION_DUPLICADA");
  });

  it("no admite postularse a una oferta cerrada (409) ni a un borrador (404)", async () => {
    const cerrada = await crearOferta(tokenEquipo);
    await equipo.patch(`${RUTA_OFERTAS}/${cerrada.id}/estado`, { estado: "CERRADA" });
    const aCerrada = await jugador.post(postulaciones(cerrada.id), {});
    expect(aCerrada.status).toBe(409);
    expect(aCerrada.body.error.code).toBe("OFERTA_NO_ABIERTA");

    const borrador = await crearOferta(tokenEquipo, { estado: "BORRADOR" });
    expect((await jugador.post(postulaciones(borrador.id), {})).status).toBe(404);
  });

  it("sólo se postula el jugador (403 al equipo y al scout)", async () => {
    const oferta = await crearOferta(tokenEquipo);
    expect((await equipo.post(postulaciones(oferta.id), {})).status).toBe(403);
    expect((await scout.post(postulaciones(oferta.id), {})).status).toBe(403);
  });
});

describe(`GET ${RUTA_OFERTAS}/:id/postulaciones`, () => {
  let ofertaId: string;

  beforeAll(async () => {
    ofertaId = (await crearOferta(tokenEquipo)).id;
    await postular(tokenJugador, ofertaId);
    await postular(tokenJugador2, ofertaId);
  });

  it("el equipo dueño ve las postulaciones con datos públicos del jugador y sin su correo", async () => {
    const respuesta = await equipo.get(postulaciones(ofertaId));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveLength(2);
    expect(Object.keys(respuesta.body[0].jugador).sort()).toEqual(
      ["avatarUrl", "departamento", "id", "nombre", "pais"],
    );
    expect(JSON.stringify(respuesta.body)).not.toContain("@proplay.test");
  });

  it("el scout las ve; otro equipo y el jugador, no (403)", async () => {
    expect((await scout.get(postulaciones(ofertaId))).status).toBe(200);
    expect((await conToken(tokenOtroEquipo).get(postulaciones(ofertaId))).status).toBe(403);
    expect((await jugador.get(postulaciones(ofertaId))).status).toBe(403);
  });
});

describe(`GET ${RUTA_OFERTAS}/postulaciones/me`, () => {
  it("devuelve las postulaciones del jugador con su oferta", async () => {
    const token = await registrar("post-mias", "JUGADOR");
    const oferta = await crearOferta(tokenEquipo, { titulo: "Oferta para mis postulaciones" });
    await postular(token, oferta.id);

    const respuesta = await conToken(token).get(`${RUTA_OFERTAS}/postulaciones/me`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveLength(1);
    expect(respuesta.body[0]).toMatchObject({
      estado: "ENVIADA",
      oferta: { id: oferta.id, titulo: "Oferta para mis postulaciones", estado: "ABIERTA" },
    });
  });

  it("responde 403 al equipo", async () => {
    expect((await equipo.get(`${RUTA_OFERTAS}/postulaciones/me`)).status).toBe(403);
  });
});

describe(`PATCH ${RUTA_OFERTAS}/postulaciones/:id`, () => {
  it("recorre el embudo y guarda la fecha de cada cambio, en orden", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const id = await postular(tokenJugador, oferta.id);

    const revisada = await moverPostulacion(tokenEquipo, id, "EN_REVISION");
    expect(revisada.revisadaEn).not.toBeNull();
    const entrevista = await moverPostulacion(tokenEquipo, id, "ENTREVISTA");
    expect(entrevista.entrevistaEn).not.toBeNull();
    const aceptada = await moverPostulacion(tokenEquipo, id, "ACEPTADA");
    expect(aceptada).toMatchObject({ estado: "ACEPTADA", rechazadaEn: null });

    const fechas = [aceptada.creadoEn, aceptada.revisadaEn, aceptada.entrevistaEn, aceptada.aceptadaEn];
    expect(fechas.every(Boolean)).toBe(true);
    expect(fechas).toEqual([...fechas].sort());

    const traza = await prisma.auditLog.findFirst({
      where: { accion: "POSTULACION_ESTADO_CAMBIADO", entidadId: id },
      orderBy: { creadoEn: "desc" },
    });
    expect(traza?.metadata).toEqual({
      estadoAnterior: "ENTREVISTA",
      estadoNuevo: "ACEPTADA",
      origen: "equipo",
    });
  });

  it("rechazar desde revisión guarda rechazadaEn y conserva revisadaEn", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const id = await postular(tokenJugador, oferta.id);
    await moverPostulacion(tokenEquipo, id, "EN_REVISION");
    const rechazada = await moverPostulacion(tokenEquipo, id, "RECHAZADA");
    expect(rechazada.rechazadaEn).not.toBeNull();
    expect(rechazada.revisadaEn).not.toBeNull();
    expect(rechazada.entrevistaEn).toBeNull();
  });

  it.each([
    ["saltar de ENVIADA a ACEPTADA", [], "ACEPTADA"],
    ["saltar de ENVIADA a ENTREVISTA", [], "ENTREVISTA"],
    ["volver a ENVIADA", ["EN_REVISION"], "ENVIADA"],
    ["repetir el estado actual", ["EN_REVISION"], "EN_REVISION"],
    ["salir de ACEPTADA", ["EN_REVISION", "ENTREVISTA", "ACEPTADA"], "RECHAZADA"],
    ["salir de RECHAZADA", ["RECHAZADA"], "EN_REVISION"],
  ])("rechaza %s con 409 y no cambia nada", async (_caso, previos, destino) => {
    const oferta = await crearOferta(tokenEquipo);
    const id = await postular(tokenJugador, oferta.id);
    for (const paso of previos) await moverPostulacion(tokenEquipo, id, paso);
    const antes = await prisma.postulacion.findUniqueOrThrow({ where: { id } });

    const respuesta = await equipo.patch(postulacion(id), { estado: destino });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe("TRANSICION_NO_PERMITIDA");
    expect(await prisma.postulacion.findUniqueOrThrow({ where: { id } })).toEqual(antes);
  });

  it("una oferta cerrada congela sus postulaciones (409)", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const id = await postular(tokenJugador, oferta.id);
    await equipo.patch(`${RUTA_OFERTAS}/${oferta.id}/estado`, { estado: "CERRADA" });
    const respuesta = await equipo.patch(postulacion(id), { estado: "EN_REVISION" });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe("OFERTA_NO_ABIERTA");
  });

  it("sólo el equipo dueño cambia estados: 403 a otro equipo, al scout y al jugador", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const id = await postular(tokenJugador, oferta.id);
    const cambio = { estado: "EN_REVISION" };
    expect((await conToken(tokenOtroEquipo).patch(postulacion(id), cambio)).status).toBe(403);
    expect((await scout.patch(postulacion(id), cambio)).status).toBe(403);
    expect((await jugador.patch(postulacion(id), cambio)).status).toBe(403);
  });

  it("responde 404 con una postulación que no existe", async () => {
    expect((await equipo.patch(postulacion("no-existe"), { estado: "EN_REVISION" })).status).toBe(404);
  });
});

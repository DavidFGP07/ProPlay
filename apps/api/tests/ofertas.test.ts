import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { JUEGO_PILOTO, PESOS_MATCHING } from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import { app, cerrarConexiones, limpiarUsuariosDePrueba } from "./utils/entorno";
import {
  DEPARTAMENTO_PRUEBA,
  OFERTA_BASE,
  RUTA_OFERTAS,
  conToken,
  crearOferta,
  moverPostulacion,
  postular,
  registrar,
} from "./utils/ofertas";

/**
 * RF-07 · Ofertas: creación con pesos, edición, estados con su fecha,
 * permisos por rol y por propiedad, listado paginado y filtros.
 */

let equipo: ReturnType<typeof conToken>;
let otroEquipo: ReturnType<typeof conToken>;
let jugador: ReturnType<typeof conToken>;
let scout: ReturnType<typeof conToken>;
let tokenEquipo: string;
let tokenOtroEquipo: string;
let tokenJugador: string;
let tokenJugador2: string;
let tokenJugador3: string;

beforeAll(async () => {
  await limpiarUsuariosDePrueba();
  tokenEquipo = await registrar("ofertas-equipo", "EQUIPO");
  tokenOtroEquipo = await registrar("ofertas-otro-equipo", "EQUIPO");
  tokenJugador = await registrar("ofertas-jugador", "JUGADOR");
  tokenJugador2 = await registrar("ofertas-jugador2", "JUGADOR");
  tokenJugador3 = await registrar("ofertas-jugador3", "JUGADOR");
  equipo = conToken(tokenEquipo);
  otroEquipo = conToken(tokenOtroEquipo);
  jugador = conToken(tokenJugador);
  scout = conToken(await registrar("ofertas-scout", "SCOUT"));
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
  await cerrarConexiones();
});

const estado = (id: string) => `${RUTA_OFERTAS}/${id}/estado`;

describe(`POST ${RUTA_OFERTAS}`, () => {
  it("crea un borrador con los pesos por defecto, el juego del piloto y sin fecha de publicación", async () => {
    const respuesta = await equipo.post(RUTA_OFERTAS, OFERTA_BASE);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({
      estado: "BORRADOR",
      juego: JUEGO_PILOTO,
      pesos: PESOS_MATCHING,
      publicadaEn: null,
      cerradaEn: null,
      departamento: DEPARTAMENTO_PRUEBA,
    });
    expect(respuesta.body.equipo).not.toHaveProperty("usuarioId");

    const traza = await prisma.auditLog.findFirst({
      where: { accion: "OFERTA_CREADA", entidadId: respuesta.body.id },
    });
    expect(traza).not.toBeNull();
  });

  it("guarda los pesos elegidos y la fecha de publicación si se crea abierta", async () => {
    const pesos = { tecnica: 0.5, experiencia: 0.2, habilidadesBlandas: 0.1, geografica: 0, disponibilidad: 0.2 };
    const oferta = await crearOferta(tokenEquipo, { pesos });
    expect(oferta.pesos).toEqual(pesos);
    expect(oferta.estado).toBe("ABIERTA");
    expect(oferta.publicadaEn).not.toBeNull();
  });

  it("rechaza con 422 pesos que no suman 1", async () => {
    const respuesta = await equipo.post(RUTA_OFERTAS, {
      ...OFERTA_BASE,
      pesos: { ...PESOS_MATCHING, tecnica: 0.6 },
    });
    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rechaza con 422 una oferta remota con ubicación", async () => {
    const respuesta = await equipo.post(RUTA_OFERTAS, { ...OFERTA_BASE, modalidad: "REMOTA" });
    expect(respuesta.status).toBe(422);
  });

  it.each([
    ["el jugador", () => jugador],
    ["el scout", () => scout],
  ])("responde 403 a %s", async (_rol, cliente) => {
    const respuesta = await cliente().post(RUTA_OFERTAS, OFERTA_BASE);
    expect(respuesta.status).toBe(403);
  });
});

describe(`GET ${RUTA_OFERTAS}/:id`, () => {
  it("un borrador sólo lo ve su equipo: 404 para los demás", async () => {
    const borrador = await crearOferta(tokenEquipo, { estado: "BORRADOR" });
    expect((await equipo.get(`${RUTA_OFERTAS}/${borrador.id}`)).status).toBe(200);
    expect((await otroEquipo.get(`${RUTA_OFERTAS}/${borrador.id}`)).status).toBe(404);
    expect((await jugador.get(`${RUTA_OFERTAS}/${borrador.id}`)).status).toBe(404);
    expect((await scout.get(`${RUTA_OFERTAS}/${borrador.id}`)).status).toBe(404);
  });

  it("una oferta publicada la ve cualquier usuario con sesión", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const respuesta = await jugador.get(`${RUTA_OFERTAS}/${oferta.id}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.id).toBe(oferta.id);
  });
});

describe(`PATCH ${RUTA_OFERTAS}/:id`, () => {
  it("edita parcialmente una oferta propia", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const pesos = { tecnica: 0.2, experiencia: 0.2, habilidadesBlandas: 0.2, geografica: 0.2, disponibilidad: 0.2 };
    const respuesta = await equipo.patch(`${RUTA_OFERTAS}/${oferta.id}`, {
      titulo: "Título editado de la oferta",
      pesos,
    });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ titulo: "Título editado de la oferta", pesos, rol: "MID" });
  });

  it("pasar a remota borra la ubicación", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const respuesta = await equipo.patch(`${RUTA_OFERTAS}/${oferta.id}`, { modalidad: "REMOTA" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ modalidad: "REMOTA", pais: null, departamento: null });
  });

  it.each([
    ["un departamento en una oferta remota", { modalidad: "REMOTA" }, { departamento: "ATLANTICO" }],
    ["pasar a presencial sin ubicación", { modalidad: "REMOTA" }, { modalidad: "PRESENCIAL" }],
  ])("valida la ubicación resultante: rechaza %s (422)", async (_caso, previo, cambio) => {
    const oferta = await crearOferta(tokenEquipo);
    await equipo.patch(`${RUTA_OFERTAS}/${oferta.id}`, previo);
    const respuesta = await equipo.patch(`${RUTA_OFERTAS}/${oferta.id}`, cambio);
    expect(respuesta.status).toBe(422);
  });

  it("rechaza con 422 pesos que no suman 1", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const respuesta = await equipo.patch(`${RUTA_OFERTAS}/${oferta.id}`, {
      pesos: { ...PESOS_MATCHING, geografica: 0.5 },
    });
    expect(respuesta.status).toBe(422);
  });

  it("responde 403 con la oferta publicada de otro equipo y 404 con su borrador", async () => {
    const publicada = await crearOferta(tokenEquipo);
    const borrador = await crearOferta(tokenEquipo, { estado: "BORRADOR" });
    const cambio = { titulo: "Intento de otro equipo" };
    expect((await otroEquipo.patch(`${RUTA_OFERTAS}/${publicada.id}`, cambio)).status).toBe(403);
    expect((await otroEquipo.patch(`${RUTA_OFERTAS}/${borrador.id}`, cambio)).status).toBe(404);
  });

  it("el scout no edita (403)", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const respuesta = await scout.patch(`${RUTA_OFERTAS}/${oferta.id}`, { titulo: "Intento del scout" });
    expect(respuesta.status).toBe(403);
  });

  it("una oferta cerrada no se edita (409)", async () => {
    const oferta = await crearOferta(tokenEquipo);
    await equipo.patch(estado(oferta.id), { estado: "CERRADA" });
    const respuesta = await equipo.patch(`${RUTA_OFERTAS}/${oferta.id}`, { titulo: "Ya no se puede" });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe("OFERTA_FINALIZADA");
  });
});

describe(`PATCH ${RUTA_OFERTAS}/:id/estado`, () => {
  it("publicar un borrador guarda publicadaEn", async () => {
    const borrador = await crearOferta(tokenEquipo, { estado: "BORRADOR" });
    const respuesta = await equipo.patch(estado(borrador.id), { estado: "ABIERTA" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.estado).toBe("ABIERTA");
    expect(respuesta.body.publicadaEn).not.toBeNull();

    const traza = await prisma.auditLog.findFirst({
      where: { accion: "OFERTA_ESTADO_CAMBIADO", entidadId: borrador.id },
    });
    expect(traza?.metadata).toEqual({ estadoAnterior: "BORRADOR", estadoNuevo: "ABIERTA" });
  });

  it.each([
    ["ABIERTA", "BORRADOR"],
    ["ABIERTA", "ABIERTA"],
    ["BORRADOR", "CUBIERTA"],
  ])("rechaza %s → %s con 409", async (inicial, destino) => {
    const oferta = await crearOferta(tokenEquipo, { estado: inicial });
    const respuesta = await equipo.patch(estado(oferta.id), { estado: destino });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe("TRANSICION_NO_PERMITIDA");
  });

  it.each(["ABIERTA", "CUBIERTA", "CERRADA"])("una oferta cerrada no pasa a %s (409)", async (destino) => {
    const oferta = await crearOferta(tokenEquipo);
    await equipo.patch(estado(oferta.id), { estado: "CERRADA" });
    const respuesta = await equipo.patch(estado(oferta.id), { estado: destino });
    expect(respuesta.status).toBe(409);
  });

  it("no se cubre sin una postulación aceptada (409)", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const respuesta = await equipo.patch(estado(oferta.id), { estado: "CUBIERTA" });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe("OFERTA_SIN_ACEPTADA");
  });

  it("cerrar guarda cerradaEn y rechaza las postulaciones pendientes con su fecha y su traza", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const enviada = await postular(tokenJugador, oferta.id);
    const enRevision = await postular(tokenJugador2, oferta.id);
    await moverPostulacion(tokenEquipo, enRevision, "EN_REVISION");

    const respuesta = await equipo.patch(estado(oferta.id), { estado: "CERRADA" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.cerradaEn).not.toBeNull();

    const postulaciones = await prisma.postulacion.findMany({ where: { ofertaId: oferta.id } });
    expect(postulaciones.map((p) => p.estado)).toEqual(["RECHAZADA", "RECHAZADA"]);
    for (const p of postulaciones) {
      expect(p.rechazadaEn?.toISOString()).toBe(respuesta.body.cerradaEn);
    }
    const trazas = await prisma.auditLog.findMany({
      where: { entidadId: { in: [enviada, enRevision] }, accion: "POSTULACION_ESTADO_CAMBIADO" },
    });
    const deCierre = trazas.filter(
      (t) => (t.metadata as { origen?: string } | null)?.origen === "cierre_oferta",
    );
    expect(deCierre).toHaveLength(2);
  });

  it("cubrir conserva la aceptada y rechaza las pendientes, sin tocar las ya rechazadas", async () => {
    const oferta = await crearOferta(tokenEquipo);
    const aceptada = await postular(tokenJugador, oferta.id);
    const rechazada = await postular(tokenJugador2, oferta.id);
    const pendiente = await postular(tokenJugador3, oferta.id);
    for (const paso of ["EN_REVISION", "ENTREVISTA", "ACEPTADA"]) {
      await moverPostulacion(tokenEquipo, aceptada, paso);
    }
    const yaRechazada = await moverPostulacion(tokenEquipo, rechazada, "RECHAZADA");

    const respuesta = await equipo.patch(estado(oferta.id), { estado: "CUBIERTA" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.estado).toBe("CUBIERTA");

    const porId = Object.fromEntries(
      (await prisma.postulacion.findMany({ where: { ofertaId: oferta.id } })).map((p) => [p.id, p]),
    );
    expect(porId[aceptada]?.estado).toBe("ACEPTADA");
    expect(porId[aceptada]?.rechazadaEn).toBeNull();
    expect(porId[pendiente]?.estado).toBe("RECHAZADA");
    expect(porId[pendiente]?.rechazadaEn?.toISOString()).toBe(respuesta.body.cerradaEn);
    expect(porId[rechazada]?.rechazadaEn?.toISOString()).toBe(yaRechazada.rechazadaEn);
  });

  it("responde 403 al scout y a otro equipo", async () => {
    const oferta = await crearOferta(tokenEquipo);
    expect((await scout.patch(estado(oferta.id), { estado: "CERRADA" })).status).toBe(403);
    expect((await otroEquipo.patch(estado(oferta.id), { estado: "CERRADA" })).status).toBe(403);
  });
});

describe(`GET ${RUTA_OFERTAS}`, () => {
  let ids: string[];

  beforeAll(async () => {
    // Equipo propio del listado, con ofertas en Vaupés de las que se conoce el orden.
    const token = await registrar("ofertas-listado", "EQUIPO");
    ids = [];
    for (const rol of ["TOP", "JUNGLA", "ADC"]) {
      ids.push((await crearOferta(token, { rol, titulo: `Listado ${rol} de pruebas` })).id);
    }
    const remota = await crearOferta(token, {
      rol: "SOPORTE",
      modalidad: "REMOTA",
      pais: null,
      departamento: null,
    });
    ids.push(remota.id);
    await crearOferta(token, { rol: "TOP", estado: "BORRADOR" });
    const cerrada = await crearOferta(token, { rol: "TOP" });
    await conToken(token).patch(estado(cerrada.id), { estado: "CERRADA" });
  });

  const enVaupes = `${RUTA_OFERTAS}?departamento=${DEPARTAMENTO_PRUEBA}`;

  it("sólo lista ofertas abiertas, de la más reciente a la más antigua", async () => {
    const respuesta = await jugador.get(`${enVaupes}&pageSize=100`);
    expect(respuesta.status).toBe(200);
    const listadas = respuesta.body.data as { id: string; estado: string; publicadaEn: string }[];
    expect(listadas.every((o) => o.estado === "ABIERTA")).toBe(true);
    const fechas = listadas.map((o) => o.publicadaEn);
    expect(fechas).toEqual([...fechas].sort().reverse());
    // Las tres presenciales del listado, en orden inverso de creación.
    const propias = listadas.map((o) => o.id).filter((id) => ids.slice(0, 3).includes(id));
    expect(propias).toEqual(ids.slice(0, 3).reverse());
  });

  it("pagina con meta y sin repetir ofertas entre páginas", async () => {
    const primera = await jugador.get(`${enVaupes}&rol=TOP&pageSize=1&page=1`);
    expect(primera.status).toBe(200);
    expect(primera.body.meta).toMatchObject({ page: 1, pageSize: 1 });
    expect(primera.body.data).toHaveLength(1);
    const total = primera.body.meta.total as number;
    expect(primera.body.meta.totalPages).toBe(total);

    const todas = await jugador.get(`${enVaupes}&rol=TOP&pageSize=100`);
    const segunda = await jugador.get(`${enVaupes}&rol=TOP&pageSize=1&page=2`);
    if (total > 1) {
      expect(segunda.body.data[0].id).toBe(todas.body.data[1].id);
    } else {
      expect(segunda.body.data).toEqual([]);
    }
  });

  it("filtra por rol, departamento y modalidad", async () => {
    const porRol = await jugador.get(`${enVaupes}&rol=JUNGLA&pageSize=100`);
    expect(porRol.body.data.map((o: { id: string }) => o.id)).toContain(ids[1]);
    expect(porRol.body.data.every((o: { rol: string }) => o.rol === "JUNGLA")).toBe(true);

    const remotas = await jugador.get(`${RUTA_OFERTAS}?modalidad=REMOTA&pageSize=100`);
    expect(remotas.body.data.map((o: { id: string }) => o.id)).toContain(ids[3]);
    expect(remotas.body.data.every((o: { modalidad: string }) => o.modalidad === "REMOTA")).toBe(true);

    // La remota no tiene departamento: no sale al filtrar por Vaupés.
    const enDepartamento = await jugador.get(`${enVaupes}&pageSize=100`);
    expect(enDepartamento.body.data.map((o: { id: string }) => o.id)).not.toContain(ids[3]);
  });

  it("rechaza filtros fuera del catálogo con 422", async () => {
    expect((await jugador.get(`${RUTA_OFERTAS}?rol=AWPER`)).status).toBe(422);
    expect((await jugador.get(`${RUTA_OFERTAS}?pageSize=1000`)).status).toBe(422);
  });

  it("exige sesión", async () => {
    expect((await request(app).get(RUTA_OFERTAS)).status).toBe(401);
  });
});

describe(`GET ${RUTA_OFERTAS}/me`, () => {
  it("lista las ofertas del equipo en cualquier estado, con sus postulaciones", async () => {
    const token = await registrar("ofertas-mias", "EQUIPO");
    const borrador = await crearOferta(token, { estado: "BORRADOR" });
    const abierta = await crearOferta(token);
    await postular(tokenJugador, abierta.id);

    const respuesta = await conToken(token).get(`${RUTA_OFERTAS}/me`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.meta.total).toBe(2);
    const porId = Object.fromEntries(
      respuesta.body.data.map((o: { id: string; totalPostulaciones: number }) => [o.id, o]),
    );
    expect(porId[borrador.id].totalPostulaciones).toBe(0);
    expect(porId[abierta.id].totalPostulaciones).toBe(1);

    const borradores = await conToken(token).get(`${RUTA_OFERTAS}/me?estado=BORRADOR`);
    expect(borradores.body.data.map((o: { id: string }) => o.id)).toEqual([borrador.id]);
  });

  it("responde 403 al jugador y al scout", async () => {
    expect((await jugador.get(`${RUTA_OFERTAS}/me`)).status).toBe(403);
    expect((await scout.get(`${RUTA_OFERTAS}/me`)).status).toBe(403);
  });
});

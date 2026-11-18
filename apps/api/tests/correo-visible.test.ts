import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { API_PREFIX, candidatoOfertaSchema, postulacionRecibidaSchema } from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import { PREFIJO_PRUEBA, app, cerrarConexiones, limpiarUsuariosDePrueba } from "./utils/entorno";
import { RUTA_OFERTAS, conToken, crearOferta, moverPostulacion, postular, registrar } from "./utils/ofertas";

/**
 * Sustituto de la mensajería (decisión 0.10): el equipo dueño ve el correo del
 * jugador en las postulaciones recibidas y en el detalle del candidato, sólo
 * con la postulación en revisión, entrevista o aceptada. Ni el scout, ni el
 * administrador, ni ninguna otra vista.
 */

let tokenEquipo: string;
let tokenScout: string;
let tokenAdmin: string;
let tokenJugador: string;
let tokenRechazado: string;
let oferta: string;
let jugadorId: string;
let rechazadoId: string;
let postulacion: string;
let postulacionRechazada: string;
let correo: string;
let correoRechazado: string;

async function perfilDe(etiqueta: string) {
  return prisma.perfilJugador.findFirstOrThrow({
    where: { usuario: { email: { startsWith: `${PREFIJO_PRUEBA}+${etiqueta}-` } } },
    include: { usuario: true },
  });
}

async function comoAdmin(etiqueta: string): Promise<string> {
  await registrar(etiqueta, "SCOUT");
  const usuario = await prisma.usuario.findFirstOrThrow({ where: { email: { startsWith: `${PREFIJO_PRUEBA}+${etiqueta}-` } } });
  await prisma.usuario.update({ where: { id: usuario.id }, data: { rol: "ADMIN" } });
  const login = await request(app).post(`${API_PREFIX}/auth/login`).send({ email: usuario.email, password: "ProPlay123" });
  return login.body.accessToken as string;
}

const rutaRecibidas = () => `${RUTA_OFERTAS}/${oferta}/postulaciones`;
const rutaDetalle = (id = jugadorId) => `${API_PREFIX}/matching/ofertas/${oferta}/candidatos/${id}`;

/** Contacto de la postulación `id` en las recibidas, vistas con `token`. */
async function contactoEnRecibidas(token: string, id = postulacion) {
  const respuesta = await conToken(token).get(rutaRecibidas());
  expect(respuesta.status).toBe(200);
  const recibidas = postulacionRecibidaSchema.array().parse(respuesta.body);
  return recibidas.find((p) => p.id === id)!.contacto;
}

async function contactoEnDetalle(token: string, id = jugadorId) {
  const respuesta = await conToken(token).get(rutaDetalle(id));
  expect(respuesta.status).toBe(200);
  return candidatoOfertaSchema.parse(respuesta.body).contacto;
}

beforeAll(async () => {
  await limpiarUsuariosDePrueba();
  tokenEquipo = await registrar("correo-equipo", "EQUIPO");
  tokenScout = await registrar("correo-scout", "SCOUT");
  tokenAdmin = await comoAdmin("correo-admin");
  tokenJugador = await registrar("correo-jugador", "JUGADOR");
  tokenRechazado = await registrar("correo-rechazado", "JUGADOR");
  const perfil = await perfilDe("correo-jugador");
  jugadorId = perfil.id;
  correo = perfil.usuario.email;
  const rechazado = await perfilDe("correo-rechazado");
  rechazadoId = rechazado.id;
  correoRechazado = rechazado.usuario.email;
  oferta = (await crearOferta(tokenEquipo)).id;
  postulacion = await postular(tokenJugador, oferta);
  postulacionRechazada = await postular(tokenRechazado, oferta);
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
  await cerrarConexiones();
});

describe("correo del jugador para el equipo dueño", () => {
  it("con la postulación recién enviada, nadie lo ve", async () => {
    expect(await contactoEnRecibidas(tokenEquipo)).toBeNull();
    expect(await contactoEnDetalle(tokenEquipo)).toBeNull();
  });

  it("en revisión, el equipo dueño lo ve en las recibidas y en el detalle", async () => {
    await moverPostulacion(tokenEquipo, postulacion, "EN_REVISION");
    expect(await contactoEnRecibidas(tokenEquipo)).toEqual({ email: correo });
    expect(await contactoEnDetalle(tokenEquipo)).toEqual({ email: correo });
  });

  it("el scout y el administrador no lo ven nunca", async () => {
    for (const token of [tokenScout, tokenAdmin]) {
      expect(await contactoEnRecibidas(token)).toBeNull();
      expect(await contactoEnDetalle(token)).toBeNull();
      const recibidas = await conToken(token).get(rutaRecibidas());
      expect(JSON.stringify(recibidas.body)).not.toContain(correo);
    }
  });

  it("en entrevista y aceptada lo sigue viendo", async () => {
    await moverPostulacion(tokenEquipo, postulacion, "ENTREVISTA");
    expect(await contactoEnRecibidas(tokenEquipo)).toEqual({ email: correo });
    expect(await contactoEnDetalle(tokenEquipo)).toEqual({ email: correo });
    await moverPostulacion(tokenEquipo, postulacion, "ACEPTADA");
    expect(await contactoEnRecibidas(tokenEquipo)).toEqual({ email: correo });
    expect(await contactoEnDetalle(tokenEquipo)).toEqual({ email: correo });
  });

  it("rechazada deja de verlo, aunque antes estuviera en revisión", async () => {
    await moverPostulacion(tokenEquipo, postulacionRechazada, "EN_REVISION");
    expect(await contactoEnRecibidas(tokenEquipo, postulacionRechazada)).toEqual({ email: correoRechazado });
    await moverPostulacion(tokenEquipo, postulacionRechazada, "RECHAZADA");
    expect(await contactoEnRecibidas(tokenEquipo, postulacionRechazada)).toBeNull();
    expect(await contactoEnDetalle(tokenEquipo, rechazadoId)).toBeNull();
  });
});

describe("el correo no sale en ninguna otra vista", () => {
  // Con la postulación aceptada: el caso en que el equipo dueño sí lo ve en las dos vistas permitidas.
  it("ni en el ranking, ni en el buscador, ni en el perfil público, ni en las ofertas del jugador", async () => {
    const vistas = [
      conToken(tokenEquipo).get(`${API_PREFIX}/matching/ofertas/${oferta}/ranking?pageSize=100`),
      conToken(tokenEquipo).get(`${API_PREFIX}/matching/ofertas/${oferta}/ranking?soloPostulados=true`),
      conToken(tokenScout).get(`${API_PREFIX}/scouting/jugadores?pageSize=100`),
      conToken(tokenEquipo).get(`${API_PREFIX}/scouting/jugadores?pageSize=100`),
      request(app).get(`${API_PREFIX}/perfiles/${jugadorId}`),
      conToken(tokenEquipo).get(`${API_PREFIX}/perfiles/${jugadorId}`),
      conToken(tokenJugador).get(`${API_PREFIX}/matching/jugador/me`),
      conToken(tokenEquipo).get(`${RUTA_OFERTAS}/${oferta}`),
      conToken(tokenEquipo).get(`${RUTA_OFERTAS}/me`),
    ];
    for (const respuesta of await Promise.all(vistas)) {
      expect(respuesta.status).toBe(200);
      expect(JSON.stringify(respuesta.body)).not.toContain(correo);
    }
  });

  it("el detalle como scout tampoco lo lleva", async () => {
    const detalle = await conToken(tokenScout).get(rutaDetalle());
    expect(JSON.stringify(detalle.body)).not.toContain(correo);
  });
});

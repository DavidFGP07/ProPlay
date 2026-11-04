import request from "supertest";
import { expect } from "vitest";
import { API_PREFIX, type RolRegistrable } from "@proplay/shared";
import { CONSENTIMIENTO, app, emailDePrueba } from "./entorno";

/**
 * Utilidades de las pruebas de ofertas y postulaciones: cuentas de cada rol y
 * ofertas creadas por la API. Las ofertas de prueba van a un departamento que
 * el seed no usa (Vaupés), para que los listados se puedan comprobar aunque la
 * base tenga datos de demostración.
 */

export const RUTA_OFERTAS = `${API_PREFIX}/ofertas`;
export const DEPARTAMENTO_PRUEBA = "VAUPES";

export async function registrar(etiqueta: string, rol: RolRegistrable): Promise<string> {
  const respuesta = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email: emailDePrueba(etiqueta),
      password: "ProPlay123",
      nombre: `Prueba ${etiqueta}`,
      rol,
      ...CONSENTIMIENTO,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.accessToken as string;
}

export function conToken(token: string) {
  return {
    get: (ruta: string) => request(app).get(ruta).set("Authorization", `Bearer ${token}`),
    post: (ruta: string, cuerpo: object = {}) =>
      request(app).post(ruta).set("Authorization", `Bearer ${token}`).send(cuerpo),
    patch: (ruta: string, cuerpo: object) =>
      request(app).patch(ruta).set("Authorization", `Bearer ${token}`).send(cuerpo),
  };
}

export const OFERTA_BASE = {
  titulo: "MID para la academia de pruebas",
  rol: "MID",
  modalidad: "PRESENCIAL",
  pais: "CO",
  departamento: DEPARTAMENTO_PRUEBA,
  descripcion: "Oferta creada por las pruebas de integración del módulo de ofertas.",
} as const;

/** Crea una oferta del equipo y devuelve su cuerpo; por defecto, ya abierta. */
export async function crearOferta(
  token: string,
  cambios: Record<string, unknown> = {},
): Promise<{ id: string; [campo: string]: unknown }> {
  const respuesta = await conToken(token).post(RUTA_OFERTAS, {
    ...OFERTA_BASE,
    estado: "ABIERTA",
    ...cambios,
  });
  expect(respuesta.status).toBe(201);
  return respuesta.body;
}

/** El jugador se postula y devuelve el id de la postulación. */
export async function postular(tokenJugador: string, ofertaId: string): Promise<string> {
  const respuesta = await conToken(tokenJugador).post(
    `${RUTA_OFERTAS}/${ofertaId}/postulaciones`,
    { mensaje: "Me interesa" },
  );
  expect(respuesta.status).toBe(201);
  return respuesta.body.id as string;
}

/** Cambia el estado de una postulación y comprueba que respondió 200. */
export async function moverPostulacion(tokenEquipo: string, id: string, estado: string) {
  const respuesta = await conToken(tokenEquipo).patch(
    `${RUTA_OFERTAS}/postulaciones/${id}`,
    { estado },
  );
  expect(respuesta.status).toBe(200);
  return respuesta.body;
}

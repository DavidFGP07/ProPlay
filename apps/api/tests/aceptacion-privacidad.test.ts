import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { API_PREFIX, VERSION_AVISO_PRIVACIDAD } from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import {
  CONSENTIMIENTO,
  app,
  cerrarConexiones,
  emailDePrueba,
  limpiarUsuariosDePrueba,
} from "./utils/entorno";

/**
 * RNF-05 · La aceptación del aviso de privacidad y la declaración de mayoría
 * de edad quedan guardadas, con su traza, al registrarse (Ley 1581 de 2012,
 * Decreto 1377 de 2013: la autorización debe poder probarse).
 */
const PASSWORD = "ProPlay123";

function registrar(email: string, extra: Record<string, unknown> = {}) {
  return request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({ email, password: PASSWORD, nombre: "Cuenta de Prueba", rol: "JUGADOR", ...CONSENTIMIENTO, ...extra });
}

describe("aceptación del aviso de privacidad en el registro", () => {
  beforeAll(async () => {
    await limpiarUsuariosDePrueba();
  });

  afterAll(async () => {
    await limpiarUsuariosDePrueba();
    await cerrarConexiones();
  });

  it("guarda la versión vigente, la fecha de aceptación y la de la declaración", async () => {
    const email = emailDePrueba("aceptacion");
    const antes = Date.now();
    const respuesta = await registrar(email);
    expect(respuesta.status).toBe(201);

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: email.toLowerCase() } });
    expect(usuario.avisoPrivacidadVersion).toBe(VERSION_AVISO_PRIVACIDAD);
    expect(usuario.avisoPrivacidadAceptadoEn!.getTime()).toBeGreaterThanOrEqual(antes - 1000);
    expect(usuario.avisoPrivacidadAceptadoEn!.getTime()).toBeLessThanOrEqual(Date.now());
    expect(usuario.declaraMayorEdadEn).toEqual(usuario.avisoPrivacidadAceptadoEn);

    const traza = await prisma.auditLog.findFirstOrThrow({
      where: { usuarioId: usuario.id, accion: "USUARIO_REGISTRADO" },
    });
    expect(traza.metadata).toMatchObject({
      rol: "JUGADOR",
      avisoPrivacidadVersion: VERSION_AVISO_PRIVACIDAD,
      declaraMayorEdad: true,
    });
  });

  it("ignora una versión del aviso enviada por el cliente", async () => {
    const email = emailDePrueba("version-cliente");
    const respuesta = await registrar(email, {
      avisoPrivacidadVersion: "0.1-enviada-por-el-cliente",
      avisoPrivacidadAceptadoEn: "2000-01-01T00:00:00Z",
    });
    expect(respuesta.status).toBe(201);

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: email.toLowerCase() } });
    expect(usuario.avisoPrivacidadVersion).toBe(VERSION_AVISO_PRIVACIDAD);
    expect(usuario.avisoPrivacidadAceptadoEn!.getFullYear()).toBeGreaterThan(2000);
  });

  it("si falla la traza de auditoría no se crea el usuario", async () => {
    const email = emailDePrueba("auditoria-caida").toLowerCase();
    // Disparador temporal que hace fallar el INSERT en AuditLog sólo para el
    // alta de este correo; el usuario recién creado es visible dentro de la
    // misma transacción.
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION prueba_auditoria_caida() RETURNS trigger AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "Usuario" WHERE id = NEW."usuarioId" AND email = '${email}') THEN
          RAISE EXCEPTION 'auditoría caída (prueba)';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER prueba_auditoria_caida BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION prueba_auditoria_caida();
    `);

    try {
      const respuesta = await registrar(email);
      expect(respuesta.status).toBe(500);
      expect(await prisma.usuario.findUnique({ where: { email } })).toBeNull();
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS prueba_auditoria_caida ON "AuditLog"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS prueba_auditoria_caida()`);
    }

    // Sin el fallo, el mismo registro funciona: la transacción no dejó restos.
    expect((await registrar(email)).status).toBe(201);
  });
});

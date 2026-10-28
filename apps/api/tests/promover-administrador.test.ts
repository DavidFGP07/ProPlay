import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { API_PREFIX, REFRESH_COOKIE_NAME, type RolRegistrable } from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import { SALIDA, ejecutar, type Consola } from "../src/cli/promoverAdministrador";
import {
  CONSENTIMIENTO,
  app,
  cerrarConexiones,
  emailDePrueba,
  extraerCookie,
  limpiarUsuariosDePrueba,
} from "./utils/entorno";

/**
 * RF-01 · Alta del primer administrador: script cli/promoverAdministrador.ts
 * (tarea 1.4, docs/operacion.md).
 */

interface Cuenta {
  id: string;
  email: string;
  accessToken: string;
  /** Cookie de refresh lista para la cabecera Cookie. */
  cookie: string;
}

async function registrar(etiqueta: string, rol: RolRegistrable): Promise<Cuenta> {
  const email = emailDePrueba(etiqueta);
  const respuesta = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({ email, password: "ProPlay123", nombre: "Cuenta de Prueba", rol, ...CONSENTIMIENTO });
  expect(respuesta.status).toBe(201);
  const cookie = extraerCookie(respuesta.headers["set-cookie"], REFRESH_COOKIE_NAME);
  if (!cookie) throw new Error("La respuesta no trae la cookie de refresh");
  return {
    id: respuesta.body.usuario.id as string,
    email,
    accessToken: respuesta.body.accessToken as string,
    cookie: cookie.split(";")[0]!,
  };
}

/** Consola que guarda lo impreso para poder comprobarlo. */
function consolaDePrueba(): Consola & { salida: string[]; errores: string[] } {
  const salida: string[] = [];
  const errores: string[] = [];
  return { salida, errores, log: (m) => salida.push(m), error: (m) => errores.push(m) };
}

function rolDe(id: string) {
  return prisma.usuario.findUniqueOrThrow({ where: { id }, select: { rol: true } });
}

function trazasDe(id: string) {
  return prisma.auditLog.findMany({ where: { usuarioId: id, accion: "ROL_CAMBIADO" } });
}

afterAll(async () => {
  await limpiarUsuariosDePrueba();
  await cerrarConexiones();
});

describe("promover a administrador por línea de comandos", () => {
  it("promueve una cuenta de scout y deja la traza en AuditLog", async () => {
    const cuenta = await registrar("promover-scout", "SCOUT");
    const consola = consolaDePrueba();

    expect(await ejecutar([cuenta.email], consola)).toBe(SALIDA.OK);

    expect((await rolDe(cuenta.id)).rol).toBe("ADMIN");
    const trazas = await trazasDe(cuenta.id);
    expect(trazas).toHaveLength(1);
    expect(trazas[0]).toMatchObject({
      entidad: "Usuario",
      entidadId: cuenta.id,
      metadata: { rolAnterior: "SCOUT", rolNuevo: "ADMIN", origen: "cli" },
    });
    expect(consola.salida.join("\n")).toContain("pasó de SCOUT a ADMIN");
  });

  it("la sesión abierta recibe el rol nuevo en el siguiente refresco", async () => {
    const cuenta = await registrar("promover-refresco", "SCOUT");
    expect(await ejecutar([cuenta.email], consolaDePrueba())).toBe(SALIDA.OK);
    const listarUsuarios = (token: string) =>
      request(app).get(`${API_PREFIX}/usuarios`).set("Authorization", `Bearer ${token}`);

    // El access token emitido antes de la promoción conserva el rol anterior.
    expect((await listarUsuarios(cuenta.accessToken)).status).toBe(403);

    const refresco = await request(app)
      .post(`${API_PREFIX}/auth/refresh`)
      .set("Cookie", cuenta.cookie);
    expect(refresco.status).toBe(200);
    expect((await listarUsuarios(refresco.body.accessToken as string)).status).toBe(200);
  });

  it("acepta el correo con mayúsculas y espacios alrededor", async () => {
    const cuenta = await registrar("promover-mayusculas", "SCOUT");

    expect(await ejecutar([`  ${cuenta.email.toUpperCase()} `], consolaDePrueba())).toBe(
      SALIDA.OK,
    );
    expect((await rolDe(cuenta.id)).rol).toBe("ADMIN");
  });

  it("es idempotente: si ya es administrador no cambia nada ni duplica la traza", async () => {
    const cuenta = await registrar("promover-dos-veces", "SCOUT");
    expect(await ejecutar([cuenta.email], consolaDePrueba())).toBe(SALIDA.OK);
    const consola = consolaDePrueba();

    expect(await ejecutar([cuenta.email], consola)).toBe(SALIDA.OK);

    expect(consola.salida.join("\n")).toContain("ya es administrador");
    expect(await trazasDe(cuenta.id)).toHaveLength(1);
  });

  it.each(["JUGADOR", "EQUIPO"] as const)(
    "se niega con una cuenta de %s, que tiene perfil",
    async (rol) => {
      const cuenta = await registrar(`promover-${rol.toLowerCase()}`, rol);
      const consola = consolaDePrueba();

      expect(await ejecutar([cuenta.email], consola)).toBe(SALIDA.RECHAZADO);

      expect((await rolDe(cuenta.id)).rol).toBe(rol);
      expect(await trazasDe(cuenta.id)).toHaveLength(0);
      expect(consola.errores.join("\n")).toContain("perfil de jugador o de equipo");
    },
  );

  it("se niega si la cuenta no existe", async () => {
    const consola = consolaDePrueba();

    expect(await ejecutar([emailDePrueba("promover-inexistente")], consola)).toBe(
      SALIDA.RECHAZADO,
    );
    expect(consola.errores.join("\n")).toContain("No existe ninguna cuenta");
  });

  it("se niega si la cuenta está desactivada", async () => {
    const cuenta = await registrar("promover-desactivada", "SCOUT");
    await prisma.usuario.update({ where: { id: cuenta.id }, data: { activo: false } });
    const consola = consolaDePrueba();

    expect(await ejecutar([cuenta.email], consola)).toBe(SALIDA.RECHAZADO);

    expect((await rolDe(cuenta.id)).rol).toBe("SCOUT");
    expect(await trazasDe(cuenta.id)).toHaveLength(0);
    expect(consola.errores.join("\n")).toContain("desactivada");
  });

  it("rechaza un correo mal formado", async () => {
    const consola = consolaDePrueba();

    expect(await ejecutar(["no-es-un-correo"], consola)).toBe(SALIDA.RECHAZADO);
    expect(consola.errores.join("\n")).toContain("no es válido");
  });

  it.each([[[]], [["uno@proplay.test", "dos@proplay.test"]], [["   "]]])(
    "muestra el uso y sale con 2 si los argumentos no son un correo (%j)",
    async (argumentos) => {
      const consola = consolaDePrueba();

      expect(await ejecutar(argumentos, consola)).toBe(SALIDA.USO);
      expect(consola.errores.join("\n")).toContain("Uso: npm run admin:promover");
    },
  );
});

import type { Express } from "express";
import { randomBytes } from "node:crypto";
import { crearApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";

/**
 * Utilidades compartidas por las pruebas de integración.
 *
 * Las pruebas hablan con la app real (Express + Prisma) contra la base de
 * datos de DATABASE_URL, así que crean usuarios con correos aleatorios y los
 * borran al terminar. En CI la base es proplay_test.
 */

export const app: Express = crearApp();

/** Prefijo con el que se identifican y limpian los usuarios de prueba. */
export const PREFIJO_PRUEBA = "test-integracion";

export function emailDePrueba(etiqueta: string): string {
  return `${PREFIJO_PRUEBA}+${etiqueta}-${randomBytes(4).toString("hex")}@proplay.test`;
}

/** Borra todo lo que hayan creado las pruebas (los perfiles caen en cascada). */
export async function limpiarUsuariosDePrueba(): Promise<void> {
  await prisma.usuario.deleteMany({
    where: { email: { startsWith: PREFIJO_PRUEBA } },
  });
}

export async function cerrarConexiones(): Promise<void> {
  await prisma.$disconnect();
}

/** Extrae la cookie de refresh de la cabecera Set-Cookie. */
export function extraerCookie(
  cabecera: string | string[] | undefined,
  nombre: string,
): string | undefined {
  const cookies = Array.isArray(cabecera) ? cabecera : cabecera ? [cabecera] : [];
  return cookies.find((cookie) => cookie.startsWith(`${nombre}=`));
}

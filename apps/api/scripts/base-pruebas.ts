// Base de datos propia de las pruebas de integración.
//
//   npm test -w api          la prepara sola antes de la primera prueba
//   npm run db:test -w api   la crea y la migra sin ejecutar pruebas
//
// Las pruebas nunca corren contra la base de desarrollo: usan una base aparte
// en el mismo servidor que la de DATABASE_URL, con el mismo nombre y el sufijo
// `_test` (`proplay` → `proplay_test`). Si DATABASE_URL ya apunta a una base
// `_test` (el CI), se usa tal cual. La base se crea si no existe y se le
// aplican las migraciones pendientes en cada ejecución.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const RAIZ_API = join(__dirname, "..");
export const SUFIJO_BASE_PRUEBAS = "_test";

/** Nombre de la base de una URL de Postgres. */
export function nombreDeBase(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

/** La base de la URL es una base de pruebas (su nombre termina en `_test`). */
export function esBaseDePruebas(url: string): boolean {
  return nombreDeBase(url).endsWith(SUFIJO_BASE_PRUEBAS);
}

/** DATABASE_URL de la configuración: la del entorno o, si no, la de apps/api/.env. */
function urlConfigurada(): string {
  const archivoEnv = join(RAIZ_API, ".env");
  // No pisa las variables ya definidas en el entorno (las del CI mandan).
  if (!process.env.DATABASE_URL && existsSync(archivoEnv)) process.loadEnvFile(archivoEnv);
  if (!process.env.DATABASE_URL) {
    throw new Error("Falta DATABASE_URL: las pruebas derivan de ella su base de pruebas");
  }
  return process.env.DATABASE_URL;
}

/**
 * URL de la base de pruebas: la de DATABASE_URL con el sufijo `_test` en el
 * nombre de la base, o la misma si ya lo lleva.
 */
export function urlBaseDePruebas(original = urlConfigurada()): string {
  if (esBaseDePruebas(original)) return original;
  const destino = new URL(original);
  destino.pathname = `/${nombreDeBase(original)}${SUFIJO_BASE_PRUEBAS}`;
  return destino.toString();
}

/** Crea la base de pruebas si no existe y le aplica las migraciones pendientes. */
export async function prepararBaseDePruebas(): Promise<string> {
  const original = urlConfigurada();
  const destino = urlBaseDePruebas(original);
  const base = nombreDeBase(destino);
  // El nombre va entre comillas en CREATE DATABASE, que no admite parámetros.
  if (!/^[A-Za-z0-9_]+$/.test(base)) {
    throw new Error(`Nombre de base de pruebas no admitido: ${base}`);
  }

  if (destino !== original) {
    const { Prisma, PrismaClient } = await import("@prisma/client");
    const admin = new PrismaClient({ datasources: { db: { url: original } } });
    try {
      const [existe] = await admin.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_database WHERE datname = ${base}
      `;
      if (!existe?.n) {
        await admin.$executeRaw`CREATE DATABASE ${Prisma.raw(`"${base}"`)}`;
        console.log(`Base de pruebas ${base} creada.`);
      }
    } finally {
      await admin.$disconnect();
    }
  }

  execSync("npx prisma migrate deploy", {
    cwd: RAIZ_API,
    env: { ...process.env, DATABASE_URL: destino },
    stdio: ["ignore", "ignore", "inherit"],
  });
  return destino;
}

// Ejecutado como script (`npm run db:test -w api`).
if (typeof require !== "undefined" && require.main === module) {
  prepararBaseDePruebas()
    .then((url) => console.log(`Base de pruebas lista: ${nombreDeBase(url)}`))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}

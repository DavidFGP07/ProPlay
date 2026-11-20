// Deja la base de la demostración exactamente como la crea el seed.
//
//   npm run demo:reiniciar          (desde la raíz)
//   npm run demo:reiniciar -w api
//
// Borra la base de DATABASE_URL entera, le aplica todas las migraciones (el
// índice HNSW incluido) y ejecuta el seed: no queda nada de los ensayos, ni
// postulaciones, ni ofertas, ni cuentas creadas a mano. Procedimiento en
// docs/operacion.md, «Reiniciar la base de la demostración».
//
// Sólo se ejecuta contra una base local de desarrollo: se niega en producción,
// contra la base de las pruebas y contra cualquier servidor que no sea local.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { esBaseDePruebas, nombreDeBase } from "./base-pruebas";

const RAIZ_API = join(__dirname, "..");
const SERVIDORES_LOCALES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Por qué no se puede reiniciar esta base, o `null` si se puede. */
export function motivoParaNoReiniciar(
  url: string | undefined,
  nodeEnv: string | undefined,
): string | null {
  if (nodeEnv === "production") return "NODE_ENV=production: nunca se reinicia una base de producción";
  if (!url) return "falta DATABASE_URL";
  let destino: URL;
  try {
    destino = new URL(url);
  } catch {
    return "DATABASE_URL no es una URL válida";
  }
  if (!SERVIDORES_LOCALES.has(destino.hostname)) {
    return `el servidor de la base (${destino.hostname}) no es local`;
  }
  if (esBaseDePruebas(url)) {
    return `«${nombreDeBase(url)}» es la base de las pruebas; npm test la gestiona sola`;
  }
  return null;
}

function main(): number {
  const archivoEnv = join(RAIZ_API, ".env");
  if (!process.env.DATABASE_URL && existsSync(archivoEnv)) process.loadEnvFile(archivoEnv);

  const motivo = motivoParaNoReiniciar(process.env.DATABASE_URL, process.env.NODE_ENV);
  if (motivo) {
    console.error(`No se reinició la base: ${motivo}.`);
    return 1;
  }

  const base = nombreDeBase(process.env.DATABASE_URL!);
  console.log(`Reiniciando la base «${base}»: migraciones desde cero y seed…`);
  // `migrate reset` ejecuta el seed configurado en package.json («prisma.seed»).
  execSync("npx prisma migrate reset --force", { cwd: RAIZ_API, stdio: "inherit" });
  console.log(
    `\nBase «${base}» lista para la demostración. Reinicia la API si estaba en marcha: ` +
      "los límites de peticiones y las sesiones abiertas viven en su memoria y en las cookies.",
  );
  return 0;
}

if (typeof require !== "undefined" && require.main === module) {
  process.exitCode = main();
}

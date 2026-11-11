import { esBaseDePruebas, nombreDeBase } from "../../scripts/base-pruebas";

/**
 * `setupFiles` de Vitest: se ejecuta en cada archivo de pruebas antes de
 * importar la app. Si por cualquier motivo DATABASE_URL no apunta a una base
 * de pruebas, la ejecución se detiene aquí, antes de abrir una conexión.
 */
const url = process.env.DATABASE_URL;
if (!url || !esBaseDePruebas(url)) {
  throw new Error(
    `Las pruebas sólo corren contra una base de pruebas (nombre terminado en _test), no contra ` +
      `«${url ? nombreDeBase(url) : "sin DATABASE_URL"}». Revisa apps/api/vitest.config.ts.`,
  );
}

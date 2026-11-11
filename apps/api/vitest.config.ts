import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { urlBaseDePruebas } from "./scripts/base-pruebas";

export default defineConfig({
  resolve: {
    alias: {
      "@proplay/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    // NODE_ENV=test desactiva el rate limit y el log de peticiones; las
    // variables del proceso tienen prioridad sobre las de apps/api/.env.
    // DATABASE_URL apunta siempre a la base de pruebas (`…_test`), nunca a la
    // de desarrollo: `globalSetup` la crea y la migra, y `setupFiles` se niega
    // a ejecutar nada si la base no es de pruebas (scripts/base-pruebas.ts).
    env: { NODE_ENV: "test", DATABASE_URL: urlBaseDePruebas() },
    globalSetup: ["tests/utils/prepararBase.ts"],
    setupFiles: ["tests/utils/soloBaseDePruebas.ts"],
    globals: false,
    include: ["tests/**/*.test.ts"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    pool: "forks",
    fileParallelism: false,
  },
});

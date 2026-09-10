import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

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
    env: { NODE_ENV: "test" },
    globals: false,
    include: ["tests/**/*.test.ts"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    pool: "forks",
    fileParallelism: false,
  },
});

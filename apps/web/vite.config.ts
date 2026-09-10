import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const rutaSrc = fileURLToPath(new URL("./src", import.meta.url));
const rutaShared = fileURLToPath(
  new URL("../../packages/shared/src", import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // @proplay/shared se resuelve SIEMPRE al TypeScript fuente: así un cambio
      // en el paquete compartido se refleja en caliente (HMR) sin compilarlo, y
      // `npm run build -w web` funciona sin construir antes otros workspaces.
      { find: /^@proplay\/shared$/, replacement: `${rutaShared}/index.ts` },
      { find: /^@proplay\/shared\/(.*)$/, replacement: `${rutaShared}/$1` },
      { find: "@", replacement: rutaSrc },
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});

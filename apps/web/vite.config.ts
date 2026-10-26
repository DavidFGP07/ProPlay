/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // @proplay/shared se resuelve al TypeScript fuente: los cambios del
      // contrato llegan en caliente sin compilar el paquete.
      { find: /^@proplay\/shared$/, replacement: path.resolve(__dirname, '../../packages/shared/src/index.ts') },
      { find: /^@proplay\/shared\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/shared/src') + '/$1' },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    // Las pruebas corren siempre con el puente de demostracion encendido y sin
    // depender de un apps/web/.env local.
    env: {
      VITE_API_URL: 'http://localhost:3000/api/v1',
      VITE_DEMO_DATA: 'true',
    },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/lib/**/*.ts',
        'src/services/matching.ts',
        'src/services/llm.ts',
      ],
      // RNF-08: cobertura minima del 60 % en el modulo de matching.
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
})

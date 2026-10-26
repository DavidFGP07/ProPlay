/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  /** 'true' enciende el puente de datos de demostracion (src/mocks/). */
  readonly VITE_DEMO_DATA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

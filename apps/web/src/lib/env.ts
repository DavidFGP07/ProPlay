/**
 * Configuración del cliente.
 *
 * Todo lo que empieza por VITE_ se empaqueta en el bundle y es público: aquí
 * no va ningún secreto. La URL de la API nunca se escribe a mano en el código.
 */
const apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl) {
  throw new Error(
    "Falta VITE_API_URL. Copia apps/web/.env.example a apps/web/.env",
  );
}

export const config = {
  apiUrl: apiUrl.replace(/\/$/, ""),
  esDesarrollo: import.meta.env.DEV,
} as const;

/**
 * Configuracion del cliente.
 *
 * Todo lo que empieza por VITE_ se empaqueta en el bundle y es publico: aqui
 * no va ningun secreto. La URL de la API nunca se escribe a mano en el codigo.
 */
const apiUrl = import.meta.env.VITE_API_URL

if (!apiUrl) {
  throw new Error('Falta VITE_API_URL. Copia apps/web/.env.example a apps/web/.env')
}

export const config = {
  apiUrl: apiUrl.replace(/\/$/, ''),
  esDesarrollo: import.meta.env.DEV,
  /**
   * Puente de datos de demostracion. Encendido, las vistas cuyos endpoints aun
   * no existen se alimentan de la simulacion de `src/mocks/`; apagado, muestran
   * solo lo que devuelve la API real, aunque este vacio.
   */
  datosDemo: import.meta.env.VITE_DEMO_DATA === 'true',
} as const

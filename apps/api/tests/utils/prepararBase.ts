import { prepararBaseDePruebas } from "../../scripts/base-pruebas";

/**
 * `globalSetup` de Vitest: antes de la primera prueba, crea la base de pruebas
 * si no existe y le aplica las migraciones pendientes.
 */
export default async function setup(): Promise<void> {
  await prepararBaseDePruebas();
}

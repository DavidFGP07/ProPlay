// RF-09 · Recalcula los vectores de perfil (PerfilVector) de todos los
// jugadores activos con el vectorizador actual (PERFIL_VECTOR_VERSION). Se
// ejecuta al subir de versión el vectorizador; el motor también recalcula los
// obsoletos antes de cada ranking, así que no es imprescindible, pero evita
// que la primera consulta pague el recálculo de todos.
//
//   local:     npm run matching:revectorizar -w api
//   servidor:  node apps/api/dist/cli/revectorizar.js
import { PERFIL_VECTOR_VERSION } from "@proplay/shared";
import { desconectarPrisma } from "../config/prisma";
import { revectorizarTodos } from "../modules/matching/matching.service";

export async function ejecutar(consola: Pick<Console, "log"> = console): Promise<number> {
  const inicio = Date.now();
  const total = await revectorizarTodos();
  consola.log(
    `Vectores recalculados: ${total} (versión ${PERFIL_VECTOR_VERSION}) en ${Date.now() - inicio} ms`,
  );
  return total;
}

if (require.main === module) {
  ejecutar()
    .catch((error: unknown) => {
      console.error("No se pudieron recalcular los vectores:", error);
      process.exitCode = 1;
    })
    .finally(desconectarPrisma);
}

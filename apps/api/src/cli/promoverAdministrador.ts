// RF-01 · Alta del primer administrador (tarea 1.4 del plan). Procedimiento en
// docs/operacion.md.
//
//   local:     npm run admin:promover -w api -- <correo>
//   servidor:  node apps/api/dist/cli/promoverAdministrador.js <correo>
//
// Promueve a ADMIN una cuenta ya registrada. No recibe contraseñas: la persona
// la define al registrarse, así que nunca queda en el historial de la terminal.
import { desconectarPrisma } from "../config/prisma";
import { promoverAAdministrador } from "../modules/usuarios/usuarios.service";
import { AppError } from "../utils/errors";

/** Códigos de salida del script. */
export const SALIDA = { OK: 0, RECHAZADO: 1, USO: 2 } as const;

export interface Consola {
  log: (mensaje: string) => void;
  error: (mensaje: string) => void;
}

const USO = "Uso: npm run admin:promover -w api -- <correo>";

/** Ejecuta el script con sus argumentos y devuelve el código de salida. */
export async function ejecutar(
  argumentos: readonly string[],
  consola: Consola = console,
): Promise<number> {
  if (argumentos.length !== 1 || !argumentos[0]?.trim()) {
    consola.error(USO);
    return SALIDA.USO;
  }

  try {
    const resultado = await promoverAAdministrador(argumentos[0]);
    if (resultado.estado === "YA_ERA_ADMIN") {
      consola.log(`${resultado.usuario.email} ya es administrador; no se cambió nada.`);
      return SALIDA.OK;
    }
    consola.log(
      `${resultado.usuario.email} pasó de ${resultado.rolAnterior} a ADMIN. ` +
        "El cambio queda en AuditLog (ROL_CAMBIADO). Las sesiones abiertas " +
        "reciben el rol nuevo en el siguiente refresco; si no, al volver a entrar.",
    );
    return SALIDA.OK;
  } catch (error) {
    if (error instanceof AppError && error.esOperacional) {
      consola.error(`No se promovió la cuenta: ${error.message}.`);
      return SALIDA.RECHAZADO;
    }
    throw error;
  }
}

if (require.main === module) {
  ejecutar(process.argv.slice(2))
    .then((codigo) => {
      process.exitCode = codigo;
    })
    .catch((error: unknown) => {
      console.error("Error inesperado al promover la cuenta:", error);
      process.exitCode = SALIDA.RECHAZADO;
    })
    .finally(() => desconectarPrisma());
}

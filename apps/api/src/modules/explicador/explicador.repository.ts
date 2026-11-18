import { env } from "../../config/env";
import { clienteRedis } from "../../config/redis";

/**
 * Acceso a datos del módulo `explicador`. No usa Prisma: guarda en Redis los
 * textos generados (caché por contenido) y los contadores de los límites.
 * Las claves de las pruebas llevan su propio prefijo para no tocar las de
 * desarrollo, que viven en el mismo Redis.
 */
export const PREFIJO_CLAVES = env.esTest ? "explicador:test:" : "explicador:";

/** Un texto generado se conserva 30 días. */
const VIGENCIA_TEXTO_S = 30 * 24 * 60 * 60;

export async function leerTexto(clave: string): Promise<string | null> {
  return (await clienteRedis()).get(`${PREFIJO_CLAVES}texto:${clave}`);
}

export async function guardarTexto(clave: string, texto: string): Promise<void> {
  await (await clienteRedis()).set(`${PREFIJO_CLAVES}texto:${clave}`, texto, "EX", VIGENCIA_TEXTO_S);
}

/** Suma uno al contador y le pone caducidad si es nuevo; devuelve el valor tras sumar. */
async function contar(clave: string, vigenciaS: number): Promise<number> {
  const redis = await clienteRedis();
  const [[errorIncr, valor] = [null, 0], [errorExpire] = [null]] =
    (await redis.multi().incr(clave).expire(clave, vigenciaS, "NX").exec()) ?? [];
  if (errorIncr || errorExpire) throw errorIncr ?? errorExpire;
  return Number(valor);
}

/**
 * Reserva una generación nueva: una más en la hora del usuario y en el día de
 * toda la aplicación (ventanas fijas en UTC). `false` si alguno de los dos
 * límites ya estaba agotado. Los aciertos de caché no pasan por aquí.
 */
export async function reservarGeneracion(
  usuarioId: string,
  ahora: Date,
  limites: { usuarioHora: number; diario: number },
): Promise<boolean> {
  const hora = ahora.toISOString().slice(0, 13);
  const dia = ahora.toISOString().slice(0, 10);
  const delUsuario = await contar(`${PREFIJO_CLAVES}usuario:${usuarioId}:${hora}`, 60 * 60);
  if (delUsuario > limites.usuarioHora) return false;
  const delDia = await contar(`${PREFIJO_CLAVES}dia:${dia}`, 2 * 24 * 60 * 60);
  return delDia <= limites.diario;
}

// RF-03 · Estado de la integración con Riot y de la cola de ingesta, para
// operación (docs/operacion.md, «Ingesta de Riot»). Es el detalle que
// `/health` no publica: estado de la clave, cola en pausa y trabajos.
//
//   local:     npm run ingesta:estado -w api
//   servidor:  node apps/api/dist/cli/estadoIngesta.js
import { env } from "../config/env";
import { clienteRedis, desconectarRedis } from "../config/redis";
import { cerrarColaIngesta, colaIngesta } from "../ingesta/cola";
import { estadoClaveRiot } from "../integrations";
import { PREFIJO_CUOTA_RIOT } from "../integrations/riot/cuotaRiot";

const DESCRIPCION_CLAVE = {
  ok: "válida",
  "sin-clave": "falta RIOT_API_KEY",
  "clave-caducada": "Riot la rechazó (caducada o inválida): renuévala y reinicia",
} as const;

export async function ejecutar(consola: Pick<Console, "log"> = console): Promise<void> {
  const estado = await estadoClaveRiot.estado(env.RIOT_API_KEY);
  const trabajos = await colaIngesta().contar();
  const redis = await clienteRedis();
  const ahora = Date.now();
  const ventanas = await Promise.all(
    env.riotVentanas.map(async ({ limite, ms }) => {
      const usadas = await redis.zcount(`${PREFIJO_CUOTA_RIOT}:ventana:${ms}`, ahora - ms, "+inf");
      return `${usadas}/${limite} en ${ms / 1000} s`;
    }),
  );
  const bloqueo = Number(await redis.get(`${PREFIJO_CUOTA_RIOT}:bloqueo`)) - ahora;

  consola.log(`Clave de Riot:   ${DESCRIPCION_CLAVE[estado]}`);
  consola.log(`Cola de ingesta: ${trabajos.pausada ? "EN PAUSA" : "activa"}`);
  consola.log(
    `  en espera ${trabajos.enEspera} · en curso ${trabajos.enCurso} · ` +
      `reprogramados ${trabajos.reprogramados} · fallidos ${trabajos.fallidos}`,
  );
  consola.log(`Cuota de Riot:   ${ventanas.join(" · ")} (reserva para vincular: ${env.RIOT_RESERVA_ALTA} %)`);
  if (bloqueo > 0) consola.log(`  bloqueada por un 429 de Riot ${Math.ceil(bloqueo / 1000)} s más`);
  consola.log(`Periódica:       cada ${env.INGESTA_INTERVALO_HORAS} h por jugador`);
}

if (require.main === module) {
  ejecutar()
    .catch((error: unknown) => {
      console.error("No se pudo leer el estado de la ingesta:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await cerrarColaIngesta();
      await desconectarRedis();
    });
}

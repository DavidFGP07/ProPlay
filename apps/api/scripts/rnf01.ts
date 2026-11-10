// RNF-01 · Medición del percentil 95 del ranking de candidatos con 1.000 perfiles
// indexados (criterio de aceptación del Cuadro IV: p95 < 2 s).
//
//   npm run rnf01 -w api
//
// Trabaja sobre una base propia, `proplay_rnf01`, en el mismo servidor que la
// de DATABASE_URL: la crea si no existe, le aplica las migraciones y carga
// 1.000 jugadores sintéticos con un generador determinista, así que la
// medición se repite con los mismos datos. Nunca toca la base de desarrollo.
// Escribe el resultado en docs/rnf-01.md.
import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const BASE = "proplay_rnf01";
const PERFILES = 1000;
const REPETICIONES = 200;
const CALENTAMIENTO = 5;
const PREFIJO = "rnf01";
const RAIZ_API = join(__dirname, "..");

/** Generador determinista (mulberry32): mismos datos en cada medición. */
function aleatorio(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentil(ordenados: number[], p: number): number {
  const i = Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1);
  return ordenados[i]!;
}

interface Resumen {
  n: number;
  media: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

function resumir(muestras: number[]): Resumen {
  const ordenados = [...muestras].sort((a, b) => a - b);
  return {
    n: ordenados.length,
    media: ordenados.reduce((s, x) => s + x, 0) / ordenados.length,
    p50: percentil(ordenados, 50),
    p95: percentil(ordenados, 95),
    p99: percentil(ordenados, 99),
    max: ordenados[ordenados.length - 1]!,
  };
}

const ms = (x: number) => `${x.toFixed(1)} ms`;

async function main(): Promise<void> {
  const archivoEnv = join(RAIZ_API, ".env");
  if (existsSync(archivoEnv)) process.loadEnvFile(archivoEnv);
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL");
  const original = new URL(process.env.DATABASE_URL);
  const destino = new URL(original.toString());
  destino.pathname = `/${BASE}`;

  // 1. Base propia, migrada.
  const { Prisma, PrismaClient } = await import("@prisma/client");
  const admin = new PrismaClient({ datasources: { db: { url: original.toString() } } });
  const [existe] = await admin.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM pg_database WHERE datname = ${BASE}
  `;
  if (!existe!.n) await admin.$executeRaw`CREATE DATABASE ${Prisma.raw(`"${BASE}"`)}`;
  await admin.$disconnect();
  execSync("npx prisma migrate deploy", {
    cwd: RAIZ_API,
    env: { ...process.env, DATABASE_URL: destino.toString() },
    stdio: "inherit",
  });

  // 2. La app contra esa base, sin límites de peticiones ni worker de ingesta:
  //    se mide el motor, no el limitador.
  process.env.DATABASE_URL = destino.toString();
  process.env.NODE_ENV = "test";
  process.env.INGESTA_ACTIVA = "false";
  const shared = await import("@proplay/shared");
  const { prisma } = await import("../src/config/prisma");
  const { crearApp } = await import("../src/app");
  const { firmarAccessToken } = await import("../src/utils/jwt");
  const servicio = await import("../src/modules/matching/matching.service");
  const { default: request } = await import("supertest");

  const [{ base }] = (await prisma.$queryRaw<{ base: string }[]>`SELECT current_database() AS base`) as [
    { base: string },
  ];
  if (base !== BASE) throw new Error(`La medición iba a correr sobre ${base}, no sobre ${BASE}`);

  // 3. Datos sintéticos.
  console.log(`Cargando ${PERFILES} perfiles sintéticos en ${BASE}…`);
  await prisma.usuario.deleteMany({ where: { email: { startsWith: `${PREFIJO}+` } } });
  const r = aleatorio(20261110);
  const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(r() * lista.length)]!;
  const caribe = shared.DEPARTAMENTOS.filter((d) => shared.MACROREGION_POR_DEPARTAMENTO[d] === "CARIBE");
  const ahora = Date.now();

  const usuarios = [];
  const perfiles = [];
  const cuentas = [];
  const capturas = [];
  for (let i = 0; i < PERFILES; i++) {
    const id = `${PREFIJO}-j-${i}`;
    usuarios.push({
      id: `${PREFIJO}-u-${i}`,
      email: `${PREFIJO}+jugador-${i}@proplay.test`,
      passwordHash: "sin-acceso",
      nombre: `Jugador sintético ${i}`,
      rol: "JUGADOR" as const,
    });
    const ubicacion = r();
    const pais = ubicacion < 0.3 ? null : ubicacion < 0.4 ? elegir(["MX", "PE", "VE"]) : "CO";
    perfiles.push({
      id,
      usuarioId: `${PREFIJO}-u-${i}`,
      pais,
      departamento: pais === "CO" ? (r() < 0.5 ? elegir(caribe) : elegir(shared.DEPARTAMENTOS)) : null,
      disponibilidadHoras: r() < 0.15 ? null : 5 + Math.floor(r() * 36),
      dispuestoRelocalizar: r() < 0.4,
    });
    if (r() < 0.8) {
      const cuentaId = `${PREFIJO}-c-${i}`;
      cuentas.push({
        id: cuentaId,
        jugadorId: id,
        plataforma: "RIOT" as const,
        externalId: `${PREFIJO}-puuid-${i}`,
        servidor: "LA1",
        verificadaEn: new Date(ahora - 30 * 86_400_000),
      });
      const posicion = elegir(shared.POSICIONES_LOL);
      const otra = elegir(shared.POSICIONES_LOL);
      const partidas = 20;
      const enPrincipal = 10 + Math.floor(r() * 10);
      const winRate = 0.35 + r() * 0.35;
      capturas.push({
        jugadorId: id,
        cuentaId,
        juego: shared.JUEGO_PILOTO,
        rol: posicion,
        rango: r() < 0.1 ? null : shared.RANGOS_LOL[4 + Math.floor(r() * 27)]!,
        partidas,
        victorias: Math.round(partidas * winRate),
        kda: Number((1 + r() * 5).toFixed(2)),
        winRate,
        fuente: "RIOT" as const,
        metricas: {
          partidasAnalizadas: partidas,
          csPorMinuto: Number((3 + r() * 7).toFixed(2)),
          oroPorMinuto: Number((280 + r() * 240).toFixed(2)),
          danoPorMinuto: Number((250 + r() * 700).toFixed(2)),
          visionPorMinuto: Number((0.4 + r() * 2.6).toFixed(2)),
          participacionKills: Number((0.3 + r() * 0.5).toFixed(4)),
          distribucionRoles:
            otra === posicion ? { [posicion]: partidas } : { [posicion]: enPrincipal, [otra]: partidas - enPrincipal },
          rangoSoloDuo: { liga: "GOLD", division: "II", puntosLiga: 10, victorias: 40 + Math.floor(r() * 200), derrotas: 40 + Math.floor(r() * 200) },
        },
        capturadaEn: new Date(ahora - Math.floor(r() * 20) * 86_400_000),
      });
    }
  }
  await prisma.usuario.createMany({ data: usuarios });
  await prisma.perfilJugador.createMany({ data: perfiles });
  await prisma.cuentaGaming.createMany({ data: cuentas });
  await prisma.estadistica.createMany({ data: capturas });

  const equipo = await prisma.usuario.create({
    data: {
      email: `${PREFIJO}+equipo@proplay.test`,
      passwordHash: "sin-acceso",
      nombre: "Equipo RNF-01",
      rol: "EQUIPO",
      perfilEquipo: { create: { nombreOrg: "Equipo RNF-01", pais: "CO", departamento: "ATLANTICO" } },
    },
    include: { perfilEquipo: true },
  });
  const oferta = await prisma.oferta.create({
    data: {
      equipoId: equipo.perfilEquipo!.id,
      titulo: "MID para la medición de RNF-01",
      juego: shared.JUEGO_PILOTO,
      rol: "MID",
      rangoMinimo: "DIAMANTE_IV",
      modalidad: "PRESENCIAL",
      pais: "CO",
      departamento: "ATLANTICO",
      horasSemana: 20,
      descripcion: "Oferta sintética para medir RNF-01.",
      estado: "ABIERTA",
      publicadaEn: new Date(),
      pesoTecnica: shared.PESOS_MATCHING.tecnica,
      pesoExperiencia: shared.PESOS_MATCHING.experiencia,
      pesoHabilidadesBlandas: shared.PESOS_MATCHING.habilidadesBlandas,
      pesoGeografica: shared.PESOS_MATCHING.geografica,
      pesoDisponibilidad: shared.PESOS_MATCHING.disponibilidad,
    },
  });
  // 30 postulantes: entran en el ranking aunque el índice no los traiga.
  await prisma.postulacion.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({ ofertaId: oferta.id, jugadorId: `${PREFIJO}-j-${i * 33}` })),
  });

  const t0 = performance.now();
  const vectores = await servicio.revectorizarTodos();
  const tiempoVectores = performance.now() - t0;
  const indexados = await prisma.perfilVector.count({ where: { version: shared.PERFIL_VECTOR_VERSION } });
  console.log(`${vectores} vectores calculados en ${ms(tiempoVectores)} (${indexados} indexados)`);

  // 4. Medición por HTTP (Express, validación, permisos, motor y base).
  const app = crearApp();
  const token = firmarAccessToken({ sub: equipo.id, email: equipo.email, rol: "EQUIPO" });
  const ruta = `${shared.API_PREFIX}/matching/ofertas/${oferta.id}`;
  const medir = async (
    peticion: () => PromiseLike<{ status: number; body: unknown }>,
  ): Promise<{ ms: number; cuerpo: unknown }> => {
    const inicio = performance.now();
    const respuesta = await peticion();
    const duracion = performance.now() - inicio;
    if (respuesta.status !== 200) throw new Error(`Respuesta ${respuesta.status}: ${JSON.stringify(respuesta.body)}`);
    return { ms: duracion, cuerpo: respuesta.body };
  };
  const frio = () => request(app).post(`${ruta}/recalcular`).query({ pageSize: 20 }).set("Authorization", `Bearer ${token}`);
  const caliente = () => request(app).get(`${ruta}/ranking`).query({ pageSize: 20 }).set("Authorization", `Bearer ${token}`);

  for (let i = 0; i < CALENTAMIENTO; i++) await medir(frio);
  const primero = shared.rankingOfertaSchema.parse((await medir(frio)).cuerpo);

  console.log(`Midiendo ${REPETICIONES} rankings con recálculo y ${REPETICIONES} leyendo la instantánea…`);
  const muestrasFrio: number[] = [];
  for (let i = 0; i < REPETICIONES; i++) muestrasFrio.push((await medir(frio)).ms);
  const muestrasCaliente: number[] = [];
  for (let i = 0; i < REPETICIONES; i++) muestrasCaliente.push((await medir(caliente)).ms);
  const rFrio = resumir(muestrasFrio);
  const rCaliente = resumir(muestrasCaliente);

  // 5. Plan de la consulta del recuperador.
  const { vectorizarOferta } = await import("../src/modules/matching/motor/vectorizador");
  const vectorOferta = vectorizarOferta({
    ofertaId: oferta.id,
    rol: "MID",
    rangoMinimo: "DIAMANTE_IV",
    modalidad: "PRESENCIAL",
    pais: "CO",
    departamento: "ATLANTICO",
    horasSemana: 20,
    pesos: { ...shared.PESOS_MATCHING },
  });
  const texto = `[${vectorOferta.join(",")}]`;
  const planDe = (forzarIndice: boolean) => prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL hnsw.ef_search = ${Prisma.raw(String(servicio.CANDIDATOS_RECUPERADOR))}`;
    if (forzarIndice) await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
    return tx.$queryRaw<{ "QUERY PLAN": string }[]>`
      EXPLAIN ANALYZE
      SELECT pv."jugadorId", 1 - (pv.embedding <=> ${texto}::vector) AS similitud
        FROM "PerfilVector" pv
       WHERE pv.version = ${shared.PERFIL_VECTOR_VERSION}
       ORDER BY pv.embedding <=> ${texto}::vector
       LIMIT ${servicio.CANDIDATOS_RECUPERADOR}
    `;
  });
  const comoTexto = (plan: { "QUERY PLAN": string }[]) =>
    plan.map((f) => f["QUERY PLAN"]).join("\n").replace(/\[[-0-9.,e]+\]/g, "[…]");
  const textoPlan = comoTexto(await planDe(false));
  const textoPlanIndice = comoTexto(await planDe(true));
  const usaIndice = textoPlan.includes("hnsw_idx");
  const bloque = (texto: string) => ["```", texto, "```"].join("\n");
  const notaPlan = usaIndice
    ? "El planificador usa el índice HNSW."
    : [
        `Con ${indexados} vectores, **el planificador prefiere recorrer la tabla y ordenar** ` +
          "(resultado exacto) en lugar del índice HNSW: a este tamaño es más barato. El índice " +
          "entra cuando la tabla crece. Para comparar, el mismo recorrido obligado a usar el " +
          "índice (`SET LOCAL enable_seqscan = off`, como en `tests/matching.test.ts`):",
        "",
        bloque(textoPlanIndice),
      ].join("\n");

  // 6. Entorno.
  const [{ version: versionPg }] = (await prisma.$queryRaw<{ version: string }[]>`SELECT version()`) as [
    { version: string },
  ];
  const [{ extversion }] = (await prisma.$queryRaw<{ extversion: string }[]>`
    SELECT extversion FROM pg_extension WHERE extname = 'vector'
  `) as [{ extversion: string }];
  const cpu = os.cpus()[0]?.model ?? "desconocida";
  const cumple = rFrio.p95 < 2000;

  const fila = (nombre: string, x: Resumen) =>
    `| ${nombre} | ${x.n} | ${ms(x.media)} | ${ms(x.p50)} | **${ms(x.p95)}** | ${ms(x.p99)} | ${ms(x.max)} |`;
  const fecha = new Date().toISOString().slice(0, 10);
  const informe = `# RNF-01 · Latencia del ranking de candidatos

> **Criterio (Cuadro IV del documento):** percentil 95 de la consulta del ranking por debajo
> de 2 s con 1.000 perfiles indexados.
>
> **Resultado (${fecha}): ${cumple ? "se cumple" : "NO se cumple"}.** p95 con recálculo completo:
> **${ms(rFrio.p95)}**; leyendo el ranking guardado: **${ms(rCaliente.p95)}**.
>
> **Medición en local** (${cpu}, base de datos en la misma máquina), no en la infraestructura
> del despliegue. **Se repetirá en la infraestructura del despliegue antes de la sustentación**
> y el resultado sustituirá a éste.

Generado por \`npm run rnf01 -w api\` (\`apps/api/scripts/rnf01.ts\`). No editar a mano: se
reescribe en cada medición.

## Qué se mide

Cada petición recorre la API entera dentro del proceso (Express, autenticación, permisos,
validación, motor y base de datos), con \`supertest\` y sin red de por medio:

- **Con recálculo** (\`POST /matching/ofertas/:id/recalcular\`): el peor caso de una consulta.
  Comprueba los vectores obsoletos, recupera ${servicio.CANDIDATOS_RECUPERADOR} vecinos del índice HNSW
  con \`SET LOCAL hnsw.ef_search = ${servicio.CANDIDATOS_RECUPERADOR}\`, les suma los postulantes, lee sus datos,
  puntúa las cinco dimensiones, reemplaza la instantánea en \`Matching\` y devuelve la primera página.
  **Es la cifra que se compara con el criterio.**
- **Leyendo la instantánea** (\`GET /matching/ofertas/:id/ranking\` sin cambios en los datos):
  comprueba que el ranking está al día y devuelve la página.

${REPETICIONES} peticiones seguidas de cada tipo, tras ${CALENTAMIENTO} de calentamiento; página de 20 candidatos.

## Datos

- ${PERFILES} jugadores sintéticos, generados con semilla fija (\`${PREFIJO}-*\`) en la base \`${BASE}\`:
  80 % con cuenta de Riot verificada y una captura (posición, rango, métricas y distribución de
  partidas aleatorias), 30 % sin ubicación, 10 % fuera de Colombia, la mitad de los de Colombia en
  el Caribe y 15 % sin horas declaradas.
- ${indexados} vectores de la versión ${shared.PERFIL_VECTOR_VERSION} en \`PerfilVector\`, calculados en ${ms(tiempoVectores)}
  (el coste de \`npm run matching:revectorizar\` para esta base).
- Una oferta presencial de MID en Atlántico (rango mínimo Diamante IV, 20 h, pesos del piloto) con
  30 postulantes. Cada ranking puntúa ${primero.meta.total} candidatos.

## Resultados

| Escenario | n | Media | p50 | p95 | p99 | Máximo |
| --- | --- | --- | --- | --- | --- | --- |
${fila("Con recálculo (criterio)", rFrio)}
${fila("Leyendo la instantánea", rCaliente)}

## Plan del recuperador

Consulta del recuperador con el vector de la oferta (\`EXPLAIN ANALYZE\`; el vector, abreviado),
tal como la ejecuta el motor:

\`\`\`
${textoPlan}
\`\`\`

${notaPlan}

## Entorno

- CPU: ${cpu} (${os.cpus().length} núcleos), ${(os.totalmem() / 1024 ** 3).toFixed(0)} GB de RAM, ${os.type()} ${os.release()}
- Node ${process.version}
- ${versionPg.split(",")[0]} con pgvector ${extversion}, en la misma máquina

## Límites de la medición

- Las peticiones son secuenciales: mide la latencia de una consulta, no la carga concurrente.
- Es una medición **en local**: la base está en la misma máquina, sin latencia de red, y la
  máquina de desarrollo (${cpu}) no es la del despliegue. Antes de la sustentación se repite en
  la infraestructura del despliegue (API y base del proveedor) con el mismo script.
- Los datos son sintéticos. El tamaño (1.000 perfiles) es el del criterio; la distribución de
  rangos y métricas no pretende ser la del piloto.

## Cómo repetirla

\`\`\`bash
npm run rnf01 -w api
\`\`\`

Crea \`${BASE}\` si no existe y reescribe este archivo. La base de desarrollo no se toca.
`;
  writeFileSync(join(RAIZ_API, "../../docs/rnf-01.md"), informe);
  console.log(
    `\nCon recálculo: p95 ${ms(rFrio.p95)} · leyendo la instantánea: p95 ${ms(rCaliente.p95)} → ${cumple ? "CUMPLE" : "NO CUMPLE"} RNF-01`,
  );
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error("La medición de RNF-01 falló:", error);
  process.exitCode = 1;
});

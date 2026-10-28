import { afterAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * RNF-01 · Guarda del índice HNSW (scripts/verificar-indice-hnsw.mjs, CLAUDE.md
 * §4). Se ejecuta el script real contra migraciones de prueba escritas en un
 * directorio temporal, nunca en prisma/migrations.
 */

const SCRIPT = resolve(__dirname, "../scripts/verificar-indice-hnsw.mjs");
const INDICE = '"PerfilVector_embedding_hnsw_idx"';
const BORRAR = `DROP INDEX ${INDICE};`;
const CREAR_HNSW = `CREATE INDEX ${INDICE} ON "PerfilVector" USING hnsw ("embedding" vector_cosine_ops);`;
const CREAR_BTREE = `CREATE INDEX ${INDICE} ON "PerfilVector" ("embedding");`;

const temporales: string[] = [];

/** Crea una carpeta de migraciones con una subcarpeta por migración. */
function migraciones(sqlPorMigracion: Record<string, string>): string {
  const carpeta = mkdtempSync(join(tmpdir(), "proplay-guarda-hnsw-"));
  temporales.push(carpeta);
  for (const [nombre, sql] of Object.entries(sqlPorMigracion)) {
    mkdirSync(join(carpeta, nombre));
    writeFileSync(join(carpeta, nombre, "migration.sql"), sql);
  }
  return carpeta;
}

function guarda(carpeta: string) {
  const resultado = spawnSync(process.execPath, [SCRIPT, carpeta], { encoding: "utf8" });
  return { codigo: resultado.status, salida: resultado.stdout + resultado.stderr };
}

afterAll(() => {
  for (const carpeta of temporales) rmSync(carpeta, { recursive: true, force: true });
});

describe("guarda del índice HNSW en las migraciones", () => {
  it("pasa si ninguna migración toca el índice", () => {
    const { codigo, salida } = guarda(
      migraciones({ "20260101000000_otra": 'ALTER TABLE "Oferta" ADD COLUMN "x" TEXT;' }),
    );

    expect(codigo).toBe(0);
    expect(salida).toContain("Ninguna migración borra el índice");
  });

  it("falla si una migración borra el índice sin volver a crearlo", () => {
    const { codigo, salida } = guarda(
      migraciones({ "20260101000000_deriva": `${BORRAR}\nALTER TABLE "Oferta" ADD COLUMN "x" TEXT;` }),
    );

    expect(codigo).toBe(1);
    expect(salida).toContain("20260101000000_deriva");
  });

  it("excepción: pasa si el mismo archivo borra el índice y lo vuelve a crear con HNSW", () => {
    const { codigo } = guarda(
      migraciones({ "20260101000000_recrear": `${BORRAR}\n${CREAR_HNSW}` }),
    );

    expect(codigo).toBe(0);
  });

  it("la excepción no vale si la creación va antes del borrado", () => {
    const { codigo } = guarda(
      migraciones({ "20260101000000_al_reves": `${CREAR_HNSW}\n${BORRAR}` }),
    );

    expect(codigo).toBe(1);
  });

  it("la excepción no vale si se vuelve a crear sin HNSW", () => {
    const { codigo } = guarda(
      migraciones({ "20260101000000_btree": `${BORRAR}\n${CREAR_BTREE}` }),
    );

    expect(codigo).toBe(1);
  });

  it("la excepción no vale si el índice se crea en otra migración", () => {
    const { codigo, salida } = guarda(
      migraciones({
        "20260101000000_borra": BORRAR,
        "20260102000000_crea": CREAR_HNSW,
      }),
    );

    expect(codigo).toBe(1);
    expect(salida).toContain("20260101000000_borra");
  });

  it("detecta las variantes IF EXISTS, CONCURRENTLY y con esquema", () => {
    const { codigo } = guarda(
      migraciones({
        "20260101000000_variante": `DROP INDEX CONCURRENTLY IF EXISTS "public".${INDICE};`,
      }),
    );

    expect(codigo).toBe(1);
  });

  it("ignora un borrado comentado", () => {
    const { codigo } = guarda(
      migraciones({ "20260101000000_comentado": `-- ${BORRAR}\n/* ${BORRAR} */` }),
    );

    expect(codigo).toBe(0);
  });
});

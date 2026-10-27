// Guarda del índice HNSW de PerfilVector (CLAUDE.md §4, RNF-01).
//
// Prisma no modela índices HNSW y mete un DROP INDEX del nuestro en cada
// migración que genera. Este script falla si alguna migración lo borra sin
// volver a crearlo después en el mismo archivo.
//
//   node scripts/verificar-indice-hnsw.mjs [carpeta de migraciones]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const INDICE = "PerfilVector_embedding_hnsw_idx";
const NOMBRE = `("?public"?\\.)?"?${INDICE}"?`;
const BORRADO = new RegExp(
  `drop\\s+index\\s+(concurrently\\s+)?(if\\s+exists\\s+)?${NOMBRE}`,
  "gi",
);
const CREACION = new RegExp(
  `create\\s+index\\s+(concurrently\\s+)?(if\\s+not\\s+exists\\s+)?"?${INDICE}"?\\s+on\\s+[^;]*?using\\s+hnsw`,
  "gi",
);

/** Sustituye los comentarios por espacios: conserva posiciones y saltos de línea. */
function sinComentarios(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/--[^\n]*/g, (c) => " ".repeat(c.length));
}

function lineaDe(texto, posicion) {
  return texto.slice(0, posicion).split("\n").length;
}

const carpeta = resolve(process.argv[2] ?? join(import.meta.dirname, "..", "prisma", "migrations"));
const infracciones = [];

for (const migracion of readdirSync(carpeta).sort()) {
  const archivo = join(carpeta, migracion, "migration.sql");
  if (!existsSync(archivo)) continue;
  const sql = sinComentarios(readFileSync(archivo, "utf8"));

  const borrados = [...sql.matchAll(BORRADO)];
  if (borrados.length === 0) continue;

  // Excepción: se permite borrar el índice si después se vuelve a crear con HNSW.
  const ultimoBorrado = borrados.at(-1).index;
  const recreado = [...sql.matchAll(CREACION)].some((c) => c.index > ultimoBorrado);
  if (recreado) continue;

  for (const borrado of borrados) {
    infracciones.push(`${relative(process.cwd(), archivo)}:${lineaDe(sql, borrado.index)}`);
  }
}

if (infracciones.length > 0) {
  console.error(`✖ Una migración borra el índice ${INDICE} sin volver a crearlo:`);
  for (const infraccion of infracciones) console.error(`  · ${infraccion}`);
  console.error(
    "  Quita ese DROP INDEX del migration.sql antes de aplicarla (CLAUDE.md §4).",
  );
  process.exit(1);
}

console.log(`✓ Ninguna migración borra el índice ${INDICE}.`);

import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/prisma";
import { cerrarConexiones } from "./utils/entorno";

/**
 * RNF-01 · El índice HNSW de PerfilVector.embedding existe tras aplicar las
 * migraciones. Complementa a scripts/verificar-indice-hnsw.mjs: éste revisa
 * el SQL de las migraciones; aquí se mira la base real, que es lo que también
 * pierde el índice con un `prisma db push` (CLAUDE.md §4).
 */
describe("índice HNSW de PerfilVector", () => {
  afterAll(async () => {
    await cerrarConexiones();
  });

  it("existe sobre embedding con distancia coseno", async () => {
    const indices = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'PerfilVector' AND indexname = 'PerfilVector_embedding_hnsw_idx'
    `;

    expect(indices).toHaveLength(1);
    expect(indices[0]!.indexdef).toMatch(/USING hnsw \(embedding vector_cosine_ops\)/);
  });
});

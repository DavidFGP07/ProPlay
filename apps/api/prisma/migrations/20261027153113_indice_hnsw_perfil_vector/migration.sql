-- Migración escrita a mano: índice HNSW para la búsqueda de vecinos sobre
-- "PerfilVector"."embedding" (CLAUDE.md §4, RNF-01). Prisma no modela índices
-- de pgvector, así que no aparece en schema.prisma: revisa cualquier migración
-- generada después de esta y elimina un DROP INDEX que lo toque.
--
-- La métrica es la distancia coseno, la misma que usa el recuperador por
-- contenido (`ORDER BY embedding <=> $1 LIMIT k`): un índice HNSW sólo se usa
-- cuando el operador de la consulta coincide con su clase de operadores.
-- Parámetros por defecto de pgvector (m = 16, ef_construction = 64).

CREATE INDEX IF NOT EXISTS "PerfilVector_embedding_hnsw_idx"
  ON "PerfilVector" USING hnsw ("embedding" vector_cosine_ops);

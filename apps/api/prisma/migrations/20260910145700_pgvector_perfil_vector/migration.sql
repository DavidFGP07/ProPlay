-- Migración adicional escrita a mano: Prisma no modela el tipo `vector` de
-- pgvector, así que la extensión y la columna se declaran en SQL. En el
-- schema.prisma la columna aparece como Unsupported("vector(64)") para que
-- Prisma la conozca y no la considere deriva del esquema.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "PerfilVector"
  ADD COLUMN IF NOT EXISTS "embedding" vector(64);

-- El vector se mantiene además como Float[] en "dimensiones" para poder
-- leerlo y escribirlo desde Prisma; "embedding" es la columna que usarán las
-- búsquedas de similitud del módulo de matching.
--
-- TODO: cuando haya volumen de datos, crear el índice ANN correspondiente:
--   CREATE INDEX "PerfilVector_embedding_ivfflat_idx"
--     ON "PerfilVector" USING ivfflat ("embedding" vector_cosine_ops)
--     WITH (lists = 100);

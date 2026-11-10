-- Matching guarda la explicación por dimensión, la similitud del recuperador y
-- la versión de las fórmulas (docs/decisiones.md, «Motor de matching»).
--
-- Prisma generaba además `DROP INDEX "PerfilVector_embedding_hnsw_idx";`: se ha
-- quitado a mano. El índice HNSW es obligatorio (RNF-01) y Prisma no lo conoce
-- (CLAUDE.md §4).
--
-- Las columnas nuevas son obligatorias y sin valor por defecto. La tabla sólo
-- puede tener filas de pruebas manuales, porque ningún código la escribía
-- (los endpoints de matching respondían 501): se vacía antes de añadirlas. Un
-- ranking borrado se vuelve a calcular al pedirlo.
DELETE FROM "Matching";

-- AlterTable
ALTER TABLE "Matching" ADD COLUMN     "explicacion" JSONB NOT NULL,
ADD COLUMN     "similitud" DOUBLE PRECISION,
ADD COLUMN     "versionFormulas" INTEGER NOT NULL;

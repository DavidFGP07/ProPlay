-- Tarea 3.8: catálogo de rangos de LoL (RangoLol), rango de cada captura de
-- estadísticas y rango mínimo de la oferta con ese catálogo.
-- Prisma generó además `DROP INDEX "PerfilVector_embedding_hnsw_idx"` porque no
-- modela el índice HNSW: se quitó a mano (CLAUDE.md §4).
-- El índice de Estadistica pasa a (jugadorId, juego, capturadaEn) para leer la
-- última captura de cada jugador en el buscador de talento.

-- CreateEnum
CREATE TYPE "RangoLol" AS ENUM ('HIERRO_IV', 'HIERRO_III', 'HIERRO_II', 'HIERRO_I', 'BRONCE_IV', 'BRONCE_III', 'BRONCE_II', 'BRONCE_I', 'PLATA_IV', 'PLATA_III', 'PLATA_II', 'PLATA_I', 'ORO_IV', 'ORO_III', 'ORO_II', 'ORO_I', 'PLATINO_IV', 'PLATINO_III', 'PLATINO_II', 'PLATINO_I', 'ESMERALDA_IV', 'ESMERALDA_III', 'ESMERALDA_II', 'ESMERALDA_I', 'DIAMANTE_IV', 'DIAMANTE_III', 'DIAMANTE_II', 'DIAMANTE_I', 'MAESTRO', 'GRAN_MAESTRO', 'RETADOR');

-- DropIndex
DROP INDEX "Estadistica_jugadorId_juego_idx";

-- AlterTable
ALTER TABLE "Estadistica" ADD COLUMN     "rango" "RangoLol";

-- AlterTable
-- Prisma generó DROP COLUMN + ADD COLUMN, que borraría el rango mínimo de las
-- ofertas ya publicadas (el módulo de ofertas ya está en uso). Se convierte el
-- texto en su lugar: «Diamante II» → DIAMANTE_II, «Gran Maestro» →
-- GRAN_MAESTRO. Lo que no corresponda a ningún valor del catálogo queda NULL
-- en vez de inventar un rango.
ALTER TABLE "Oferta" ALTER COLUMN "rangoMinimo" TYPE "RangoLol" USING (
  CASE
    WHEN upper(replace(trim("rangoMinimo"), ' ', '_')) = ANY (enum_range(NULL::"RangoLol")::text[])
      THEN upper(replace(trim("rangoMinimo"), ' ', '_'))::"RangoLol"
    ELSE NULL
  END
);

-- CreateIndex
CREATE INDEX "Estadistica_jugadorId_juego_capturadaEn_idx" ON "Estadistica"("jugadorId", "juego", "capturadaEn");


-- Integración con Riot: servidor de la cuenta, última sincronización correcta y
-- último intento (espera entre ingestas), y la cuenta de la que sale cada
-- captura de estadísticas, con borrado en cascada al desvincularla.
-- Generada con `prisma migrate diff`; Prisma añadió además
-- `DROP INDEX "PerfilVector_embedding_hnsw_idx"` porque no modela el índice
-- HNSW: se quitó a mano (CLAUDE.md §4).

-- AlterTable
ALTER TABLE "CuentaGaming" ADD COLUMN     "intentoSincronizacionEn" TIMESTAMP(3),
ADD COLUMN     "servidor" TEXT,
ADD COLUMN     "sincronizadaEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Estadistica" ADD COLUMN     "cuentaId" TEXT;

-- CreateIndex
CREATE INDEX "Estadistica_cuentaId_idx" ON "Estadistica"("cuentaId");

-- AddForeignKey
ALTER TABLE "Estadistica" ADD CONSTRAINT "Estadistica_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaGaming"("id") ON DELETE CASCADE ON UPDATE CASCADE;


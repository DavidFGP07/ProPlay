-- CreateEnum
CREATE TYPE "Departamento" AS ENUM ('AMAZONAS', 'ANTIOQUIA', 'ARAUCA', 'ATLANTICO', 'BOGOTA_DC', 'BOLIVAR', 'BOYACA', 'CALDAS', 'CAQUETA', 'CASANARE', 'CAUCA', 'CESAR', 'CHOCO', 'CORDOBA', 'CUNDINAMARCA', 'GUAINIA', 'GUAVIARE', 'HUILA', 'LA_GUAJIRA', 'MAGDALENA', 'META', 'NARINO', 'NORTE_DE_SANTANDER', 'PUTUMAYO', 'QUINDIO', 'RISARALDA', 'SAN_ANDRES', 'SANTANDER', 'SUCRE', 'TOLIMA', 'VALLE_DEL_CAUCA', 'VAUPES', 'VICHADA');

-- DropIndex
DROP INDEX "PerfilJugador_region_idx";

-- AlterTable
-- `region` guardaba regiones de servidor del juego (LAN, LAS…), no ubicación:
-- se elimina. `pais` era texto libre del seed («Colombia»): se descarta con
-- `USING NULL` en lugar de truncarlo a dos caracteres, y el seed lo repone con
-- códigos ISO 3166-1 alfa-2.
-- Prisma generó además `DROP INDEX "PerfilVector_embedding_hnsw_idx"` porque no
-- modela el índice HNSW: se quitó a mano (CLAUDE.md §4).
ALTER TABLE "PerfilJugador" DROP COLUMN "region",
ADD COLUMN     "departamento" "Departamento",
ALTER COLUMN "pais" SET DATA TYPE CHAR(2) USING NULL;

-- CreateIndex
CREATE INDEX "PerfilJugador_pais_departamento_idx" ON "PerfilJugador"("pais", "departamento");


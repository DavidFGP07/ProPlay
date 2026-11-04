-- Tareas 3.1, 3.2 y 3.16: estados, pesos y ubicación de la oferta, y fecha de
-- cada cambio de estado de la postulación.
-- Prisma generó además `DROP INDEX "PerfilVector_embedding_hnsw_idx"` porque no
-- modela el índice HNSW: se quitó a mano (CLAUDE.md §4).
-- `PerfilEquipo.region` guardaba regiones de servidor (LAN, LAS…): se elimina y
-- la sede pasa a `pais` + `departamento`, como en `PerfilJugador`.

-- CreateEnum
CREATE TYPE "Modalidad" AS ENUM ('PRESENCIAL', 'HIBRIDA', 'REMOTA');

-- CreateEnum
CREATE TYPE "PosicionLol" AS ENUM ('TOP', 'JUNGLA', 'MID', 'ADC', 'SOPORTE');

-- AlterEnum
ALTER TYPE "EstadoOferta" ADD VALUE 'CUBIERTA';

-- AlterEnum
ALTER TYPE "EstadoPostulacion" ADD VALUE 'ENTREVISTA';

-- DropIndex
DROP INDEX "Oferta_estado_idx";

-- DropIndex
DROP INDEX "Oferta_juego_idx";

-- DropIndex
DROP INDEX "Oferta_region_idx";

-- DropIndex
DROP INDEX "PerfilEquipo_region_idx";

-- Las ofertas existentes sólo pueden venir del seed (crear ofertas respondía 501)
-- y no caben en el modelo nuevo: `rol` era texto libre con roles de otros juegos
-- (DUELISTA, AWPER…), `region` guardaba regiones de servidor y faltan la
-- modalidad y los pesos. Se borran en lugar de inventar valores; el borrado
-- arrastra sus postulaciones y matchings (ON DELETE CASCADE), también del seed.
-- `npm run db:seed` las repone con el modelo nuevo.
DELETE FROM "Oferta";

-- AlterTable
ALTER TABLE "Oferta" DROP COLUMN "experienciaMinAnios",
DROP COLUMN "region",
ADD COLUMN     "cerradaEn" TIMESTAMP(3),
ADD COLUMN     "departamento" "Departamento",
ADD COLUMN     "modalidad" "Modalidad" NOT NULL,
ADD COLUMN     "pais" CHAR(2),
ADD COLUMN     "pesoDisponibilidad" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "pesoExperiencia" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "pesoGeografica" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "pesoHabilidadesBlandas" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "pesoTecnica" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "publicadaEn" TIMESTAMP(3),
DROP COLUMN "rol",
ADD COLUMN     "rol" "PosicionLol" NOT NULL;

-- AlterTable
ALTER TABLE "PerfilEquipo" DROP COLUMN "region",
ADD COLUMN     "departamento" "Departamento",
ADD COLUMN     "pais" CHAR(2);

-- AlterTable
ALTER TABLE "Postulacion" ADD COLUMN     "aceptadaEn" TIMESTAMP(3),
ADD COLUMN     "entrevistaEn" TIMESTAMP(3),
ADD COLUMN     "rechazadaEn" TIMESTAMP(3),
ADD COLUMN     "revisadaEn" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Oferta_estado_publicadaEn_idx" ON "Oferta"("estado", "publicadaEn");

-- CreateIndex
CREATE INDEX "Oferta_rol_idx" ON "Oferta"("rol");

-- CreateIndex
CREATE INDEX "Oferta_modalidad_idx" ON "Oferta"("modalidad");

-- CreateIndex
CREATE INDEX "Oferta_pais_departamento_idx" ON "Oferta"("pais", "departamento");

-- CreateIndex
CREATE INDEX "PerfilEquipo_pais_departamento_idx" ON "PerfilEquipo"("pais", "departamento");


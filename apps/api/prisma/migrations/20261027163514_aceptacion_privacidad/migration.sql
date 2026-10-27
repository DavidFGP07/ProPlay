-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "avisoPrivacidadAceptadoEn" TIMESTAMP(3),
ADD COLUMN     "avisoPrivacidadVersion" TEXT,
ADD COLUMN     "declaraMayorEdadEn" TIMESTAMP(3);

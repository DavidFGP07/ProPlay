-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('JUGADOR', 'EQUIPO', 'SCOUT', 'ADMIN');

-- CreateEnum
CREATE TYPE "CategoriaHabilidad" AS ENUM ('TECNICA', 'BLANDA');

-- CreateEnum
CREATE TYPE "Plataforma" AS ENUM ('RIOT', 'STEAM', 'TWITCH', 'YOUTUBE');

-- CreateEnum
CREATE TYPE "EstadoOferta" AS ENUM ('BORRADOR', 'ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "EstadoPostulacion" AS ENUM ('ENVIADA', 'EN_REVISION', 'ACEPTADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'JUGADOR',
    "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilJugador" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "bio" TEXT,
    "region" TEXT,
    "pais" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "disponibilidadHoras" INTEGER,
    "dispuestoRelocalizar" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilJugador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilEquipo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombreOrg" TEXT NOT NULL,
    "descripcion" TEXT,
    "sitioWeb" TEXT,
    "logoUrl" TEXT,
    "region" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilEquipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habilidad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaHabilidad" NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Habilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabilidadJugador" (
    "id" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "habilidadId" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "verificada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabilidadJugador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endorsement" (
    "id" TEXT NOT NULL,
    "habilidadJugadorId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "comentario" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Endorsement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaGaming" (
    "id" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "plataforma" "Plataforma" NOT NULL,
    "externalId" TEXT NOT NULL,
    "handle" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiraEn" TIMESTAMP(3),
    "verificadaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuentaGaming_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estadistica" (
    "id" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "juego" TEXT NOT NULL,
    "rol" TEXT,
    "partidas" INTEGER NOT NULL DEFAULT 0,
    "victorias" INTEGER NOT NULL DEFAULT 0,
    "kda" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metricas" JSONB,
    "fuente" "Plataforma" NOT NULL,
    "capturadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Estadistica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilVector" (
    "id" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "dimensiones" DOUBLE PRECISION[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "calculadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerfilVector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publicacion" (
    "id" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Oferta" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "juego" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "rangoMinimo" TEXT,
    "experienciaMinAnios" INTEGER NOT NULL DEFAULT 0,
    "region" TEXT,
    "horasSemana" INTEGER,
    "descripcion" TEXT NOT NULL,
    "estado" "EstadoOferta" NOT NULL DEFAULT 'BORRADOR',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Oferta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Postulacion" (
    "id" TEXT NOT NULL,
    "ofertaId" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "estado" "EstadoPostulacion" NOT NULL DEFAULT 'ENVIADA',
    "mensaje" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Postulacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matching" (
    "id" TEXT NOT NULL,
    "ofertaId" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "puntaje" DOUBLE PRECISION NOT NULL,
    "desglose" JSONB NOT NULL,
    "calculadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Matching_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversacion" (
    "id" TEXT NOT NULL,
    "titulo" TEXT,
    "esGrupo" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipanteConversacion" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "leidoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipanteConversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensaje" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "leidaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilJugador_usuarioId_key" ON "PerfilJugador"("usuarioId");

-- CreateIndex
CREATE INDEX "PerfilJugador_region_idx" ON "PerfilJugador"("region");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilEquipo_usuarioId_key" ON "PerfilEquipo"("usuarioId");

-- CreateIndex
CREATE INDEX "PerfilEquipo_region_idx" ON "PerfilEquipo"("region");

-- CreateIndex
CREATE UNIQUE INDEX "Habilidad_nombre_key" ON "Habilidad"("nombre");

-- CreateIndex
CREATE INDEX "Habilidad_categoria_idx" ON "Habilidad"("categoria");

-- CreateIndex
CREATE INDEX "HabilidadJugador_jugadorId_idx" ON "HabilidadJugador"("jugadorId");

-- CreateIndex
CREATE INDEX "HabilidadJugador_habilidadId_idx" ON "HabilidadJugador"("habilidadId");

-- CreateIndex
CREATE UNIQUE INDEX "HabilidadJugador_jugadorId_habilidadId_key" ON "HabilidadJugador"("jugadorId", "habilidadId");

-- CreateIndex
CREATE INDEX "Endorsement_autorId_idx" ON "Endorsement"("autorId");

-- CreateIndex
CREATE UNIQUE INDEX "Endorsement_habilidadJugadorId_autorId_key" ON "Endorsement"("habilidadJugadorId", "autorId");

-- CreateIndex
CREATE INDEX "CuentaGaming_jugadorId_idx" ON "CuentaGaming"("jugadorId");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaGaming_jugadorId_plataforma_key" ON "CuentaGaming"("jugadorId", "plataforma");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaGaming_plataforma_externalId_key" ON "CuentaGaming"("plataforma", "externalId");

-- CreateIndex
CREATE INDEX "Estadistica_jugadorId_idx" ON "Estadistica"("jugadorId");

-- CreateIndex
CREATE INDEX "Estadistica_jugadorId_juego_idx" ON "Estadistica"("jugadorId", "juego");

-- CreateIndex
CREATE INDEX "Estadistica_juego_idx" ON "Estadistica"("juego");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilVector_jugadorId_key" ON "PerfilVector"("jugadorId");

-- CreateIndex
CREATE INDEX "Publicacion_autorId_idx" ON "Publicacion"("autorId");

-- CreateIndex
CREATE INDEX "Publicacion_creadoEn_idx" ON "Publicacion"("creadoEn");

-- CreateIndex
CREATE INDEX "Oferta_equipoId_idx" ON "Oferta"("equipoId");

-- CreateIndex
CREATE INDEX "Oferta_juego_idx" ON "Oferta"("juego");

-- CreateIndex
CREATE INDEX "Oferta_region_idx" ON "Oferta"("region");

-- CreateIndex
CREATE INDEX "Oferta_estado_idx" ON "Oferta"("estado");

-- CreateIndex
CREATE INDEX "Postulacion_ofertaId_idx" ON "Postulacion"("ofertaId");

-- CreateIndex
CREATE INDEX "Postulacion_jugadorId_idx" ON "Postulacion"("jugadorId");

-- CreateIndex
CREATE INDEX "Postulacion_estado_idx" ON "Postulacion"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Postulacion_ofertaId_jugadorId_key" ON "Postulacion"("ofertaId", "jugadorId");

-- CreateIndex
CREATE INDEX "Matching_ofertaId_idx" ON "Matching"("ofertaId");

-- CreateIndex
CREATE INDEX "Matching_jugadorId_idx" ON "Matching"("jugadorId");

-- CreateIndex
CREATE INDEX "Matching_ofertaId_puntaje_idx" ON "Matching"("ofertaId", "puntaje");

-- CreateIndex
CREATE UNIQUE INDEX "Matching_ofertaId_jugadorId_key" ON "Matching"("ofertaId", "jugadorId");

-- CreateIndex
CREATE INDEX "ParticipanteConversacion_usuarioId_idx" ON "ParticipanteConversacion"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipanteConversacion_conversacionId_usuarioId_key" ON "ParticipanteConversacion"("conversacionId", "usuarioId");

-- CreateIndex
CREATE INDEX "Mensaje_conversacionId_creadoEn_idx" ON "Mensaje"("conversacionId", "creadoEn");

-- CreateIndex
CREATE INDEX "Mensaje_autorId_idx" ON "Mensaje"("autorId");

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_idx" ON "Notificacion"("usuarioId");

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_leidaEn_idx" ON "Notificacion"("usuarioId", "leidaEn");

-- CreateIndex
CREATE INDEX "AuditLog_usuarioId_idx" ON "AuditLog"("usuarioId");

-- CreateIndex
CREATE INDEX "AuditLog_entidad_entidadId_idx" ON "AuditLog"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "AuditLog_creadoEn_idx" ON "AuditLog"("creadoEn");

-- AddForeignKey
ALTER TABLE "PerfilJugador" ADD CONSTRAINT "PerfilJugador_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilEquipo" ADD CONSTRAINT "PerfilEquipo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabilidadJugador" ADD CONSTRAINT "HabilidadJugador_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "PerfilJugador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabilidadJugador" ADD CONSTRAINT "HabilidadJugador_habilidadId_fkey" FOREIGN KEY ("habilidadId") REFERENCES "Habilidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_habilidadJugadorId_fkey" FOREIGN KEY ("habilidadJugadorId") REFERENCES "HabilidadJugador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaGaming" ADD CONSTRAINT "CuentaGaming_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "PerfilJugador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estadistica" ADD CONSTRAINT "Estadistica_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "PerfilJugador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilVector" ADD CONSTRAINT "PerfilVector_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "PerfilJugador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publicacion" ADD CONSTRAINT "Publicacion_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oferta" ADD CONSTRAINT "Oferta_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "PerfilEquipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "Oferta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "PerfilJugador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matching" ADD CONSTRAINT "Matching_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "Oferta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matching" ADD CONSTRAINT "Matching_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "PerfilJugador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipanteConversacion" ADD CONSTRAINT "ParticipanteConversacion_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipanteConversacion" ADD CONSTRAINT "ParticipanteConversacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

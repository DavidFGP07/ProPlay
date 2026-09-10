# ---------------------------------------------------------------------------
# ProPlay API — imagen de producción
#
# IMPORTANTE: el contexto de build es la RAÍZ DEL MONOREPO, no apps/api,
# porque la API depende de packages/shared. Construye así:
#
#   docker build -f apps/api/Dockerfile -t proplay-api .
#
# En Railway o Render: root directory = raíz del repo,
# Dockerfile path = apps/api/Dockerfile.
# ---------------------------------------------------------------------------

FROM node:20-alpine AS base
WORKDIR /app
# Prisma necesita openssl en Alpine para su motor de consultas.
RUN apk add --no-cache openssl libc6-compat
ENV npm_config_update_notifier=false

# --------------------------- dependencias completas ------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# --ignore-scripts: prisma generate se ejecuta más adelante, ya con el schema.
RUN npm ci --ignore-scripts

# ------------------------------- compilación -------------------------------
FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
  && npm run build -w @proplay/shared \
  && npm run build -w api

# -------------------------------- ejecución --------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# El schema viaja a la imagen: el arranque ejecuta `prisma migrate deploy`.
COPY apps/api/prisma ./apps/api/prisma
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Usuario no root (viene con la imagen oficial de Node).
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Aplica las migraciones pendientes y arranca el servidor.
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/server.js"]

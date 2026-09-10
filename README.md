# ProPlay

Plataforma web de **red profesional para el scouting de talento en eSports**.
Conecta jugadores, equipos y scouts: perfiles verificables, estadísticas
importadas de las plataformas de juego, ofertas de los equipos y un algoritmo
de compatibilidad entre ambos.

Proyecto de grado — Universidad del Norte.

> Estado actual: **esqueleto**. La autenticación funciona de punta a punta
> (registro, login, refresh, rutas protegidas por rol). Los demás módulos son
> andamiaje: sus rutas existen y responden `501 Not Implemented`.

---

## Arquitectura en una frase

Monolito modular en el servidor (Express + Prisma, nueve módulos separados por
carpetas), cliente desacoplado (React + Vite), contrato compartido en un
paquete propio, todo en un monorepo con **npm workspaces**.

```
proplay/
├── apps/api      → API REST Express + TypeScript + Prisma  (:3000)
├── apps/web      → Cliente React + Vite + TailwindCSS      (:5173)
├── packages/shared → contrato único: esquemas Zod, tipos, enums, constantes
└── docs/         → arquitectura y registro de decisiones
```

La API se sirve bajo `/api/v1`. Documentación ampliada en
[docs/arquitectura.md](docs/arquitectura.md) y
[docs/decisiones.md](docs/decisiones.md).

---

## Requisitos previos

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| Node.js | 20 LTS o superior | ejecutar api y web |
| npm | 10 o superior | workspaces del monorepo |
| Docker + Docker Compose | cualquiera reciente | Postgres 16 con pgvector y Redis 7 |

Si no tienes Docker, hay una alternativa con Homebrew más abajo.

---

## Instalación

1. **Clona el repositorio y entra en la carpeta.**

   ```bash
   git clone <url-del-repo> proplay
   cd proplay
   ```

2. **Levanta la infraestructura local** (Postgres con pgvector y Redis):

   ```bash
   docker compose up -d
   docker compose ps          # ambos servicios deben estar "healthy"
   ```

3. **Copia los archivos de entorno** y genera los secretos de la API:

   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env

   # Genera los tres secretos y pégalos en apps/api/.env
   node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
   node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
   node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Instala las dependencias de los tres workspaces con un solo comando:**

   ```bash
   npm install
   ```

   No hace falta entrar en `apps/api`, `apps/web` ni `packages/shared`: npm
   workspaces los enlaza y el `postinstall` de la raíz ejecuta
   `prisma generate`.

5. **Aplica las migraciones y carga los datos de prueba:**

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

6. **Arranca todo en paralelo:**

   ```bash
   npm run dev
   ```

   - API: <http://localhost:3000/api/v1>
   - Web: <http://localhost:5173>
   - Salud: <http://localhost:3000/api/v1/health>

### Cuentas de prueba

Todas usan la contraseña `ProPlay123`:

| Correo | Rol |
| --- | --- |
| `admin@proplay.gg` | ADMIN |
| `scout@proplay.gg` | SCOUT |
| `equipo@caribeesports.gg` | EQUIPO |
| `jugador1@proplay.gg` … `jugador15@proplay.gg` | JUGADOR |

### Alternativa sin Docker (macOS con Homebrew)

```bash
brew install postgresql@17 pgvector redis
brew services start postgresql@17
brew services start redis

/opt/homebrew/opt/postgresql@17/bin/psql -d postgres \
  -c "CREATE ROLE proplay LOGIN PASSWORD 'proplay' SUPERUSER;" \
  -c "CREATE DATABASE proplay OWNER proplay;"
```

`DATABASE_URL` y `REDIS_URL` de `apps/api/.env.example` ya apuntan a esos
puertos, así que el resto de los pasos no cambia. El `docker-compose.yml` usa
Postgres 16 (`pgvector/pgvector:pg16`); con Homebrew se instala 17 porque es la
versión contra la que Homebrew compila pgvector.

---

## Scripts

Todos se ejecutan desde la raíz del monorepo.

| Script | Qué hace |
| --- | --- |
| `npm run dev` | API y web en paralelo con prefijos de color (`concurrently`) |
| `npm run build` | Compila `shared`, luego `api`, luego `web` |
| `npm run lint` | ESLint en los tres workspaces |
| `npm run typecheck` | `tsc --noEmit` en los tres workspaces |
| `npm test` | Pruebas de integración de la API (Vitest + supertest) |
| `npm run db:migrate` | `prisma migrate dev` (desarrollo) |
| `npm run db:deploy` | `prisma migrate deploy` (producción y CI) |
| `npm run db:seed` | Carga los datos de prueba (idempotente) |
| `npm run db:studio` | Abre Prisma Studio |
| `npm run db:reset` | Borra la base, reaplica migraciones y siembra |
| `npm run docker:up` / `docker:down` | Atajos de `docker compose` |

Para un solo workspace: `npm run <script> -w api`, `-w web`,
`-w @proplay/shared`.

---

## Pruebas

```bash
npm test
```

Son pruebas de **integración**: levantan la app Express real y hablan con
Postgres, así que la base de datos tiene que estar arriba. Cubren el registro,
el login, el refresco de sesión, `/auth/me`, el acceso denegado sin token, el
acceso denegado por rol y la forma del error del contrato.

Las pruebas crean usuarios con correos aleatorios prefijados con
`test-integracion` y los borran al terminar. En CI se ejecutan contra una base
`proplay_test` aparte; en local usan la `DATABASE_URL` de `apps/api/.env`. Si
prefieres aislarlas del todo, crea `proplay_test` y exporta `DATABASE_URL`
antes de lanzar `npm test`.

---

## Despliegue

Cada app se despliega por separado aunque vivan en el mismo repositorio.

### API en Railway o Render (Docker)

El `Dockerfile` es multi-stage sobre `node:20-alpine`, corre como usuario no
root y su `CMD` aplica las migraciones antes de arrancar el servidor.

**El contexto de build es la raíz del monorepo, no `apps/api`**, porque la
imagen necesita `packages/shared`. En la configuración del servicio:

| Ajuste | Valor |
| --- | --- |
| Root directory | `.` (la raíz del repositorio) |
| Dockerfile path | `apps/api/Dockerfile` |
| Puerto | `3000` (o el que inyecte la plataforma en `PORT`) |

En local se construye igual:

```bash
docker build -f apps/api/Dockerfile -t proplay-api .
```

Variables de entorno que hay que definir en el servicio: `DATABASE_URL`,
`REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`,
`CORS_ORIGIN` (el dominio de Vercel), `NODE_ENV=production` y, cuando se
conecten las integraciones, `CLOUDINARY_*` y `RIOT_API_KEY`.

### Web en Vercel

Aquí es donde más se falla con monorepos de workspaces. La configuración exacta:

| Ajuste | Valor |
| --- | --- |
| Root directory | `.` (la raíz del repositorio, **no** `apps/web`) |
| Install command | `npm install` |
| Build command | `npm run build -w web` |
| Output directory | `apps/web/dist` |
| Variable de entorno | `VITE_API_URL=https://<tu-api>/api/v1` |

`apps/web/vercel.json` incluye el rewrite de todas las rutas a `index.html`
para que React Router funcione con recarga directa de una URL profunda.

`npm run build -w web` no necesita compilar `packages/shared` antes: Vite
resuelve `@proplay/shared` al TypeScript fuente mediante un alias.

### CORS y cookies en producción

La web y la API viven en dominios distintos, así que:

- el backend lee `CORS_ORIGIN` y responde con `credentials: true`;
- la cookie del refresh token se emite con `SameSite=None; Secure` cuando
  `NODE_ENV=production`;
- el frontend nunca lleva URLs escritas a mano: todo sale de `VITE_API_URL`.

### Integración continua

`.github/workflows/ci.yml` levanta Postgres y Redis como *services*, instala
desde la raíz y ejecuta `lint`, `typecheck`, `test` y `build`.

---

## Seguridad

- Ningún secreto en el repositorio: un `.env.example` por app, con un
  comentario por variable.
- `apps/api/src/config/env.ts` valida el entorno con Zod al arrancar y falla
  rápido si falta algo.
- Contraseñas con bcrypt (12 rondas). Access token de 15 minutos en memoria del
  cliente; refresh token de 7 días en cookie `httpOnly`.
- Los tokens OAuth de las cuentas gaming se guardan cifrados con AES-256-GCM
  (`apps/api/src/utils/crypto.ts`).
- `helmet`, CORS por lista blanca y rate limiting global (300 peticiones cada 15
  minutos) más uno estricto en `/auth` (10 cada 15 minutos).
- Manejador de errores central: siempre `{ error: { code, message, details? } }`
  y nunca stack traces en producción.

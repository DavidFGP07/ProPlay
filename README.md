# ProPlay

Plataforma web de **red profesional para el scouting de talento en eSports**.
Conecta jugadores, equipos y scouts: perfiles verificables, estadísticas
importadas de las plataformas de juego, ofertas de los equipos y un algoritmo
de compatibilidad entre ambos.

Proyecto de grado — Universidad del Norte.

> Estado actual: la autenticación funciona de punta a punta (registro, login,
> refresh, rutas protegidas por rol), igual que los perfiles y la
> **integración con la API de Riot Games** (vinculación verificada de la cuenta
> de League of Legends y estadísticas). Los demás módulos son andamiaje: sus
> rutas existen y responden `501 Not Implemented`.

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

## Integración con la API de Riot Games

Es la única fuente de datos externa del proyecto (decisión 0.3: solo League of
Legends). Con ella el perfil del jugador deja de ser autodeclarado: las cifras
salen de la API oficial de Riot.

### Qué hace

1. **Vincula la cuenta de Riot del jugador y demuestra que es suya.** El
   jugador escribe su Riot ID (`Nombre#TAG`) y su servidor; la API lo busca en
   Riot y le pide que se ponga un icono de invocador concreto (uno de los
   básicos, que tiene todo el mundo). Cuando lo hace, la API lo comprueba en
   Riot y marca la cuenta como **verificada**. Así nadie puede vincular la
   cuenta de otro. (Riot Sign On, el OAuth de Riot, exige una clave de
   producción con aprobación; ver `docs/decisiones.md`, «Integración con Riot».)
2. **Descarga y normaliza sus estadísticas** (RF-03, RF-04). En cada
   sincronización analiza sus últimas 20 partidas de clasificatoria solo/dúo
   (cola 420; si tiene menos de 5, completa con normales) y guarda una captura
   en `Estadistica`, con la posición más jugada en solo/dúo y el rango de
   solo/dúo en el formato del buscador (`packages/shared/src/riot.ts`).
3. **Guarda el histórico**, de modo que se puede ver la tendencia del
   rendimiento entre capturas (indicador de «Mis estadísticas»).

### Qué datos trae

| Dato | Endpoint de Riot | Dónde queda |
| --- | --- | --- |
| puuid y Riot ID | `account-v1` | `CuentaGaming.externalId`, `CuentaGaming.handle` |
| Nivel e icono del invocador | `summoner-v4` | `metricas.nivelInvocador`; el icono sólo se usa para verificar |
| Rango en Solo/Duo en el catálogo `RangoLol` (lo que filtra el buscador) | `league-v4` | `Estadistica.rango` |
| Rango detallado en Solo/Duo y Flex (liga, división, LP, victorias y derrotas) | `league-v4` | `metricas.rangoSoloDuo`, `metricas.rangoFlex` |
| Partidas, victorias, KDA, win rate | `match-v5` | columnas de `Estadistica` |
| Posición más jugada y reparto por posición, sólo en solo/dúo (`TOP`, `JUNGLA`, `MID`, `ADC`, `SOPORTE`) | `match-v5` | `Estadistica.rol`, `metricas.distribucionRoles` |
| CS, oro, daño a campeones y visión por minuto; participación en kills; duración media | `match-v5` | `metricas.*` |
| Tres campeones más jugados con su KDA y victorias | `match-v5` | `metricas.campeonesMasJugados` |

La forma exacta de `metricas` es `metricasLolSchema` en `@proplay/shared`. Se
descartan los *remakes* (partidas de menos de 5 minutos). Si Riot no tiene
partidas nuevas desde la última captura, no se duplica la fila.

### Endpoints

| Método y ruta | Rol | Qué hace |
| --- | --- | --- |
| `POST /perfiles/cuentas-gaming/riot` | JUGADOR | Paso 1: `{ gameName, tagLine, servidor }` → icono que debe ponerse y `tokenDesafio` (válido 15 min). Con el paso 2, 10 intentos cada 15 min por usuario |
| `POST /perfiles/cuentas-gaming/riot/verificar` | JUGADOR | Paso 2: `{ tokenDesafio }` → comprueba el icono en Riot y guarda la cuenta verificada |
| `GET /perfiles/cuentas-gaming` | JUGADOR | Cuentas vinculadas con su servidor, fecha de verificación y última sincronización |
| `DELETE /perfiles/cuentas-gaming/:plataforma` | JUGADOR | Desvincula la cuenta y borra las estadísticas que salieron de ella |
| `POST /estadisticas/sincronizar` | JUGADOR | Descarga las estadísticas desde Riot (como mucho una vez cada 10 min, contando los intentos fallidos) |
| `GET /estadisticas/jugador/:id` | con sesión | Histórico de capturas (`?juego=&desde=&hasta=`); `:id` es el del perfil público |
| `GET /estadisticas/jugador/:id/resumen` | con sesión | Última captura por juego y su variación frente a la anterior |

Servidores admitidos: `LA1` (Latinoamérica Norte, por defecto y el del
piloto), `LA2`, `NA1`, `BR1`, `EUW1`, `EUN1`, `TR1`, `RU`, `ME1`, `KR`, `JP1`,
`OC1`, `SG2`, `TW2` y `VN2`.

### Configuración

En `apps/api/.env`:

```bash
RIOT_API_KEY=RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

- La clave de **desarrollo** se saca en <https://developer.riotgames.com> y
  **caduca cada 24 horas**: hay que regenerarla y pegarla otra vez cada día
  (ver «Renovar la clave» más abajo).
  Con una clave caducada, los endpoints de Riot responden `502` con el mensaje
  «Riot rechazó la clave de la API: es inválida o caducó».
- Sin clave, responden `503 SERVICIO_NO_CONFIGURADO`; el resto de la API
  funciona igual.
- La clave nunca va al repositorio ni a variables `VITE_*`.

#### Renovar la clave cuando caduque

1. Entra en <https://developer.riotgames.com> con tu cuenta de Riot y, en el
   panel, pulsa **Regenerate API Key**.
2. Copia la clave nueva (`RGAPI-…`).
3. Abre **`apps/api/.env`** (no el `.env.example` ni el de `apps/web`) y
   reemplaza el valor de la línea `RIOT_API_KEY=`:

   ```bash
   RIOT_API_KEY=RGAPI-la-clave-nueva
   ```

4. Reinicia la API (`Ctrl+C` y otra vez `npm run dev`): la clave se lee al
   arrancar.

No hay que tocar el código, la base de datos ni el cliente web, y las cuentas ya
verificadas y sus estadísticas siguen ahí.

### En la aplicación web

Con la sesión de un jugador, el menú lateral tiene dos vistas nuevas:

- **Cuentas vinculadas** (`/cuentas-vinculadas`): buscar la cuenta por Riot ID,
  ver el icono que hay que ponerse, verificarla, sincronizar y desvincular.
- **Mis estadísticas** (`/mis-estadisticas`): rango, métricas, posiciones,
  campeones más jugados y la gráfica de la tendencia entre sincronizaciones.

Límites de la clave de desarrollo: 20 peticiones por segundo y 100 cada dos
minutos para toda la aplicación. Una sincronización gasta unas 24 peticiones,
así que caben unas cuatro cada dos minutos. El cliente
(`apps/api/src/integrations/riot/riot.client.ts`) reparte la cuota, respeta el
`Retry-After` de Riot y, si la espera fuera larga, responde `429` en lugar de
dejar la petición colgada.

### Qué más se puede añadir con esta misma API

Sin cambiar de clave:

- **Worker de ingesta periódica** (tarea 2.5): sincronizar a todos los
  jugadores verificados de madrugada, con la cuota en Redis.
- **Maestría de campeones** (`champion-mastery-v4`): puntos y nivel por
  campeón, útil para la dimensión técnica del matching.
- **Línea de tiempo de la partida** (`match-v5 /timeline`): oro y experiencia
  al minuto 10/15, diferencia de CS con el rival de línea, primeras sangres.
- **Desafíos** (`lol-challenges-v1`): logros de Riot como evidencia de
  habilidades.
- **Estado del servidor** (`lol-status-v4`): avisar si Riot tiene incidencias
  cuando falla una sincronización.
- **Comparación por rango**: con el rango que ya se guarda, normalizar las
  métricas frente a jugadores de la misma liga para el matching (S3).

Con una clave de **producción** (tarea 0.1 del plan): Riot Sign On (OAuth) en
lugar del desafío del icono, sin caducidad diaria y con más cuota. VALORANT
exige además una aprobación propia de Riot.

---

## Requisitos previos

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| Node.js | 22 (fijado en `.nvmrc`) | ejecutar api y web |
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
| `npm test` | Pruebas de integración de la API (Vitest + supertest) y pruebas del cliente (Vitest + Testing Library) |
| `npm run db:migrate` | `prisma migrate dev` (desarrollo) |
| `npm run db:deploy` | `prisma migrate deploy` (producción y CI) |
| `npm run db:seed` | Carga los datos de prueba (idempotente) |
| `npm run db:studio` | Abre Prisma Studio |
| `npm run db:reset` | Borra la base, reaplica migraciones y siembra |
| `npm run docker:up` / `docker:down` | Atajos de `docker compose` |
| `npm run admin:promover -w api -- <correo>` | Promueve a `ADMIN` una cuenta de scout ya registrada ([docs/operacion.md](docs/operacion.md)) |

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

El `Dockerfile` es multi-stage sobre `node:22-alpine`, corre como usuario no
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
`CORS_ORIGIN` (el dominio de Vercel), `NODE_ENV=production`, `TRUST_PROXY`
`RIOT_API_KEY` (ver «Integración con la API de Riot Games») y, cuando se
conecte, `CLOUDINARY_*`.

`TRUST_PROXY` es el número de proxies que hay delante de la API: `1` en
Railway o Render, uno más por cada capa añadida (una CDN, por ejemplo) y `0`
si la API recibe las conexiones directamente. En producción es obligatoria y
la API no arranca sin ella. Si se queda corta, todos los anónimos comparten la
IP del proxy y el mismo cupo de los límites; si sobra, cualquiera puede
falsear `X-Forwarded-For` y saltarse el límite por IP.

El primer administrador se da de alta después del despliegue, desde una consola
del contenedor: ver [docs/operacion.md](docs/operacion.md). El seed nunca se
ejecuta en producción.

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

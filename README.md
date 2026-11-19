# ProPlay

Plataforma web de **red profesional para el scouting de talento en eSports**.
Conecta jugadores, equipos y scouts: perfiles verificables, estadísticas
importadas de las plataformas de juego, ofertas de los equipos y un algoritmo
de compatibilidad entre ambos.

Proyecto de grado — Universidad del Norte.

> Estado actual: funcionan de punta a punta la autenticación (registro, login,
> refresh, rutas protegidas por rol), los perfiles, la **integración con la API
> de Riot Games** (vinculación verificada por icono de la cuenta de League of
> Legends, estadísticas e ingesta periódica en cola), el buscador de talento,
> las ofertas con sus postulaciones, el **motor de matching** con ranking
> explicable y la **analítica** (embudo de la vacante, dimensión decisiva y mapa
> del talento). Siguen como andamiaje (`501 Not Implemented`) `mensajeria`,
> `notificaciones`, `admin`, habilidades y endorsements, la vinculación por
> OAuth y algunos endpoints sueltos de `scouting` y `matching`: la lista exacta
> está en [Rutas de la API](#rutas-de-la-api).

---

## Arquitectura en una frase

Monolito modular en el servidor (Express + Prisma, diez módulos separados por
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
| `POST /perfiles/cuentas-gaming/riot` | JUGADOR | Paso 1: `{ gameName, tagLine, servidor }` → icono que debe ponerse y `tokenDesafio` (válido 15 min, guardado en Redis). Con un desafío activo para la misma cuenta devuelve ése; para otra, 409. Con «generar otro icono», 10 intentos cada 15 min por usuario |
| `GET /perfiles/cuentas-gaming/riot/desafio` | JUGADOR | Desafío activo (`{ desafio }`, o `null`): el mismo icono con su caducidad, para retomarlo |
| `POST /perfiles/cuentas-gaming/riot/desafio/regenerar` | JUGADOR | «Generar otro icono»: sustituye el desafío activo e invalida el anterior |
| `DELETE /perfiles/cuentas-gaming/riot/desafio` | JUGADOR | Cancela el desafío activo, para vincular otra cuenta |
| `POST /perfiles/cuentas-gaming/riot/verificar` | JUGADOR | Paso 2: `{ tokenDesafio }` → comprueba el icono en Riot: 201 `VERIFICADA` con la cuenta, o 200 `PENDIENTE` si Riot aún no refleja el cambio. 40 comprobaciones por desafío, aparte del límite anterior |
| `GET /perfiles/cuentas-gaming` | JUGADOR | Cuentas vinculadas con su servidor, fecha de verificación y última sincronización |
| `DELETE /perfiles/cuentas-gaming/:plataforma` | JUGADOR | Desvincula la cuenta y borra las estadísticas que salieron de ella |
| `POST /estadisticas/sincronizar` | JUGADOR | Encola la descarga de las estadísticas desde Riot y responde 202 con el estado (como mucho una vez cada 10 min, contando los intentos fallidos). Además hay ingesta periódica cada 6 h |
| `GET /estadisticas/sincronizacion` | JUGADOR | Estado de la sincronización: en cola (también por mucha demanda), en curso o terminada, con el resultado de la última |
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
- Sin clave, o con una caducada o rechazada por Riot, los endpoints que llaman a
  Riot responden `503 RIOT_NO_DISPONIBLE` («inténtalo más tarde»; el detalle va
  a los registros) y la cola de ingesta se pausa; el resto de la API funciona
  igual. Cualquier otro fallo de Riot responde `502 SERVICIO_EXTERNO`
  (`apps/api/src/integrations/riot/riot.client.ts`).
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
minutos para toda la aplicación (`RIOT_LIMITES`, por defecto `20:1,100:120`).
Una sincronización gasta unas 24 peticiones, así que caben unas cuatro cada dos
minutos. La cuota es **global y vive en Redis**
(`apps/api/src/integrations/riot/cuotaRiot.ts`), con prioridad para vincular y
comprobar el icono (`RIOT_RESERVA_ALTA`, por defecto el 30 % de cada ventana).
Si no hay cupo, la vinculación responde `503 MUCHA_DEMANDA` con la espera y la
sincronización se queda en cola; el porqué está en `docs/decisiones.md`,
«Cuota de Riot e ingesta», y la operación, en `docs/operacion.md`.

### Qué más se puede añadir con esta misma API

Sin cambiar de clave:

- **Maestría de campeones** (`champion-mastery-v4`): puntos y nivel por
  campeón, útil para la dimensión técnica del matching.
- **Línea de tiempo de la partida** (`match-v5 /timeline`): oro y experiencia
  al minuto 10/15, diferencia de CS con el rival de línea, primeras sangres.
- **Desafíos** (`lol-challenges-v1`): logros de Riot como evidencia de
  habilidades.
- **Estado del servidor** (`lol-status-v4`): avisar si Riot tiene incidencias
  cuando falla una sincronización.
- **Comparación por rango**: con el rango que ya se guarda, normalizar las
  métricas frente a jugadores de la misma liga. Hoy la técnica usa escalas fijas
  por posición (`docs/arquitectura.md`, «Escalas fijas de la técnica»).

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
   npm run db:deploy
   npm run db:seed
   ```

   `db:deploy` aplica las migraciones existentes. `db:migrate`
   (`prisma migrate dev`) es sólo para **crear** una migración nueva y tiene sus
   reglas por el índice HNSW (CLAUDE.md §4).

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
| `jugador1@proplay.gg` … `jugador21@proplay.gg` | JUGADOR |

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
puertos, así que el resto de los pasos no cambia. **Usa una cosa o la otra, no las dos:**
Docker y Homebrew escuchan en los mismos puertos (5432 y 6379), y si los dos
están arrancados, `localhost` llega a uno y `docker exec` consulta el otro. Para
volver a Docker: `brew services stop postgresql@17` y `brew services stop redis`
(dejan de arrancar al iniciar sesión) y `lsof -nP -iTCP:5432 -sTCP:LISTEN` para
comprobar que sólo escucha Docker. El `docker-compose.yml` usa
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
| `npm run verify` | Guarda del índice HNSW, lint, typecheck y pruebas: lo mismo que el CI salvo el build. Tiene que pasar antes de empujar |
| `npm run db:deploy` | `prisma migrate deploy`: aplica las migraciones existentes (local, producción y CI) |
| `npm run db:migrate` | `prisma migrate dev`: sólo para **crear** una migración nueva, con las reglas de CLAUDE.md §4 |
| `npm run db:generate` | `prisma generate` (también lo hace el `postinstall`) |
| `npm run db:seed` | Carga los datos de prueba (idempotente) |
| `npm run db:test -w api` | Crea y migra la base de las pruebas (`proplay_test`); `npm test` ya lo hace solo |
| `npm run db:studio` | Abre Prisma Studio |
| `npm run db:reset` | Borra la base, reaplica migraciones y siembra |
| `npm run docker:up` / `docker:down` | Atajos de `docker compose` |
| `npm run check:indice-hnsw -w api` | Falla si una migración borra el índice HNSW sin volver a crearlo |
| `npm run admin:promover -w api -- <correo>` | Promueve a `ADMIN` una cuenta de scout ya registrada ([docs/operacion.md](docs/operacion.md)) |
| `npm run ingesta:estado -w api` | Estado de la cola de ingesta de Riot y de la clave ([docs/operacion.md](docs/operacion.md)) |
| `npm run matching:revectorizar -w api` | Recalcula los vectores de perfil de todos los jugadores |
| `npm run metricas:piloto -w api -- [opciones]` | Exporta en CSV las métricas del piloto para el informe ([docs/operacion.md](docs/operacion.md)) |
| `npm run rnf01 -w api` | Mide RNF-01 sobre una base propia y reescribe [docs/rnf-01.md](docs/rnf-01.md) |

Para un solo workspace: `npm run <script> -w api`, `-w web`,
`-w @proplay/shared`.

---

## Rutas de la API

Todas bajo `/api/v1`. Sacadas de los routers (`apps/api/src/modules/*/*.routes.ts`
y `apps/api/src/app.ts`); «con sesión» es cualquier rol autenticado. La columna RF
es la del comentario de trazabilidad de la ruta o, en las que siguen en `501`, la
de su vista en el inventario de CLAUDE.md §5.

| Método y ruta | Roles | RF | Estado |
| --- | --- | --- | --- |
| `GET /health` | público | — | Postgres, Redis y estado de la clave de Riot |
| `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` | público | RF-01 | Implementado |
| `GET /auth/me` | con sesión | RF-01 | Implementado |
| `GET /usuarios` | ADMIN | — | Implementado |
| `PATCH /usuarios/me` · `PATCH /usuarios/me/contrasena` | con sesión | RF-01 | Implementado |
| `GET /usuarios/:id` | con sesión | — | Implementado |
| `GET /perfiles/me` | con sesión | RF-05 | Implementado |
| `PATCH /perfiles/jugador` | JUGADOR | RF-05, RF-09 | Implementado (incluida la ubicación) |
| `PATCH /perfiles/equipo` | EQUIPO | RF-07 | Implementado (incluida la sede) |
| `GET /perfiles/:id` | público (sesión opcional) | RF-05 | Implementado: perfil público |
| `GET /perfiles/cuentas-gaming` | JUGADOR | RF-02, RF-03 | Implementado |
| `POST /perfiles/cuentas-gaming/riot` · `GET`, `DELETE /perfiles/cuentas-gaming/riot/desafio` · `POST …/riot/desafio/regenerar` · `POST …/riot/verificar` | JUGADOR | RF-02 | Implementado: vinculación por icono |
| `DELETE /perfiles/cuentas-gaming/:plataforma` | JUGADOR | RF-02 | Implementado |
| `POST /perfiles/cuentas-gaming` | JUGADOR | RF-02 | **501**: vinculación por OAuth (necesita RSO) |
| `GET`, `POST /perfiles/habilidades` · `POST /perfiles/endorsements` | con sesión / JUGADOR | RF-06 | **501** |
| `POST /estadisticas/sincronizar` · `GET /estadisticas/sincronizacion` | JUGADOR | RF-03 | Implementado (cola de ingesta) |
| `GET /estadisticas/jugador/:id` · `GET /estadisticas/jugador/:id/resumen` | con sesión | RF-04, RF-13 | Implementado |
| `GET /scouting/jugadores` | EQUIPO, SCOUT, ADMIN | RF-08 | Implementado |
| `GET /scouting/jugadores/:id` · `GET`, `POST /scouting/busquedas` | EQUIPO, SCOUT (y ADMIN la ficha) | RF-08 | **501** |
| `GET /ofertas` · `GET /ofertas/:id` | con sesión | RF-07 | Implementado |
| `GET /ofertas/me` · `POST /ofertas` · `PATCH /ofertas/:id` · `PATCH /ofertas/:id/estado` | EQUIPO | RF-07 | Implementado |
| `POST /ofertas/:id/postulaciones` · `GET /ofertas/postulaciones/me` | JUGADOR | RF-10 | Implementado |
| `GET /ofertas/:id/postulaciones` | EQUIPO, SCOUT, ADMIN | RF-10 | Implementado |
| `PATCH /ofertas/postulaciones/:id` | EQUIPO | RF-10 | Implementado |
| `GET /matching/ofertas/:id/ranking` · `GET /matching/ofertas/:id/candidatos/:jugadorId` | EQUIPO, SCOUT, ADMIN | RF-09, RF-11 | Implementado |
| `POST /matching/ofertas/:id/recalcular` | EQUIPO, SCOUT | RF-09 | Implementado |
| `GET /matching/jugador/me` | JUGADOR | RF-09 | Implementado |
| `GET /analitica/embudo` · `GET /analitica/ofertas/:id/embudo` · `GET /analitica/ofertas/:id/dimension-decisiva` | EQUIPO | RF-13 | Implementado |
| `GET /analitica/talento` | EQUIPO, SCOUT, ADMIN | RF-13 | Implementado |
| `GET /explicaciones/ofertas/:id/candidatos/:jugadorId` | EQUIPO, SCOUT, ADMIN | RF-11 | Implementado (sin clave del proveedor responde `NO_DISPONIBLE`) |
| `GET`, `POST /mensajeria/conversaciones` · `GET`, `POST /mensajeria/conversaciones/:id/mensajes` | con sesión | RF-12 | **501** (trabajo futuro) |
| `GET /notificaciones` · `GET /notificaciones/contador` · `POST /notificaciones/leidas` | con sesión | RF-12 | **501** (trabajo futuro) |
| `GET /admin/metricas` · `GET /admin/auditoria` · `POST /admin/usuarios/rol` · `POST /admin/usuarios/suspender` | ADMIN | RF-14 | **501** (trabajo futuro; las operaciones van por scripts) |

---

## Variables de entorno

La API las valida con Zod al arrancar (`apps/api/src/config/env.ts`) y no arranca si
falta una obligatoria. El cliente lee las suyas en `apps/web/src/lib/env.ts`. Los
`.env.example` de cada app llevan un comentario por variable.

### API (`apps/api/.env`)

| Variable | Obligatoria | Por defecto | Para qué |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `development`, `test` o `production` |
| `PORT` | no | `3000` | Puerto HTTP |
| `DATABASE_URL` | **sí** | — | PostgreSQL con pgvector |
| `REDIS_URL` | **sí** | — | Redis: cuota de Riot, desafíos de vinculación y cola de ingesta |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | **sí** | — | Firmas de los tokens; al menos 32 caracteres y distintos |
| `ENCRYPTION_KEY` | **sí** | — | Clave AES-256-GCM (64 caracteres hexadecimales) para los tokens de las cuentas de juego |
| `CORS_ORIGIN` | no | `http://localhost:5173` | Origen (o lista) autorizado |
| `TRUST_PROXY` | **en producción** | sin proxy | Proxies delante de la API (ver «Despliegue») |
| `RIOT_API_KEY` | no | — | Clave de la API de Riot; sin ella, lo de Riot responde `503 RIOT_NO_DISPONIBLE` |
| `RIOT_LIMITES` | no | `20:1,100:120` | Ventanas de cuota de la clave, `límite:segundos` |
| `RIOT_RESERVA_ALTA` | no | `30` | Porcentaje de cada ventana reservado a la vinculación |
| `INGESTA_ACTIVA` | no | `true` (`false` en pruebas) | Arranca el worker y el planificador de la ingesta en el proceso de la API |
| `INGESTA_INTERVALO_HORAS` | no | `6` | Horas entre dos sincronizaciones periódicas del mismo jugador |
| `ANTHROPIC_API_KEY` | no | — | Clave del explicador con modelo de lenguaje (RF-11). Sólo del servidor: nunca en `VITE_*`. Sin ella, el explicador queda desactivado y el detalle del candidato muestra la explicación determinista |
| `EXPLICADOR_ACTIVO` | no | `true` (`false` en las pruebas) | Apaga el explicador sin quitar la clave |
| `EXPLICADOR_MODELO` | no | `claude-haiku-5-5` | Modelo que redacta la explicación |
| `EXPLICADOR_TIMEOUT_MS` | no | `4000` | Tiempo máximo de una generación; pasado, se degrada a la explicación determinista |
| `EXPLICADOR_LIMITE_USUARIO_HORA` | no | `30` | Generaciones nuevas por usuario y hora (la caché no cuenta) |
| `EXPLICADOR_LIMITE_DIARIO` | no | `300` | Tope diario de generaciones nuevas para toda la aplicación |
| `LOG_LEVEL` | no | `info` | Nivel de log de pino |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | no | — | Cliente de Cloudinary (`integrations/cloudinary`); ningún endpoint lo usa todavía |
| `STEAM_API_KEY`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | no | — | Declaradas para integraciones que son trabajo futuro (decisión 0.3: el piloto es sólo League of Legends); sus proveedores responden `501` |

### Cliente (`apps/web/.env`)

| Variable | Obligatoria | Para qué |
| --- | --- | --- |
| `VITE_API_URL` | **sí** | URL base de la API con `/api/v1`, sin barra final. Es pública: va en el bundle |
| `VITE_DEMO_DATA` | no | `true` enciende el puente de datos de demostración de las vistas aún simuladas; cualquier otro valor, sólo datos reales |

El `.env` de la raíz sólo tiene las variables del contenedor de Postgres
(`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`) que usa `docker-compose.yml`.

---

## Pruebas

```bash
npm test
```

Las de la API son sobre todo de **integración**: levantan la app Express real
y hablan con Postgres y Redis, así que los dos tienen que estar arriba; las
funciones puras (fórmulas del motor, métricas de la analítica) se prueban
además con cifras exactas. Las del cliente usan Vitest y Testing Library con un
doble del cliente HTTP. `npm run verify` las ejecuta todas.

Las pruebas de la API **nunca corren contra la base de desarrollo**: usan una
base propia en el mismo servidor, con el nombre de la de `DATABASE_URL` y el
sufijo `_test` (`proplay` → `proplay_test`, la misma que en CI). `npm test` la
crea si no existe y le aplica las migraciones pendientes antes de la primera
prueba (`apps/api/scripts/base-pruebas.ts`); para prepararla sin ejecutar
pruebas, `npm run db:test -w api`. Si la base a la que apuntan no termina en
`_test`, las pruebas se detienen antes de abrir una conexión.

Crean usuarios con correos aleatorios prefijados con `test-integracion` y los
borran al terminar. La base de pruebas no lleva los datos del seed.

---

## Despliegue

Cada app se despliega por separado aunque vivan en el mismo repositorio.

### API en Railway o Render (Docker)

> **Aún no se ha desplegado nunca** (tarea 2.13 del plan). El worker y el
> planificador de la ingesta de Riot corren **dentro del proceso de la API**
> (`apps/api/src/server.ts`, `INGESTA_ACTIVA`): en un plan que suspenda el
> servicio por inactividad, la sincronización periódica se detiene mientras
> duerme. Hace falta además un Postgres gestionado con la extensión `pgvector`
> y un Redis.

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
`CORS_ORIGIN` (el dominio de Vercel), `NODE_ENV=production`, `TRUST_PROXY` y
`RIOT_API_KEY` (ver «Integración con la API de Riot Games»); con una clave de
producción, también `RIOT_LIMITES`. La lista completa está en
[Variables de entorno](#variables-de-entorno).

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

`.github/workflows/ci.yml` corre en cada pull request contra `main` y en cada
push a `main`. Levanta Postgres (con pgvector) y Redis como *services*, instala
desde la raíz y ejecuta la guarda del índice HNSW, `db:deploy`, `lint`,
`typecheck`, `test` y `build`. Un pull request apilado sobre otra rama no lo
dispara hasta que se reapunta a `main`.

---

## Seguridad

- Ningún secreto en el repositorio: un `.env.example` por app, con un
  comentario por variable.
- `apps/api/src/config/env.ts` valida el entorno con Zod al arrancar y falla
  rápido si falta algo.
- Contraseñas con bcrypt (12 rondas). Access token de 15 minutos en memoria del
  cliente; refresh token de 7 días en cookie `httpOnly`.
- Los tokens de las cuentas gaming se guardarían cifrados con AES-256-GCM
  (`apps/api/src/utils/crypto.ts`, `ENCRYPTION_KEY`; RNF-03). **Hoy no se guarda
  ninguno**: la vinculación con Riot es por icono, sin OAuth, y
  `CuentaGaming.accessToken` y `refreshToken` quedan nulos
  (`docs/decisiones.md`, «Integración con Riot»).
- `helmet`, CORS por lista blanca y límites de peticiones: global (300 cada 15
  minutos), `/auth` (10 cada 15 minutos) y propios del refresco, el cambio de
  contraseña, el perfil público, el buscador, el ranking, el recálculo y la
  vinculación con Riot (`apps/api/src/middleware/rateLimit.ts`).
- Manejador de errores central: siempre `{ error: { code, message, details? } }`
  y nunca stack traces en producción.

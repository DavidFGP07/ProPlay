# CLAUDE.md — convenciones de ProPlay

Guía para cualquier sesión de trabajo sobre este repositorio. Si algo de aquí choca con lo
que parece "lo normal", manda esto.

---

## 1. Qué es

Red profesional para el **scouting de talento en eSports** (proyecto de grado, Universidad
del Norte). Resuelve un problema de asimetría de información: hoy los equipos evalúan
jugadores con estadísticas autodeclaradas que nadie verifica.

Dos decisiones definen el producto y no se negocian:

1. **Verificabilidad.** El perfil de un jugador no se construye con lo que declara, sino
   con datos traídos de la API del juego tras vincular su cuenta por OAuth 2.0.
2. **Matching algorítmico.** La plataforma calcula un puntaje de compatibilidad sobre cinco
   dimensiones y devuelve un ranking explicable, no un tablón que el equipo filtra a mano.

Si una decisión técnica contradice alguna de las dos, está mal.

El diseño completo está en el documento del proyecto, `docs/ProPlay.pdf` (versión vigente:
v5; el nombre del archivo es fijo y las versiones quedan en el historial de git). Secciones
útiles: **VII** requisitos (Tablas III y IV: RF-01…RF-14, RNF-01…RNF-08), **VIII**
arquitectura C4 y fórmula del puntaje (ecuación 1), **IX** modelo entidad-relación, **XIII**
plan de sprints. El plan de trabajo por bloques está en `docs/plan-implementacion.md`. Cuando el código y el documento no coincidan,
manda el documento, salvo que haya una entrada en `docs/decisiones.md` que lo justifique.

## 2. Estructura

Monorepo con npm workspaces: monolito modular Express en el servidor, cliente React
desacoplado y un paquete compartido con el contrato entre ambos.

```
apps/api          API REST Express + Prisma  (workspace "api")
apps/web          Cliente React + Vite       (workspace "web")
packages/shared   Contrato                   (workspace "@proplay/shared")
```

Un `npm install` en la raíz deja los tres listos. Nunca instales dependencias entrando en
la carpeta de un workspace: usa `npm install <paquete> -w api`.

```bash
docker compose up -d        # Postgres 16 + pgvector, Redis 7
npm install                 # desde la raíz
npm run db:deploy           # aplica las migraciones existentes
npm run db:seed             # cuentas de prueba (contraseña ProPlay123)
npm run dev                 # API en :3000, cliente en :5173
npm run verify              # guarda del índice HNSW, lint, typecheck y pruebas
```

- `db:deploy` aplica migraciones; `db:migrate` (`prisma migrate dev`) es sólo para **crear**
  una migración nueva y tiene sus reglas en §4. Nunca lo uses para ponerte al día.
- El cliente de Prisma de `node_modules` es compartido por todas las ramas. Al cambiar a una
  rama con otro `schema.prisma`, ejecuta `npm run db:generate` y `npm run db:deploy`; si
  no, la API falla con `P2022` (pide columnas que tu base no tiene).

---

## 3. Reglas que no se negocian

### 3.1 Todo contrato entre cliente y servidor pasa por `@proplay/shared`

Esquemas Zod de request y response, tipos inferidos, enums del dominio y constantes de
negocio se definen **una sola vez** en `packages/shared/src`.

- El backend los usa en el middleware `validate(schema)`.
- El frontend los usa en `react-hook-form` (`zodResolver`) y para tipar las respuestas de
  TanStack Query.
- Prohibido duplicar un enum, un tipo o una regla de validación en `apps/api` o `apps/web`.
  Si lo necesitan los dos lados, va en `shared`.
- Los enums de `packages/shared/src/enums.ts` deben coincidir **exactamente** con los de
  `apps/api/prisma/schema.prisma`. Si cambias uno, cambia el otro **en el mismo commit**.

### 3.2 Controller → service → repository

Cada módulo de negocio en `apps/api/src/modules/<nombre>/` tiene siempre estos cinco
archivos, sin excepciones:

```
<nombre>.routes.ts       define el router de Express y monta los middlewares
<nombre>.controller.ts   sólo req/res: nada de lógica
<nombre>.service.ts      lógica de negocio
<nombre>.repository.ts   ÚNICO punto de acceso a Prisma del módulo
<nombre>.schema.ts       re-exporta los esquemas de @proplay/shared del módulo
```

- Un controlador **nunca** importa `prisma`. Pasa por el service.
- Un service **nunca** importa `prisma`. Pasa por el repository.
- `apps/api/src/config/prisma.ts` sólo se importa desde archivos `*.repository.ts` (y desde
  `config/health.ts` para el ping).

### 3.3 Dependencias entre módulos

Las dependencias forman un grafo **sin ciclos**. `usuarios` no depende de nadie.
`notificaciones` nunca se invoca directamente: los demás publican un evento y él lo
consume. `admin` sólo lee.

```
usuarios → perfiles → estadisticas → matching → scouting
                      ofertas      → matching
                      (todos)      → evento → notificaciones
```

Si necesitas que un módulo llame a otro que está por encima suyo en ese orden, la
responsabilidad está mal ubicada. Dilo antes de crear el ciclo.

### 3.4 Idioma de los identificadores

- **Español**: entidades y campos del modelo de datos (así están en el documento), nombres
  de módulos, funciones y variables de dominio (`registrar`, `calcularCompatibilidad`,
  `perfilJugador`), comentarios y documentación.
- **Inglés**: nombres técnicos ya establecidos por las herramientas (`middleware`,
  `router`, `schema`, `handler`, `accessToken`, `build`).
- Rutas HTTP en español y en plural: `/api/v1/ofertas`, `/api/v1/perfiles`. Las de
  autenticación son `/api/v1/auth/...`.

### 3.5 Errores y respuestas

- Toda la API responde errores con la misma forma: `{ error: { code, message, details? } }`.
  La produce `middleware/errorHandler.ts`; no armes respuestas de error a mano.
- Lanza los errores de `utils/errors.ts` (`NotFoundError`, `ForbiddenError`,
  `ConflictError`, `NotImplementedError`...). No hagas `res.status(500).json(...)`.
- Todo handler asíncrono va envuelto en `asyncHandler`.

### 3.6 Trazabilidad

Cada endpoint y cada vista lleva el identificador del requisito que realiza:

```ts
// RF-09 · Ranking de candidatos con puntaje de compatibilidad
```

No es decoración: es con lo que se verifica qué parte del diseño está implementada.

---

## 4. Modelo de datos

`Usuario` · `PerfilJugador` · `PerfilEquipo` · `CuentaGaming` · `Estadistica` ·
`PerfilVector` · `Habilidad` · `HabilidadJugador` · `Endorsement` · `Oferta` ·
`Postulacion` · `Matching` · `Mensaje` · `Notificacion` · `AuditLog`

Tres puntos que es fácil romper:

1. **`PerfilVector` es una entidad propia**, 1:1 con `PerfilJugador`, con
   `embedding vector(64)`, `version` y `calculadoEn`. Separarla permite recalcular los
   vectores al cambiar la versión del modelo sin tocar el perfil.
2. **El índice HNSW sobre `PerfilVector.embedding` es obligatorio**, no opcional. Sin él no
   se cumple RNF-01 (percentil 95 por debajo de 2 s). Es
   `"PerfilVector_embedding_hnsw_idx"` (`vector_cosine_ops`, para consultas con `<=>`) y
   vive en la migración manual `20261027153113_indice_hnsw_perfil_vector`.

   **Prisma no lo conoce y lo borra si te descuidas.** Prisma no modela índices HNSW (ni
   siquiera admite declararlos en `schema.prisma`), así que lo ve como deriva: toda
   migración nueva que generes incluirá `DROP INDEX "PerfilVector_embedding_hnsw_idx";`.
   Para cambiar el esquema:
   - Genera siempre con `npx prisma migrate dev --create-only --name <nombre>`, nunca con
     `migrate dev` a secas (ese aplica la migración y borra el índice en tu base al momento).
   - Abre el `migration.sql` generado y **elimina el `DROP INDEX` del índice HNSW** antes de
     aplicarla con `npm run db:migrate` y de commitearla.
   - No uses `prisma db push`: borra el índice sin dejar migración.
   - Lo vigila `npm run check:indice-hnsw -w api`, dentro de `npm run verify` y del CI:
     falla si una migración contiene ese `DROP INDEX`, salvo que el mismo archivo vuelva a
     crear el índice con `USING hnsw` después del borrado. La prueba
     `apps/api/tests/indice-hnsw.test.ts` confirma que el índice existe tras migrar, y
     `apps/api/tests/guarda-indice-hnsw.test.ts` prueba la propia guarda (excepción
     incluida) con migraciones escritas en un directorio temporal.
3. **Los tokens de `CuentaGaming` se guardan cifrados** con AES-256-GCM usando
   `ENCRYPTION_KEY`. Nunca en claro. Es RNF-03.

---

## 5. Inventario de vistas

Lo que el producto debe llegar a tener. **No inventes vistas que no estén aquí**; si crees
que falta una, dilo y la añadimos. Las rutas marcadas `—` todavía no existen.

> **No construyas vistas marcadas como Futuro sin acordarlo.**

> Mantener actualizada la columna "ruta actual" es parte del trabajo: cuando implementes o
> renombres una vista, actualiza esta tabla en el mismo commit.

La columna **Alcance** recoge el recorte de la tesis a 19 vistas (tarea 0.10; la decisión
está en `docs/decisiones.md`, «Recorte de alcance»):

- **Núcleo** (13): lo necesario para demostrar la verificabilidad y el matching explicable, y
  para ejecutar y medir el piloto (H1 y H2).
- **Soporte** (6): versión mínima, con el límite que indica la fila.
- **Futuro**: fuera de la tesis. Las recuperables llevan su orden de recuperación (1.º a
  3.º) si sobra tiempo; las demás están descartadas.

### Públicas

| Vista | Ruta actual | RF | Alcance |
|---|---|---|---|
| Ingreso y registro (misma pantalla, dos modos) | `/login` | RF-01 | Núcleo |
| Recuperar y restablecer contraseña | — | RF-01 | Futuro (1.º en recuperarse) |
| Verificación de correo | — | RF-01 | Futuro (descartada) |
| Perfil público del jugador (compartible, sin sesión) | `/jugador/:id` | RF-05 | Núcleo |
| Perfil público de la organización | — | RF-07 | Futuro (3.º en recuperarse) |
| Aviso de privacidad y términos (Ley 1581) | `/legal/privacidad` (`#privacidad`, `#terminos`) | RNF-05 | Núcleo |
| 404 | `*` (cualquier ruta desconocida) | — | Núcleo |

### Jugador

| Vista | Ruta actual | RF | Alcance |
|---|---|---|---|
| Feed | `/` | RF-08 | Futuro (descartada) |
| Mi perfil (cabecera y datos profesionales reales; el resto, simulado) | `/mi-perfil` | RF-05 | Núcleo |
| Cuentas vinculadas (estado, última sincronización) | — | RF-02, RF-03 | Núcleo. Absorbe el contenido del onboarding |
| Mis estadísticas (incluye la tendencia del rendimiento, uno de los indicadores de la analítica) | — | RF-04, RF-13 | Núcleo |
| Habilidades y endorsements | — | RF-06 | Soporte: catálogo fijo; endorsements sólo de equipos |
| Explorar oportunidades | `/vacantes` | RF-07, RF-09 | Núcleo |
| Detalle de la oferta y postulación | `/vacantes/:id` | RF-07, RF-10 | Núcleo |
| Mis postulaciones | — | RF-10 | Soporte: pestaña de Mi perfil, sin vista propia |
| Mensajes | `/mensajes` | RF-12 | Futuro (2.º en recuperarse) |
| Ajustes de cuenta y privacidad (común a los cuatro roles; hoy nombre y contraseña) | `/cuenta` | RF-01, RNF-05 | Soporte, y cuenta como dos de las 19: Mi cuenta, y Ajustes de privacidad sólo de visibilidad (perfil público sí/no y mostrar ubicación) |
| Onboarding | — | RF-02, RF-05 | Futuro (descartada): su contenido vive en Cuentas vinculadas y en el aviso de ubicación de Mi perfil |

### Equipo y scout

El scout ve lo mismo que el equipo **salvo** crear, editar y cerrar ofertas y cambiar el
estado de una postulación. El menú se arma desde el rol, no con condicionales sueltos
dentro de cada vista.

| Vista | Ruta actual | RF | Alcance |
|---|---|---|---|
| Panel del equipo (datos de la organización reales; el resto, simulado) | `/panel-equipo` | RF-13, RF-07 | Núcleo: se fusiona con Analítica en una sola vista |
| Buscador de talento | `/explorar` | RF-08 | Soporte: filtros por rol, rango y departamento |
| Crear oferta, **con ajuste de los pesos de las cinco dimensiones** | — | RF-07, RF-09 | Núcleo |
| **Ranking de candidatos con desglose por dimensión** | — | RF-09 | Núcleo |
| Detalle del candidato con la explicación del matching | — | RF-09, RF-11 | Núcleo |
| Comparador de candidatos | — | RF-09 | Futuro (descartada) |
| Postulaciones recibidas | — | RF-10 | Soporte: dentro del detalle de la oferta, sin vista propia |
| Lista de seguimiento | — | RF-08 | Futuro (descartada) |
| Analítica (`/dashboard` es hoy la versión simulada) | `/dashboard` | RF-13 | Núcleo, fusionada con el panel del equipo. Indicadores: embudo de la vacante con tiempo hasta cubrirla (mide H1), dimensión que decide el ranking y mapa del talento verificado por macrorregión, rol y rango (el Caribe frente al resto); el cuarto, la tendencia del jugador, vive en Mis estadísticas |

### Administrador

| Vista | Ruta actual | RF | Alcance |
|---|---|---|---|
| Panel de administración | `/admin` | RF-13 | Futuro (descartada): las operaciones van por scripts documentados en `docs/operacion.md` |
| Usuarios, contenido, catálogo de habilidades, auditoría, integraciones | — | RF-01, RF-06, RF-14, RF-03 | Futuro (descartada), igual que el panel |

### Estados transversales

Toda vista que cargue datos implementa cuatro estados: **cargando** (esqueleto, no spinner
a pantalla completa), **vacío** (con acción sugerida, nunca una tabla en blanco), **error**
(con reintento) y **sin permiso** (403). Son componentes compartidos; no se reescriben por
vista.

---

## 6. Estilo

- TypeScript en modo `strict` en los tres workspaces. Nada de `@ts-ignore`.
- `npm run verify` tiene que pasar antes de empujar: guarda del índice HNSW, lint,
  typecheck y pruebas de los tres workspaces. Es lo mismo que comprueba el CI.
- **Tailwind 4**, con los tokens declarados en `@theme` dentro de `index.css`. La paleta es
  `brand`, `accent` y `surface`. No metas colores en clases arbitrarias ni valores
  hexadecimales sueltos en el JSX.
- Tema oscuro. No construyas tema claro en esta etapa.
- Componentes de UI reutilizables en `apps/web/src/components/ui`; si necesitas un botón o
  un input, usa los que ya están. No instales librerías de componentes.
- **Recharts** para gráficas. Una sola librería de gráficos en todo el proyecto.
- Ningún texto visible embebido en el JSX: van a `src/i18n/es.ts`. El documento contempla
  multilenguaje y recogerlo después sale caro.
- Accesibilidad: contraste WCAG 2.1 AA, foco visible, navegación completa por teclado,
  etiquetas asociadas a cada campo.
- Responsivo verificado a 375 px y a 1440 px (RNF-08).
- TanStack Query para todo dato de servidor. El estado de React es sólo para interfaz
  (pestaña activa, modal abierto).
- Nombres de archivo: `PascalCase.tsx` para componentes React, `camelCase.ts` para el resto.

---

## 7. Commits

Convencionales, con el workspace como ámbito:

```
feat(api): endpoints de ofertas y postulaciones
feat(web): formulario de creación de oferta
feat(shared): esquemas del módulo de matching
fix(api): validar el estado de la oferta antes de postular
chore(repo): actualizar dependencias
docs(readme): añadir configuración de Vercel
```

Un commit por bloque de trabajo coherente.

Tras fusionar un PR, borra su rama en local y en el remoto. Antes, reapunta a `main` los PR
que la usen como base.

---

## 8. Qué NO hacer

- No añadir Nx, Turborepo ni cambiar a pnpm: el proyecto usa npm workspaces a propósito.
- No convertir el monolito en microservicios. Los módulos se separan por carpetas.
- No duplicar esquemas, tipos ni enums entre `api` y `web`.
- No tocar Prisma fuera de un `*.repository.ts`.
- No escribir URLs de API a mano en el frontend: usa `VITE_API_URL` a través de
  `src/lib/env.ts` y el cliente de `src/api/client.ts`.
- No poner secretos en variables `VITE_*`: se empaquetan en el bundle y son públicas.
- **No guardar el access token en `localStorage`**: vive en memoria y la sesión se sostiene
  con la cookie `httpOnly` del refresh token.
- No mezclar datos simulados dentro de un componente. Viven aislados en `src/mocks/`, detrás
  de un hook de `src/api/` con la firma que tendrá la llamada real.
- No usar datos simulados en una vista que ya tenga su endpoint real.
- No silenciar errores de tipos heredados. Repórtalos y acordamos qué hacer.
- No commitear `.env`, `dist/` ni `node_modules/`. **El `CLAUDE.md` sí se versiona.**
- No implementar funcionalidades que nadie pidió: si el endpoint es andamiaje, déjalo en
  `501` hasta que toque.
- No inventar migraciones a mano salvo para lo que Prisma no modela (la columna `vector(64)`
  de pgvector); para el resto, `prisma migrate dev`.
- No cambiar la estructura de carpetas ni el stack sin pedirlo antes.
- Si algo del documento te parece equivocado, dilo antes de desviarte.

---

## 9. Estado actual

**Backend.** El módulo `usuarios` está implementado; de `perfiles`, sólo `GET /perfiles/me`,
`PATCH /perfiles/jugador`, `PATCH /perfiles/equipo` y `GET /perfiles/:id` (perfil público, sin sesión). Los demás endpoints de `perfiles` y los otros módulos (`estadisticas`,
`scouting`, `matching`, `ofertas`, `mensajeria`, `notificaciones`, `admin`) tienen los cinco archivos, las rutas registradas y handlers que devuelven `501` con un
`// TODO:` describiendo qué debe hacer el endpoint. Al implementar uno, quita el TODO y
sustituye el stub del repository por Prisma real: **no cambies la estructura de archivos**.

> Divergencia conocida con el documento: éste describe un módulo "usuarios y perfiles" y
> trata las integraciones como módulo de negocio. El código los tiene como `usuarios` +
> `perfiles` separados y las integraciones como capa de infraestructura. Se mantiene el
> código tal cual; la correspondencia queda anotada en `docs/decisiones.md`.

**Frontend.** El cliente proviene del prototipo de la rama `Fronted`, integrado en
`apps/web`. Su capa de datos es una simulación en memoria aislada en `src/mocks/` detrás de
hooks de TanStack Query. Cada hook simulado lleva `// TODO: Sx — conectar con GET /api/v1/...`
indicando el sprint que lo conecta. Hablan ya con la API real la autenticación, `/cuenta`
(nombre y contraseña), el registro con su aceptación, el perfil público `/jugador/:id` (sin
sesión), en `/mi-perfil` la cabecera y los datos profesionales, y en `/panel-equipo` la
tarjeta «Datos de la organización» (sólo el rol `EQUIPO`); `/legal/privacidad` es texto
estático. El resto de `/mi-perfil` (cuentas, habilidades, portafolio, postulaciones,
privacidad y laterales) y de `/panel-equipo` (indicadores, vacantes, procesos y
recomendaciones) sigue simulado, con `MarcaDatosDemo` en cada sección.

El **puente de datos de demostración** (`VITE_DEMO_DATA=true` en `apps/web/.env`) alimenta
las vistas simuladas: la sesión real se hace pasar por una persona de ejemplo de su mismo
rol (`src/mocks/persona.ts`) y el `Layout` lo avisa con «Datos de demostración». Con la
bandera apagada sólo se ve lo real. Al conectar una vista de verdad, retira su hook del
puente y añade su ruta (un patrón de React Router) a `RUTAS_SIN_DATOS_DEMO` en `src/router/areas.ts`.
Si la vista queda mixta, entra igual en esa lista y cada sección simulada lleva
`MarcaDatosDemo` (`src/components/AvisoDatosDemo.tsx`).

**Integración continua.** El CI de GitHub corre en cada pull request y en `main` lo mismo
que `npm run verify` más el build, contra un Postgres y un Redis limpios. Un PR no se
fusiona con el CI en rojo.

**Plan.** Cuatro sprints de dos semanas. S1 fundación y acceso · S2 perfil verificable
(ingesta desde Riot, solo League of Legends) · S3 motor de matching · S4 IA generativa, cierre y validación.

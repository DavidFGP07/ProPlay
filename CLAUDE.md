# CLAUDE.md — convenciones de ProPlay

Guía para cualquier sesión de trabajo sobre este repositorio. Si algo de aquí
choca con lo que parece "lo normal", manda esto.

## Qué es

Red profesional para el scouting de talento en eSports. Monorepo con npm
workspaces: monolito modular Express en el servidor, cliente React desacoplado
y un paquete compartido con el contrato entre ambos.

```
apps/api          API REST Express + Prisma  (workspace "api")
apps/web          Cliente React + Vite       (workspace "web")
packages/shared   Contrato                   (workspace "@proplay/shared")
```

Un `npm install` en la raíz deja los tres listos. Nunca instales dependencias
entrando en la carpeta de un workspace: usa `npm install <paquete> -w api`.

## Reglas que no se negocian

### 1. Todo contrato entre cliente y servidor pasa por `@proplay/shared`

Esquemas Zod de request y response, tipos inferidos, enums del dominio y
constantes de negocio se definen **una sola vez** en `packages/shared/src`.

- El backend los usa en el middleware `validate(schema)`.
- El frontend los usa en `react-hook-form` (`zodResolver`) y para tipar las
  respuestas de TanStack Query.
- Prohibido duplicar un enum, un tipo o una regla de validación en `apps/api`
  o `apps/web`. Si lo necesitan los dos lados, va en `shared`.
- Los enums de `packages/shared/src/enums.ts` deben coincidir **exactamente**
  con los de `apps/api/prisma/schema.prisma`. Si cambias uno, cambia el otro en
  el mismo commit.

### 2. Controller → service → repository

Cada módulo de negocio en `apps/api/src/modules/<nombre>/` tiene siempre estos
cinco archivos, sin excepciones:

```
<nombre>.routes.ts       define el router de Express y monta los middlewares
<nombre>.controller.ts   sólo req/res: nada de lógica
<nombre>.service.ts      lógica de negocio
<nombre>.repository.ts   ÚNICO punto de acceso a Prisma del módulo
<nombre>.schema.ts       re-exporta los esquemas de @proplay/shared del módulo
```

- Un controlador **nunca** importa `prisma`. Pasa por el service.
- Un service **nunca** importa `prisma`. Pasa por el repository.
- `apps/api/src/config/prisma.ts` sólo se importa desde archivos
  `*.repository.ts` (y desde `config/health.ts` para el ping).

### 3. Idioma de los identificadores

- **Español**: entidades y campos del modelo de datos (así están en el
  documento del proyecto), nombres de módulos, funciones y variables de dominio
  (`registrar`, `calcularCompatibilidad`, `perfilJugador`), comentarios y
  documentación.
- **Inglés**: nombres técnicos ya establecidos por las herramientas
  (`middleware`, `router`, `schema`, `handler`, `accessToken`, `build`).
- Rutas HTTP en español y en plural: `/api/v1/ofertas`, `/api/v1/perfiles`.
  Las de autenticación son `/api/v1/auth/...`.

### 4. Errores y respuestas

- Toda la API responde errores con la misma forma:
  `{ error: { code, message, details? } }`. La produce
  `middleware/errorHandler.ts`; no armes respuestas de error a mano.
- Lanza los errores de `utils/errors.ts` (`NotFoundError`, `ForbiddenError`,
  `ConflictError`, `NotImplementedError`...). No hagas `res.status(500).json(...)`.
- Todo handler asíncrono va envuelto en `asyncHandler`.

### 5. Estado del andamiaje

Sólo el módulo `usuarios` está implementado. Los demás (`perfiles`,
`estadisticas`, `scouting`, `matching`, `ofertas`, `mensajeria`,
`notificaciones`, `admin`) tienen los cinco archivos, las rutas registradas y
handlers que devuelven `501` con un comentario `// TODO:` describiendo qué debe
hacer el endpoint. Al implementar uno, quita el TODO y sustituye el stub del
repository por Prisma real: no cambies la estructura de archivos.

En el frontend, las páginas de esas features son maquetas con datos de ejemplo
y un comentario `// TODO: conectar con GET /api/v1/...`.

## Estilo

- TypeScript en modo `strict` en los tres workspaces. Nada de `@ts-ignore`.
- `npm run lint` y `npm run typecheck` tienen que pasar antes de commitear.
- Tailwind con la paleta de marca de `apps/web/tailwind.config.ts`
  (`primario`, `secundario`, `fondo`). No metas colores en clases arbitrarias.
- Componentes de UI reutilizables en `apps/web/src/components/ui`; si necesitas
  un botón o un input, usa los que ya están.
- Nombres de archivo: `PascalCase.tsx` para componentes React, `camelCase.ts`
  para el resto.

## Commits

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

## Qué NO hacer

- No añadir Nx, Turborepo ni cambiar a pnpm: el proyecto usa npm workspaces a
  propósito.
- No convertir el monolito en microservicios. Los nueve módulos se separan por
  carpetas, no por servicios.
- No duplicar esquemas, tipos ni enums entre `api` y `web`.
- No tocar Prisma fuera de un `*.repository.ts`.
- No escribir URLs de API a mano en el frontend: usa `VITE_API_URL` a través de
  `src/lib/env.ts` y el cliente de `src/api/client.ts`.
- No poner secretos en variables `VITE_*`: se empaquetan en el bundle y son
  públicas.
- No guardar el access token en `localStorage`: vive en memoria y la sesión se
  sostiene con la cookie `httpOnly` del refresh token.
- No commitear `.env`, `dist/` ni `node_modules/`.
- No implementar funcionalidades que nadie pidió: si el endpoint es andamiaje,
  déjalo en `501` hasta que toque.
- No inventar migraciones a mano salvo para lo que Prisma no modela (como la
  columna `vector(64)` de pgvector); para el resto, `prisma migrate dev`.

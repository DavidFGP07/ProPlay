# Registro de decisiones técnicas

Una línea de justificación por decisión. Las que venían dadas por el documento
del proyecto se anotan igual, para que el registro esté completo.

## Estructura y herramientas

| Decisión | Justificación |
| --- | --- |
| Monorepo con **npm workspaces**, sin Nx ni Turborepo | Tres paquetes y un solo equipo: el orquestador extra añade configuración sin resolver nada todavía. |
| Monolito modular en lugar de microservicios | El acoplamiento entre módulos (matching necesita perfiles, estadísticas y ofertas) es alto y el tráfico esperado bajo. |
| Nombres de workspace `api`, `web` y `@proplay/shared` | `npm run build -w web` es el comando que pide Vercel; el paquete compartido va con ámbito para que se distinga de una dependencia externa. |
| `concurrently` para el `dev` de la raíz | Es la forma más simple de tener los dos procesos con prefijos de color en una sola terminal. |
| ESLint 9 con *flat config*: una base en la raíz que cada workspace extiende | Una sola lista de reglas, pero cada workspace mantiene su `eslint .` independiente. |
| Prettier no se añade | ESLint más `.editorconfig` cubren lo necesario; un formateador más significa otra configuración que mantener sincronizada. |

## Paquete compartido

| Decisión | Justificación |
| --- | --- |
| Los enums del dominio se declaran como tuplas `as const` y de ahí se derivan el tipo, el objeto de valores y el esquema Zod | Un solo sitio donde añadir un valor nuevo, sin listas paralelas que se desincronicen. |
| El frontend resuelve `@proplay/shared` con un **alias de Vite al TypeScript fuente** | Da recarga en caliente al cambiar el contrato y permite que `npm run build -w web` funcione sin compilar antes otro workspace, que es justo lo que rompe los despliegues en Vercel. |
| La API resuelve `@proplay/shared` con `paths` de TypeScript hacia el fuente en desarrollo y hacia `dist/*.d.ts` en `tsconfig.build.json` | `tsx` recarga en caliente sobre el fuente, y en la compilación `tsc` usa las declaraciones para no intentar emitir archivos de otro paquete. |
| `packages/shared` se compila a CommonJS | La API compila a CommonJS; un paquete ESM obligaría a migrar todo el backend a ESM sin ganancia. |
| Los tipos se re-exportan desde `types/` además de inferirse en `schemas/` | Cumple la estructura pedida y da un punto único de importación de tipos, sin duplicar declaraciones (son los mismos símbolos). |

## Backend

| Decisión | Justificación |
| --- | --- |
| Prisma como ORM | El `schema.prisma` sirve a la vez de documentación del modelo, que es un requisito del proyecto. |
| Validación con Zod en un middleware `validate(schema, fuente)` | Reutiliza los esquemas del contrato y deja los controladores sin código de validación. |
| El resultado validado de `query` se guarda en `req.validado.query` | En Express 5 `req.query` es de sólo lectura, así que no se puede sobrescribir con el valor coercido. |
| Access token de 15 minutos en memoria del cliente + refresh de 7 días en cookie `httpOnly` | Reduce la ventana de un token robado y evita guardar credenciales en `localStorage`. |
| El refresh token es **stateless** (JWT firmado, sin lista en Redis) | Suficiente para el alcance actual; cuando haga falta revocación inmediata se añade una lista de revocados en Redis. |
| La cookie de refresh se limita a la ruta `/api/v1/auth` | No viaja en las peticiones normales de la API, así que reduce su exposición. |
| `SameSite=None; Secure` sólo en producción, `Lax` en desarrollo | En producción la web y la API están en dominios distintos; en local ambos son `localhost` y `Lax` evita exigir HTTPS. |
| bcrypt con 12 rondas | Compromiso habitual entre coste de cómputo y resistencia a fuerza bruta. |
| El registro crea también el perfil (`PerfilJugador` o `PerfilEquipo`) en la misma transacción | Evita usuarios sin perfil, un estado que ningún módulo posterior sabría manejar. |
| Las variables de entorno se cargan con `process.loadEnvFile` de Node en lugar de `dotenv` | Node 20 ya lo trae; una dependencia menos para exactamente el mismo resultado. |
| `env.ts` valida con Zod y llama a `process.exit(1)` si algo falta | Fallar al arrancar es mucho más barato que fallar en la primera petición que use la variable. |
| El cliente de Redis usa `lazyConnect` | Las pruebas de integración pueden cargar la app sin Redis y el servidor conecta explícitamente al arrancar. |
| `GET /health` responde 200 si Postgres y Redis están arriba y 503 si alguno falla | Así lo puede usar directamente el health check de la plataforma de despliegue. |
| El rate limiting se desactiva con `NODE_ENV=test` | Las pruebas de autenticación hacen más de diez peticiones seguidas al mismo endpoint. |
| Los errores de dominio son clases en `utils/errors.ts` y un único `errorHandler` los traduce | Garantiza la misma forma de respuesta en toda la API y que el stack no salga nunca en producción. |
| El módulo `perfiles` queda como andamiaje | La lista de criterios de aceptación no incluye ninguno de sus endpoints; implementarlo sería añadir funcionalidad no pedida. |
| Los stubs del andamiaje lanzan `NotImplementedError` desde el *repository*, no desde el controlador | Deja el camino controller → service → repository ya recorrido, que es la estructura que hay que respetar al implementar. |
| `prisma` está en `dependencies` y no en `devDependencies` | El `CMD` del contenedor ejecuta `prisma migrate deploy`, así que el CLI tiene que existir en la imagen de producción. |

## Datos

| Decisión | Justificación |
| --- | --- |
| Entidades y campos del modelo en español | Están así en el documento del proyecto y el esquema hace de documentación. |
| `PerfilVector` guarda el vector dos veces: `dimensiones Float[]` y `embedding vector(64)` | Prisma sabe leer y escribir el array; la columna nativa de pgvector es la que permite búsquedas de similitud. |
| La columna `vector(64)` se declara como `Unsupported("vector(64)")` en el schema y se crea en una migración escrita a mano | Prisma no modela el tipo, pero declararlo evita que lo considere deriva del esquema en la siguiente migración. |
| El índice ANN (`ivfflat`) queda como TODO en la migración | Un índice aproximado sobre una tabla vacía no aporta nada y sus parámetros dependen del volumen real. |
| El seed es idempotente (`upsert`) e incluye además un ADMIN y un SCOUT | Se puede ejecutar varias veces sin ensuciar la base, y hacen falta cuentas de esos roles para probar `rbac`. |
| Los datos sintéticos salen de un generador pseudoaleatorio con semilla fija | El seed produce siempre los mismos números, así las pruebas manuales son comparables entre máquinas. |
| Las pruebas de integración corren contra una base real, no contra mocks | Lo que se quiere verificar es justo la integración: Zod, Prisma, middlewares y Express juntos. |
| Las pruebas crean usuarios con correo aleatorio prefijado y los borran al terminar | Permite ejecutarlas contra la base de desarrollo sin arrastrar basura ni chocar entre ejecuciones. |

## Frontend

| Decisión | Justificación |
| --- | --- |
| El access token vive en un módulo en memoria, no en `localStorage` | Un token en `localStorage` es accesible desde cualquier script de la página. |
| Un solo interceptor de axios refresca la sesión y reintenta la petición una vez | Concentra el manejo del 401 en un sitio y evita bucles de refresco. |
| El estado de servidor lo lleva TanStack Query; la sesión, un contexto de React | Query no está pensado para el ciclo de vida de la autenticación, y el contexto es lo bastante simple. |
| Los hooks de los recursos todavía no implementados existen con `enabled: false` | La página compila y queda escrito dónde conectar el endpoint cuando el módulo esté listo. |
| Las páginas de los módulos pendientes son maquetas con datos de ejemplo | Sirven para validar la navegación por rol y el diseño sin fingir funcionalidad. |
| La paleta de marca se define en `tailwind.config.ts` como `primario`, `secundario` y `fondo` | Los nombres semánticos sobreviven a un cambio de color; los hexadecimales sueltos, no. |
| El tema es oscuro fijo | Es la convención del sector y el fondo `#0F1117` viene dado por la identidad del proyecto. |

## Infraestructura y despliegue

| Decisión | Justificación |
| --- | --- |
| Postgres y Redis en Docker Compose, pero api y web fuera de Docker | La recarga en caliente y los tiempos de arranque son mucho mejores en local. |
| Imagen de la API multi-stage sobre `node:20-alpine` con usuario no root | Menos superficie y menos privilegios en la imagen final. |
| El contexto de build del Dockerfile es la raíz del monorepo | La imagen necesita `packages/shared`; construir desde `apps/api` no lo alcanzaría. |
| La imagen de producción instala dependencias con `npm ci --omit=dev` de todos los workspaces | `npm ci` exige el árbol completo de workspaces del lockfile; filtrar por workspace daría un lockfile incoherente por unos pocos megas de diferencia. |
| El `CMD` ejecuta `prisma migrate deploy` antes de arrancar | El despliegue queda en un paso y la base nunca se queda atrás del código. |
| `vercel.json` reescribe todas las rutas a `index.html` | Sin eso, recargar una URL profunda de React Router devuelve 404. |
| El CI usa `prisma migrate deploy` sobre una base `proplay_test` | `migrate dev` es interactivo y pensado para desarrollo. |
| Verificación local con Postgres 17 de Homebrew en lugar de Docker | En la máquina donde se construyó el esqueleto no había Docker; Homebrew compila pgvector contra 17, y `docker-compose.yml` sigue fijando 16 como dice la especificación. |

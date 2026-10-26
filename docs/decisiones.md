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
| La paleta de marca se define con `@theme` en `src/index.css` (Tailwind 4) como `brand`, `accent` y `surface` | Viene del prototipo de `Fronted`; los nombres semánticos sobreviven a un cambio de color, los hexadecimales sueltos no. |
| El tema es oscuro fijo | Es la convención del sector; el fondo es el token `surface-900` del prototipo. |

## Infraestructura y despliegue

| Decisión | Justificación |
| --- | --- |
| Postgres y Redis en Docker Compose, pero api y web fuera de Docker | La recarga en caliente y los tiempos de arranque son mucho mejores en local. |
| Imagen de la API multi-stage sobre `node:22-alpine` con usuario no root | Menos superficie y menos privilegios en la imagen final. |
| El contexto de build del Dockerfile es la raíz del monorepo | La imagen necesita `packages/shared`; construir desde `apps/api` no lo alcanzaría. |
| La imagen de producción instala dependencias con `npm ci --omit=dev` de todos los workspaces | `npm ci` exige el árbol completo de workspaces del lockfile; filtrar por workspace daría un lockfile incoherente por unos pocos megas de diferencia. |
| El `CMD` ejecuta `prisma migrate deploy` antes de arrancar | El despliegue queda en un paso y la base nunca se queda atrás del código. |
| `vercel.json` reescribe todas las rutas a `index.html` | Sin eso, recargar una URL profunda de React Router devuelve 404. |
| El CI usa `prisma migrate deploy` sobre una base `proplay_test` | `migrate dev` es interactivo y pensado para desarrollo. |
| Verificación local con Postgres 17 de Homebrew en lugar de Docker | En la máquina donde se construyó el esqueleto no había Docker; Homebrew compila pgvector contra 17, y `docker-compose.yml` sigue fijando 16 como dice la especificación. |

## Integración del cliente de `Fronted`

| Decisión | Justificación |
| --- | --- |
| El prototipo de la rama `Fronted` sustituye al `apps/web` anterior; se integra con un merge `--no-ff` y luego se mueve | El commit original de mogeko-cpu queda intacto en el historial con su autoría, y `git log --follow` sigue los archivos hasta él. |
| Se conservan Vite 6 y Tailwind 4 del prototipo | Decisión del equipo: no se bajan versiones; la configuración de Tailwind 3 se fue con el cliente reemplazado. |
| Del `apps/web` anterior sólo sobreviven `.env.example` y `vercel.json` | Son configuración de despliegue que el prototipo no traía; el resto del cliente se reemplaza. |
| Los documentos del prototipo (C4, modelo de datos, pruebas piloto, trazabilidad) pasan a `docs/prototipo/` | La documentación del proyecto vive en `docs/`; se separan en una subcarpeta porque describen el prototipo, no el código actual. |
| El `package-lock.json` propio del prototipo se elimina | En un monorepo de npm workspaces sólo hay un lockfile, el de la raíz. |
| `apps/api` sube de vitest 2 a vitest 3 | Con dos versiones mayores, npm eleva la de `api` a la raíz y `@testing-library/jest-dom` se registra sobre la equivocada: rompe los matchers y los tipos de los tests del cliente. Una sola versión lo resuelve. |
| `server.open` del prototipo se sustituye por `strictPort` | `npm run dev` arranca api y web a la vez; abrir el navegador en cada arranque estorba y el puerto 5173 está fijado por `CORS_ORIGIN`. |
| Los datos simulados (`mocks/api.ts`, `mocks/seed.ts`) se movieron sin reescribir su lógica y sólo se consumen desde los hooks de `src/api/` | Es la costura de datos: cada hook tiene la firma de la llamada real y un `// TODO: Sx` con su endpoint; conectarlo no toca los componentes. |
| Los hooks de recursos «míos» (notificaciones, mensajes, privacidad, perfil propio) no reciben el id del usuario | La API real identifica al usuario por el access token; la simulación lo lee de `mocks/sesion.ts`, que registra el `AuthContext`. |
| Los componentes resuelven sus identificadores de dominio con `useIdentidad()` | Es el equivalente de `GET /perfiles/me`: dice de qué perfil de jugador u organización es dueño el usuario, sin que la vista toque el mock. |
| Toda mutación invalida todas las consultas | La simulación tiene efectos cruzados (una postulación emite notificación y auditoría). Al conectar cada endpoint se acota la invalidación a sus claves. |
| Al cerrar sesión se vacía la caché de TanStack Query | Ningún dato del usuario anterior debe quedar visible para el siguiente. |
| `services/matching.ts` y `services/llm.ts` siguen en `services/` | Son el motor de matching y el explicador simulados; sólo los usa el mock. Se retiran cuando los módulos `matching` (S3) y la IA generativa (S4) vivan en el backend. |
| La autenticación del prototipo (sesión en `localStorage`, acceso sólo con correo) se sustituye por la de `main`: `api/client.ts` con su interceptor JWT y el `AuthContext` | La interfaz es la del prototipo; la lógica de sesión es la que ya funciona contra la API. Token en memoria, refresco con la cookie `httpOnly`. |
| El login y el registro validan con `loginSchema` y `registerSchema` de `@proplay/shared` mediante `react-hook-form` | Mismo esquema en cliente y servidor (CLAUDE.md §3.1). `Input` y `Select` de `components/ui.tsx` reenvían el `ref` para poder registrarse. |
| La aceptación del aviso de privacidad se valida en el cliente extendiendo `registerSchema`, pero no se persiste | El contrato de registro no la recibe todavía. Ver «Pendientes»: persistirla y crear `/legal/privacidad` (S1). |
| El registro ya no pide la región ni ofrece el rol administrador | La región es un dato del perfil, no de la cuenta (ver «Pendientes», S2); `ADMIN` no es registrable (`ROLES_REGISTRABLES`). |
| Las cuentas de demostración del login son las del seed de la API y sólo aparecen en modo desarrollo | Son cuentas reales de la base local; en producción no se exponen. La lista vive en `api/cuentasSemilla.ts`, junto a la contraseña del seed. |
| Puente de datos de demostración detrás de `VITE_DEMO_DATA` | Con la bandera encendida, la sesión real se hace pasar por una persona simulada de su mismo rol (`mocks/persona.ts`, único punto de conversión) y el `Layout` muestra el aviso «Datos de demostración». Apagada, los hooks devuelven el vacío que daría la API y sus mutaciones fallan con un aviso: así se ve qué está conectado de verdad y el puente se retira sprint a sprint. |
| Las pruebas de humo sustituyen el recurso `api/auth` por uno en memoria y fijan `VITE_DEMO_DATA` en `vite.config.ts` | No dependen de una API levantada ni de un `.env` local; cada sesión de prueba usa el nombre de la persona de su rol. |
| Los textos nuevos van a `src/i18n/es.ts` | CLAUDE.md §6. Los textos heredados del prototipo siguen en el JSX: ver deuda conocida. |
| Los enums (`Rol`, `CategoriaHabilidad`, `Plataforma`, `EstadoOferta`, `EstadoPostulacion`), `Habilidad` y el usuario (`UsuarioPublico`) del cliente vienen de `@proplay/shared` | CLAUDE.md §3.1. La simulación y sus pruebas usan los mismos valores en mayúscula; la interfaz los muestra con las etiquetas de `i18n/es.ts`, nunca en crudo. |
| `types/index.ts` pasa a `mocks/modelos.ts` y conserva sólo los modelos de vista del prototipo que aún no tienen contrato | No se fuerzan a la forma de `shared` mientras sus endpoints no existan: cada uno se reconcilia en el sprint que lo conecta (tabla siguiente). Cinco comparten nombre con un tipo de `shared` sin coincidir en forma: `Estadistica`, `Oferta`, `Mensaje`, `Notificacion` y `TipoNotificacion`; ninguna vista importa ambos. |
| ESLint del cliente con la configuración base del monorepo y las reglas de `react-hooks` | El prototipo no traía linter. Sólo marcó un `prefer-const` en la simulación, corregido. |
| El control de acceso se declara una vez por área en el enrutador, con rutas de layout sin path (`router/areas.ts`) | Las once URLs del prototipo no cambian; el menú lateral lee las mismas listas de roles, así que vista, menú y guarda no pueden discrepar. |
| La 404 es una vista pública, fuera del `Layout` | Responde igual con o sin sesión; antes cualquier ruta desconocida redirigía al feed. |
| `/auth/refresh` tiene un limitador propio: 60 peticiones cada 15 minutos por usuario | El access token vive en memoria y cada recarga gasta un refresco: compartir el límite de 10 del login cerraba la sesión. Se cuenta por el sujeto del refresh token (rota en cada uso, así que su valor no sirve de clave) y no por IP, para que una red compartida no bloquee a todos; sin token válido, por IP. Registro y login conservan `limiteAuth`. |
| Node 22 fijado con `.nvmrc` y `engines`; el CI lee la versión de `.nvmrc` | Una sola fuente para la versión; la imagen de la API (`apps/api/Dockerfile`) usa la misma mayor, `node:22-alpine`. |

## Pendientes

Trabajo identificado durante la integración que no entra en este cambio. Cada
entrada dice en qué sprint se cierra; al resolverla, bórrala en el mismo commit.

| Pendiente | Por qué | Sprint |
| --- | --- | --- |
| Persistir la aceptación del aviso de privacidad con su fecha y la versión del aviso, y crear la vista `/legal/privacidad` | Hoy el registro exige aceptar un documento que no existe y la aceptación no se guarda (RNF-05, Ley 1581). Requiere el campo en `registerSchema`, el modelo en Prisma y la vista pública del inventario. | S1 |
| Hacer público `/jugador/:id`, sin guarda de sesión | Es la vitrina del jugador y el argumento central del proyecto: un perfil verificable que se comparte por enlace. El inventario ya lo marca como público; hoy está dentro del área privada. | S1 |
| Vista de cuenta y ajustes para equipo, scout y administrador | Sólo el jugador tiene vista propia (`/mi-perfil`): el resto no puede cambiar su nombre ni su contraseña. La API ya expone `PATCH /usuarios/me`; falta el endpoint de cambio de contraseña aunque `cambiarPasswordSchema` existe en `shared`. Añadir la vista al inventario de CLAUDE.md §5, que hoy sólo la lista para el jugador. | S1 |
| Alta del primer administrador en producción y procedimiento de promoción | El seed crea `admin@proplay.gg` con la contraseña de demostración, válido sólo en desarrollo (el seed nunca debe correr en producción). `ADMIN` no es registrable y el único rastro de cómo se asigna es un comentario en `shared/enums.ts` («se asigna a mano»); `POST /admin/usuarios/rol` responde 501. Definir el arranque (un script de una sola vez) y documentarlo en el README; el endpoint de promoción con su traza en `AuditLog` llega con el módulo `admin`. | S1 (arranque) · S4 (endpoint) |
| La imagen de producción de la API no arranca: falta el binario nativo de `bcrypt` | `npm ci --omit=dev --ignore-scripts` omite el script de instalación de `bcrypt`, que es el que descarga su binario; al primer `require` falla con `Cannot find module …bcrypt_lib.node`. Ocurre igual con `node:20-alpine`: es anterior a la integración. | S1 |
| Definir dónde se captura la región del jugador | El registro dejó de pedirla y no hay onboarding. Es insumo de la dimensión geográfica del matching: tiene que existir antes de que el S3 la necesite. | S2 |

## Deuda conocida

| Deuda | Cuándo |
| --- | --- |
| `components/ui.tsx` es un único archivo con todos los componentes de interfaz. Partirlo en `components/ui/`, uno por archivo, mejora el mantenimiento sin bloquear nada. | Cuando se toque el sistema de diseño |
| Los textos visibles de las vistas heredadas del prototipo siguen en el JSX, no en `src/i18n/es.ts` (CLAUDE.md §6). Los textos nuevos ya van al archivo de traducciones. | Vista a vista, al conectar cada una |
| Los cuatro estados transversales (cargando, vacío, error con reintento, sin permiso) no son todavía componentes compartidos: cada vista del prototipo resuelve los suyos y ninguna muestra el estado de error. | S1, junto con el resto de la fundación |
| Las vistas del prototipo no llevan el identificador `RF-xx` del requisito que realizan (CLAUDE.md §3.6); sí lo llevan los hooks de `src/api/`. | Vista a vista |

## Divergencias con `@proplay/shared`

Lista de trabajo: cada entrada dice quién gana y en qué sprint se cierra. Al
resolver una, bórrala de aquí en el mismo commit.

### 1. Hueco en el diseño: gana el prototipo

Propuestas de ampliación del contrato. **No se aplican** hasta su sprint; ese
día se añaden a `shared/enums.ts` y a `schema.prisma` en el mismo commit.

| Divergencia | Propuesta | Sprint |
| --- | --- | --- |
| Postulación en estado `ENTREVISTA` | El documento contempla «invitar a un tryout»: falta un estado entre `EN_REVISION` y `ACEPTADA` en `EstadoPostulacion`. En el cliente vive como `EstadoPostulacionPrototipo`. | S3 |
| Notificación de sincronización de estadísticas (`ingesta`) | El worker de ingesta (RF-03) avisa al jugador de que sus datos cambiaron; no hay tipo equivalente en `TIPOS_NOTIFICACION`. | S2 |
| Preferencias de privacidad (`ConfiguracionPrivacidad`: visibilidad del perfil y de sus secciones) | RNF-05 las exige y no hay esquema ni modelo que las guarde. | S2 |
| Rango competitivo en `Estadistica` (`rango`) y en `Oferta` (`rangoMinimo`) | `Oferta` ya tiene `rangoMinimo`; la estadística sólo lo tendría dentro de `metricas`. Hace falta como campo para filtrar y comparar. | S2 |
| `salario` y `requisitos[]` de la oferta | El prototipo los muestra en el detalle; el contrato no los recoge. | S3 |

### 2. Simplificación del prototipo: gana `shared`

El modelo del backend es más completo; el cliente se adapta.

| Divergencia | Adaptación del cliente | Sprint |
| --- | --- | --- |
| `Mensaje` emisor → receptor directo frente a `Conversacion` + `Mensaje` | El backend soporta hilos y chats de equipo, que el documento pide. La bandeja pasa a listar conversaciones. | S4 |
| Campos del perfil del jugador: `biografia`, `horasDisponibles`, `dispuestoARelocalizarse`, `foto` | Se renombran a `bio`, `disponibilidadHoras`, `dispuestoRelocalizar`, `avatarUrl`. | S2 |
| Vinculación de cuentas tecleando un identificador | El contrato usa OAuth 2.0 (`codigoAutorizacion`): el formulario se sustituye por la redirección a Riot y Steam. | S2 |
| `Estadistica` con `perfilId`, `fuente: 'api-riot'…` y `ultimaSync` | Pasa a `jugadorId`, `fuente: Plataforma` y `capturadaEn`. | S2 |
| `Oferta` sin `titulo` y con `experienciaMinima`, `regionPreferida`, `horasSemanales`, `publicadaEn` | Se añade `titulo` y se renombran a `experienciaMinAnios`, `region`, `horasSemana`, `creadoEn`. | S3 |
| Desglose del matching como lista con la dimensión `blandas` | El contrato lo da como objeto con `habilidadesBlandas`. | S3 |
| Estado de oferta `en-proceso` | No existe en el contrato (el proceso es de las postulaciones). **Resuelto en este cambio:** la insignia ámbar pasó a `BORRADOR`. | — |

### 3. Preocupación de presentación: no toca el modelo

Campos que la interfaz necesita pero que se derivan de los datos. Los compone
el adaptador del cliente (`src/api/`); **no deben acabar en Prisma** ni en los
esquemas de `shared`.

| Divergencia | Se deriva de | Sprint |
| --- | --- | --- |
| `titulo`, `detalle` y `enlace` de `Notificacion` | `tipo` + `payload` | S4 |
| `leida: boolean` de `Notificacion` | `leidaEn !== null` | S4 |
| Tipos de notificación en minúscula del prototipo (`postulacion`, `endoso`…) | Correspondencia con `NUEVA_POSTULACION`, `ENDORSEMENT_RECIBIDO`… en el adaptador | S4 |
| `emisorNombre` del mensaje | Participantes de la conversación | S4 |
| `esCaribe` y `handle` del perfil | `region` y el nombre de usuario | S2 |
| `tendencia` de la estadística (serie de la sparkline) | Histórico de capturas | S2 |
| `detalle`, `peso` y `contribucion` de cada dimensión del matching | Desglose + `PESOS_MATCHING` | S3 |
| Etiquetas de enums («Abierta», «Riot Games») | `i18n/es.ts`. **Resuelto en este cambio.** | — |


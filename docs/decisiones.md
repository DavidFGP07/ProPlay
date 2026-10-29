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
| El hash de contraseñas usa `bcryptjs` (JavaScript puro) en lugar de `bcrypt` (nativo) | Sin dependencia nativa, la imagen no necesita binarios precompilados ni toolchain y se construye de forma reproducible manteniendo `npm ci --ignore-scripts`; con `bcrypt`, ese flag omitía la descarga del binario y el contenedor no arrancaba. Mismo algoritmo y formato (`$2b$`): los hashes existentes siguen siendo válidos. A la escala del piloto, la diferencia de rendimiento es irrelevante. |
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
| `trust proxy` sale de `TRUST_PROXY`, desactivado si no se fija y obligatorio en producción | Con un valor fijo y sin proxy delante, Express tomaría la IP de `X-Forwarded-For`, que el cliente puede escribir: bastaría cambiarla en cada petición para saltarse cualquier límite por IP. Sólo el despliegue sabe cuántos proxies hay; `true` se rechaza porque confía en cualquiera. |
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
| La aceptación del aviso de privacidad se valida en el cliente extendiendo `registerSchema`, pero no se persiste | Superada en la tarea 1.1: el contrato la exige y el registro la guarda (ver «Privacidad y piloto»). |
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
| Endpoint de cambio de rol | El alta del primer administrador ya se resolvió con un script de línea de comandos (ver «Cuenta y sesiones» y `docs/operacion.md`). Falta `POST /admin/usuarios/rol`, que hoy responde 501, para promover y degradar desde la aplicación con su traza `ROL_CAMBIADO` en `AuditLog`; hasta entonces, degradar exige un `UPDATE` manual. | S4 |
| Catálogo de ubicación para `Oferta` y `PerfilEquipo`, con «sin restricción» | Su `region` sigue siendo texto libre y el seed la llena con regiones de servidor (LAN, LAS…), como hacía `PerfilJugador`. La dimensión geográfica compara al jugador con la **oferta** (bootcamp presencial o remoto), así que la oferta necesita el mismo `pais` + `departamento` y un valor que no restrinja; también `crearOfertaSchema` y `listarOfertasQuerySchema`. | S3 |
| Modelo de trayectoria para la dimensión de experiencia (resolver antes del S3, junto con la tarea 3.5) | El documento (Sección VIII) define la experiencia como «historial en equipos, torneos, competencias y logros obtenidos», no como años. Ni el modelo del documento ni `schema.prisma` tienen dónde guardarlo: faltan equipos anteriores, torneos y logros (el prototipo los simula). Hay que diseñar ese modelo y decidir cómo se distingue lo declarado por el jugador de lo verificado. No se añade `aniosExperiencia`. | S3 |
| Roles de la dimensión técnica desde las partidas de Riot | Los roles que juega un jugador deberían salir de su historial de partidas (ingesta del S2), no de una declaración como `rolesPreferidos` del prototipo, que no pasa al modelo. | S2–S3 |
| Puntuación de la dimensión geográfica cuando el jugador no tiene ubicación | `pais` y `departamento` son anulables y las cuentas anteriores a la tarea 1.5 no la tienen. Hay que decidir el valor (neutro, mínimo o excluir la dimensión y renormalizar los pesos) antes de implementar `calcularCompatibilidad`. | S3 |

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
| `region` del perfil del jugador como ciudad (`Barranquilla`, `Cartagena`…) | Pasa a `pais` (ISO 3166-1 alfa-2) + `departamento` (`ATLANTICO`, `BOLIVAR`…). Las 8 ciudades del prototipo caen en 8 departamentos distintos. | S2 |
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
| `esCaribe` y `handle` del perfil | `MACROREGION_POR_DEPARTAMENTO[departamento] === "CARIBE"` y el nombre de usuario | S2 |
| `tendencia` de la estadística (serie de la sparkline) | Histórico de capturas | S2 |
| `detalle`, `peso` y `contribucion` de cada dimensión del matching | Desglose + `PESOS_MATCHING` | S3 |
| Etiquetas de enums («Abierta», «Riot Games») | `i18n/es.ts`. **Resuelto en este cambio.** | — |

## Correcciones

| Corrección | Detalle |
| --- | --- |
| El índice HNSW sobre `PerfilVector.embedding` no existió hasta la migración `20261027153113_indice_hnsw_perfil_vector` | `CLAUDE.md` §4 lo declaraba obligatorio y el plan de implementación lo daba por creado, pero la migración de pgvector sólo añadía la extensión y la columna, y dejaba un índice `ivfflat` como `TODO` comentado. Se crea `"PerfilVector_embedding_hnsw_idx"` con `vector_cosine_ops`, la métrica coseno del recuperador (`ORDER BY embedding <=> $1`). El `TODO` sigue en `20260910145700_pgvector_perfil_vector` porque esa migración ya está aplicada y editarla cambiaría su checksum; queda obsoleto. Prisma no puede declarar el índice: `CLAUDE.md` §4 explica cómo evitar que una migración futura lo borre. |

## Cuenta y sesiones

| Decisión | Justificación |
| --- | --- |
| Cambiar la contraseña revoca las demás sesiones mediante `Usuario.credencialesCambiadasEn` | Los refresh tokens son JWT sin estado y no se guardan, así que no hay lista que revocar. `/auth/refresh` rechaza los emitidos antes del último cambio de credenciales, comparando en segundos (`iat < floor(credencialesCambiadasEn / 1000)`) para que el token de la propia respuesta siga valiendo; esa respuesta trae una sesión nueva y quien cambia la contraseña sigue dentro. Los access tokens ya emitidos valen hasta caducar (15 minutos como máximo). |
| Una contraseña actual incorrecta responde `400 CONTRASENA_ACTUAL_INVALIDA`, no `401` | El interceptor del cliente trata cualquier `401` como sesión caducada: refresca, reintenta y cierra la sesión. Con un `401`, equivocarse de contraseña al cambiarla expulsaría al usuario. |
| `PATCH /usuarios/me` deja de aceptar `activo` | Suspender o reactivar una cuenta no es una edición propia: cualquier usuario podía suspenderse y uno suspendido con un access token vigente podía reactivarse. Queda para el módulo `admin`; si llega, el campo se descarta. |
| Lista de rutas sin datos de demostración (`RUTAS_SIN_DATOS_DEMO` en `router/areas.ts`) | El aviso «Datos de demostración» lo pinta el `Layout` para todas las vistas; las que sólo consumen endpoints reales, como `/cuenta`, se declaran ahí y no lo muestran. Al conectar cada vista de verdad, se añade su ruta. |
| El primer administrador se da de alta con un script, `npm run admin:promover -w api -- <correo>` (en producción, `node apps/api/dist/cli/promoverAdministrador.js`), que promueve a `ADMIN` una cuenta **ya registrada como scout** | La contraseña la define la persona al registrarse y nunca pasa por argumentos ni por el historial de la terminal. Un script es explícito y deja traza; una variable `ADMIN_EMAIL` aplicada al arrancar se reaplicaría en cada despliegue y el seed crea cuentas con la contraseña de demostración. Se niega con cuentas de jugador o de equipo (su perfil público quedaría huérfano), desactivadas o inexistentes; si ya es administrador no hace nada. El rol y la traza `ROL_CAMBIADO` (`metadata: { rolAnterior, rolNuevo, origen: "cli" }`) van en la misma transacción. No revoca sesiones: el refresco lee el rol de la base, así que el nuevo llega en el siguiente refresco (15 minutos como máximo). La lógica vive en `usuarios.service` y el script en `src/cli/` para que se compile en la imagen, que no trae `tsx`. |

## Privacidad y piloto

| Decisión | Justificación |
| --- | --- |
| El piloto usa solo League of Legends, con datos de la API de Riot. Steam, Twitch y YouTube pasan a trabajo futuro | Cuatro integraciones OAuth no caben en el plazo; una completa demuestra la verificabilidad mejor que cuatro a medias. Los esqueletos de esas integraciones siguen en `apps/api/src/integrations/`, sin tocar. |
| El registro queda restringido a mayores de 18 años mediante una declaración obligatoria. La autorización del representante legal pasa a trabajo futuro | La Ley 1581 da tratamiento especial a los datos de menores; recoger la autorización de su representante exige un flujo propio. La casilla «Declaro que soy mayor de 18 años» es obligatoria (`registerSchema`) y su fecha se guarda en `Usuario.declaraMayorEdadEn`. |
| La aceptación del aviso se guarda en `Usuario` (`avisoPrivacidadVersion`, `avisoPrivacidadAceptadoEn`, `declaraMayorEdadEn`) y en la traza `USUARIO_REGISTRADO` de `AuditLog`, en la misma transacción que crea el usuario. La versión vigente es `VERSION_AVISO_PRIVACIDAD` en `@proplay/shared` | Sin entidad nueva: el modelo sigue con las 15 del documento. La traza, con la versión en `metadata`, es el rastro histórico, y al ir en la transacción no puede quedar un usuario sin prueba de su autorización (Decreto 1377 de 2013). El servidor guarda la versión vigente e ignora cualquiera que envíe el cliente. El texto vive en `apps/web/src/i18n/legal.ts`; al cambiarlo se sube la versión, a partir de la primera publicación del aviso. **Trabajo futuro:** volver a pedir la aceptación cuando cambie la versión. Las cuentas anteriores a esta tarea tienen las columnas vacías. |

## Ubicación del jugador

| Decisión | Justificación |
| --- | --- |
| La ubicación geográfica del jugador es **país + departamento**: `PerfilJugador.pais` (`CHAR(2)`, ISO 3166-1 alfa-2) y `PerfilJugador.departamento` (enum `Departamento`), éste sólo cuando el país es Colombia. Sustituye a `PerfilJugador.region` | La fórmula de la dimensión geográfica (prototipo y `docs/arquitectura.md`) tiene tres niveles: misma ubicación, misma macrorregión y otra, más la disposición a relocalizarse. El departamento basta para los tres; la ciudad sería un dato personal más sin mejorar el cálculo (Ley 1581), y la zona horaria se deduce del país. `region` mezclaba conceptos: el seed guardaba regiones de servidor (LAN, LAS…) y el prototipo, ciudades. La región de servidor sale de la cuenta vinculada (S2). |
| Catálogo: `DEPARTAMENTOS` es enum en `shared` y en Prisma (33 valores); `PAISES` es una constante de `shared` validada con Zod, no enum de Prisma; `MACROREGION_POR_DEPARTAMENTO` deriva la macrorregión y no se guarda | Los departamentos son un conjunto cerrado y estable: que la base lo garantice compensa. La lista ISO es larga y la mantiene un tercero. La macrorregión es función del departamento: guardarla permitiría incoherencias. Nada de texto libre; las etiquetas visibles van al i18n del cliente. |
| Un departamento que abarca varias regiones naturales cuenta en una sola, como en las regiones administrativas de planificación (Cauca, Chocó, Nariño y Valle del Cauca, Pacífica; Antioquia, Andina). San Andrés cuenta como Caribe y no hay macrorregión Insular | Para el piloto, centrado en el Caribe colombiano, el archipiélago es parte del segmento Caribe. Con San Andrés en Caribe, ningún departamento quedaba Insular. |
| Regla de ubicación en el contrato (`ubicacionJugadorSchema`, incluido en `perfilJugadorSchema`): con `CO` el departamento es obligatorio y con otro país no se admite. `null` borra la ubicación | Un departamento sin país no se puede comprobar en el esquema; el servidor lo valida contra el país guardado (ver la entrada del `PATCH /perfiles/jugador`). |
| La ubicación se captura en la edición del perfil (`PATCH /perfiles/jugador`), no en el registro ni en un onboarding | El registro dejó de pedirla porque es un dato del perfil, no de la cuenta; pedirla allí añade fricción al alta y no cubre a los jugadores ya registrados. El onboarding es una vista cuyo contenido principal es vincular la cuenta de Riot (S2). El endpoint es el primero del módulo `perfiles`, que la tarea siguiente completa. |
| El filtro de ubicación del buscador de talento (`busquedaJugadoresSchema`) pasa de `region` a `pais` + `departamento` | Filtraba una columna que deja de existir. El endpoint sigue en 501. |
| La migración `ubicacion_perfil_jugador` descarta los valores de `pais` (`USING NULL`) en vez de convertirlos | Eran texto libre del seed («Colombia»); truncarlos a dos caracteres daría códigos falsos. Cada base local debe ejecutar `npm run db:deploy` y `npm run db:seed`, que repone la ubicación de los 15 jugadores. |
| `GET /perfiles/me` responde `{ tipo, perfil }` según el rol; al scout y al administrador, que no tienen perfil, `200 { tipo: null, perfil: null }`. `PATCH /perfiles/jugador` es una actualización parcial y responde con la misma forma | El cliente puede reutilizar la respuesta del `PATCH` como la de `GET /me` en la caché de TanStack Query. Con un `404`, TanStack Query reintentaría y cualquier vista común que pida el perfil mostraría un error para dos roles válidos. El `404` queda para la inconsistencia de un jugador o equipo sin perfil. |
| Cuando el `PATCH` trae el país, el servidor guarda el departamento con él (nulo si no llega). Si trae sólo el departamento, lo valida contra el país guardado con la misma regla de `ubicacionJugadorSchema` (`422` si no casa) | Así cambiar de Colombia a otro país no deja el departamento anterior guardado, y un jugador de Colombia puede cambiar de departamento sin reenviar el país. La regla vive una sola vez en `shared`: el esquema comprueba la pareja cuando llega completa y el servicio la reaplica sobre el país guardado. Sustituye a la regla anterior, que rechazaba cualquier departamento sin país. |
| Actualizaciones parciales con `PATCH` en toda la API. `PUT /perfiles/jugador` pasa a `PATCH`, y `PUT /perfiles/equipo` también, aunque sigue en 501 | Ni el documento ni `docs/arquitectura.md` fijaban el verbo: el `PUT` venía del andamiaje. `PUT` reemplaza el recurso entero y estas rutas sólo cambian los campos enviados, como `PATCH /usuarios/me` y `PATCH /ofertas/:id`. Un `PUT` futuro sólo tiene sentido si reemplaza el recurso completo. |
| La tarjeta «Ubicación» de `/mi-perfil` habla con la API real (`GET /perfiles/me`, `PATCH /perfiles/jugador`) mientras el resto de la vista sigue con datos de demostración. Es **temporal**: la tarea siguiente conecta la vista entera | La dimensión geográfica necesita la ubicación antes del S3 y la vista completa depende del resto del módulo `perfiles`. Para no confundir el dato real con los de la persona de ejemplo, la tarjeta lleva borde verde, la insignia «Dato real de tu cuenta» y, con el puente activo, una línea que lo explica. Se monta fuera de la rama que depende del puente, así que también aparece con `VITE_DEMO_DATA` apagado. La región y la disposición a relocalizarse salen del panel simulado de «Datos profesionales» para que no haya dos formularios del mismo dato. `/mi-perfil` no entra en `RUTAS_SIN_DATOS_DEMO` hasta que la vista entera sea real. |
| La tarjeta avisa «Completa tu ubicación» cuando el jugador no tiene país guardado; no hay bloqueo ni ventana emergente | Es la forma con menos fricción de recuperar a los jugadores registrados antes de la tarea 1.5. El S3 decide qué puntúa la dimensión geográfica mientras falte (ver «Pendientes»). |
| Los países se muestran con `Intl.DisplayNames` en español a partir del código ISO; los departamentos y macrorregiones, con etiquetas de `i18n/es.ts` | 249 nombres de país mantenidos a mano serían deuda sin valor: el navegador ya los trae localizados. Colombia va primero en la lista por el piloto. |
| El traductor de errores de la API a formularios (`api/errores.ts`) y el aviso de resultado con reintento (`EstadoEnvio` en `components/ui.tsx`) salen de `CuentaPage` a piezas compartidas | La tarjeta de ubicación los necesitaba igual; CLAUDE.md §5 pide que los estados transversales no se reescriban por vista. Los textos comunes pasan a `es.comun`. |
| El aviso de privacidad precisa «ubicación (país y, en Colombia, departamento)» en lugar de «región» **sin subir `VERSION_AVISO_PRIVACIDAD`**, que sigue en 1.0 | El aviso aún no se ha publicado: el versionado cuenta desde la primera publicación. A partir de ella, cualquier cambio del texto sube la versión. |

## Perfil público y módulo `perfiles`

| Decisión | Justificación |
| --- | --- |
| El perfil público del jugador tiene contrato propio, `perfilJugadorPublicoSchema`, construido como **lista blanca**: `id` (de `PerfilJugador`), `nombre`, `bio`, `pais`, `departamento`, `avatarUrl` y `cuentasVerificadas` (sólo `plataforma` y `verificadaEn`) | Un esquema «privado menos algunos campos» filtra todo lo que se añada al privado después. Con la lista blanca, lo nuevo no sale hasta que se decide. Fuera quedan el correo, el id de la cuenta, las fechas de aceptación y lo que el matching usa en privado (disponibilidad y disposición a relocalizarse), en línea con lo que el aviso de privacidad declara público. `CAMPOS_PERFIL_JUGADOR_PUBLICO` deja la lista a mano de las pruebas. |
| La URL pública usa el id de `PerfilJugador`, no el de `Usuario` | No expone la clave de la cuenta, que es la que usan `/usuarios/:id` y la auditoría. Es un `cuid` no secuencial; el límite de peticiones y la ausencia de un listado público cubren el recorrido. |
| `fechaNacimiento` sale de `perfilJugadorSchema` y de la respuesta del perfil propio; la columna se queda | La mayoría de edad ya se declara al registrarse y nada usa la fecha: pedirla es recoger un dato personal sin finalidad (minimización, Ley 1581). Si se envía, se descarta. |
| `region` sale de `perfilEquipoSchema` y de la respuesta del perfil del equipo hasta que exista el catálogo de ubicación del S3; la columna se queda | Hoy es texto libre y el seed guarda en ella regiones de servidor: editarla perpetuaría la mezcla que ya se corrigió en el jugador. |
| `GET /perfiles/:id` no exige sesión y responde lo mismo con o sin ella; una cuenta desactivada da 404, igual que un id inexistente | Es el perfil compartible de RF-05. Si la respuesta cambiara con la sesión, la lista blanca dejaría de ser la única fuente de lo que es público. El 404 único no revela si la cuenta existió. |
| Límite propio del perfil público: 120 consultas cada 15 minutos, por usuario con sesión y por IP sin ella, además del global | Es la única lectura sin sesión de la API; frena el recorrido masivo de perfiles sin molestar a un scout que revisa candidatos. Por IP sólo es fiable con `TRUST_PROXY` bien fijado en el despliegue. |
| El perfil público lleva `<meta name="robots" content="noindex">` durante el piloto | Los jugadores del piloto no han elegido aparecer en buscadores y aún no hay ajustes de privacidad para decidirlo. Se retira cuando existan. |
| `/jugador/:id` se monta fuera de las guardas: con sesión dentro del `Layout`, sin ella en un marco mínimo con la marca y «Iniciar sesión» | Mismo componente y misma consulta en los dos casos; sólo cambia el envoltorio. `RUTAS_SIN_DATOS_DEMO` pasa a patrones de ruta (`matchPath`) para poder incluirla. |
| La vista pública sólo muestra lo que hay: sin cuenta de Riot dice «Sin cuenta de Riot vinculada», estadísticas y habilidades quedan como estados vacíos y no hay botón de endorsement | Mostrar cifras o índices simulados en una vista compartible contradiría la verificabilidad. Desaparecen el índice de confianza, la cobertura del matching, el portafolio, los logros y los equipos anteriores del prototipo. |
| El cliente no reintenta las consultas que fallan con 4xx | Un 404 o un 429 no cambian al repetir la petición; reintentar un 429 además gasta cupo. |
| **Riesgo para demostraciones:** mientras dure el puente, los enlaces a `/jugador/:id` de las vistas simuladas (buscador de talento, panel de equipo y detalle de oferta) llevan ids de la simulación y dan «Perfil no encontrado» | El perfil público ya consulta la API real y esos ids no existen en la base. Se corrige al conectar cada vista; hasta entonces, en una demostración se llega al perfil público con un id real. «Ver como lo ven los equipos» de Mi perfil ya usa el id real desde que la vista se conectó. |
| `/mi-perfil` tiene la cabecera (nombre, avatar, ubicación con su macrorregión, disponibilidad, disposición a relocalizarse y enlace al perfil público propio) y la pestaña «Datos profesionales» reales. El formulario reúne presentación, horas semanales y ubicación en un solo `PATCH /perfiles/jugador`. **Sustituye a la tarjeta temporal «Ubicación»** | Era la parte de la vista que el módulo `perfiles` ya puede servir. Un solo formulario evita dos botones de guardar para el mismo recurso. Salen de la vista el `@handle`, los roles preferidos, los años de experiencia, los equipos anteriores y el anillo de verificación de la cabecera: no tienen modelo detrás (ver «Pendientes»). |
| Cuentas, habilidades, portafolio, postulaciones, privacidad y los laterales de evidencia y notificaciones siguen simulados, cada uno con la marca compartida `MarcaDatosDemo`; `/mi-perfil` entra en `RUTAS_SIN_DATOS_DEMO` y pierde el aviso de página | En una vista mixta, un aviso de página diría que nada es real. La marca va en la sección: una línea al abrir cada pestaña simulada y una insignia en la cabecera de cada lateral. Con `VITE_DEMO_DATA` apagado esas secciones no se montan y la vista queda con la cabecera y los datos profesionales. Se retiran a medida que se conecten sus módulos (S2: cuentas y estadísticas; tarea 2.2: habilidades). |
| El servidor recorta la presentación y guarda una en blanco como `null` | `perfilJugadorSchema` no admite `null` en `bio` y el formulario envía el texto vacío para borrarla; sin normalizar, el perfil público mostraría un párrafo vacío en lugar de su estado «todavía no ha escrito su presentación». |
| Los mensajes por defecto de Zod se traducen con un **mapa de errores global del cliente** (`z.setErrorMap(mapaErroresZod)`, instalado en `main.tsx` y en el setup de pruebas), por código de error (`too_small`, `too_big`, `invalid_type`, `invalid_string`, `invalid_enum_value`), con los textos en `es.validacion` de `i18n/es.ts`. No hay traducciones por campo y los mensajes no van a `shared` | Los esquemas del contrato no personalizan esos mensajes y llegaban en inglés. Un único mapa vale para todos los formularios, también con los esquemas de `@proplay/shared`, porque el cliente usa una sola copia de Zod. Los mensajes propios de un esquema («Selecciona el departamento») tienen prioridad y no pasan por el mapa. Las reglas siguen saliendo del contrato: el mapa sólo cambia el texto. |
| **Límite conocido:** la disponibilidad semanal no se puede vaciar una vez guardada | `perfilJugadorSchema` no admite `null` en `disponibilidadHoras`, así que el formulario no la envía si el campo queda vacío y se conserva el valor anterior. Se acepta así por ahora; si hace falta borrarla, es un cambio de `shared` en su propio PR. |
| Todo campo de URL del contrato (`avatarUrl`, `sitioWeb`, `logoUrl`, `mediaUrls`) usa `urlHttpSchema` (`schemas/common.ts`), que sólo admite `http:` y `https:` | `z.string().url()` acepta cualquier esquema que `new URL` sepa leer, incluidos `javascript:` y `data:`: guardados y pintados en un `href`, ejecutan código. El protocolo se comprueba ya normalizado por `URL` (mayúsculas, espacios y tabuladores no lo esquivan). No lleva mensaje propio: emite `invalid_string`/`url` y el cliente lo traduce con su mapa global. Al pintar una URL como enlace externo se usa `target="_blank"` con `rel="noopener noreferrer"`. |
| En los `PATCH`, un campo ausente no cambia y `null` lo borra; el cliente envía `null` cuando el campo queda vacío. `perfilEquipoSchema` pasa a ser parcial: `nombreOrg` se puede omitir pero no borrar (es obligatorio en la base); `descripcion`, `sitioWeb` y `logoUrl` admiten `null`. `avatarUrl` del jugador, también | Con el esquema anterior la descripción y el sitio web, una vez guardados, no se podían quitar, y `nombreOrg` obligatorio contradecía la semántica parcial del `PATCH`. La presentación y la disponibilidad del jugador no cambian en este PR: la disponibilidad sigue como límite conocido (entrada anterior). |
| `PATCH /perfiles/equipo` edita `nombreOrg`, `descripcion` y `sitioWeb` del perfil de la organización; sólo el rol `EQUIPO` (el scout recibe 403, porque no tiene perfil propio). Una descripción en blanco se guarda como `null`, igual que la presentación del jugador. `logoUrl` lo admite el contrato pero no se edita desde la interfaz hasta que exista la subida de imágenes | Es la parte de RF-07 que el modelo ya sostiene. El perfil público de la organización queda fuera de esta tarea. |
| La edición vive en una tarjeta «Datos de la organización» de `/panel-equipo`, sólo para `EQUIPO`. El subtítulo del panel pasa a ser el nombre real de la organización (antes, nombre y región de la persona de ejemplo). `/panel-equipo` entra en `RUTAS_SIN_DATOS_DEMO` y sus secciones simuladas (indicadores, vacantes, procesos y recomendaciones) llevan `MarcaDatosDemo`, que no se pinta con el puente apagado | Mismo criterio que `/mi-perfil` para una vista mixta. Para el scout y el administrador el panel no tiene datos reales, pero cada sección ya lleva su marca, así que el aviso de página sobraría. El enlace al sitio web se abre en otra pestaña con `rel="noopener noreferrer"`. |

## Recorte de alcance

Tarea 0.10 del plan. El inventario de vistas de `CLAUDE.md` (§5) marca cada fila con su
alcance; esta sección recoge la decisión y su porqué.

| Decisión | Justificación |
| --- | --- |
| La tesis se queda con **19 vistas**: 13 de núcleo y 6 de soporte mínimo. El resto del inventario pasa a trabajo futuro; ninguna fila se borra | Criterio: entra lo necesario para demostrar la verificabilidad y el matching explicable, y para ejecutar y medir el piloto (H1 y H2). Lo demás no cabe en los sprints que quedan, y decidirlo ahora se defiende; descubrirlo en la última semana, no. |
| **Núcleo (13):** Ingreso y registro · Aviso de privacidad · 404 · Perfil público del jugador · Mi perfil · Cuentas vinculadas · Mis estadísticas · Explorar oportunidades · Detalle de oferta y postulación · Crear oferta con pesos · Ranking con desglose · Detalle del candidato con explicación · Analítica (fusionada con el panel del equipo) | Cubren de punta a punta las dos decisiones que definen el producto: el perfil construido con datos de Riot (cuentas vinculadas, estadísticas, perfil público) y el ranking explicable (oferta con pesos, ranking, detalle del candidato), más la analítica que mide el piloto. |
| **Soporte mínimo (6):** Mi cuenta · Ajustes de privacidad (sólo visibilidad: perfil público sí/no y mostrar ubicación) · Habilidades y endorsements (catálogo fijo, endorsements sólo de equipos) · Buscador de talento (filtros por rol, rango y departamento) · Mis postulaciones (pestaña de Mi perfil, sin vista propia) · Postulaciones recibidas (dentro del detalle de la oferta, sin vista propia) | Son necesarias para que el núcleo funcione o para cumplir RNF-05, pero no son el aporte del proyecto: se construyen en su versión más pequeña. Las dos de postulaciones no tienen ruta propia porque su contexto natural ya es una vista del núcleo. |
| **Trabajo futuro, por orden de recuperación si sobra tiempo:** 1) Recuperar contraseña, 2) Mensajes, 3) Perfil público de la organización | Son las que más echaría en falta un usuario del piloto, en ese orden: sin recuperación de contraseña, quien la olvide no tiene cómo volver a entrar; sin mensajes, el contacto depende del sustituto descrito abajo. |
| **Descartadas:** Verificación de correo · Feed · Onboarding · Comparador de candidatos · Lista de seguimiento · Panel de administración y sus subvistas | El contenido del onboarding vive en Cuentas vinculadas y en el aviso de ubicación de Mi perfil. Las operaciones de administración van por scripts documentados en `docs/operacion.md`. El resto no aporta a H1 ni a H2. |
| **La analítica son cuatro indicadores:** embudo de la vacante con tiempo hasta cubrirla (mide H1), qué dimensión decide el ranking, mapa del talento verificado por macrorregión, rol y rango (el Caribe frente al resto), y tendencia del rendimiento del jugador, que vive en Mis estadísticas | Es el componente de innovación que exige el director. Cada indicador sale de datos que el sistema ya tiene o tendrá: el embudo exige guardar la fecha de cada cambio de estado de la postulación (tarea del S3 en el plan); el mapa, la ubicación del jugador y sus cuentas verificadas; la dimensión decisiva, el desglose de `Matching`. |
| **RF-12 (mensajería y notificaciones) y la interfaz de RF-14 (administración) pasan a fase 2**. El registro de auditoría de RF-14 se sigue escribiendo en `AuditLog`; lo que sale es la vista para consultarlo | Ninguna de las dos es necesaria para demostrar la verificabilidad ni el matching. La traza sí se queda: es RNF-06 y la Ley 1581 la exige con o sin interfaz. |
| Sustituto de la mensajería en el piloto: **el equipo ve el correo del jugador cuando preselecciona su postulación**. Pendiente de reflejarlo en el aviso de privacidad cuando se implemente | Sin mensajería, el equipo necesita un canal para contactar al candidato elegido. Mostrar el correo sólo tras la preselección limita la exposición a quien ya tiene un proceso abierto con el jugador. Es una cesión de un dato personal a un tercero, así que el aviso debe decirlo antes de que ocurra (Ley 1581); si eso cambia el texto, sube `VERSION_AVISO_PRIVACIDAD`. |

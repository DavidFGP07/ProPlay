# ProPlay — Plan de implementación y guía de trabajo colaborativo

> Documento para los tres integrantes del equipo. Estado al cierre del Sprint 1.
> Guardar como `docs/plan-implementacion.md` en el repositorio.
> Bloques 0, 1 y 2 actualizados el 2026-10-28 con lo fusionado en `main` (PR #1 a #22).

---

## 1. Dónde estamos hoy

### Funciona de verdad

**Backend.** Un único módulo implementado, `usuarios`, con autenticación completa:
registro, inicio de sesión, refresco, cierre de sesión y consulta del usuario en sesión.
Más listado de usuarios para administrador, edición de la cuenta propia y consulta por id.

Infraestructura común operativa: `GET /health` comprobando Postgres y Redis; middlewares de
helmet, CORS, límite de peticiones, verificación JWT, control por rol, validación con los
esquemas de `@proplay/shared` y manejador de errores con forma única. Contraseñas con
bcryptjs a 12 rondas y tokens de cuentas de juego cifrados con AES-256-GCM. 134 pruebas
automáticas de la API pasando (`npm run verify` en `main`, 2026-10-28).

**Base de datos.** Esquema completo con las 15 entidades, migraciones y extensión
`pgvector`. El índice HNSW sobre `PerfilVector.embedding` **no existía hasta el #5**: el
esquema declaraba la columna `vector(64)` pero ninguna migración creaba el índice. Hoy vive
en la migración manual `20261027153113_indice_hnsw_perfil_vector` y lo vigila
`check:indice-hnsw` dentro de `npm run verify` y del CI (#10). El seed carga 15 jugadores con estadísticas y vectores de 64 dimensiones,
3 equipos, 5 ofertas y 16 habilidades. **Esos datos están en la base pero ningún endpoint
los lee todavía.**

**Frontend.** Once rutas más el 404, todas navegables. Registro e inicio de sesión reales
contra la API, sesión en memoria con cookie `httpOnly`, guardas de rol en el enrutador.
161 pruebas del cliente pasando (`npm run verify` en `main`, 2026-10-28; `packages/shared`
no tiene pruebas propias). Lint y typecheck limpios en los tres workspaces.

**Despliegue.** La imagen de la API construye y arranca. Todavía no se ha desplegado nunca
en un servidor real.

### No funciona todavía

Ocho módulos del backend responden `501`: `perfiles`, `estadisticas`, `ofertas`,
`matching`, `scouting`, `mensajeria`, `notificaciones` y `admin`. Las integraciones con
Riot, Steam, Twitch, YouTube y Cloudinary son esqueleto con `TODO`.

En la aplicación, todo lo que no sea autenticación viene de la simulación en
`apps/web/src/mocks/`, y por eso aparece el aviso «Datos de demostración». Cada hook de
`apps/web/src/api/` lleva un `TODO` con el endpoint y el sprint que lo conecta.

### La frase honesta

Tenemos un producto que **se ve terminado y está terminado sólo en autenticación**. El
aporte diferencial del proyecto —los perfiles verificables y el motor de matching— aún no
existe. Eso es normal al cierre del Sprint 1 y es exactamente lo que toca construir ahora.

---

## 2. Bloque 0 — Desbloqueos. Máxima prioridad, esta semana

**Estas tareas no son de código y varias bloquean sprints completos.** Si no avanzan en
paralelo al desarrollo, el proyecto se queda sin piso aunque el software funcione.

| # | Tarea | Por qué urge | Responsable | Fecha |
|---|---|---|---|---|
| 0.1 | **Solicitar la clave de producción de la API de Riot** | Las claves de desarrollo caducan cada 24 h. La aprobación tarda semanas y **bloquea todo el Sprint 2**. Exige una política de privacidad publicada | | |
| 0.2 | **Medir la línea base del scouting manual.** Entrevistar 2–3 equipos del Caribe y registrar cuánto tardan hoy en llenar una vacante | Sin ese número, la hipótesis H1 no se puede contrastar. En la sustentación no habría contra qué comparar | | |
| 0.3 | **Decidir un solo juego para el piloto** (propuesta: League of Legends vía Riot)<br>**Decidida:** solo League of Legends con la API de Riot; Steam, Twitch y YouTube pasan a trabajo futuro (`docs/decisiones.md`, «Privacidad y piloto», #11) | Cuatro integraciones OAuth en seis semanas no caben. Una completa vale más que cuatro a medias | | |
| 0.4 | **Decidir qué se hace con los menores de edad**: restringir el registro a mayores de 18 y declararlo, o implementar autorización del representante legal<br>**Decidida:** solo mayores de 18, con declaración obligatoria en el registro; la autorización del representante pasa a trabajo futuro (`docs/decisiones.md`, «Privacidad y piloto», #11; esquema en #8 y columnas en #9) | Buena parte del talento emergente de eSports tiene entre 14 y 17 años. La Ley 1581 da tratamiento especial a sus datos | | |
| 0.5 | **Desbloquear el CI**: ticket a GitHub Support y, si el director lo autoriza, hacer el repositorio público<br>**Resuelta:** el CI corre en cada pull request y en `main` desde que se resolvió la facturación de GitHub; su primer fallo se corrigió en #7 | Seis semanas con tres personas commiteando sin verificación automática es pedir un accidente | | |
| 0.6 | **Montar `npm run verify` local** (`lint && typecheck && test`) y la regla de no empujar sin correrlo<br>**Hecha:** #2; la guarda del índice HNSW se añadió en #10 | Cubre el hueco mientras el CI esté bloqueado | | |
| 0.7 | **Plan de reclutamiento del piloto**: lista objetivo de 50 jugadores y 3 equipos, y quién contacta a cada uno | Conseguir 50 jugadores reales es más difícil que construir el matching, y tiene el mismo plazo | | |
| 0.8 | **Diseñar los instrumentos de medición**: encuesta de NPS y de percepción de objetividad | Se aplican al final pero se diseñan ahora. Improvisarlos la última semana invalida el resultado | | |
| 0.9 | **Consultar si la facultad exige aval de comité de ética** para pruebas con personas | En varias universidades sí, y tramitarlo tarda | | |
| 0.10 | **Recortar el alcance**: decidir cuáles de las 39 vistas del inventario entran en la tesis y declarar el resto como trabajo futuro | No vamos a construir 39. Decidirlo ahora se defiende; descubrirlo en la última semana, no | | |

**Sobre 0.1:** la clave de producción de Riot exige que el aviso de privacidad esté
publicado en una URL pública. `/legal/privacidad` ya existe (#11), pero sólo en local: hay
que **desplegar el cliente antes de solicitar la clave**, y por tanto antes del piloto. Eso
adelanta parte del ensayo de despliegue (2.13).

---

## 3. Bloque 1 — Cerrar el Sprint 1

Deuda pendiente registrada en `docs/decisiones.md`. Son tareas pequeñas y se pueden
repartir.

| # | Tarea | Alcance | Prioridad |
|---|---|---|---|
| 1.1 | Vista `/legal/privacidad` y persistir la aceptación con fecha y versión del aviso<br>**Hecha:** #8 (contrato), #9 (columnas) y #11 (vista y aceptación persistida) | Hoy el registro pide aceptar un documento que no existe y no guarda la aceptación. Es RNF-05 y Ley 1581 | Alta |
| 1.2 | Hacer público `/jugador/:id`<br>**Hecha:** #17 (contrato en lista blanca) y #18 (perfil público sin sesión) | Es la vitrina del jugador. Si exige sesión, el argumento central del proyecto no se cumple. Quitar la guarda | Alta |
| 1.3 | Vista de cuenta para equipo, scout y administrador, y ruta `PATCH` de cambio de contraseña<br>**Hecha:** #3 (esquema), #4 (columna) y #6 (vista `/cuenta` y cambio de contraseña) | Hoy tres de los cuatro roles no pueden cambiar ni su nombre ni su contraseña | Alta |
| 1.4 | Documentar el alta del primer administrador<br>**En curso:** rama `feat/api-alta-administrador` | Para el piloto hace falta un admin real en producción. Hoy sólo hay un comentario que dice «se asigna a mano» | Media |
| 1.5 | Decidir e implementar dónde se captura la región del jugador<br>**Hecha:** #13 (modelo por país y departamento), #14 y #15 (API) y #16 (tarjeta «Ubicación» en Mi perfil) | El registro dejó de pedirla y no hay onboarding. Es insumo de la dimensión geográfica del matching, que se necesita en S3 | Alta |
| 1.6 | Deuda técnica diferida: partir `ui.tsx` en un archivo por componente, extraer los textos a `i18n/es.ts`, implementar los cuatro estados transversales, sembrar los comentarios `// RF-xx` en las vistas<br>**Pendiente.** Entre los textos por extraer están los escritos directamente en el JSX de `PanelEquipoPage.tsx` («Procesos de selección», «Gestión de vacantes…»), que no pasan por `es.ts` | No bloquea, pero cuanto más se posponga más cuesta | Baja |

---

## 4. Bloque 2 — Sprint 2: perfil verificable

**Objetivo del sprint:** que un jugador vincule su cuenta de Riot y su perfil muestre
estadísticas traídas de la API oficial, normalizadas y con métricas derivadas. Es el sprint
en el que la promesa de verificabilidad deja de ser una afirmación del documento.

La integración es **solo con Riot (League of Legends)**, según la decisión 0.3. Steam,
Twitch, YouTube y las demás plataformas pasan a trabajo futuro; sus esqueletos siguen en
`apps/api/src/integrations/` sin tocar.

### Backend

| # | Tarea |
|---|---|
| 2.1 | Módulo `perfiles`: consulta y edición del perfil de jugador y del perfil de equipo<br>**Adelantada en el Sprint 1.** Jugador: #14 y #15 (`GET /perfiles/me`, `PATCH /perfiles/jugador`) y #19 (`/mi-perfil`). Perfil público: #17 y #18 (`GET /perfiles/:id`). Equipo: #20 y #21 (`PATCH /perfiles/equipo` y «Datos de la organización» en `/panel-equipo`) |
| 2.2 | Habilidades y endorsements: asignación, niveles y validación por terceros |
| 2.3 | Módulo `integraciones`: implementar `GameStatsProvider` para Riot — flujo OAuth, obtención de la cuenta, obtención del historial de partidas |
| 2.4 | Cifrado y descifrado de los tokens de `CuentaGaming`, y refresco automático cuando expiren |
| 2.5 | Worker de ingesta: programación periódica, reintentos con retroceso, y control de cuota de la API de Riot usando Redis |
| 2.6 | Módulo `estadisticas`: persistencia, limpieza de duplicados, normalización a escala 0–1 y cálculo de métricas derivadas (KDA, win rate, tendencias) |
| 2.7 | Endpoints de consulta de estadísticas por jugador y por juego |

### Frontend

| # | Tarea |
|---|---|
| 2.8 | Vista de cuentas vinculadas: estado por plataforma, última sincronización, vincular, desvincular y **aviso claro de qué datos se leen y para qué** (exigencia de la Ley 1581) |
| 2.9 | Vista de mis estadísticas: por juego, histórico y tendencias |
| 2.10 | Conectar los hooks de perfil y estadísticas; **retirar el puente de demostración en esas vistas** y con él su distintivo |
| 2.11 | Onboarding, si es ahí donde se decide capturar la región (ver 1.5) |
| 2.12 | **Distintivo de verificación** visible junto a cada métrica que venga de la API oficial. Es el argumento central del proyecto hecho visible |

### Infraestructura

| # | Tarea |
|---|---|
| 2.13 | **Ensayo de despliegue real**: API en Railway o Render, cliente en Vercel, base gestionada. No dejarlo para la última semana |
| 2.14 | Variables de entorno y secretos de producción, con rotación documentada |

---

## 5. Bloque 3 — Sprint 3: el motor de matching

**Objetivo del sprint:** que un equipo publique una oferta, ajuste los pesos de las cinco
dimensiones y reciba un ranking de candidatos con su desglose. Es el sprint que decide si
el proyecto demuestra lo que promete.

**Hueco a resolver antes del sprint, junto con la tarea 3.5:** el modelo de trayectoria para
la dimensión de experiencia. El documento la define como historial en equipos, torneos,
competencias y logros, pero ni el modelo entidad-relación ni `schema.prisma` tienen dónde
guardar equipos anteriores, torneos y logros (hoy los simula el prototipo). Hay que diseñar
ese modelo y decidir cómo se distingue lo declarado por el jugador de lo verificado. Está
registrado en `docs/decisiones.md`, «Pendientes».

### Backend

| # | Tarea |
|---|---|
| 3.1 | Módulo `ofertas`: creación, edición, cierre y estados |
| 3.2 | Postulaciones y sus estados. Decidir aquí si se incorpora el estado `entrevista` que el prototipo propuso y que el documento sugiere con «invitar a un tryout» |
| 3.3 | Vectorizador de perfil: convertir estadísticas normalizadas y atributos en el vector de 64 dimensiones y persistirlo en `PerfilVector` |
| 3.4 | Recuperador por contenido: consulta de vecinos más cercanos sobre el índice HNSW de `pgvector` |
| 3.5 | **Definir y documentar la fórmula de cada una de las cinco dimensiones** (técnica, experiencia, habilidades blandas, geográfica, disponibilidad). Hoy sólo están descritas en prosa. La de experiencia depende del modelo de trayectoria (ver el párrafo anterior) |
| 3.6 | Ponderador: aplicar la ecuación del documento con pesos configurables por oferta |
| 3.7 | Persistir el resultado en `Matching` con el desglose por dimensión |
| 3.8 | Módulo `scouting`: búsqueda de jugadores con filtros por juego, rol, rango, región y disponibilidad |
| 3.9 | **Medir RNF-01 en este sprint**: percentil 95 por debajo de 2 s con 1.000 perfiles indexados. Si se mide al final y falla, corregirlo exige rehacer el motor |

### Frontend

| # | Tarea |
|---|---|
| 3.10 | Crear oferta con **deslizadores de pesos que siempre suman 100 %**: al mover uno, los demás se reajustan. Es lo que materializa la ecuación y distingue a ProPlay de un tablón de empleo |
| 3.11 | **Ranking de candidatos con desglose por dimensión** en gráfico de radar o barras. Es la pantalla estrella de la sustentación: si sólo muestra un número, el diferencial no se ve |
| 3.12 | Detalle del candidato |
| 3.13 | Mis postulaciones (jugador) y postulaciones recibidas (equipo) |
| 3.14 | Conectar los hooks correspondientes y retirar el puente de demostración en esas vistas |

---

## 6. Bloque 4 — Sprint 4: IA generativa, cierre y validación

### Backend

| # | Tarea |
|---|---|
| 4.1 | Explicador: generar en lenguaje natural la justificación del puntaje, anclada en datos recuperados en tiempo real |
| 4.2 | Sandbox de Python para el cálculo exacto de métricas, fuera del modelo de lenguaje |
| 4.3 | **Degradación elegante**: si el servicio de LLM falla, se muestra el desglose numérico y el ranking sigue funcionando. El ranking nunca depende de que el LLM esté vivo |
| 4.4 | Módulo `mensajeria`: conversaciones y mensajes |
| 4.5 | Módulo `notificaciones`: consumo de eventos publicados por los demás módulos |
| 4.6 | Módulo `admin`: métricas, cambio de rol, suspensión de cuentas y consulta de auditoría |

### Frontend

| # | Tarea |
|---|---|
| 4.7 | Explicación del matching en el detalle del candidato |
| 4.8 | Mensajería conectada |
| 4.9 | Notificaciones conectadas |
| 4.10 | Dashboard de analítica con datos reales |
| 4.11 | Subvistas de administración |
| 4.12 | **Retirar por completo el puente de demostración y la bandera `VITE_DEMO_DATA`** |

### Validación

| # | Tarea |
|---|---|
| 4.13 | Ejecutar las pruebas piloto con los equipos y jugadores reclutados |
| 4.14 | Aplicar los instrumentos de medición y recoger las métricas de la plataforma |
| 4.15 | Redactar el informe de validación |
| 4.16 | Incorporar los resultados al documento y contrastar las hipótesis H1 y H2 contra la línea base del punto 0.2 |

---

## 7. Bloque 5 — Documento y sustentación. Transversal

| # | Tarea |
|---|---|
| 5.1 | Mantener el documento al día con los cambios de diseño que surjan en cada sprint |
| 5.2 | Incorporar los resultados de validación |
| 5.3 | Preparar una demostración guionizada, con usuarios y datos preparados de antemano |
| 5.4 | Manual de usuario y manual técnico |
| 5.5 | Resumen ejecutivo para posible publicación |

---

## 8. Trabajo colaborativo: ramas

### El principio

`main` es la rama de integración y de despliegue. **Nadie commitea directamente en `main`.**
Todo entra por pull request desde una rama corta.

No usamos `develop` ni Git Flow: con tres personas y seis semanas, esa ceremonia cuesta más
de lo que aporta.

### Nomenclatura

```
feat/<ámbito>-<asunto>      funcionalidad nueva
fix/<ámbito>-<asunto>       corrección
chore/<asunto>              configuración, dependencias, infraestructura
docs/<asunto>               documentación y el documento del proyecto
```

Ejemplos: `feat/api-perfiles`, `feat/web-cuentas-vinculadas`, `fix/api-refresh-limite`,
`docs/plan-implementacion`.

### Reglas

1. **Una rama por tarea, no por sprint.** Vida máxima de tres o cuatro días. Si una rama
   vive más, está mal partida.
2. **Pull request siempre, con un revisor.** Aunque el cambio sea pequeño. Es lo que evita
   que alguien descubra en la semana seis que otro reescribió lo mismo.
3. **`npm run verify` antes de empujar, y el CI en verde antes de fusionar.** Sin
   excepción. (Mientras el CI estuvo bloqueado, `verify` era la única verificación; ver 0.5.)
4. **Antes de abrir una rama, `git pull` sobre `main`.** Y rebase o merge de `main` a diario
   si la rama vive más de un día.
5. **Borrar la rama tras fusionar.**

### Cómo repartirse el trabajo

**Por rebanada vertical, no por capa.** Es decir: cada persona toma un módulo de principio a
fin —endpoint, hook y vista— en lugar de que uno haga «todo el backend» y otro «todo el
frontend».

La razón es la que ya nos costó tres semanas: cuando frontend y backend avanzan por
separado, terminan sin encajar. Con rebanadas verticales, quien construye el endpoint es
quien lo consume, y el desajuste aparece en el momento, no al integrar.

**Reparto propuesto para el Sprint 2:**

| Persona | Rebanada | Ramas |
|---|---|---|
| A | Perfiles y habilidades | `feat/perfiles-api`, `feat/perfiles-web` |
| B | Integración con Riot, worker de ingesta y estadísticas | `feat/integraciones-riot`, `feat/estadisticas-api` |
| C | Vistas de cuentas vinculadas y estadísticas, más el cierre de la deuda del Sprint 1 | `feat/web-cuentas-vinculadas`, `feat/web-estadisticas`, `fix/s1-pendientes` |

**Reparto propuesto para el Sprint 3:**

| Persona | Rebanada | Ramas |
|---|---|---|
| A | Ofertas y postulaciones, de extremo a extremo | `feat/ofertas-api`, `feat/ofertas-web` |
| B | Motor de matching: vectorizador, recuperador, ponderador y medición de RNF-01 | `feat/matching-motor` |
| C | Pantallas estrella: creación de oferta con pesos y ranking con desglose | `feat/web-pesos-oferta`, `feat/web-ranking` |

### Zonas de conflicto

Hay cuatro sitios que todos tocan y donde los conflictos son seguros si no hay disciplina:

| Zona | Regla |
|---|---|
| `packages/shared` | Los cambios de contrato van en **su propio PR, pequeño y fusionado rápido**, y se avisan en el grupo antes de abrirlo. Nunca mezclados con una funcionalidad |
| `apps/api/prisma/schema.prisma` y migraciones | Igual: PR propio. Y recordar que los enums de `shared` y los de Prisma se cambian **en el mismo commit** |
| El enrutador y la tabla de navegación del cliente | Avisar antes de añadir rutas. Son archivos que todos rozan |
| `docs/decisiones.md` y `CLAUDE.md` | Añadir al final, nunca reordenar. Si hay conflicto, se resuelve conservando ambas entradas |

### Ritmo

Tres sincronizaciones cortas por semana, de quince minutos: qué hice, qué voy a hacer, qué
me bloquea. Y una revisión al cierre de cada sprint sobre un incremento desplegado y
verificable, no sobre una rama local.

---

## 9. Orden de ataque recomendado

1. **Hoy:** repartir el Bloque 0 y poner fecha a cada punto. Especialmente 0.1 (Riot),
   0.2 (línea base) y 0.10 (recorte de alcance).
2. **Esta semana:** cerrar el Bloque 1 en paralelo.
3. **Semanas 3 y 4:** Sprint 2, con el ensayo de despliegue incluido.
4. **Semanas 5 y 6:** Sprint 3. Medir RNF-01 dentro del sprint.
5. **Semanas 7 y 8:** Sprint 4 y validación.

El criterio que ordena todo: **primero lo que resuelve incertidumbre**. Si las APIs de Riot
no dan los datos que esperamos, o si la búsqueda vectorial no responde en dos segundos,
queremos saberlo en la semana cuatro y no en la ocho.

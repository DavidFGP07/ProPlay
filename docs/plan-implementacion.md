# ProPlay — Plan de implementación y guía de trabajo colaborativo

> Documento para los tres integrantes del equipo. Escrito al cierre del Sprint 1 y
> **actualizado el 2026-11-17 con lo fusionado en `main` (PR #1 a #55)**: cada tarea dice si
> está hecha (con sus PR), pendiente, reemplazada o fuera de alcance. Lo que no se puede
> comprobar desde el repositorio va marcado «sin verificar desde el código».

---

## 1. Dónde estamos hoy

Estado al 2026-11-17, con `main` en el PR #55. El detalle vive en otros documentos y aquí
sólo se resume: las rutas y su estado, en el README («Rutas de la API»); las vistas, en el
inventario de `CLAUDE.md` §5; el porqué de cada decisión, en `docs/decisiones.md`.

### Funciona de verdad

- **Sprint 1 (fundación y acceso), cerrado salvo 1.6.** Autenticación completa con
  la aceptación del aviso de privacidad y la mayoría de edad, `/cuenta`, perfiles de jugador
  y de equipo con ubicación, perfil público sin sesión y alta del primer administrador por
  script.
- **Sprint 2 (perfil verificable), cerrado salvo 2.2, 2.13 y 2.14.** Vinculación de la cuenta
  de Riot por desafío de icono, ingesta en cola con cuota global en Redis y sincronización
  periódica, Cuentas vinculadas y Mis estadísticas con su tendencia, y el buscador de
  talento.
- **Sprint 3 (motor de matching), cerrado salvo 3.15 y 3.18.** Ofertas con estados, pesos,
  modalidad y ubicación; postulaciones con la fecha de cada etapa; motor de matching
  (vectorizador, recuperador HNSW, cinco dimensiones, ponderador y persistencia); ranking
  con desglose y detalle del candidato; RNF-01 medido en local (`docs/rnf-01.md`).
- **Sprint 4: la analítica (4.10) está hecha**, con el script de las métricas del piloto.

La calidad la sostienen `npm run verify` (guarda del índice HNSW, lint, typecheck y
pruebas de los tres workspaces) y el CI en cada pull request contra `main`, con una base de
pruebas propia (`proplay_test`).

### No funciona todavía

- **Sprint 4:** el sandbox de Python (4.2; el cálculo es determinista en TypeScript, decisión
  «Calculador exacto») y retirar el puente de demostración (4.12).
- **Despliegue** (2.13): nunca se ha desplegado. Sin URL pública tampoco se puede pedir la
  clave de producción de Riot (0.1).
- **Soporte:** habilidades y endorsements (2.2), ajustes de privacidad y el sustituto de la
  mensajería (3.18).
- **Secciones simuladas de Mi perfil** (cuentas, habilidades, portafolio, privacidad y
  laterales), que desaparecen con `VITE_DEMO_DATA=false`.
- **Validación** (4.13 a 4.16): depende del despliegue, del reclutamiento y de la línea base,
  que no constan en el repositorio.

---

## 2. Bloque 0 — Desbloqueos. Máxima prioridad, esta semana

**Estas tareas no son de código y varias bloquean sprints completos.** Si no avanzan en
paralelo al desarrollo, el proyecto se queda sin piso aunque el software funcione.

| # | Tarea | Por qué urge | Responsable | Fecha |
|---|---|---|---|---|
| 0.1 | **Solicitar la clave de producción de la API de Riot**<br>**Sin verificar desde el código** (no consta en el repositorio). En el código, `RIOT_LIMITES` sigue por defecto en la cuota de la clave de desarrollo. | Las claves de desarrollo caducan cada 24 h. La aprobación tarda semanas y **bloquea todo el Sprint 2**. Exige una política de privacidad publicada | | |
| 0.2 | **Medir la línea base del scouting manual.** Entrevistar 2–3 equipos del Caribe y registrar cuánto tardan hoy en llenar una vacante<br>**Sin verificar desde el código** (no consta en el repositorio). En el código, `LINEA_BASE_SCOUTING_MANUAL` sigue en `null` (#51); lo que debe medir está en `docs/arquitectura.md`, «Línea base». | Sin ese número, la hipótesis H1 no se puede contrastar. En la sustentación no habría contra qué comparar | | |
| 0.3 | **Decidir un solo juego para el piloto** (propuesta: League of Legends vía Riot)<br>**Decidida:** solo League of Legends con la API de Riot; Steam, Twitch y YouTube pasan a trabajo futuro (`docs/decisiones.md`, «Privacidad y piloto», #11) | Cuatro integraciones OAuth en seis semanas no caben. Una completa vale más que cuatro a medias | | |
| 0.4 | **Decidir qué se hace con los menores de edad**: restringir el registro a mayores de 18 y declararlo, o implementar autorización del representante legal<br>**Decidida:** solo mayores de 18, con declaración obligatoria en el registro; la autorización del representante pasa a trabajo futuro (`docs/decisiones.md`, «Privacidad y piloto», #11; esquema en #8 y columnas en #9) | Buena parte del talento emergente de eSports tiene entre 14 y 17 años. La Ley 1581 da tratamiento especial a sus datos | | |
| 0.5 | **Desbloquear el CI**: ticket a GitHub Support y, si el director lo autoriza, hacer el repositorio público<br>**Resuelta:** el CI corre en cada pull request y en `main` desde que se resolvió la facturación de GitHub; su primer fallo se corrigió en #7 | Seis semanas con tres personas commiteando sin verificación automática es pedir un accidente | | |
| 0.6 | **Montar `npm run verify` local** (`lint && typecheck && test`) y la regla de no empujar sin correrlo<br>**Hecha:** #2; la guarda del índice HNSW se añadió en #10 | Cubre el hueco mientras el CI esté bloqueado | | |
| 0.7 | **Plan de reclutamiento del piloto**: lista objetivo de 50 jugadores y 3 equipos, y quién contacta a cada uno<br>**Sin verificar desde el código** (no consta en el repositorio). | Conseguir 50 jugadores reales es más difícil que construir el matching, y tiene el mismo plazo | | |
| 0.8 | **Diseñar los instrumentos de medición**: encuesta de NPS y de percepción de objetividad<br>**Sin verificar desde el código** (no consta en el repositorio). | Se aplican al final pero se diseñan ahora. Improvisarlos la última semana invalida el resultado | | |
| 0.9 | **Consultar si la facultad exige aval de comité de ética** para pruebas con personas<br>**Sin verificar desde el código** (no consta en el repositorio). | En varias universidades sí, y tramitarlo tarda | | |
| 0.10 | **Recortar el alcance**: decidir cuáles de las 39 vistas del inventario entran en la tesis y declarar el resto como trabajo futuro<br>**Cerrada:** 19 vistas (13 de núcleo y 6 de soporte mínimo); el resto, trabajo futuro. Columna «Alcance» en el inventario de `CLAUDE.md` (§5) y decisión en `docs/decisiones.md`, «Recorte de alcance». Las tareas de los bloques 2 a 4 están reubicadas según ella y las que salen están en el Bloque 6 | No vamos a construir 39. Decidirlo ahora se defiende; descubrirlo en la última semana, no | | |

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
| 1.4 | Documentar el alta del primer administrador<br>**Hecha:** #25 (`npm run admin:promover -w api`, `docs/operacion.md`) | Para el piloto hace falta un admin real en producción. Hoy sólo hay un comentario que dice «se asigna a mano» | Media |
| 1.5 | Decidir e implementar dónde se captura la región del jugador<br>**Hecha:** #13 (modelo por país y departamento), #14 y #15 (API) y #16 (tarjeta «Ubicación» en Mi perfil) | El registro dejó de pedirla y no hay onboarding. Es insumo de la dimensión geográfica del matching, que se necesita en S3 | Alta |
| 1.6 | Deuda técnica diferida: partir `ui.tsx` en un archivo por componente, extraer los textos a `i18n/es.ts`, implementar los cuatro estados transversales, sembrar los comentarios `// RF-xx` en las vistas<br>**Pendiente en parte.** Los cuatro estados ya tienen componentes compartidos y los usan las vistas conectadas; `ui.tsx` sigue sin partir y las vistas heredadas del prototipo conservan textos en el JSX (`docs/decisiones.md`, «Deuda conocida»). | No bloquea, pero cuanto más se posponga más cuesta | Baja |
| 1.7 | **Retirar del menú de la versión del piloto las vistas simuladas fuera de alcance** (Feed, Mensajes, Dashboard simulado y Admin), conservando su código como prototipo. La página de inicio redirige a Explorar oportunidades (jugador) o a Analítica (equipo y scout). Decisión 0.10<br>**Hecha (#58).** Feed, Mensajes y Auditoría salen del menú; `/` redirige a la vista principal del rol y `/mensajes` y `/admin` muestran «Función no disponible en esta versión». El Dashboard ya era la analítica real (#54). | Un participante del piloto no debe encontrar vistas que la tesis no sostiene: verían datos simulados como si fueran reales | Media |

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
| 2.2 | Habilidades y endorsements en **versión mínima** (decisión 0.10): catálogo fijo cargado por el seed, asignación con nivel y endorsements sólo de equipos<br>**Pendiente:** las rutas de habilidades y endorsements responden `501`. |
| 2.3 | Módulo `integraciones`: implementar `GameStatsProvider` para Riot — flujo OAuth, obtención de la cuenta, obtención del historial de partidas<br>**Hecha por otro camino:** #34 y #38. Sin OAuth: la propiedad de la cuenta se demuestra con un desafío de icono (`docs/decisiones.md`, «Vinculación con Riot»); `vincularCuenta` y `refrescarToken` de `RiotProvider` responden `501` hasta tener Riot Sign On. |
| 2.4 | Cifrado y descifrado de los tokens de `CuentaGaming`, y refresco automático cuando expiren<br>**Sin aplicación por ahora:** el cifrado está en `utils/crypto.ts`, pero sin OAuth no hay tokens que guardar ni refrescar (#38). |
| 2.5 | Worker de ingesta: programación periódica, reintentos con retroceso, y control de cuota de la API de Riot usando Redis<br>**Hecha:** #39 (cola BullMQ y cuota global en Redis con prioridad). |
| 2.6 | Módulo `estadisticas`: persistencia, limpieza de duplicados, normalización a escala 0–1 y cálculo de métricas derivadas (KDA, win rate, tendencias)<br>**Hecha:** #38 (`integrations/riot/riot.normalizacion.ts`). La normalización a 0–1 que usa el matching son las escalas fijas del motor (#45). |
| 2.7 | Endpoints de consulta de estadísticas por jugador y por juego<br>**Hecha:** #38. |

### Frontend

| # | Tarea |
|---|---|
| 2.8 | Vista de cuentas vinculadas: estado por plataforma, última sincronización, vincular, desvincular y **aviso claro de qué datos se leen y para qué** (exigencia de la Ley 1581)<br>**Hecha:** #38, con el aviso «Qué datos leemos y para qué». |
| 2.9 | Vista de mis estadísticas: por juego, histórico y tendencias<br>**Hecha:** #38 (sólo League of Legends). |
| 2.10 | Conectar los hooks de perfil y estadísticas; **retirar el puente de demostración en esas vistas** y con él su distintivo<br>**Hecha:** #19 (perfil) y #38 (cuentas y estadísticas). |
| 2.11 | ~~Onboarding~~ **Descartada** (decisión 0.10): la ubicación se captura en Mi perfil (1.5) y la vinculación de la cuenta vive en Cuentas vinculadas (2.8) |
| 2.12 | **Distintivo de verificación** visible junto a cada métrica que venga de la API oficial. Es el argumento central del proyecto hecho visible<br>**Hecha en parte:** sello de cuenta verificada (con su fecha) en Mis estadísticas, el perfil público, el buscador y el ranking; no junto a cada métrica. |
| 2.15 | **Analítica, primer indicador: mapa del talento verificado** por macrorregión, rol y rango, con el Caribe frente al resto. Sólo cuenta jugadores con cuenta de Riot vinculada; la macrorregión sale de `MACROREGION_POR_DEPARTAMENTO`. Va en la vista fusionada de Analítica y panel del equipo<br>**Hecha:** #51 a #54, en `/dashboard`. |
| 2.16 | **Analítica, tendencia del rendimiento del jugador**, dentro de Mis estadísticas (2.9)<br>**Hecha:** #38 (gráfica de tendencia en Mis estadísticas). |

### Infraestructura

| # | Tarea |
|---|---|
| 2.13 | **Ensayo de despliegue real**: API en Railway o Render, cliente en Vercel, base gestionada. No dejarlo para la última semana<br>**Pendiente:** la aplicación no se ha desplegado nunca. |
| 2.14 | Variables de entorno y secretos de producción, con rotación documentada<br>**Pendiente.** Las variables están documentadas (README, «Variables de entorno»); de la rotación, sólo la renovación diaria de la clave de Riot (`docs/operacion.md`). |

---

## 5. Bloque 3 — Sprint 3: el motor de matching

**Objetivo del sprint:** que un equipo publique una oferta, ajuste los pesos de las cinco
dimensiones y reciba un ranking de candidatos con su desglose. Es el sprint que decide si
el proyecto demuestra lo que promete.

**Hueco a resolver antes del sprint, junto con la tarea 3.5:** el modelo de trayectoria para
la dimensión de experiencia. El documento la define como historial en equipos, torneos,
competencias y logros, pero ni el modelo entidad-relación ni `schema.prisma` tienen dónde
guardar equipos anteriores, torneos y logros (hoy los simula el prototipo). Hay que diseñar
ese modelo y decidir cómo se distingue lo declarado por el jugador de lo verificado.
**Resuelto para el piloto con peso 0:** la experiencia sigue en la ecuación y vale 0
(`SIN_DATOS_PILOTO`); el modelo de trayectoria pasó a trabajo futuro (`docs/decisiones.md`,
«Motor de matching»).

### Backend

| # | Tarea |
|---|---|
| 3.1 | Módulo `ofertas`: creación, edición, cierre y estados<br>**Hecha:** #28 (contrato y modelo) y #29 (endpoints). |
| 3.2 | Postulaciones y sus estados. Decidir aquí si se incorpora el estado `entrevista` que el prototipo propuso y que el documento sugiere con «invitar a un tryout»<br>**Hecha:** #28 y #29, con el estado `ENTREVISTA` (el tryout). |
| 3.3 | Vectorizador de perfil: convertir estadísticas normalizadas y atributos en el vector de 64 dimensiones y persistirlo en `PerfilVector`<br>**Hecha:** #44 y #45 (vectorizador versión 2). |
| 3.4 | Recuperador por contenido: consulta de vecinos más cercanos sobre el índice HNSW de `pgvector`<br>**Hecha:** #45 (#5 creó el índice HNSW). |
| 3.5 | **Definir y documentar la fórmula de cada una de las cinco dimensiones** (técnica, experiencia, habilidades blandas, geográfica, disponibilidad). Hoy sólo están descritas en prosa. La de experiencia depende del modelo de trayectoria (ver el párrafo anterior)<br>**Hecha:** #40 y #45 (`docs/arquitectura.md`, «Las cinco dimensiones»). La experiencia vale 0 sin modelo de trayectoria, que pasó a trabajo futuro (`docs/decisiones.md`, «Motor de matching»). |
| 3.6 | Ponderador: aplicar la ecuación del documento con pesos configurables por oferta<br>**Hecha:** #40 y #45. |
| 3.7 | Persistir el resultado en `Matching` con el desglose por dimensión<br>**Hecha:** #41 y #45. |
| 3.8 | Módulo `scouting` en **versión mínima** (decisión 0.10): búsqueda de jugadores con filtros por rol, rango y departamento<br>**Hecha:** #35, #36 y #37. |
| 3.9 | **Medir RNF-01 en este sprint**: percentil 95 por debajo de 2 s con 1.000 perfiles indexados. Si se mide al final y falla, corregirlo exige rehacer el motor<br>**Hecha:** #46 (`docs/rnf-01.md`; medido en local, se repetirá en el despliegue). |
| 3.16 | **Guardar la fecha de cada cambio de estado de la postulación** (historial de estados, no sólo el estado actual). Sin ella no se calcula el embudo de la vacante ni el tiempo hasta cubrirla (H1). Va con 3.2 y es un cambio de esquema en su propio PR<br>**Hecha:** #28 y #29 (columnas `revisadaEn`, `entrevistaEn`, `aceptadaEn`, `rechazadaEn`). |
| 3.17 | Datos de la analítica: **embudo de la vacante con tiempo hasta cubrirla** (sobre 3.16) y **qué dimensión decide el ranking** (sobre el desglose de 3.7). La vista se completa en 4.10<br>**Hecha:** #51, #52 y #53/#55. |
| 3.18 | Sustituto de la mensajería en el piloto (decisión 0.10): el equipo ve el correo del jugador cuando **preselecciona** su postulación. Antes de activarlo, reflejarlo en el aviso de privacidad y, si cambia el texto, subir `VERSION_AVISO_PRIVACIDAD`<br>**Pendiente.** |

### Frontend

| # | Tarea |
|---|---|
| 3.10 | Crear oferta con **deslizadores de pesos que siempre suman 100 %**: al mover uno, los demás se reajustan. Es lo que materializa la ecuación y distingue a ProPlay de un tablón de empleo<br>**Hecha:** #31 y #42/#43 (sólo las dimensiones con datos). |
| 3.11 | **Ranking de candidatos con desglose por dimensión** en gráfico de radar o barras. Es la pantalla estrella de la sustentación: si sólo muestra un número, el diferencial no se ve<br>**Hecha:** #47 a #50, con una barra apilada de aportes, no un radar (`docs/decisiones.md`, «Ranking de candidatos»). |
| 3.12 | Detalle del candidato<br>**Hecha:** #47 y #49. |
| 3.13 | Mis postulaciones (jugador), como **pestaña de Mi perfil**, y postulaciones recibidas (equipo), **dentro del detalle de la oferta**. Ninguna tiene vista propia (decisión 0.10)<br>**Hecha:** #30 y #31. |
| 3.14 | Conectar los hooks correspondientes y retirar el puente de demostración en esas vistas<br>**Hecha** en cada vista conectada (#30, #31, #49, #50 y #54). |

### Documento

| # | Tarea |
|---|---|
| 3.15 | **Justificar los valores por defecto de los pesos** (`PESOS_MATCHING`; hoy técnica 0,50, geográfica 0,25, disponibilidad 0,25, y experiencia y habilidades blandas 0 porque no hay datos con que medirlas: #40 y `docs/decisiones.md`, «Motor de matching») y reflejarlos en la Sección VIII del documento. Hoy la ecuación (1) sólo dice que los pesos los configura el equipo que publica la oferta; los valores con que arranca el formulario no están justificados en ninguna parte<br>**Pendiente:** la justificación de los tres pesos activos para el documento. |

---

## 6. Bloque 4 — Sprint 4: IA generativa, cierre y validación

### Backend

| # | Tarea |
|---|---|
| 4.1 | Explicador: generar en lenguaje natural la justificación del puntaje, anclada en datos recuperados en tiempo real<br>**Hecha:** #63 (contrato) y el PR del explicador. Claude Haiku 5.5 redacta a partir del desglose del ranking recalculado al pedirlo, con comprobación de fidelidad y caché por contenido. |
| 4.2 | Sandbox de Python para el cálculo exacto de métricas, fuera del modelo de lenguaje<br>**Pendiente.** |
| 4.3 | **Degradación elegante**: si el servicio de LLM falla, se muestra el desglose numérico y el ranking sigue funcionando. El ranking nunca depende de que el LLM esté vivo<br>**Hecha** con el explicador: sin clave, con error, tiempo agotado, fidelidad fallida o límite agotado responde `NO_DISPONIBLE` y la vista se queda con la explicación determinista. |
| 4.4–4.6 | Pasan a trabajo futuro (Bloque 6) por la decisión 0.10: mensajería, notificaciones y administración |

### Frontend

| # | Tarea |
|---|---|
| 4.7 | Explicación del matching en el detalle del candidato<br>**Hecha:** bloque «Por qué encaja (generado con IA)» sobre la tabla de aportes, con esqueleto y nota de degradación (`components/ExplicacionGenerada.tsx`). |
| 4.8, 4.9, 4.11 | Pasan a trabajo futuro (Bloque 6) por la decisión 0.10: mensajería, notificaciones y subvistas de administración |
| 4.10 | **Analítica con datos reales**, fusionada con el panel del equipo: completa los cuatro indicadores (mapa del talento de 2.15, tendencia de 2.16, embudo y dimensión decisiva de 3.17). Es el componente de innovación que exige el director<br>**Hecha:** #51 a #55. |
| 4.12 | **Retirar por completo el puente de demostración y la bandera `VITE_DEMO_DATA`**<br>**Pendiente.** |

### Validación

| # | Tarea |
|---|---|
| 4.13 | Ejecutar las pruebas piloto con los equipos y jugadores reclutados<br>**Fuera de la tesis:** no hubo piloto con usuarios; queda diseñada en `docs/protocolo-validacion.md`. |
| 4.14 | Aplicar los instrumentos de medición y recoger las métricas de la plataforma<br>**Fuera de la tesis:** no hubo piloto con usuarios; queda diseñada en `docs/protocolo-validacion.md`. |
| 4.15 | Redactar el informe de validación<br>**Fuera de la tesis:** no hubo piloto con usuarios; queda diseñada en `docs/protocolo-validacion.md`. |
| 4.16 | Incorporar los resultados al documento y contrastar las hipótesis H1 y H2 contra la línea base del punto 0.2<br>**Fuera de la tesis:** no hubo piloto con usuarios; queda diseñada en `docs/protocolo-validacion.md`. |

---

## 7. Bloque 5 — Documento y sustentación. Transversal

| # | Tarea |
|---|---|
| 5.1 | Mantener el documento al día con los cambios de diseño que surjan en cada sprint<br>**En curso:** los cambios pendientes para el documento están en `docs/para-el-informe.md`. |
| 5.2 | Incorporar los resultados de validación<br>**Pendiente** (depende del piloto). |
| 5.3 | Preparar una demostración guionizada, con usuarios y datos preparados de antemano<br>**Pendiente en el repositorio:** no hay guion de demostración versionado. |
| 5.4 | Manual de usuario y manual técnico<br>**Pendiente.** Hay documentación técnica (README, `docs/`), no manual de usuario. |
| 5.5 | Resumen ejecutivo para posible publicación<br>**Pendiente.** |

---

## 8. Bloque 6 — Trabajo futuro. Fuera de la tesis

Lo que la decisión 0.10 deja fuera. No se construye sin acordarlo; si sobra tiempo, se
recupera en este orden:

1. Recuperar y restablecer contraseña.
2. Mensajería (RF-12): módulo `mensajeria` y vista Mensajes (antes 4.4 y 4.8).
3. Perfil público de la organización.

Sin orden de recuperación, en fase 2:

| Antes | Tarea |
|---|---|
| 4.5 y 4.9 | Módulo `notificaciones` y su conexión en el cliente (RF-12) |
| 4.6 y 4.11 | Módulo `admin` y subvistas de administración (interfaz de RF-14). Mientras tanto, las operaciones van por los scripts de `docs/operacion.md` y la auditoría se sigue escribiendo en `AuditLog` |
| — | Descartadas: verificación de correo, feed, onboarding, comparador de candidatos y lista de seguimiento |

---

## 9. Trabajo colaborativo: ramas

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

## 10. Orden de ataque recomendado

Actualizado el 2026-11-17. Lo que queda, en el orden en que más incertidumbre resuelve:

1. **Despliegue (2.13)**, con el cliente público: desbloquea la solicitud de la clave de
   producción de Riot (0.1) y es donde hay que repetir RNF-01.
2. ~~**Retirar del menú las vistas simuladas (1.7)**~~: hecha (#58).
3. ~~**Explicación con modelo de lenguaje (4.1, 4.3 y 4.7)**~~: hecha (#63 y el PR del explicador).
4. **Soporte mínimo:** habilidades y endorsements (2.2), ajustes de privacidad y sustituto de
   la mensajería (3.18).
5. **Piloto (4.13 a 4.16)**, con la línea base (0.2) cargada en
   `LINEA_BASE_SCOUTING_MANUAL` y las métricas del script `metricas:piloto`.

El criterio que ordena todo sigue siendo el mismo: **primero lo que resuelve
incertidumbre**. Las dos incertidumbres técnicas del documento (si Riot da los datos
necesarios y si la búsqueda vectorial responde en dos segundos) quedaron despejadas en los
Sprints 2 y 3; la que queda abierta es el despliegue.

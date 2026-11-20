# Guía para redactar el informe

Qué dice hoy el documento del proyecto (`docs/ProPlay.pdf`, versión 5), qué hay construido
de verdad y qué hay que cambiar en el documento, **sección por sección**.

> **No hubo piloto con usuarios.** El código se cierra el 2026-11-20 y la sustentación es el
> 2026-11-27. H1 y H2 se presentan como un **diseño de validación listo para ejecutarse**
> ([`docs/protocolo-validacion.md`](protocolo-validacion.md)); la evidencia disponible es
> RNF-01 (`docs/rnf-01.md`), las pruebas automáticas (`npm run verify`) y la demostración. Estado al
2026-11-20, con `main` en el PR #73. Todo lo que se afirma aquí sobre la aplicación se
comprobó en el código; lo que no se puede comprobar desde el repositorio va marcado
«sin verificar desde el código».

Referencias que se usan en toda la guía:

- **Rutas de la API** con roles, RF y estado: README, «Rutas de la API».
- **Vistas** con su alcance y si usan datos reales: `CLAUDE.md` §5.
- **Porqué de cada decisión**: `docs/decisiones.md` (se cita por el título de su sección).
- **Arquitectura, fórmulas y definiciones de métricas**: `docs/arquitectura.md`.
- **Estado de cada tarea del plan**, con sus PR: `docs/plan-implementacion.md`.

---

## I. Introducción

**Qué dice el PDF.** Presenta ProPlay como red profesional para el scouting de eSports en el
Caribe colombiano, con ingesta directa de estadísticas **mediante OAuth 2.0**, vectorización
de perfiles, PostgreSQL con pgvector y un motor de recomendación **híbrido asistido por un
modelo Transformer**.

**Qué hay construido.** Perfiles con datos traídos de la API de Riot (League of Legends),
ingesta periódica, búsqueda vectorial con pgvector e índice HNSW, y un motor de matching que
puntúa cinco dimensiones y explica el ranking.

**Divergencias que hay que reflejar.**
- La propiedad de la cuenta se demuestra con un **desafío de icono**, no con OAuth: Riot
  Sign On exige una clave de producción aprobada (`decisiones.md`, «Vinculación con Riot»).
- Sólo **League of Legends** con la API de Riot; Steam, Twitch y YouTube son trabajo futuro
  (decisión 0.3, «Privacidad y piloto»).
- El motor opera **sólo por contenido**: el componente colaborativo existe con peso 0
  (arranque en frío). El modelo Transformer (Claude Haiku 5.5, por la API de Anthropic)
  **redacta la explicación del puntaje, no lo calcula ni ordena** (ver «Riesgos del título»).

**Qué falta.** La validación con usuarios queda diseñada y no se ejecuta en la tesis.

## II. Descripción del problema

**Qué dice el PDF.** La asimetría de información en el scouting: estadísticas
autodeclaradas, observación manual y contactos personales.

**Qué hay construido.** Nada que cambie el planteamiento. La aplicación responde al problema
como se describe: el perfil del jugador sale de datos de Riot y no de lo que declara
(`CLAUDE.md` §1).

**Divergencias.** Ninguna.

## III. Justificación

**Qué dice el PDF.** Conveniencia, relevancia social, implicaciones prácticas y valor
teórico y tecnológico. Este último cita OAuth 2.0, la recomendación híbrida (contenido más
colaborativo), el modelo Transformer que explica el resultado y el intérprete de Python
aislado.

**Divergencias.** Las mismas de la Sección I: icono en lugar de OAuth, colaborativo con
peso 0, el Transformer sólo redacta la explicación y no hay sandbox de Python. Conviene
redactar el valor tecnológico sobre lo construido (verificabilidad, matching explicable con
desglose por dimensión y explicación en lenguaje natural anclada en él, analítica) y dejar el
resto como diseño o trabajo futuro.

## IV. Objetivos

**Qué dice el PDF.** El objetivo general y cuatro específicos:
- **OE1**, revisión de literatura;
- **OE2**, arquitectura y modelo de datos;
- **OE3**, prototipo con React, Express, JWT y OAuth 2.0, ingesta desde Riot y Steam, Redis y
  matching híbrido asistido por Transformer con sandbox de Python;
- **OE4**, validación con pruebas piloto.

**Estado por objetivo.**
- **OE1.** Es trabajo documental, sin código que lo muestre: sin verificar desde el código.
- **OE2.** Hecho, con las divergencias de las Secciones VIII y IX.
- **OE3.** Hecho en lo que no depende del Sprint 4. Divergen OAuth (icono), Steam (sólo Riot),
  el modo híbrido (colaborativo con peso 0), el Transformer, que redacta la explicación sin
  intervenir en el puntaje (tareas 4.1, 4.3 y 4.7), y el sandbox de Python, que no se construye
  (4.2: el cálculo es aritmética determinista en TypeScript).
- **OE4.** **No se ejecuta en la tesis:** queda como protocolo de validación propuesto
  (`docs/protocolo-validacion.md`), con las métricas que ya calcula la plataforma y el script
  `metricas:piloto`. Ejecutarlo depende del despliegue (2.13), del reclutamiento (0.7) y de la
  línea base (0.2).

**Divergencias que hay que reflejar.** OE3 se cumple con las divergencias anteriores. Conviene
precisar en la redacción que el modelo Transformer asiste explicando el resultado, no
recomendando (ver «Riesgos del título»).

## V. Metodología de I+D

**Qué dice el PDF.** Scrum con prototipado iterativo: cuatro sprints de dos semanas, cada uno
con revisión sobre un incremento **desplegado** y verificable.

**Qué hay construido.**
- Los cuatro sprints, con su trazabilidad en los PR de GitHub (`plan-implementacion.md`).
- Integración continua en cada pull request (`.github/workflows/ci.yml`) y `npm run verify`.

**Divergencias.**
- **Nada se ha desplegado** (tarea 2.13): las revisiones fueron sobre `main` en local, no
  sobre un incremento desplegado.
- Se añadió un recorte de alcance a 17 vistas (tarea 0.10, «Recorte de alcance»; 19 en un
  principio, 17 tras «Habilidades y ajustes de privacidad, a trabajo futuro»), que el
  documento no recoge.

## VI. Marco teórico

**Qué dice el PDF.**
- Estado del arte, bases teóricas (recomendación, Transformer, analítica) y sistema de
  variables (Cuadro II).
- Hipótesis H1 (eficiencia) y H2 (objetividad).

**Qué hay construido.** Los indicadores del Cuadro II que la plataforma puede medir ya se
calculan (`arquitectura.md`, «Analítica»):

| Indicador | Cómo se mide en la plataforma |
| --- | --- |
| **H1, tiempo hasta cubrir la vacante** | Días naturales en Colombia de la publicación a la primera aceptación, con mediana, media y n |
| **H1, tiempo hasta el primer tryout** | Días naturales de la publicación a la primera entrevista |
| **H1, coincidencias exitosas y tasa de conversión** | Postulaciones aceptadas y su proporción |
| **H2, proporción de perfiles verificados** | Verificados sobre jugadores registrados |
| **Factores contextuales, región de origen** | Mapa del talento, el Caribe frente al resto |

**Cómo presentar H1 y H2.** Como **diseño de validación listo para ejecutarse**, no como
resultados. El diseño está en `docs/protocolo-validacion.md`: fases, métricas, instrumentos y
exportación con el script. Las métricas de la tabla anterior ya funcionan en la aplicación y
se pueden enseñar en la demostración con los datos del seed. La evidencia empírica disponible
en la tesis es:
- **RNF-01** (`docs/rnf-01.md`);
- **las pruebas automáticas** (`npm run verify`), incluidas las de las fórmulas del motor y de
  las métricas con cifras exactas;
- **la demostración.**

**Divergencias que hay que reflejar** (`decisiones.md`, «Analítica» → «Cambios para el
documento del proyecto»):
- El «tiempo promedio para encontrar candidatos» se concreta en dos métricas: el tiempo hasta
  cubrir la vacante y el tiempo hasta el primer tryout. Las dos en días naturales, con
  **mediana, media y n**.
- **H1 se presenta como evidencia descriptiva**, siempre con su n, y no como contraste
  estadístico: con 3 equipos y pocas vacantes no hay potencia para una prueba de hipótesis.
- La percepción de objetividad, el NPS y la precisión del matching salen de instrumentos
  externos (tarea 0.8), sin verificar desde el código.

## VII. Modelo de requerimientos

**Qué dice el PDF.** Cuatro actores, 14 requisitos funcionales (Cuadro III) y 8 no
funcionales (Cuadro IV).

**Estado de los requisitos funcionales** (rutas en el README; vistas en `CLAUDE.md` §5):

| RF | Estado |
| --- | --- |
| RF-01 Registro y sesión | Hecho con JWT; **sin OAuth** (no hace falta para la sesión). Sin recuperación de contraseña (trabajo futuro) |
| RF-02 Vinculación de cuentas | Hecho para Riot **por icono**; OAuth en `501` |
| RF-03 Ingesta periódica | Hecho: cola BullMQ, cuota global en Redis y sincronización cada `INGESTA_INTERVALO_HORAS` |
| RF-04 Normalización y métricas derivadas | Hecho: captura normalizada de Riot y escalas fijas del motor |
| RF-05 Perfil profesional | Hecho en parte: cabecera, datos profesionales, ubicación y perfil público reales, este con el resumen de la última captura verificada de Riot (posición, rango, partidas y métricas principales); historial competitivo y portafolio, simulados |
| RF-06 Habilidades y endorsements | **Trabajo futuro** (`501`; «Habilidades y ajustes de privacidad, a trabajo futuro»); la dimensión de habilidades blandas tiene peso 0 |
| RF-07 Ofertas | Hecho |
| RF-08 Búsqueda de jugadores | Hecho por posición, rango mínimo y departamento; **no por juego ni disponibilidad** |
| RF-09 Puntaje y ranking | Hecho: cinco dimensiones, ranking persistido y explicable |
| RF-10 Postulaciones | Hecho, con la fecha de cada etapa |
| RF-11 Explicación en lenguaje natural | Hecho: explicación determinista por dimensión y, encima, un texto redactado por Claude Haiku 5.5 a partir del desglose (módulo `explicador`), con comprobación de fidelidad, caché, límites y degradación a la determinista |
| RF-12 Mensajería y notificaciones | Mensajería: trabajo futuro (`501`); la sustituye el correo del jugador, visible para el equipo dueño desde que preselecciona la postulación. Notificaciones: **hechas en versión mínima** dentro de la app (nueva postulación, cambio de estado y rechazo al cerrar la oferta), con la campana de la cabecera; sin correo electrónico, push ni tiempo real |
| RF-13 Analítica | Hecho en el módulo `analitica` y `/dashboard`, más el script del piloto |
| RF-14 Auditoría | Se escribe en `AuditLog` (registro, login, cambios de contraseña, vinculación, ofertas, postulaciones y cambio de rol); **la vista de consulta es trabajo futuro** |

**Estado de los no funcionales:**

| RNF | Estado |
| --- | --- |
| RNF-01 p95 < 2 s con 1.000 perfiles | **Cumplido en local** (`docs/rnf-01.md`, 2026-11-10). Falta repetirlo en el despliegue |
| RNF-02 HTTPS | Depende del despliegue: sin verificar |
| RNF-03 Tokens cifrados | Cifrado listo (`utils/crypto.ts`), pero **no se guarda ningún token**: sin OAuth no los hay |
| RNF-04 Acceso por rol | Hecho, con pruebas de acceso denegado (`apps/api/tests/rutas-protegidas.test.ts` y las de cada módulo) |
| RNF-05 Ley 1581 | Aviso aceptado y persistido en el registro. **La visibilidad configurable del perfil es trabajo futuro**: el perfil público es visible por enlace, como informa el aviso |
| RNF-06 Trazabilidad | Se escribe en `AuditLog`; «consultable» sólo por la base, sin vista ni script |
| RNF-07 Usabilidad | Diseño responsivo comprobado a 375 y 1440 px en cada vista conectada; las «tres interacciones o menos» no se han medido |
| RNF-08 Mantenibilidad | Módulos por carpeta y contenedores en local. El umbral de cobertura del 60 % (`apps/web/vite.config.ts`) cubre archivos del cliente (`src/lib` y el motor y el explicador simulados del prototipo), **no el motor real de la API**, que no tiene umbral de cobertura configurado (sus fórmulas sí tienen pruebas con cifras exactas). El «despliegue con un solo comando» no se ha probado |

**Divergencias.** RF-13 lo realiza el módulo `analitica` y no «Administración». Los
administradores obtienen las métricas del piloto por script (decisión 0.10).

## VIII. Arquitectura de la solución

**Qué dice el PDF.**
- **C4.** Contexto con Riot y Steam, LLM y Cloudinary. Nueve módulos de negocio más
  integraciones, worker desacoplado, PostgreSQL con pgvector, Redis y Cloudinary.
- **Motor de matching:** orquestador, vectorizador, recuperador HNSW, colaborativo,
  ponderador, calculador exacto en Python y explicador Transformer.
- **Interfaz:** feed, perfil, panel y dashboard.

**Qué hay construido** (`arquitectura.md`):
- **Módulos.** Once, separados por carpetas. `usuarios` y `perfiles` son módulos distintos,
  se añaden `analitica` y `explicador`, y las integraciones son una capa de infraestructura,
  no un módulo.
- **Worker de ingesta.** Va por cola (BullMQ) dentro del proceso de la API: desacoplado de la
  petición, no de proceso.
- **Motor.** Vectorizador (versión 2, 64 dimensiones), recuperador HNSW con 200 vecinos más
  los postulantes, cinco dimensiones como funciones puras, ponderador de la ecuación (1),
  colaborativo con peso 0 y persistencia en `Matching`. Recalcula el ranking al leerlo si
  algo cambió.
- **Explicador.** Módulo `explicador` fuera del motor: redacta con Claude Haiku 5.5 un texto a
  partir del desglose del candidato (sólo cifras y códigos), comprueba que no invente cifras ni
  rangos y que diga los requisitos de la oferta que el candidato no cumple y, si algo falla, se
  queda la explicación determinista. El ranking no depende de él.
- **Lo que no hay:** sin calculador en Python (el cálculo es determinista en TypeScript).
- **Interfaz.** Panel del equipo con el resumen de la analítica, ranking con desglose,
  detalle del candidato y analítica. El feed quedó descartado.

**Cambios para la Sección VIII** (lista consolidada; detalle en `decisiones.md`, «Motor de
matching», «Ranking de candidatos» y «Analítica»):
1. **Pesos por defecto del piloto:** técnica 0,50, geográfica 0,25, disponibilidad 0,25,
   experiencia 0 y habilidades blandas 0 (`PESOS_MATCHING`). La justificación de los tres
   activos sigue pendiente (tarea 3.15).
2. **Experiencia y habilidades blandas con peso 0** por falta de datos verificables
   (`DIMENSIONES_SIN_DATOS_PILOTO`). Siguen en la ecuación y la interfaz no las muestra. La
   experiencia **no se mide en años**: el modelo de trayectoria es trabajo futuro.
3. **Técnica:** factor de posición × (0,45·rango + 0,55·rendimiento) (`SUBPESOS_TECNICA`),
   con `UMBRAL_ESPECIALISTA` = 0,6. El rendimiento usa **escalas fijas** por posición, no
   percentiles del grupo, y hay un caso límite conocido documentado (`arquitectura.md`).
4. **Geográfica** por modalidad (presencial, híbrida, remota) y cercanía (departamento,
   macrorregión, país) (`PUNTAJE_CERCANIA`, `MINIMO_CON_RELOCALIZACION`). **Disponibilidad**:
   horas del jugador sobre las de la oferta.
5. **Componente colaborativo con peso 0** (arranque en frío, `motor/colaborativo.ts`): el
   ranking informa el modo `CONTENIDO`.
6. **Explicación determinista** a partir de los motivos y cifras de cada dimensión, y encima
   la **generada con modelo de lenguaje** (4.1, 4.3 y 4.7): el explicador queda fuera del
   motor, no recibe datos personales, descarta los textos con cifras que no están en el
   desglose, que callan un requisito no cumplido (posición, rango mínimo u horas), que usan
   nombres de campo del JSON o que presentan como verificadas las horas, que declara el
   jugador, y degrada a la determinista (`decisiones.md`, «Explicador con modelo de
   lenguaje», «Prompt del explicador v2 y requisitos no cumplidos» y «Prompt del explicador
   v3: forma»). Como el motor ordena a todos los postulantes
   aunque ninguno cumpla los mínimos, el texto lo dice en lugar de resaltar sólo lo bueno.
7. **El desglose es una barra apilada de aportes**, no un radar: los aportes suman el
   puntaje mostrado.
8. **Once módulos**, con `analitica` y `explicador`. RF-13 lo realiza `analitica`, no «Administración».
9. **Analítica:** embudo de la vacante, dimensión decisiva (ventaja media de los 5 primeros
   sobre el resto, `TOP_DIMENSION_DECISIVA`) y mapa del talento con umbral de privacidad de 3
   (`UMBRAL_PRIVACIDAD_ANALITICA`) y supresión secundaria.
10. **Integraciones:** sólo Riot, con una cuota global en Redis con prioridad para la
    vinculación (`RIOT_LIMITES`, `RIOT_RESERVA_ALTA`).

## IX. Modelo de datos

**Qué dice el PDF.** 15 entidades en el diagrama entidad-relación (Tabla V), PostgreSQL con
pgvector, `PerfilVector` como entidad propia y tokens de `CuentaGaming` cifrados.

**Qué hay construido** (`apps/api/prisma/schema.prisma`):
- Las 15 entidades del documento, con `PerfilVector` propio (`vector(64)` e índice HNSW
  `PerfilVector_embedding_hnsw_idx`).
- Tres tablas más heredadas del prototipo y sin uso: `Publicacion`, `Conversacion` y
  `ParticipanteConversacion`.

**Diferencias con la Sección IX que hay que reflejar:**
- **Ubicación.** País y departamento (catálogo de 33 departamentos y su macrorregión) en
  `PerfilJugador`, `PerfilEquipo` y `Oferta`, en lugar de una «región».
- **`Oferta`:**
  - modalidad (`PRESENCIAL`, `HIBRIDA`, `REMOTA`);
  - posición del catálogo (`PosicionLol`) y rango mínimo del catálogo `RangoLol`;
  - cinco columnas de pesos;
  - estados `BORRADOR`, `ABIERTA`, `CUBIERTA` y `CERRADA`, con `publicadaEn` y `cerradaEn`;
  - sin años de experiencia mínima.
- **`Postulacion`.** Estados con `ENTREVISTA` (el tryout) y la fecha de cada etapa en
  columnas, sin tabla de historial (`decisiones.md`, «Ofertas y postulaciones»).
- **`Usuario`.** Aceptación del aviso y declaración de mayoría de edad con fecha y versión, y
  `credencialesCambiadasEn`.
- **`CuentaGaming`.**
  - Riot ID, servidor, `sincronizadaEn` e `intentoSincronizacionEn`;
  - los tokens existen pero quedan nulos (sin OAuth no hay tokens que guardar);
  - `Estadistica` gana `cuentaId` y el rango del catálogo.
- **`Matching`.** Explicación, similitud y versión de las fórmulas, además del desglose.

## X. Prototipo y arquitectura física

**Qué dice el PDF.** API en Docker con nueve módulos, frontend en Vercel, PostgreSQL 16 con
pgvector, Redis, Cloudinary, integraciones con Riot, Steam, Twitch y YouTube, GitHub
Actions, **Sentry y Logtail**. Seguridad con JWT y OAuth.

**Qué hay construido.**
- **API y CI.** `apps/api/Dockerfile` multi-stage, que migra al arrancar, y CI en GitHub
  Actions.
- **Despliegue.** La configuración de Vercel está en el README, «Despliegue».
- **Seguridad.** JWT de 15 minutos en memoria con refresh de 7 días en cookie `httpOnly`,
  bcrypt con 12 rondas, `helmet`, CORS por lista blanca, límites de peticiones por endpoint y
  `TRUST_PROXY` (README, «Seguridad»).

**Divergencias que hay que reflejar.**
- **No se ha desplegado** (tarea 2.13).
- **Sentry y Logtail no están integrados**: el código no los menciona. Los registros son de
  pino, por la salida estándar.
- **Cloudinary** tiene cliente, pero ningún endpoint lo usa.
- **Sólo Riot.** Steam, Twitch y YouTube son clases con todo en `501`.
- **El worker de ingesta corre en el proceso de la API.** En un plan que suspenda el servicio
  por inactividad, la ingesta periódica se detiene (`docs/operacion.md`).

## XI. Diagrama integral del prototipo y XII. Visión integrada

**Qué dice el PDF.** La visión de conjunto de usuarios, módulos, datos e integraciones,
incluida la vinculación por OAuth.

**Divergencias.** Las de las Secciones VIII a X: icono en lugar de OAuth, sólo Riot, once
módulos, el LLM sólo en la explicación, sin sandbox de Python y sin monitoreo externo. Los diagramas vigentes, en
Mermaid, están en `arquitectura.md`.

## XIII. Plan de implementación

**Qué dice el PDF.** Cuatro sprints de dos semanas (S1 fundación y acceso, S2 perfil
verificable, S3 motor de matching, S4 IA generativa, cierre y validación), con RNF-01 medido
en S3.

**Qué hay construido** (`plan-implementacion.md`, con los PR de cada tarea):
- S1, S2 y S3 cerrados salvo tareas de soporte.
- RNF-01 medido en S3.
- En S4, la analítica y la explicación con modelo de lenguaje están hechas.

**Divergencias.**
- El orden real añadió el recorte de alcance (0.10), la cuota de Riot e ingesta en cola
  (2.5) y la analítica completa en S3–S4.
- Las revisiones de sprint no fueron sobre un incremento desplegado.

## XIV. Resultados esperados

**Qué dice el PDF.** Entregables, métricas de éxito (Cuadro VII) e impacto.

**Qué mide la plataforma de cada indicador del Cuadro VII:**

| Indicador | Cómo se obtiene |
| --- | --- |
| Adopción | Registros por rol en `resumen_h1.csv` (`npm run metricas:piloto -w api`) |
| Engagement | **No hay registro de actividad** de usuarios: sin verificar desde el código |
| Coincidencias exitosas | Postulaciones aceptadas (script y analítica); la encuesta las complementa |
| NPS | Encuesta externa (tarea 0.8) |
| Tiempo de respuesta | RNF-01 en local (`docs/rnf-01.md`); falta medirlo en el despliegue |

**Qué falta.** Los resultados de los indicadores dependen de una validación con usuarios que
no se ejecuta en la tesis: la Sección XIV debe presentarlos como **metas del diseño de
validación** (`docs/protocolo-validacion.md`), no como resultados. Lo único medido es el
tiempo de respuesta (RNF-01, en local).

## XV. Análisis de viabilidad y gestión de riesgos

**Qué dice el PDF.** Viabilidad técnica y económica, y el riesgo de no obtener la clave de
producción de Riot, mitigado con «solicitud en la semana 1 y carga manual verificada como
plan de contingencia».

**Estado.**
- La clave de producción está sin verificar desde el código: la configuración por defecto es
  la cuota de desarrollo.
- **La «carga manual verificada» no existe.** El plan de contingencia real es seguir con la
  clave de desarrollo:
  - se renueva cada día (`docs/operacion.md`);
  - las vinculaciones se hacen en tandas por la cuota;
  - con la clave caducada, la aplicación pausa la ingesta y sigue funcionando con los datos
    guardados.
- **Para pedir la clave de producción hace falta el aviso de privacidad publicado**, y por
  tanto desplegar antes.

---

## Limitaciones

Para la sección de limitaciones del informe:

1. **Sin validación con usuarios.** H1 y H2 no se contrastan en la tesis: quedan como un
   diseño de validación listo para ejecutarse. Si se ejecuta, la muestra prevista (3 equipos
   y unas pocas vacantes) sólo permite evidencia descriptiva con su n, no un contraste
   estadístico.
2. **Clave de desarrollo de Riot.**
   - Caduca cada 24 horas.
   - Tiene una cuota de 100 peticiones cada 2 minutos para toda la aplicación, lo que obliga a
     vincular en tandas.
   - Los `puuid` son por titular de la clave, así que podrían no valer con una clave de
     producción (mitigado guardando el Riot ID; «Integración con Riot»).
3. **Experiencia y habilidades blandas con peso 0.** El ranking se apoya en tres
   dimensiones. Sin un modelo de trayectoria ni endorsements, dos de las cinco del documento
   no aportan.
4. **Verificación por icono.** Demuestra la propiedad de la cuenta y no deja guardar tokens,
   pero no es OAuth. Se sustituye por Riot Sign On si llega la clave de producción.
5. **Componente colaborativo con peso 0.** El motor opera sólo por contenido. El modo
   híbrido necesita un historial de contrataciones que el piloto no tendrá.
6. **Recorte de alcance.** 17 vistas de 39. Mensajería, administración, feed, comparador y
   lista de seguimiento quedaron fuera («Recorte de alcance»), y después habilidades y
   endorsements y los ajustes de privacidad («Habilidades y ajustes de privacidad, a trabajo
   futuro»). Las notificaciones volvieron en
   versión mínima (sin correo, push, tiempo real ni preferencias) y la mensajería la sustituye
   el correo del jugador visible para el equipo dueño.
7. **RNF-01 medido en local** (Apple M4, base en la misma máquina), no en la infraestructura
   del despliegue.
8. **Escalas fijas de la técnica** calibradas con razonamiento, no con distribuciones
   publicadas por Riot. Hay un caso límite conocido cuando ningún especialista alcanza el
   rango mínimo.
9. **Umbral de privacidad.** Con pocos jugadores por celda, el mapa del talento oculta buena
   parte del desglose. En el seed, todas las posiciones del Caribe quedan ocultas.
10. **Sin monitoreo de errores ni registros centralizados.** Sentry y Logtail, que cita la
    Sección X, no están integrados: los registros son los de pino por la salida estándar.
    Queda pendiente de decidir al desplegar (tarea 2.13).
11. **RNF-07 sin medir.** El diseño responsivo se comprobó a 375 y 1440 px, pero no se ha
    medido que un scout llegue a un ranking en tres interacciones o menos.

## Anexos sugeridos

| Anexo | Estado |
| --- | --- |
| Definiciones de las métricas de la analítica | **Existe**: `docs/arquitectura.md`, «Analítica» |
| Diccionario de los CSV del piloto | **Existe en parte**: `docs/operacion.md` describe cada archivo, pero no columna a columna |
| Informe de RNF-01 | **Existe**: `docs/rnf-01.md` (se regenera con `npm run rnf01 -w api`) |
| Fórmulas del motor y escalas de la técnica | **Existe**: `docs/arquitectura.md`, «Algoritmo de compatibilidad» |
| Registro de decisiones | **Existe**: `docs/decisiones.md` |
| Rutas de la API y matriz de requisitos | **Existe**: README, «Rutas de la API», y `CLAUDE.md` §5 (la matriz de `docs/prototipo/trazabilidad.md` es la del prototipo) |
| Guion de la demostración | **Falta en el repositorio** |
| Manual de usuario | **Falta** |
| Protocolo de validación | **Existe**: `docs/protocolo-validacion.md` (el manual del prototipo queda como histórico) |
| Línea base del scouting manual | **Falta**: `LINEA_BASE_SCOUTING_MANUAL` es `null`; lo que debe medir está en `arquitectura.md`, «Línea base» |

## Riesgos del título frente a lo construido

El título es «Analítica de Datos y Recomendación Híbrida Asistida por Modelos Transformer».

| Término | Estado | Riesgo |
| --- | --- | --- |
| **Analítica de datos** | Construida: módulo `analitica`, `/dashboard`, tendencia en Mis estadísticas y script del piloto | Bajo |
| **Recomendación híbrida** | El componente colaborativo existe como punto de enganche (`motor/colaborativo.ts`) con **peso 0**; el ranking informa el modo `CONTENIDO`. El recuperador vectorial (HNSW) y las cinco dimensiones sí combinan dos señales de contenido | **Alto**: tal como está, el sistema es basado en contenido. Hay que defender «híbrido» como diseño con arranque en frío (Sección VIII-C lo prevé) o ajustar el título |
| **Asistida por modelos Transformer** | **Integrado:** Claude Haiku 5.5 (un modelo Transformer, por la API de Anthropic) redacta en el detalle del candidato por qué encaja, a partir del desglose y anclado en el ranking recalculado al pedirlo. No decide el puntaje ni el orden: los da el motor determinista. Comprobación de fidelidad y degradación elegante (tareas 4.1, 4.3 y 4.7) | **Medio**: hay que redactar «asistida» como asistencia a la explicación, no a la recomendación. Sin clave del proveedor el explicador se desactiva y la demostración enseña la explicación determinista |

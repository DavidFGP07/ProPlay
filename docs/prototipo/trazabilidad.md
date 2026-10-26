# Matriz de trazabilidad

Cada requisito funcional declara el componente de arquitectura que lo realiza y
el sprint en que se entrega, lo que permite verificar en cualquier momento qué
parte del diseño está implementada y cuál no.

## Requisitos funcionales

| ID | Requisito | Prioridad | Componente | Sprint | Ubicación en el cliente | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| RF-01 | Registro, autenticación y gestión de sesión con JWT y OAuth 2.0, con los roles jugador, equipo, scout y administrador | Debe | Usuarios y perfiles | S1 | `context/AuthContext.tsx`, `services/api.ts` (`iniciarSesion`, `registrarUsuario`), `pages/LoginPage.tsx` | Completo en cliente |
| RF-02 | Vinculación de cuentas de juego del usuario mediante OAuth 2.0 con Riot Games y Steam | Debe | Integraciones externas | S2 | `pages/MiPerfilPage.tsx` → *Cuentas de juego*; `services/api.ts` (`vincularCuenta`, `desvincularCuenta`) | Completo en cliente |
| RF-03 | Ingesta periódica y automática de estadísticas de partida desde las APIs vinculadas | Debe | Worker de ingesta / Estadísticas | S2 | `services/api.ts` (`ejecutarIngesta`, `obtenerEstadoWorker`), `pages/FeedPage.tsx` | Completo en cliente |
| RF-04 | Normalización de métricas a escala comparable y cálculo de métricas derivadas (KDA, win rate, tendencias) | Debe | Estadísticas | S2 | `lib/matching.ts` (`evaluarDimension` → caso `tecnica`), `services/api.ts` (`ejecutarIngesta`) | Completo en cliente |
| RF-05 | Construcción y edición del perfil profesional del jugador con historial competitivo y portafolio | Debe | Usuarios y perfiles | S2 | `pages/MiPerfilPage.tsx` → *Datos profesionales* y *Portafolio*; `services/api.ts` (`actualizarPerfil`) | Completo en cliente |
| RF-06 | Registro de habilidades y validación mediante endorsements de terceros | Debería | Usuarios y perfiles | S3 | `pages/MiPerfilPage.tsx` → *Habilidades*; `pages/PerfilJugadorPage.tsx` → modal *Validar una habilidad*; `services/api.ts` (`registrarHabilidad`, `endosarHabilidad`) | Completo en cliente |
| RF-07 | Publicación, edición y cierre de ofertas por parte de equipos y organizaciones | Debe | Ofertas y oportunidades | S3 | `pages/PanelEquipoPage.tsx`; `services/api.ts` (`crearOferta`, `cerrarOferta`) | Completo en cliente |
| RF-08 | Búsqueda y filtrado avanzado de jugadores por juego, rol, rango, región y disponibilidad | Debe | Scouting | S3 | `pages/ScoutingPage.tsx`; `services/api.ts` (`listarJugadores`) | Completo en cliente |
| RF-09 | Cálculo del puntaje de compatibilidad sobre cinco dimensiones y entrega de un ranking de candidatos | Debe | Matching IA | S3 | `services/matching.ts` (`calcularRanking`), `pages/OfertaDetallePage.tsx` → *Ranking de compatibilidad* | Completo en cliente |
| RF-10 | Postulación a ofertas y seguimiento del estado de la postulación | Debe | Ofertas y oportunidades | S3 | `services/api.ts` (`postular`, `actualizarEstadoPostulacion`, `listarMisPostulaciones`), `pages/MiPerfilPage.tsx` → *Postulaciones* | Completo en cliente |
| RF-11 | Generación de una explicación en lenguaje natural del resultado del matching, con verificación contra fuentes externas | Debería | Matching IA / Servicio LLM | S4 | `services/llm.ts` (`generarExplicacion`), `pages/OfertaDetallePage.tsx` → *Explicación en lenguaje natural* | Completo en cliente |
| RF-12 | Mensajería entre usuarios y notificaciones de eventos relevantes | Debería | Mensajería y notificaciones | S4 | `pages/MensajesPage.tsx`, `components/NotificacionesBell.tsx`; `services/api.ts` (`emitirNotificacion`) | Completo en cliente |
| RF-13 | Dashboard de analítica con métricas agregadas para equipos y administradores | Debería | Administración | S4 | `pages/DashboardPage.tsx`; `services/api.ts` (`obtenerMetricas`) | Completo en cliente |
| RF-14 | Registro de auditoría de las operaciones sensibles sobre datos personales | Debe | Administración | S4 | `services/api.ts` (`registrarAuditoria`), `pages/AdminPage.tsx` | Completo en cliente |

## Requisitos no funcionales

| ID | Atributo de calidad | Requisito | Criterio de aceptación | Cómo se verifica en el cliente |
| --- | --- | --- | --- | --- |
| RNF-01 | Rendimiento | La consulta de ranking de candidatos responde en un tiempo acotado | Latencia del percentil 95 inferior a 2 s con 1.000 perfiles indexados | La traza de la consulta muestra la latencia real de cada ejecución (`OfertaDetallePage` → *Traza de la consulta*) |
| RNF-02 | Seguridad en tránsito | Toda comunicación entre cliente, servidor y servicios externos se cifra | HTTPS con TLS 1.2 o superior en el 100 % de los extremos | Depende del despliegue (Vercel + CDN) |
| RNF-03 | Seguridad en reposo | Los tokens de acceso a las cuentas de juego se almacenan cifrados | Cifrado AES-256-GCM verificado por inspección de la base de datos | El token nunca llega al cliente: solo el worker lo usa. En el backend real se cifra en la columna `CuentaGaming.token` |
| RNF-04 | Control de acceso | Cada recurso expone solo las operaciones permitidas al rol del solicitante | Pruebas automatizadas de acceso denegado para los cuatro roles | Guardas de rol en el router (`App.tsx`) **y** en la capa de API (`services/api.ts`). Cubierto por `app.smoke.test.tsx` |
| RNF-05 | Privacidad y cumplimiento | El tratamiento de datos personales se ajusta a la Ley 1581 de 2012 y la visibilidad del perfil es configurable | Aviso de privacidad aceptado en el registro y opciones de visibilidad operativas | `pages/LoginPage.tsx` (aviso obligatorio en el alta) y `pages/MiPerfilPage.tsx` → *Privacidad* |
| RNF-06 | Trazabilidad | Las operaciones sensibles quedan registradas con usuario, acción y marca de tiempo | Registro de auditoría consultable para el 100 % de esas operaciones | `services/api.ts` (`registrarAuditoria`) + `pages/AdminPage.tsx` |
| RNF-07 | Usabilidad | Un scout alcanza un ranking de candidatos a partir del inicio de sesión en pocos pasos | Tres interacciones o menos; diseño responsivo verificado en móvil y escritorio | Navegación por rol; diseño responsivo con punto de quiebre en `lg` |
| RNF-08 | Mantenibilidad y portabilidad | El código se organiza por módulos de negocio y el entorno se reproduce mediante contenedores | Cobertura de pruebas ≥ 60 % en el módulo de matching; despliegue reproducible con un solo comando | Suite Vitest con umbral de cobertura configurado en `vite.config.ts`; cobertura actual del **98 %** en el módulo de matching |

## Cobertura de las pruebas

| Suite | Requisitos que cubre |
| --- | --- |
| `src/lib/matching.test.ts` | RF-09 (dimensiones y pesos), RF-04 (métricas derivadas) |
| `src/lib/vector.test.ts` | RF-09 (indexación vectorial) |
| `src/lib/collaborative.test.ts` | RF-09 (componente colaborativo y arranque en frío) |
| `src/services/matching.test.ts` | RF-09 (ecuación (1), ranking, traza, top-K) |
| `src/services/llm.test.ts` | RF-11 (explicación coherente, riesgos, grounding) |
| `src/pages/app.smoke.test.tsx` | RF-01, RF-02, RF-06, RF-07, RF-10, RF-12, RNF-04, RNF-05 |

## Variables del estudio y su medición

| Variable | Tipo | Indicador en el prototipo |
| --- | --- | --- |
| Plataforma ProPlay con matching basado en IA | Independiente | Registros y usuarios activos, logs de actividad |
| Eficiencia del scouting | Dependiente | Tiempo para encontrar candidatos, coincidencias exitosas reportadas, tasa de conversión |
| Objetividad del scouting | Dependiente | Precisión del matching, proporción de perfiles con estadísticas verificadas, percepción en encuestas |
| Factores contextuales | Moderadora | Región de origen de los usuarios; análisis de resultados por segmento en las pruebas piloto |

Los indicadores se calculan en `pages/DashboardPage.tsx`, que contrasta el
valor actual frente a la meta y el mínimo aceptable de la tabla de indicadores
del proyecto.

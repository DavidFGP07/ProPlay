# ProPlay

> Analítica de Datos y Recomendación Híbrida Asistida por Modelos Transformer:
> plataforma web para el scouting de talento en eSports del Caribe colombiano.

ProPlay sustituye el scouting basado en contactos, observación manual de
transmisiones y estadísticas autorreportadas por un sistema que **verifica**
el nivel de habilidad con datos obtenidos por ingesta directa desde las APIs
oficiales de los juegos, y que **ordena** a los candidatos con un motor de
matching híbrido cuyo resultado es trazable y explicable.

Este repositorio contiene el **cliente** del sistema: la SPA en React que
consume la API REST versionada `/api/v1` descrita en el documento de diseño.
La capa `src/services/api.ts` implementa hoy ese contrato en memoria, de modo
que el prototipo funciona sin dependencias externas; sustituirla por el
backend Node.js/Express no requiere cambios en la interfaz.

---

## Puesta en marcha

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run build      # typecheck + build de produccion en dist/
npm run preview    # sirve el build de produccion
npm test           # suite de pruebas (Vitest)
npm run coverage   # pruebas + reporte de cobertura
npm run typecheck  # verificacion de tipos sin emitir
```

### Cuentas de demostración

El acceso es por correo (la contraseña se sustituye por JWT en el backend
real). La pantalla de acceso lista las cuentas de cada rol:

| Rol | Correo | Capacidades |
| --- | --- | --- |
| Jugador | `daniel.ocoro@gmail.com` | Perfil profesional editable, cuentas de juego, habilidades, postulaciones, privacidad |
| Equipo | `carlos@atlanticoesports.co` | Publica vacantes, gestiona procesos de selección, ve el dashboard |
| Scout | `julian@talenthub.co` | Consulta vacantes, procesos y rankings; **no** contrata ni publica |
| Administrador | `admin@proplay.co` | Métricas agregadas y registro de auditoría |

También existe el flujo de **alta de cuenta**, que exige aceptar el aviso de
privacidad de la Ley 1581 de 2012 (RNF-05).

---

## Arquitectura

Enfoque **monolítico modular**: el sistema se concibe como una única
aplicación backend organized internamente en módulos de negocio con
responsabilidades separadas, manteniendo centralizada la capa de datos. La
documentación completa en los tres niveles del modelo C4 está en
[`docs/arquitectura-c4.md`](docs/arquitectura-c4.md).

```
┌─ SPA (React + Tailwind) ──────────────────────────────────────────────┐
│  Feed · Mi perfil · Explorar talento · Vacantes · Panel de equipo      │
│  Dashboard · Mensajes · Auditoría                                      │
└──────────────────────────────┬────────────────────────────────────────┘
                               │  REST /api/v1  (JSON)
┌──────────────────────────────▼────────────────────────────────────────┐
│  API REST — Node.js + Express (monolito modular)                       │
│  Usuarios y perfiles · Estadísticas · Scouting · Matching IA            │
│  Ofertas · Mensajería · Notificaciones · Administración · Integraciones │
│  Middleware transversal: JWT · RBAC · validación · control de tasa ·  │
│  auditoría                                                            │
└───────────┬──────────────────────┬──────────────────────┬─────────────┘
            │                      │                      │
   PostgreSQL 16 + pgvector   Redis                Servicios externos
   (datos + vectores, HNSW)   (caché, sesiones,     (Riot, Steam, LLM,
                               control de tasa)      Cloudinary, sandbox)
```

### Módulos de negocio

| Módulo | Responsabilidad |
| --- | --- |
| Usuarios y perfiles | Registro, autenticación, perfiles de jugadores, equipos y scouts, roles y permisos |
| Estadísticas | Obtención, limpieza, normalización y consulta de métricas |
| Scouting | Búsqueda, filtrado, evaluación y seguimiento de jugadores |
| Matching IA | Algoritmo de recomendación (vectorizador, recuperador, ponderador, explicador) |
| Ofertas y oportunidades | Publicación, edición y cierre de vacantes; postulaciones |
| Mensajería | Comunicación entre usuarios |
| Notificaciones | Eventos de negocio dirigidos al actor implicado |
| Administración | Contenidos, reportes, auditoría y configuración |
| Integraciones | Acceso encapsulado a cada servicio externo |

---

## El motor de matching

Es el aporte diferenciador del proyecto. Opera en cinco pasos, que corresponden
a los componentes del Nivel 3 del modelo C4:

```
Orquestador
  ├─ Vectorizador de perfil ......... perfil + estadísticas → vector(64)
  ├─ Recuperador por contenido ...... similitud coseno sobre el índice HNSW
  ├─ Componente colaborativo ......... factorización sobre interacciones equipo–jugador
  ├─ Ponderador de 5 dimensiones .... promedio ponderado (ecuación 1)
  ├─ Calculador exacto .............. sandbox de Python para toda operación numérica
  └─ Explicador ..................... modelo Transformer + recuperación (grounding)
```

### Las cinco dimensiones

Cada dimensión produce un valor normalizado en `[0, 1]`:

| Dimensión | Qué mide |
| --- | --- |
| Técnica | Estadísticas de rendimiento verificadas y ajuste por rol y rango |
| Experiencia | Años de trayectoria, equipos previos y logros |
| Habilidades blandas | Endorsements de terceros sobre habilidades declaradas |
| Geográfica | Región del jugador, relocalización y participación en línea |
| Disponibilidad | Horas semanales frente a las exigidas por la vacante |

El puntaje de compatibilidad entre un jugador `j` y una oferta `o` es el
promedio ponderado de la ecuación (1):

```
S(j, o) = Σ wk · dk(j, o)     con  Σ wk = 1
```

Los pesos los configura la organización que publica la vacante (la interfaz
expone un control por dimensión); se normalizan para que siempre sumen 1.

### Arranque en frío

El componente colaborativo solo se activa cuando el equipo acumula historial
suficiente de interacciones (`MINIMO_INTERACCIONES = 3`). Mientras tanto su
peso permanece en cero y el motor opera en modo **puramente basado en
contenido**, que es la respuesta prevista al arranque en frío. La traza de
cada consulta se muestra en la interfaz para que el modo activo sea visible.

### Explicabilidad

El explicador redacta la justificación del puntaje en lenguaje natural
**anclada en datos recuperados en tiempo real**: ninguna métrica se calcula
dentro del modelo, todas provienen del desglose real del matching, y cada
afirmación se enlaza con su fuente (API oficial, perfil verificable,
escalera regional). El resultado nunca puede contradecir los números que se
muestran en pantalla.

---

## Estructura del código

```
src/
├── App.tsx                 rutas con guarda de roles y carga diferida
├── main.tsx                punto de entrada
├── index.css               sistema de diseño (Tailwind v4)
├── types/                  modelo de dominio (entidades E-R y contratos)
├── lib/
│   ├── matching.ts         las 5 dimensiones, pesos y comparación de rangos
│   ├── vector.ts           vectorización de 64 dims y búsqueda por similitud
│   └── collaborative.ts    componente colaborativo y arranque en frío
├── services/
│   ├── api.ts              capa de integración (contrato REST en memoria)
│   ├── matching.ts         orquestador del motor
│   └── llm.ts              explicador y calculador exacto
├── context/                sesión (AuthContext) y avisos (ToastContext)
├── components/             sistema de diseño, Layout y centro de notificaciones
├── pages/                  las 11 pantallas de la plataforma
└── data/seed.ts            datos semilla que simulan la persistencia
```

---

## Requisitos y trazabilidad

La matriz completa requisito → componente → sprint → ubicación en el código está
en [`docs/trazabilidad.md`](docs/trazabilidad.md). Resumen:

| RF | Requisito | Dónde vive |
| --- | --- | --- |
| RF-01 | Registro, autenticación y gestión de sesión | `context/AuthContext.tsx`, `services/api.ts`, `pages/LoginPage.tsx` |
| RF-02 | Vinculación de cuentas de juego (OAuth 2.0) | `pages/MiPerfilPage.tsx` → pestaña *Cuentas de juego* |
| RF-03 | Ingesta periódica de estadísticas | `services/api.ts` → `ejecutarIngesta()` (worker) |
| RF-04 | Normalización y métricas derivadas | `lib/matching.ts`, `services/api.ts` |
| RF-05 | Perfil profesional del jugador | `pages/MiPerfilPage.tsx` → pestaña *Datos profesionales* |
| RF-06 | Habilidades y endorsements de terceros | `pages/MiPerfilPage.tsx`, `pages/PerfilJugadorPage.tsx` |
| RF-07 | Publicación y cierre de ofertas | `pages/PanelEquipoPage.tsx` |
| RF-08 | Búsqueda y filtrado de jugadores | `pages/ScoutingPage.tsx` |
| RF-09 | Puntaje de compatibilidad y ranking | `services/matching.ts`, `pages/OfertaDetallePage.tsx` |
| RF-10 | Postulación y seguimiento | `services/api.ts`, `pages/MiPerfilPage.tsx` |
| RF-11 | Explicación en lenguaje natural con verificación | `services/llm.ts`, `pages/OfertaDetallePage.tsx` |
| RF-12 | Mensajería y notificaciones | `pages/MensajesPage.tsx`, `components/NotificacionesBell.tsx` |
| RF-13 | Dashboard de analítica | `pages/DashboardPage.tsx` |
| RF-14 | Registro de auditoría | `services/api.ts` → `registrarAuditoria()`, `pages/AdminPage.tsx` |

---

## Pruebas

```bash
npm test          # 87 pruebas
npm run coverage  # reporte con umbral configurado
```

| Suite | Qué cubre |
| --- | --- |
| `src/lib/matching.test.ts` | Las cinco dimensiones, normalización de pesos, comparación de rangos |
| `src/lib/vector.test.ts` | Vectorización determinista, normalización, similitud coseno, top-K |
| `src/lib/collaborative.test.ts` | Construcción de la matriz de interacciones y arranque en frío |
| `src/services/matching.test.ts` | Orquestador: orden del ranking, desglose, modo híbrido vs. contenido, top-K, traza |
| `src/services/llm.test.ts` | Explicador: coherencia con el puntaje, riesgos, grounding, no invención de métricas |
| `src/pages/app.smoke.test.tsx` | Render real de la aplicación: navegación, guardas de rol, notificaciones, registro |

El umbral de cobertura del módulo de matching está configurado en
`vite.config.ts` (**RNF-08**: ≥ 60 % en el módulo de matching). La cobertura
actual del módulo es del **98 %**.

---

## Próximos pasos

El cliente está completo respecto del documento de diseño. El sistema real
requiere el backend, ya especificado:

1. **Backend Node.js/Express** con los nueve módulos, API REST `/api/v1`,
   JWT, RBAC y auditoría como middleware transversal.
2. **Persistencia** en PostgreSQL 16 con `pgvector` e índice HNSW, y Redis
   para caché, sesiones y control de tasa.
3. **Worker de ingesta** desacoplado, con reintentos y límite de cuota.
4. **OAuth 2.0** real contra Riot Games y Steam, con tokens cifrados en
   reposo con AES-256-GCM.
5. **Sandbox de Python** para el cálculo exacto y **servicio LLM** con
   recuperación para el explicador.
6. **CI/CD** con GitHub Actions, Docker Compose para el entorno de desarrollo y
   despliegue con un solo comando (RNF-08).

El contrato de la interfaz no cambia en esa transición: `src/services/api.ts`
expone las mismas operaciones que consumirá el backend.

---

## Referencias

- Akerlof (1970) — *The Market for "Lemons"*: asimetría de información.
- Spence (1973) — *Job Market Signaling*: señales costosas de falsificar.
- Rochet & Tirole (2003) — mercados de dos lados.
- Ricci, Rokach & Shapira (2022) — *Recommender Systems Handbook*.
- Burke (2002) — sistemas de recomendación híbridos.
- Koren, Bell & Volinsky (2009) — factorización matricial.
- Malkov & Yashunin (2020) — grafos navegables de mundo pequeño (HNSW).
- Vaswani et al. (2017) — *Attention Is All You Need*.
- Lewis et al. (2020) — generación aumentada por recuperación.
- Gao et al. (2023) — modelos de lenguaje asistidos por programa (PAL).
- Chen (1976) — modelo entidad-relación.
- ISO/IEC/IEEE 29148:2018 — especificación de requisitos.
- Brown (2024) — *The C4 Model for Visualising Software Architecture*.
- Fowler (2015) — *MonolithFirst*.

---

Universidad del Norte · Departamento de Ingeniería de Sistemas · Barranquilla, Colombia

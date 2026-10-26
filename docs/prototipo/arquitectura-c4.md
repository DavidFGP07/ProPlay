# Arquitectura de ProPlay en los tres niveles del modelo C4

Cada nivel amplía el detalle del anterior: el **contexto** sitúa el sistema
entre sus actores y dependencias externas; los **contenedores** lo descomponen
en unidades desplegables; y los **componentes** abren el módulo que concentra
el aporte del proyecto, el motor de matching.

---

## Nivel 1 · Contexto del sistema

ProPlay es una plataforma única que media entre cuatro tipos de usuario y
tres clases de servicio externo.

```
                       ┌──────────────────────────────┐
     ┌──────────┐      │                              │      ┌──────────┐
     │ Jugador  │─────▶│                              │◀─────│  Equipo  │
     └──────────┘      │                              │      └──────────┘
                       │        P R O P L A Y         │
     ┌──────────┐      │  Perfiles verificables y     │      ┌──────────┐
     │  Scout   │─────▶│  matching híbrido            │◀─────│  Admin.  │
     └──────────┘      │                              │      └──────────┘
                       └──────┬───────────┬───────────┘
                              │           │
              ┌───────────────┘           └───────────────┐
              ▼                                           ▼
    ┌──────────────────┐                    ┌────────────────────────┐
    │  Riot Games      │                    │  LLM con recuperación  │
    │  y Steam         │                    │  en tiempo real        │
    │  (estadísticas)   │                    └────────────────────────┘
    └──────────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │    Cloudinary    │
                     │   (multimedia)   │
                     └──────────────────┘
```

**Decisión de contexto.** Las APIs de los juegos son la fuente de las
estadísticas verificables: sin ellas el producto pierde su diferencia
estructural, de modo que se tratan como dependencia de primer nivel y no como
un complemento opcional.

---

## Nivel 2 · Contenedores

La plataforma se concibe bajo una arquitectura **monolítica modular**: las
funcionalidades se integran en una única aplicación backend, pero se organizan
internamente en módulos de negocio con responsabilidades claramente definidas.

```
┌──────────────────────────────────────────────────────────────────────┐
│  SPA Web — React.js + TailwindCSS                                    │
│  Feed · Mi perfil · Explorar talento · Vacantes · Panel de equipo    │
│  Dashboard · Mensajes · Auditoría                                     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  HTTPS / JSON  (API REST /api/v1)
┌───────────────────────────────▼──────────────────────────────────────┐
│  API REST — Node.js + Express (monolito modular)                     │
│                                                                      │
│  ┌────────────┐┌────────────┐┌────────────┐┌────────────┐          │
│  │ Usuarios y ││ Estadístic.││  Scouting  ││ Matching IA│          │
│  │  perfiles  ││            ││            ││            │          │
│  └────────────┘└────────────┘└────────────┘└────────────┘          │
│  ┌────────────┐┌────────────┐┌────────────┐┌────────────┐┌────────┐ │
│  │  Ofertas   ││ Mensajería ││Notificacion││Administracio││Integrac.│ │
│  └────────────┘└────────────┘└────────────┘└────────────┘└────────┘ │
│                                                                      │
│  Middleware transversal: autenticación JWT · RBAC · validación ·     │
│  control de tasa · auditoría                                         │
└───────┬──────────────────────┬──────────────────────┬───────────────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐     ┌──────────────┐      ┌─────────────────────┐
│ PostgreSQL 16 │     │    Redis     │      │ Servicios externos  │
│ + pgvector    │     │ caché ·      │      │ Riot · Steam ·      │
│ (índice HNSW) │     │ sesiones ·   │      │ Twitch · YouTube ·  │
│ datos +       │     │ rate limit   │      │ LLM · Sandbox Py    │
│ vectores      │     │              │      │                     │
└───────────────┘     └──────────────┘      └─────────────────────┘
```

**Worker de ingesta.** Desacoplado del ciclo de petición y respuesta: consulta
periódicamente las APIs de los juegos y escribe el snapshot de estadísticas.
Nunca se invoca desde un controlador.

**Confín de la persistencia.** Los módulos comparten el entorno de ejecución y
la capa de datos, pero el acceso a la persistencia está confinado a un
repositorio por módulo: ningún controlador consulta la base de datos
directamente.

---

## Nivel 3 · Componentes del motor de matching

El módulo de Matching IA concentra el aporte diferenciador y por ello se
detalla un nivel más.

```
                      ┌──────────────────────────┐
  Solicitud del ─────▶│  Orquestador de matching │
  módulo de scouting  └────────────┬─────────────┘
                                   │
        ┌──────────────────────────┼───────────────────────────┐
        ▼                          ▼                           ▼
┌────────────────┐   ┌──────────────────────────┐   ┌────────────────────┐
│  Vectorizador  │   │  Recuperador por         │   │  Componente        │
│  de perfil     │   │  contenido               │   │  colaborativo      │
│                │   │  (pgvector · HNSW)       │   │  (interacciones)   │
│ perfil +       │   │                          │   │                    │
│ estadísticas → │   │  ORDER BY embedding <=> $1│   │  matriz equipo ×   │
│ vector(64)     │   │  LIMIT k                 │   │  jugador           │
└────────────────┘   └──────────────────────────┘   └────────────────────┘
        │                          │                           │
        └──────────────────────────┼───────────────────────────┘
                                   ▼
                        ┌──────────────────────┐
                        │  Ponderador de       │
                        │  5 dimensiones        │
                        │  S(j,o) = Σ wk·dk     │
                        └──────────┬───────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
        ┌───────────────────────┐     ┌──────────────────────────┐
        │  Calculador exacto    │     │  Explicador              │
        │  (sandbox de Python)  │     │  (LLM + grounding)       │
        │  ninguna métrica se   │     │  anclado en fuentes      │
        │  calcula en el modelo │     │  recuperadas en tiempo   │
        └───────────────────────┘     │  real                    │
                                      └────────────┬─────────────┘
                                                   ▼
                                      ┌──────────────────────────┐
                                      │  Ranking de candidatos   │
                                      │  puntaje + desglose +    │
                                      │  explicación + grounding │
                                      └──────────────────────────┘
```

### Recorrido de una petición

1. El **orquestador** recibe la solicitud del módulo de scouting y coordina el
   resto de los componentes.
2. El **vectorizador** convierte las estadísticas normalizadas y los atributos
   del jugador en un vector de características que se persiste junto al perfil
   (tabla `PerfilVector`, con `versión del modelo` y `fecha de cálculo`, de
   modo que un cambio de modelo no altera el perfil ni pierde trazabilidad).
3. El **recuperador por contenido** ejecuta una consulta de similitud sobre el
   índice HNSW de pgvector y devuelve los candidatos más próximos al vector de
   requisitos de la oferta, **sin recorrer la tabla completa**.
4. El **componente colaborativo** ajusta ese conjunto con la señal de
   interacciones previas entre equipos y jugadores. Mientras el historial sea
   insuficiente, su peso permanece en cero y el sistema opera en modo puramente
   basado en contenido.
5. El **ponderador** aplica la ecuación (1) con los pesos configurados por la
   organización.
6. El **calculador exacto** delega las operaciones numéricas finales a un
   intérprete de Python aislado, siguiendo el patrón de modelos de lenguaje
   asistidos por programa.
7. El **explicador** redacta en lenguaje natural la justificación del puntaje
   mediante un modelo Transformer anclado en datos recuperados en tiempo real.

### Correspondencia con el cliente

| Componente del modelo C4 | Implementación en el cliente | Archivo |
| --- | --- | --- |
| Vectorizador de perfil | `vectorizarPerfil` (64 dims, determinista) | `src/lib/vector.ts` |
| Recuperador por contenido | `buscarPorSimilitud` (top-K, coseno) | `src/lib/vector.ts` |
| Componente colaborativo | `puntajeColaborativo`, `hayHistorialSuficiente` | `src/lib/collaborative.ts` |
| Ponderador de 5 dimensiones | `evaluarDimension`, `normalizarPesos` | `src/lib/matching.ts` |
| Orquestador | `calcularRanking` + traza de ejecución | `src/services/matching.ts` |
| Calculador exacto | `calculoExactoSandbox` | `src/services/llm.ts` |
| Explicador | `generarExplicacion` (resumen, fortalezas, riesgos, grounding) | `src/services/llm.ts` |

En el backend real, el recuperador por contenido resuelve contra PostgreSQL
(`ORDER BY embedding <=> $1 LIMIT k` con índice HNSW) y el calculador exacto
contra el sandbox de Python; el cliente solo consume el resultado.

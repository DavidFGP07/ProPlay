# Modelo de datos

El modelo sigue el enfoque entidad-relación de Chen y se persiste en
PostgreSQL. Por el enfoque monolítico modular, todas las funcionalidades
comparten una misma capa de persistencia, lo que mantiene una fuente
centralizada de información y evita la duplicación de entidades entre módulos.

## Diagrama entidad-relación

```
        Habilidad ──< HabilidadJugador >──┐
             │            │                │
             │            │                │
  Endorsement >┘          │                │
        │                 │                │
        │  Usuario        │                │
        ├────────────────>│                │
        │  │              │                │
        │  │ 1:0..1       │  1:N          │
        │  ├── PerfilJugador ──< Estadistica
        │  ├── PerfilEquipo ──< Oferta ──< Matching
        │  │                        │  ▲
        │  └── AuditLog             │  │
        │                    1:N   │  │
        └──< Mensaje         Postulacion
                                    │
                         1:1       │  1:N
                    ┌───────────────┴──────────┐
                    │                          │
              PerfilVector              CuentaGaming
              (embedding vector(64))     (token cifrado)
```

En morado se highlighting las entidades que soportan directamente el motor de
matching: `Habilidad`, `HabilidadJugador`, `Endorsement`, `PerfilVector`,
`Matching` y `Estadistica`.

## Diccionario de entidades

| Entidad | Propósito | Atributos principales | Relaciones |
| --- | --- | --- | --- |
| **Usuario** | Identidad y credenciales de acceso; raíz del control de acceso por roles | email (único), hash de contraseña, rol, estado, marcas de tiempo | 1:0..1 con PerfilJugador y PerfilEquipo; 1:N con AuditLog y Mensaje |
| **PerfilJugador** | Información profesional extendida del jugador | biografía, región, país, horas de disponibilidad, disposición a relocalizarse | 1:N con CuentaGaming, Estadistica y HabilidadJugador; 1:1 con PerfilVector |
| **PerfilEquipo** | Datos de la organización que publica oportunidades | nombre, descripción, sitio web, logo, región | 1:N con Oferta |
| **CuentaGaming** | Vínculo verificado con una plataforma externa | plataforma, identificador externo, tokens cifrados, fecha de verificación | N:1 con PerfilJugador |
| **Estadistica** | Métricas de desempeño obtenidas por ingesta directa | juego, rol, partidas, victorias, KDA, win rate, métricas específicas (JSON), fuente | N:1 con PerfilJugador |
| **PerfilVector** | Representación vectorial del jugador para la búsqueda por similitud | `embedding vector(64)`, versión del modelo, fecha de cálculo | 1:1 con PerfilJugador; alimenta Matching |
| **Habilidad / HabilidadJugador** | Catálogo de habilidades y su asignación a cada jugador con nivel declarado | nombre, categoría (técnica o blanda), nivel 1–5, estado de verificación | N:M entre PerfilJugador y Habilidad |
| **Endorsement** | Validación de una habilidad por parte de un tercero | autor, fecha; restricción de unicidad por (habilidad, autor) | N:1 con HabilidadJugador y con Usuario |
| **Oferta** | Oportunidad publicada por un equipo | juego, rol, rango mínimo, experiencia, región, horas semanales, estado | N:1 con PerfilEquipo; 1:N con Postulacion y Matching |
| **Postulacion** | Candidatura de un jugador a una oferta | estado del proceso, mensaje, fechas | N:M entre Oferta y PerfilJugador |
| **Matching** | Resultado del algoritmo para un par jugador–oferta | puntaje (0–1), desglose por dimensión (JSON), fecha de cálculo | N:1 con Oferta y con PerfilJugador |
| **Mensaje** | Comunicación entre usuarios | emisor, receptor, texto, leído | N:1 con Usuario |
| **AuditLog** | Registro de operaciones sensibles para trazabilidad | acción, entidad afectada, metadatos, fecha | N:1 con Usuario |

## Tres decisiones de diseño

### 1. PostgreSQL con pgvector en lugar de un motor embebido

El algoritmo de matching requiere búsqueda por similitud sobre los vectores de
perfil, y resolverla dentro del motor mediante un índice **HNSW** evita cargar
la totalidad de los perfiles en memoria en cada consulta, además de garantizar
persistencia entre despliegues.

### 2. `PerfilVector` como entidad propia

Separarla permite **recalcular los vectores al cambiar la versión del modelo**
sin alterar el perfil ni perder trazabilidad: la entidad guarda tanto la
versión del modelo como la fecha de cálculo, de modo que siempre se sabe con
qué representación se construyó cada ranking.

### 3. Tokens de `CuentaGaming` cifrados

Requisito **RNF-03**: los tokens de acceso a las cuentas de juego se almacenan
con cifrado **AES-256-GCM**. Su compromiso permitiría a un tercero actuar en
nombre del usuario sobre su cuenta de juego, de modo que el token nunca sale
del servidor: solo el worker de ingesta lo utiliza para consultar la API
oficial.

## Correspondencia con el cliente

| Entidad | Tipo en el cliente | Archivo |
| --- | --- | --- |
| Usuario | `Usuario` | `src/types/index.ts` |
| PerfilJugador | `PerfilJugador` (+ `Logro`, `Partida`) | `src/types/index.ts` |
| PerfilEquipo | `PerfilEquipo` | `src/types/index.ts` |
| CuentaGaming | `CuentaGaming` | `src/types/index.ts` |
| Estadistica | `Estadistica` | `src/types/index.ts` |
| PerfilVector | `ResultadoMatching.embedding` (64 dims) | `src/lib/vector.ts` |
| Habilidad / HabilidadJugador | `Habilidad`, `HabilidadJugador` | `src/types/index.ts` |
| Endorsement | `Endorsement` | `src/types/index.ts` |
| Oferta | `Oferta` | `src/types/index.ts` |
| Postulacion | `Postulacion` | `src/types/index.ts` |
| Matching | `Matching` → `ResultadoMatching` + `DesgloseDimension` | `src/types/index.ts` |
| Mensaje | `Mensaje` | `src/types/index.ts` |
| AuditLog | `AuditLog` | `src/types/index.ts` |

Las entidades `Notificacion` y `ConfiguracionPrivacidad` completan el modelo
del lado del cliente: la primera corresponde al módulo de notificaciones
(RF-12) y la segunda materializa las opciones de visibilidad exigidas por
RNF-05.

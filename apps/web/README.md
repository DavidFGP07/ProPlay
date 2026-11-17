# ProPlay · cliente web (`apps/web`)

SPA en React 18 + Vite + Tailwind 4 que consume la API REST de `apps/api`
(`/api/v1`). Es un workspace del monorepo: se instala, se prueba y se arranca
desde la raíz (ver el [README principal](../../README.md)).

```bash
npm run dev -w web        # http://localhost:5173 (o `npm run dev` en la raíz, con la API)
npm run build -w web      # typecheck + build de producción en dist/
npm test -w web           # Vitest + Testing Library
npm run coverage -w web   # pruebas con el umbral de cobertura de vite.config.ts
```

Necesita `apps/web/.env` con `VITE_API_URL` (copia `.env.example`). Las cuentas
de prueba son las del seed de la API, con su contraseña común (README principal,
«Cuentas de prueba»).

---

## Origen: el prototipo de la rama `Fronted`

El cliente nació como un prototipo completo que simulaba toda la API en memoria
(`src/mocks/`) e implementaba en el navegador un motor de matching propio
(`src/lib/matching.ts`, `vector.ts`, `collaborative.ts`) y un explicador
simulado (`src/services/matching.ts`, `llm.ts`). Se integró en el monorepo y las
vistas se van conectando a la API real una a una (`docs/decisiones.md`,
«Integración del cliente de `Fronted`»).

Ese código del prototipo **sigue en el repositorio pero no decide nada en las
vistas conectadas**: el ranking real lo calcula la API. Lo usan todavía las
vistas simuladas (el feed) y queda como referencia para el explicador del
Sprint 4. El umbral de cobertura de `vite.config.ts` (60 %) se aplica a `src/lib` y al
orquestador y el explicador simulados de `src/services`; el motor real de la API
no tiene umbral de cobertura.

---

## Qué es real y qué es simulado

El estado vista a vista está en el inventario de `CLAUDE.md` §5 y en §9. En
resumen:

- **Con la API real:** ingreso y registro, `/cuenta` (nombre y contraseña), el
  perfil público `/jugador/:id`, Cuentas vinculadas y Mis estadísticas (Riot),
  Explorar oportunidades y el detalle de la oferta con la postulación, crear y
  editar oferta con sus pesos, el ranking de candidatos y el detalle del
  candidato, el buscador de talento, el panel del equipo y la analítica
  (`/dashboard`), y en Mi perfil la cabecera, los datos profesionales, la
  ubicación y la pestaña de postulaciones.
- **Simulado:** el resto de Mi perfil (cuentas, habilidades, portafolio,
  privacidad y laterales), el feed (`/`), los mensajes, las notificaciones y el
  panel de administración. Las tres últimas vistas son trabajo futuro y siguen
  en el menú hasta la tarea 1.7 del plan.

### El puente de datos de demostración

Con `VITE_DEMO_DATA=true`, las vistas simuladas se alimentan de `src/mocks/` y la
sesión real se hace pasar por una persona de ejemplo de su mismo rol
(`src/mocks/persona.ts`); el `Layout` lo avisa con «Datos de demostración» y cada
sección simulada de una vista mixta lleva `MarcaDatosDemo`. Con la bandera
apagada sólo se ve lo real. Las rutas que ya no usan el puente están en
`RUTAS_SIN_DATOS_DEMO` (`src/router/areas.ts`).

---

## Estructura

```
src/
├── App.tsx            rutas, áreas por rol (router/areas.ts) y carga diferida
├── api/               hooks de TanStack Query: los reales leen con los esquemas de
│                      @proplay/shared; los simulados pasan por api/demo.ts
├── components/        Layout, componentes de las vistas y ui.tsx (sistema de diseño)
├── context/           sesión (AuthContext) y avisos (ToastContext)
├── i18n/              es.ts (textos de la interfaz) y legal.ts (aviso de privacidad)
├── lib/               lógica de presentación (aportes, explicación, pesos, ubicación)
│                      y el motor del prototipo (matching.ts, vector.ts, collaborative.ts)
├── mocks/             simulación del prototipo (puente de demostración)
├── pages/             una página por vista
├── router/            áreas por rol y rutas sin datos de demostración
└── services/          orquestador y explicador simulados del prototipo
```

Las convenciones (contrato en `@proplay/shared`, textos en `i18n/es.ts`, tokens de
Tailwind, Recharts como única librería de gráficos, cuatro estados en cada vista)
están en `CLAUDE.md` §6.

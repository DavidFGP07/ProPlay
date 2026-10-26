import type { Rol } from '@proplay/shared'

/**
 * Cuentas que crea `apps/api/prisma/seed.ts` (npm run db:seed). Son reales en
 * la base de desarrollo: el login las ofrece solo en modo desarrollo para no
 * teclearlas. Si cambia el seed, cambia esta lista.
 */
export const PASSWORD_SEMILLA = 'ProPlay123'

export const CUENTAS_SEMILLA: { rol: Rol; email: string; nombre: string }[] = [
  { rol: 'JUGADOR', email: 'jugador1@proplay.gg', nombre: 'Andrés Molina' },
  { rol: 'EQUIPO', email: 'equipo@caribeesports.gg', nombre: 'Caribe eSports' },
  { rol: 'SCOUT', email: 'scout@proplay.gg', nombre: 'Marcela Guzmán' },
  { rol: 'ADMIN', email: 'admin@proplay.gg', nombre: 'Administración ProPlay' },
]

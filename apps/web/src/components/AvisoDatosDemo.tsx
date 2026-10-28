import { matchPath, useLocation } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import { Badge } from '@/components/ui'
import { datosDemoActivos, personaActual } from '@/api/demo'
import { useAuth } from '@/context/AuthContext'
import { es } from '@/i18n/es'
import { RUTAS_SIN_DATOS_DEMO } from '@/router/areas'

/**
 * Distintivo de las vistas alimentadas por el puente de datos de
 * demostracion: mientras este activo, el usuario tiene que saber que lo que
 * ve no es suyo. Desaparece al apagar VITE_DEMO_DATA y en las rutas que ya
 * solo usan endpoints reales (RUTAS_SIN_DATOS_DEMO).
 */
export function AvisoDatosDemo() {
  const { usuario } = useAuth()
  const { pathname } = useLocation()
  const soloDatosReales = RUTAS_SIN_DATOS_DEMO.some((ruta) => matchPath(ruta, pathname))
  if (!datosDemoActivos || !usuario || soloDatosReales) return null
  const persona = personaActual()

  return (
    <div
      role="note"
      className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3.5 py-2.5"
    >
      <FlaskConical size={15} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
      <p className="text-[11px] leading-relaxed text-amber-100/90">
        <strong className="font-semibold text-amber-200">{es.demo.titulo}</strong>
        {' · '}
        {es.demo.detalle(persona.nombre)}
      </p>
    </div>
  )
}

/**
 * Marca de una seccion simulada dentro de una vista que ya muestra datos
 * reales (RUTAS_SIN_DATOS_DEMO): el aviso pasa de la pagina a cada seccion.
 */
export function MarcaDatosDemo() {
  return (
    <p role="note" className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-amber-100/80">
      <Badge tono="ambar" className="shrink-0">
        <FlaskConical size={11} aria-hidden />
        {es.demo.titulo}
      </Badge>
      {es.demo.seccion(personaActual().nombre)}
    </p>
  )
}

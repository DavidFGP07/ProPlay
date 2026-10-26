import { FlaskConical } from 'lucide-react'
import { datosDemoActivos, personaActual } from '@/api/demo'
import { useAuth } from '@/context/AuthContext'
import { es } from '@/i18n/es'

/**
 * Distintivo de las vistas alimentadas por el puente de datos de
 * demostracion: mientras este activo, el usuario tiene que saber que lo que
 * ve no es suyo. Desaparece al apagar VITE_DEMO_DATA.
 */
export function AvisoDatosDemo() {
  const { usuario } = useAuth()
  if (!datosDemoActivos || !usuario) return null
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

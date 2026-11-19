import { Mail } from 'lucide-react'
import type { ContactoPostulante } from '@proplay/shared'
import { cn } from '@/components/ui'
import { es } from '@/i18n/es'

const t = es.contacto

/**
 * Sustituto de la mensajería (decisión 0.10): enlace `mailto:` al correo del
 * jugador. La API sólo lo envía al equipo dueño de la oferta y con la
 * postulación en revisión, entrevista o aceptada; sin contacto no se pinta.
 */
export function CorreoContacto({
  contacto,
  nombre,
  className,
}: {
  contacto: ContactoPostulante
  nombre: string
  className?: string
}) {
  if (!contacto) return null
  return (
    <a
      href={`mailto:${contacto.email}`}
      title={t.ayuda}
      aria-label={t.etiqueta(nombre, contacto.email)}
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium break-all text-brand-300 hover:text-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400',
        className,
      )}
    >
      <Mail size={13} aria-hidden className="shrink-0" />
      {contacto.email}
    </a>
  )
}

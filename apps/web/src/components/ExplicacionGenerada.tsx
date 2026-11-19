import { Sparkles } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui'
import { useExplicacionGenerada } from '@/api/explicador'
import { es } from '@/i18n/es'

const t = es.explicacionGenerada

/**
 * RF-11 · «Por qué encaja (generado con IA)»: el texto que redacta el modelo de
 * lenguaje a partir del desglose, sobre la tabla de aportes. Mientras se
 * genera, un esqueleto. Si no hay texto (explicador desactivado, error, tiempo
 * agotado, fidelidad o límite) o la petición falla, una nota discreta: la
 * explicación determinista de debajo sigue ahí, y el puesto nunca depende de
 * esto (tarea 4.3).
 */
export function ExplicacionGenerada({ ofertaId, jugadorId }: { ofertaId: string; jugadorId: string }) {
  const consulta = useExplicacionGenerada(ofertaId, jugadorId)

  if (consulta.isPending) {
    return (
      <Card aria-busy="true" aria-label={t.cargando} className="space-y-3 p-5">
        <div className="skeleton h-4 w-56 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-11/12 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </Card>
    )
  }

  if (consulta.isError || consulta.data.estado === 'NO_DISPONIBLE') {
    return (
      <p role="note" className="px-1 text-xs text-slate-400">
        {t.noDisponible}
      </p>
    )
  }

  return (
    <Card>
      <CardHeader title={t.titulo} subtitle={t.nota} icon={<Sparkles size={16} />} />
      <p className="p-5 text-sm leading-relaxed text-slate-200">{consulta.data.texto}</p>
    </Card>
  )
}

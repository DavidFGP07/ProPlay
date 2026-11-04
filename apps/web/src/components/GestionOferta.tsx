import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import {
  TRANSICIONES_OFERTA,
  TRANSICIONES_POSTULACION,
  type EstadoOferta,
  type Oferta,
} from '@proplay/shared'
import { Button, Modal } from '@/components/ui'
import { codigoError } from '@/api/errores'
import { useCambiarEstadoOferta, usePostulacionesRecibidas } from '@/api/ofertas'
import { useToast } from '@/context/ToastContext'
import { es } from '@/i18n/es'

const t = es.gestionOferta

const ACCION: Record<Exclude<EstadoOferta, 'BORRADOR'>, string> = {
  ABIERTA: t.publicar,
  CUBIERTA: t.cubrir,
  CERRADA: t.cerrar,
}

// RF-07 · Gestión de una oferta propia desde su detalle: editarla y cambiar
// su estado según TRANSICIONES_OFERTA (PATCH /api/v1/ofertas/:id/estado).
// Cubrir y cerrar se confirman, porque rechazan las postulaciones en proceso.
export function GestionOferta({ oferta }: { oferta: Oferta }) {
  const { notificar } = useToast()
  const cambio = useCambiarEstadoOferta()
  const postulaciones = usePostulacionesRecibidas(oferta.id, oferta.estado === 'ABIERTA')
  const [confirmando, setConfirmando] = useState<'CUBIERTA' | 'CERRADA' | null>(null)
  const siguientes = TRANSICIONES_OFERTA[oferta.estado] as readonly Exclude<EstadoOferta, 'BORRADOR'>[]
  const finalizada = siguientes.length === 0
  const enProceso = (postulaciones.data ?? []).filter(
    (p) => TRANSICIONES_POSTULACION[p.estado].length > 0,
  ).length

  const cambiar = async (estado: EstadoOferta) => {
    try {
      await cambio.mutateAsync({ id: oferta.id, estado })
      notificar(t.estadoCambiado(es.estadoOferta[estado]))
    } catch (e) {
      notificar(t.errores[codigoError(e) ?? ''] ?? es.comun.errores.generico, 'error')
    } finally {
      setConfirmando(null)
    }
  }

  if (finalizada) {
    return (
      <p className="rounded-xl border border-white/8 bg-surface-900/60 px-4 py-3 text-xs leading-relaxed text-slate-400">
        {t.finalizada}
      </p>
    )
  }

  return (
    <div className="space-y-2 rounded-xl border border-white/8 bg-surface-900/60 p-4">
      <h2 className="text-xs font-semibold text-slate-200">{t.titulo}</h2>
      {oferta.estado === 'BORRADOR' && (
        <p className="text-[11px] leading-relaxed text-slate-400">{t.borrador}</p>
      )}
      <Link
        to={`/panel-equipo/ofertas/${oferta.id}/editar`}
        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/5 text-xs font-medium text-slate-200 transition hover:border-brand-500/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
      >
        <Pencil size={13} aria-hidden />
        {t.editar}
      </Link>
      {siguientes.map((estado) => (
        <Button
          key={estado}
          tamano="sm"
          className="w-full"
          variante={estado === 'ABIERTA' ? 'primario' : estado === 'CUBIERTA' ? 'exito' : 'peligro'}
          cargando={cambio.isPending && cambio.variables?.estado === estado}
          disabled={cambio.isPending}
          onClick={() => (estado === 'ABIERTA' ? void cambiar(estado) : setConfirmando(estado))}
        >
          {ACCION[estado]}
        </Button>
      ))}

      <Modal
        abierto={confirmando !== null}
        onCerrar={() => setConfirmando(null)}
        titulo={confirmando ? t.confirmarTitulo(ACCION[confirmando]) : ''}
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-300">
            {confirmando === 'CUBIERTA' ? t.confirmarCubrir : t.confirmarCerrar}
          </p>
          {enProceso > 0 && <p className="text-xs font-medium text-amber-300">{t.pendientes(enProceso)}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variante="fantasma" onClick={() => setConfirmando(null)}>
              {t.cancelar}
            </Button>
            <Button
              variante={confirmando === 'CUBIERTA' ? 'exito' : 'peligro'}
              cargando={cambio.isPending}
              onClick={() => confirmando && void cambiar(confirmando)}
            >
              {t.confirmar}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

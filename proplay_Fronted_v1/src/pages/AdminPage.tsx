import { useEffect, useState } from 'react'
import { ClipboardList, Database, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  SectionTitle,
  Stat,
} from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { ejecutarIngesta, obtenerAuditLog, obtenerMetricas } from '@/services/api'
import type { AuditLog } from '@/types'

export default function AdminPage() {
  const { notificar } = useToast()
  const [log, setLog] = useState<AuditLog[]>([])
  const [sincronizando, setSincronizando] = useState(false)
  const [verificados, setVerificados] = useState(0)

  const cargar = async () => {
    const [l, m] = await Promise.all([Promise.resolve(obtenerAuditLog()), obtenerMetricas()])
    setLog(l)
    setVerificados(m.perfilesVerificados)
  }

  useEffect(() => {
    void cargar()
  }, [])

  const sincronizar = async () => {
    setSincronizando(true)
    const r = await ejecutarIngesta()
    setSincronizando(false)
    notificar(
      `Ingesta completada: ${r.registrosActualizados} registros en ${r.duracionMs} ms.`,
    )
    await cargar()
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Administracion y trazabilidad"
        subtitle="Operaciones sensibles registradas con usuario, accion y marca de tiempo (RNF-06)."
        action={
          <Button
            variante="secundario"
            tamano="sm"
            onClick={sincronizar}
            cargando={sincronizando}
          >
            <RefreshCw size={14} />
            Forzar ingesta
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Operaciones auditadas"
          value={log.length}
          icono={<ClipboardList size={16} />}
          acento="violeta"
        />
        <Stat
          label="Perfiles verificados"
          value={verificados}
          icono={<ShieldCheck size={16} />}
          acento="verde"
        />
        <Stat
          label="Backends de integracion"
          value={4}
          hint="Riot Games · Steam · Cloudinary · LLM"
          icono={<Database size={16} />}
          acento="cian"
        />
      </div>

      <Card>
        <CardHeader
          title="Registro de auditoria"
          subtitle="Operaciones sensibles sobre datos personales."
          icon={<ClipboardList size={16} />}
        />
        {log.length === 0 ? (
          <EmptyState
            icono={<ClipboardList size={22} />}
            titulo="Sin operaciones registradas"
            descripcion="Las acciones que ejecutes durante esta sesion apareceran aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/8 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Usuario</th>
                  <th className="px-5 py-2.5 font-medium">Accion</th>
                  <th className="px-5 py-2.5 font-medium">Entidad</th>
                  <th className="px-5 py-2.5 font-medium">Marca de tiempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {log.map((l) => (
                  <tr key={l.id} className="transition hover:bg-white/3">
                    <td className="px-5 py-2.5 text-slate-300">{l.usuarioNombre}</td>
                    <td className="px-5 py-2.5">
                      <Badge tono="violeta">{l.accion}</Badge>
                    </td>
                    <td className="px-5 py-2.5 font-mono text-slate-500">
                      {l.entidad}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-slate-600">
                      {new Date(l.fecha).toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            t: 'Cumplimiento normativo',
            d: 'El tratamiento de datos personales se ajusta a la Ley 1581 de 2012 de Colombia, con opciones de visibilidad configurables por el usuario.',
          },
          {
            t: 'Seguridad en reposo',
            d: 'Los tokens de acceso a las cuentas de juego se almacenan cifrados con AES-256-GCM, verificado por inspeccion de la base de datos.',
          },
          {
            t: 'Seguridad en transito',
            d: 'Toda comunicacion entre cliente, servidor y servicios externos se cifra con HTTPS y TLS 1.2 o superior.',
          },
        ].map((c) => (
          <Card key={c.t} className="p-5">
            <h4 className="text-sm font-semibold text-slate-100">{c.t}</h4>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{c.d}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

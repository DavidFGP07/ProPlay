import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageSquare, Send } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
} from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useIdentidad } from '@/api/identidad'
import { useContactos, useEnviarMensaje, useMensajes } from '@/api/mensajes'

export default function MensajesPage() {
  const { usuario } = useAuth()
  const { notificar } = useToast()
  const [parametros] = useSearchParams()
  const { data: mensajes = [] } = useMensajes()
  const { data: contactos = [] } = useContactos()
  const { data: identidad } = useIdentidad()
  const envio = useEnviarMensaje()
  const [texto, setTexto] = useState('')
  const [conversacion, setConversacion] = useState<string | null>(null)
  const finRef = useRef<HTMLDivElement>(null)
  const yo = identidad?.usuarioId
  const enviando = envio.isPending

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes.length])

  // Si la vista llega con ?con=<usuarioId> se abre esa conversacion (por
  // ejemplo, desde el boton "Contactar" del perfil de un jugador).
  useEffect(() => {
    const destino = parametros.get('con')
    if (destino) setConversacion(destino)
  }, [parametros])

  useEffect(() => {
    if (!conversacion && contactos.length > 0) setConversacion(contactos[0].id)
  }, [contactos, conversacion])

  const conversacionActual = contactos.find((c) => c.id === conversacion)
  const hilos = mensajes.filter(
    (m) =>
      (m.emisorId === conversacion && m.receptorId === yo) ||
      (m.receptorId === conversacion && m.emisorId === yo),
  )

  const enviar = async () => {
    if (!usuario || !conversacion || !texto.trim()) return
    await envio.mutateAsync({ receptorId: conversacion, texto: texto.trim() })
    setTexto('')
    notificar('Mensaje enviado.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Mensajes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Comunicacion directa entre jugadores, equipos y scouts dentro del
          ecosistema verificado.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit min-w-0">
          <CardHeader title="Conversaciones" icon={<MessageSquare size={16} />} />
          <div className="max-h-[26rem] overflow-y-auto p-2">
            {contactos.length === 0 ? (
              <EmptyState
                icono={<MessageSquare size={22} />}
                titulo="Sin contactos"
              />
            ) : (
              contactos.map((c) => {
                const ultimo = [...mensajes]
                  .reverse()
                  .find(
                    (m) =>
                      (m.emisorId === c.id && m.receptorId === yo) ||
                      (m.receptorId === c.id && m.emisorId === yo),
                  )
                return (
                  <button
                    key={c.id}
                    onClick={() => setConversacion(c.id)}
                    className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition ${
                      conversacion === c.id
                        ? 'bg-brand-500/12'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <Avatar nombre={c.nombre} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-200">
                        {c.nombre}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {ultimo?.texto ?? c.sub}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </Card>

        <Card className="flex h-[32rem] min-w-0 flex-col">
          <CardHeader
            title={conversacionActual?.nombre ?? 'Conversacion'}
            subtitle={conversacionActual?.sub}
            icon={<MessageSquare size={16} />}
            action={<Badge tono="verde">Canal verificado</Badge>}
          />

          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {hilos.length === 0 ? (
              <EmptyState
                icono={<MessageSquare size={22} />}
                titulo="Sin mensajes"
                descripcion="Inicia la conversacion con este contacto."
              />
            ) : (
              hilos.map((m) => {
                const propio = m.emisorId === yo
                return (
                  <div
                    key={m.id}
                    className={`flex ${propio ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                        propio
                          ? 'bg-gradient-to-br from-brand-600 to-accent-600 text-white'
                          : 'border border-white/8 bg-white/5 text-slate-300'
                      }`}
                    >
                      <p className="text-xs leading-relaxed">{m.texto}</p>
                      <p
                        className={`mt-1 text-[10px] ${
                          propio ? 'text-white/60' : 'text-slate-600'
                        }`}
                      >
                        {new Date(m.fecha).toLocaleString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={finRef} />
          </div>

          <div className="flex gap-2 border-t border-white/8 p-4">
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void enviar()
              }
            }}
              placeholder="Escribe un mensaje..."
            />
            <Button onClick={enviar} cargando={enviando} disabled={!texto.trim()}>
              <Send size={14} />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

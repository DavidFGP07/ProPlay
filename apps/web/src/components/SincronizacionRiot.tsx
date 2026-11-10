import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui'
import { mensajeDeError } from '@/api/client'
import { codigoDeError } from '@/api/cuentasGaming'
import { useSincronizacion } from '@/api/estadisticas'
import { es } from '@/i18n/es'

const t = es.sincronizacion

/** Codigos que son una espera, no un fallo: se avisan sin rojo. */
const CODIGOS_DE_ESPERA = ['MUCHA_DEMANDA', 'RIOT_NO_DISPONIBLE', 'TOO_MANY_REQUESTS']

// RF-03 · Boton «Sincronizar» con el estado de la ingesta: en cola (tambien
// por mucha demanda en la cuota de Riot), en curso y el resultado al terminar.
// Lo usan Cuentas vinculadas y Mis estadisticas.
export function SincronizacionRiot({
  etiqueta,
  alinear = 'inicio',
}: {
  etiqueta: string
  alinear?: 'inicio' | 'fin' | 'centro'
}) {
  const { estado, sincronizar } = useSincronizacion()
  // El resultado se cuenta sólo si la pidió esta vista (no el planificador).
  const [pedida, setPedida] = useState(false)

  const datos = estado.data
  const ocupada = datos?.estado === 'EN_COLA' || datos?.estado === 'EN_CURSO'
  const alineacion = { inicio: 'items-start', fin: 'items-end', centro: 'items-center' }[alinear]

  return (
    <div className={`flex flex-col gap-1.5 ${alineacion}`}>
      <Button
        cargando={sincronizar.isPending || ocupada}
        disabled={ocupada}
        onClick={() => sincronizar.mutate(undefined, { onSuccess: () => setPedida(true) })}
      >
        <RefreshCw size={14} aria-hidden />
        {ocupada ? t.enMarcha : etiqueta}
      </Button>
      <EstadoTexto
        mensaje={
          datos?.estado === 'EN_CURSO'
            ? t.enCurso
            : datos?.estado === 'EN_COLA'
              ? datos.muchaDemanda
                ? t.muchaDemanda
                : t.enCola
              : pedida && datos?.ultimoResultado
                ? t.resultado[datos.ultimoResultado.tipo]
                : null
        }
        aviso={datos?.estado === 'INACTIVA' && datos.ultimoResultado?.tipo === 'FALLIDA'}
      />
      {sincronizar.isError && (
        <p
          role={CODIGOS_DE_ESPERA.includes(codigoDeError(sincronizar.error) ?? '') ? 'status' : 'alert'}
          className={
            CODIGOS_DE_ESPERA.includes(codigoDeError(sincronizar.error) ?? '')
              ? 'text-xs text-amber-300'
              : 'text-xs text-rose-300'
          }
        >
          {mensajeDeError(sincronizar.error)}
        </p>
      )}
    </div>
  )
}

function EstadoTexto({ mensaje, aviso }: { mensaje: string | null; aviso: boolean }) {
  if (!mensaje) return null
  return (
    <p role="status" className={aviso ? 'text-xs text-amber-300' : 'text-xs text-slate-400'}>
      {mensaje}
    </p>
  )
}

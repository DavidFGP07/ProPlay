import { useId } from 'react'
import { RotateCcw } from 'lucide-react'
import { PESOS_MATCHING } from '@proplay/shared'
import { Button } from '@/components/ui'
import { es } from '@/i18n/es'
import {
  DIMENSIONES_VISIBLES,
  aPorcentajes,
  reajustarPesos,
  redondear,
  type Porcentajes,
} from '@/lib/pesos'

const t = es.formularioOferta

/** Pesos por defecto de ProPlay (`PESOS_MATCHING`) en porcentajes. */
export const PORCENTAJES_POR_DEFECTO = aPorcentajes(PESOS_MATCHING)

// RF-09 · Pesos de las dimensiones de la ecuación (1): siempre suman 100 %.
// Mover uno reajusta los demás en proporción (lib/pesos.ts), con ratón, táctil
// o teclado (flechas, Inicio, Fin), porque son `input type="range"`. Sólo se
// muestran las dimensiones con datos en el piloto (DIMENSIONES_VISIBLES); las
// otras van siempre en 0.
export function DeslizadoresPesos({
  valor,
  onCambiar,
}: {
  valor: Porcentajes
  onCambiar: (pesos: Porcentajes) => void
}) {
  const base = useId()
  // Se muestran enteros que suman 100; el estado conserva los decimales.
  const enteros = redondear(valor)
  const total = DIMENSIONES_VISIBLES.reduce((suma, d) => suma + enteros[d], 0)

  return (
    <div className="space-y-4">
      {DIMENSIONES_VISIBLES.map((dimension) => {
        const id = `${base}-${dimension}`
        const nombre = es.dimension[dimension]
        return (
          <div key={dimension}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <label htmlFor={id} className="font-medium text-slate-300">
                {nombre}
              </label>
              <output htmlFor={id} className="font-mono text-sm text-brand-300">
                {enteros[dimension]} %
              </output>
            </div>
            <input
              id={id}
              type="range"
              min={0}
              max={100}
              step={1}
              value={enteros[dimension]}
              aria-valuetext={`${enteros[dimension]} %`}
              onChange={(e) => onCambiar(reajustarPesos(valor, dimension, Number(e.target.value)))}
              className="mt-2 h-2 w-full cursor-pointer accent-brand-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-400"
            />
          </div>
        )
      })}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3">
        <p className="font-mono text-xs text-slate-300" aria-live="polite">
          {t.total(total)}
        </p>
        <Button variante="fantasma" tamano="sm" onClick={() => onCambiar(PORCENTAJES_POR_DEFECTO)}>
          <RotateCcw size={13} aria-hidden />
          {t.restablecer}
        </Button>
      </div>
    </div>
  )
}

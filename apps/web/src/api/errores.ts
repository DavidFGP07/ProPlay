import axios from 'axios'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { ErrorResponse } from '@proplay/shared'
import { es } from '@/i18n/es'

/**
 * Lleva los errores de la API al formulario: los de validacion (422) a su
 * campo y el resto a un mensaje general. Devuelve ese mensaje, si lo hay.
 */
export function aplicarErrorApi<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  porCodigo: Partial<Record<string, { campo: Path<T>; mensaje: string }>> = {},
): string {
  if (!axios.isAxiosError<ErrorResponse>(error) || !error.response) {
    return es.comun.errores.generico
  }
  const { status, data } = error.response
  const especifico = data?.error?.code ? porCodigo[data.error.code] : undefined
  if (especifico) {
    setError(especifico.campo, { message: especifico.mensaje })
    return ''
  }
  const campos = (data?.error?.details as { campos?: { campo: string; mensaje: string }[] })
    ?.campos
  if (status === 422 && campos?.length) {
    for (const { campo, mensaje } of campos) setError(campo as Path<T>, { message: mensaje })
    return ''
  }
  if (status === 429) return es.comun.errores.demasiadosIntentos
  return es.comun.errores.generico
}

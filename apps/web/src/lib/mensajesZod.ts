import { z } from 'zod'
import { es } from '@/i18n/es'

/**
 * Pone en español los mensajes por defecto de Zod que el contrato no
 * personaliza (longitud, rangos, tipo numérico). Los mensajes propios de los
 * esquemas de `@proplay/shared` se respetan tal cual.
 */
export const mapaErroresZod: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.too_big && issue.type === 'string') {
    return { message: es.validacion.textoLargo(Number(issue.maximum)) }
  }
  if (issue.code === z.ZodIssueCode.too_small && issue.type === 'number') {
    return { message: es.validacion.numeroMinimo(Number(issue.minimum)) }
  }
  if (issue.code === z.ZodIssueCode.too_big && issue.type === 'number') {
    return { message: es.validacion.numeroMaximo(Number(issue.maximum)) }
  }
  if (issue.code === z.ZodIssueCode.invalid_type && issue.expected === 'integer') {
    return { message: es.validacion.numeroEntero }
  }
  if (issue.code === z.ZodIssueCode.invalid_type && issue.received === 'nan') {
    return { message: es.validacion.numeroEntero }
  }
  return { message: ctx.defaultError }
}

import { z } from 'zod'
import { es } from '@/i18n/es'

/**
 * Mapa de errores global del cliente: pone en español los mensajes por defecto
 * de Zod según el código del error, con los textos de `i18n/es.ts`. No traduce
 * campo a campo: vale para todo esquema, también los de `@proplay/shared`
 * (hay una sola copia de Zod). Los mensajes propios de un esquema se respetan
 * tal cual, y los mensajes no van a `shared`.
 */
export const mapaErroresZod: z.ZodErrorMap = (issue, ctx) => {
  const t = es.validacion
  switch (issue.code) {
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: t.textoCorto(Number(issue.minimum)) }
      if (issue.type === 'number') return { message: t.numeroMinimo(Number(issue.minimum)) }
      break
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: t.textoLargo(Number(issue.maximum)) }
      if (issue.type === 'number') return { message: t.numeroMaximo(Number(issue.maximum)) }
      break
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: t.obligatorio }
      }
      if (issue.expected === 'integer' || issue.received === 'nan') {
        return { message: t.numeroEntero }
      }
      break
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'url') return { message: t.url }
      if (issue.validation === 'email') return { message: t.correo }
      break
    case z.ZodIssueCode.invalid_enum_value:
      return { message: t.opcionInvalida }
  }
  return { message: ctx.defaultError }
}

/** Instala el mapa para toda la aplicación; se llama una vez al arrancar. */
export function instalarMensajesZod(): void {
  z.setErrorMap(mapaErroresZod)
}

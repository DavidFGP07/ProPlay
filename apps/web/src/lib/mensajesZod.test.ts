import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { perfilEquipoSchema, perfilJugadorSchema } from '@proplay/shared'

/**
 * El mapa está instalado de forma global en test/setup.ts, igual que en
 * main.tsx: estas pruebas no lo pasan a ningún esquema.
 */
function mensajes(esquema: z.ZodTypeAny, valor: unknown): string[] {
  const resultado = esquema.safeParse(valor)
  return resultado.success ? [] : resultado.error.issues.map((issue) => issue.message)
}

describe('mapa de errores global de Zod', () => {
  it.each([
    ['too_big de texto', z.string().max(3), 'abcd', 'Máximo 3 caracteres'],
    ['too_small de texto', z.string().min(2), 'a', 'Mínimo 2 caracteres'],
    ['too_big de número', z.number().max(80), 81, 'Debe ser 80 o menos'],
    ['too_small de número', z.number().min(0), -1, 'Debe ser 0 o más'],
    ['entero', z.number().int(), 2.5, 'Escribe un número entero'],
    ['NaN', z.number(), Number.NaN, 'Escribe un número entero'],
    ['obligatorio', z.object({ a: z.string() }), {}, 'Campo obligatorio'],
    ['url', z.string().url(), 'no-es-url', 'Escribe una dirección web válida, con https://'],
    ['enum', z.enum(['A', 'B']), 'C', 'Selecciona una opción de la lista'],
  ])('traduce %s por su código', (_caso, esquema, valor, mensaje) => {
    expect(mensajes(esquema, valor)).toEqual([mensaje])
  })

  it('alcanza a los esquemas de @proplay/shared sin pasarles nada', () => {
    expect(mensajes(perfilJugadorSchema, { disponibilidadHoras: 81 })).toEqual([
      'Debe ser 80 o menos',
    ])
    expect(mensajes(perfilEquipoSchema, { nombreOrg: 'X' })).toEqual(['Mínimo 2 caracteres'])
  })

  it('respeta los mensajes propios del contrato', () => {
    expect(mensajes(perfilJugadorSchema, { pais: 'CO' })).toEqual(['Selecciona el departamento'])
  })
})

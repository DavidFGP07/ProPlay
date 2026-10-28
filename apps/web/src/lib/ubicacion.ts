import type { Departamento } from '@proplay/shared'
import { es } from '@/i18n/es'

const nombresPais = new Intl.DisplayNames(['es'], { type: 'region' })

/** Nombre en español de un país ISO 3166-1 alfa-2. */
export function nombrePais(codigo: string): string {
  return nombresPais.of(codigo) ?? codigo
}

/** «Atlántico, Colombia» o, fuera de Colombia, sólo el país. */
export function lugar(pais: string, departamento: Departamento | null): string {
  return departamento
    ? `${es.departamento[departamento]}, ${nombrePais(pais)}`
    : nombrePais(pais)
}

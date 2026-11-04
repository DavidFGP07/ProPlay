import {
  DEPARTAMENTOS,
  PAIS_CON_DEPARTAMENTO,
  PAISES,
  type Departamento,
  type Oferta,
} from '@proplay/shared'
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

/** Ubicación de una oferta: «Atlántico, Colombia» o, si es remota, que no la tiene. */
export function lugarOferta(oferta: Pick<Oferta, 'modalidad' | 'pais' | 'departamento'>): string {
  if (oferta.modalidad === 'REMOTA' || !oferta.pais) return es.ofertas.remota
  return lugar(oferta.pais, oferta.departamento)
}

/** Países para un select: Colombia primero (el piloto); el resto, por nombre en español. */
export function opcionesPais(): { codigo: string; nombre: string }[] {
  const resto = PAISES.filter((codigo) => codigo !== PAIS_CON_DEPARTAMENTO)
    .map((codigo) => ({ codigo, nombre: nombrePais(codigo) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return [{ codigo: PAIS_CON_DEPARTAMENTO, nombre: nombrePais(PAIS_CON_DEPARTAMENTO) }, ...resto]
}

/** Departamentos ordenados por su nombre visible, no por el código. */
export const OPCIONES_DEPARTAMENTO = [...DEPARTAMENTOS].sort((a, b) =>
  es.departamento[a].localeCompare(es.departamento[b], 'es'),
)

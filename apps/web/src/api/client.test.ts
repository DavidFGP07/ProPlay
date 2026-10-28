import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { QueryClient } from '@tanstack/react-query'
import { api, guardarAccessToken, registrarCierreDeSesion } from '@/api/client'
import { reintentarConsulta } from '@/api/queryClient'

/**
 * Interceptor de `client.ts` (401 → refresco → reintento) junto con la política
 * de reintentos de TanStack Query que usa la aplicación fuera de las pruebas.
 * El servidor es un adaptador de axios en memoria.
 */
type Respuesta = { status: number; data: unknown }

/** Recibe el token con que llegó cada petición (el reintento reutiliza la configuración). */
const recurso = vi.fn<(autorizacion: string | undefined) => Respuesta>()
const refresco = vi.fn<() => Respuesta>()
const cierreDeSesion = vi.fn()

function responder(peticion: InternalAxiosRequestConfig, { status, data }: Respuesta) {
  const respuesta = { status, data, statusText: '', headers: {}, config: peticion }
  if (status >= 400) {
    throw new AxiosError(`HTTP ${status}`, String(status), peticion, null, respuesta)
  }
  return respuesta
}

/** Mismas opciones que crearQueryClient fuera de las pruebas, sin espera entre intentos. */
function clienteDeConsultas() {
  return new QueryClient({
    defaultOptions: { queries: { retry: reintentarConsulta, retryDelay: 0 } },
  })
}

function consultar() {
  return clienteDeConsultas().fetchQuery({
    queryKey: ['recurso'],
    queryFn: async () => (await api.get<{ ok: boolean }>('/recurso')).data,
  })
}

describe('cliente HTTP con la política de reintentos', () => {
  const adaptadorOriginal = api.defaults.adapter

  beforeEach(() => {
    recurso.mockReset()
    refresco.mockReset()
    cierreDeSesion.mockReset()
    guardarAccessToken('token-caducado')
    registrarCierreDeSesion(cierreDeSesion)
    api.defaults.adapter = async (peticion) =>
      responder(peticion, recurso(AxiosHeaders.from(peticion.headers).get('Authorization') as string))
    // El refresco va por el axios global, no por `api`.
    vi.spyOn(axios, 'post').mockImplementation(async () => {
      const { status, data } = refresco()
      if (status >= 400) throw new AxiosError('refresh', String(status))
      return { data }
    })
  })

  afterEach(() => {
    api.defaults.adapter = adaptadorOriginal
    guardarAccessToken(null)
    vi.restoreAllMocks()
  })

  it('ante un 401 refresca la sesión, reintenta con el token nuevo y la consulta resuelve', async () => {
    recurso
      .mockReturnValueOnce({ status: 401, data: {} })
      .mockReturnValueOnce({ status: 200, data: { ok: true } })
    refresco.mockReturnValue({ status: 200, data: { accessToken: 'token-nuevo' } })

    await expect(consultar()).resolves.toEqual({ ok: true })

    expect(refresco).toHaveBeenCalledTimes(1)
    expect(recurso).toHaveBeenCalledTimes(2)
    expect(recurso.mock.calls).toEqual([['Bearer token-caducado'], ['Bearer token-nuevo']])
    expect(cierreDeSesion).not.toHaveBeenCalled()
  })

  it('si el refresco falla cierra la sesión una sola vez y la consulta no reintenta', async () => {
    recurso.mockReturnValue({ status: 401, data: {} })
    refresco.mockReturnValue({ status: 401, data: {} })

    await expect(consultar()).rejects.toMatchObject({ response: { status: 401 } })

    expect(recurso).toHaveBeenCalledTimes(1)
    expect(refresco).toHaveBeenCalledTimes(1)
    expect(cierreDeSesion).toHaveBeenCalledTimes(1)
  })

  it('un 404 no se reintenta y un 500 se reintenta una vez', async () => {
    recurso.mockReturnValue({ status: 404, data: {} })
    await expect(consultar()).rejects.toMatchObject({ response: { status: 404 } })
    expect(recurso).toHaveBeenCalledTimes(1)

    recurso.mockReset()
    recurso
      .mockReturnValueOnce({ status: 500, data: {} })
      .mockReturnValueOnce({ status: 200, data: { ok: true } })
    await expect(consultar()).resolves.toEqual({ ok: true })
    expect(recurso).toHaveBeenCalledTimes(2)
    expect(refresco).not.toHaveBeenCalled()
  })
})

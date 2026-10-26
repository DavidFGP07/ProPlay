import { describe, expect, it } from 'vitest'
import {
  actualizarPrivacidad,
  cerrarOferta,
  crearOferta,
  endosarHabilidad,
  iniciarSesion,
  listarHabilidades,
  listarJugadores,
  listarMisPostulaciones,
  listarNotificaciones,
  listarOfertas,
  listarPostulaciones,
  marcarNotificacionLeida,
  obtenerAuditLog,
  obtenerPerfil,
  obtenerPrivacidad,
  perfilDeUsuario,
  postular,
  registrarHabilidad,
  registrarUsuario,
} from '@/mocks/api'
import { usuarios } from '@/mocks/seed'

/**
 * Pruebas de la capa de integracion: verifican el contrato que consumira el
 * backend Node.js/Express, en particular el control de acceso por rol
 * (RNF-04), la trazabilidad (RNF-06) y la privacidad (RNF-05).
 */

const jugador = usuarios.find((u) => u.rol === 'JUGADOR')!
const equipo = usuarios.find((u) => u.rol === 'EQUIPO')!
const scout = usuarios.find((u) => u.rol === 'SCOUT')!
const admin = usuarios.find((u) => u.rol === 'ADMIN')!

const ofertaVacia = {
  equipoId: 'e-01-team',
  juego: 'Valorant' as const,
  rol: 'Duelista',
  rangoMinimo: 'Oro I',
  experienciaMinima: 1,
  regionPreferida: 'Cualquiera' as const,
  horasSemanales: 10,
  descripcion: 'Prueba automatizada',
}

describe('Autenticacion (RF-01)', () => {
  it('inicia sesion con un correo registrado', async () => {
    const u = await iniciarSesion(jugador.email)
    expect(u.id).toBe(jugador.id)
  })

  it('rechaza un correo no registrado', async () => {
    await expect(iniciarSesion('nadie@proplay.co')).rejects.toThrow(
      /No existe una cuenta/,
    )
  })

  it('exige aceptar el aviso de privacidad en el registro (RNF-05)', async () => {
    await expect(
      registrarUsuario({
        nombre: 'Prueba',
        email: 'prueba@proplay.co',
        rol: 'JUGADOR',
        region: 'Cartagena',
        aceptaPrivacidad: false,
      }),
    ).rejects.toThrow(/aviso de privacidad/)
  })

  it('rechaza un correo duplicado', async () => {
    await expect(
      registrarUsuario({
        nombre: 'Duplicado',
        email: jugador.email,
        rol: 'JUGADOR',
        region: 'Cartagena',
        aceptaPrivacidad: true,
      }),
    ).rejects.toThrow(/Ya existe una cuenta/)
  })
})

describe('Directorio de talento (RF-08)', () => {
  it('resuelve el perfil asociado a una cuenta de usuario', () => {
    expect(perfilDeUsuario(jugador.id)?.id).toBe('p-01')
    expect(perfilDeUsuario(admin.id)).toBeUndefined()
  })

  it('filtra por region y por perfiles verificados', async () => {
    const porRegion = await listarJugadores({ region: 'Barranquilla' })
    expect(porRegion.length).toBeGreaterThan(0)
    expect(porRegion.every((p) => p.region === 'Barranquilla')).toBe(true)

    const verificados = await listarJugadores({ verificados: true })
    expect(verificados.length).toBeGreaterThan(0)
  })

  it('oculta del directorio los perfiles con visibilidad privada (RNF-05)', async () => {
    const perfil = perfilDeUsuario(jugador.id)!
    await actualizarPrivacidad(
      jugador.id,
      { visibilidadPerfil: 'privado' },
      jugador,
    )

    const directorio = await listarJugadores()
    expect(directorio.some((p) => p.id === perfil.id)).toBe(false)

    // El perfil sigue siendo consultable por enlace directo.
    const directo = await obtenerPerfil(perfil.id)
    expect(directo.perfil.id).toBe(perfil.id)

    await actualizarPrivacidad(
      jugador.id,
      { visibilidadPerfil: 'publico' },
      jugador,
    )
    const restaurado = await listarJugadores()
    expect(restaurado.some((p) => p.id === perfil.id)).toBe(true)
  })
})

describe('Privacidad (RNF-05)', () => {
  it('devuelve la configuracion por defecto y la persiste al actualizarla', async () => {
    const config = await obtenerPrivacidad(admin.id)
    expect(config.visibilidadPerfil).toBe('publico')

    const actualizada = await actualizarPrivacidad(
      admin.id,
      { mostrarPortafolio: false },
      admin,
    )
    expect(actualizada.mostrarPortafolio).toBe(false)
    expect((await obtenerPrivacidad(admin.id)).mostrarPortafolio).toBe(false)
  })
})

describe('Habilidades y endorsements (RF-06)', () => {
  it('no permite registrar dos veces la misma habilidad', async () => {
    const perfil = perfilDeUsuario(jugador.id)!
    await expect(registrarHabilidad(perfil.id, 'h-1', 4, jugador)).rejects.toThrow(
      /Ya registraste/,
    )
  })

  it('rechaza un nivel fuera del rango 1-5', async () => {
    const perfil = perfilDeUsuario(jugador.id)!
    await expect(registrarHabilidad(perfil.id, 'h-8', 9, jugador)).rejects.toThrow(
      /entre 1 y 5/,
    )
  })

  it('prohibe el autoendos', async () => {
    const { skills } = await obtenerPerfil('p-01')
    await expect(
      endosarHabilidad(skills[0].id, jugador, 'Autoendos'),
    ).rejects.toThrow(/No puedes endosar tus propias habilidades/)
  })

  it('valida la habilidad de un tercero y registra el endorsement', async () => {
    const { skills } = await obtenerPerfil('p-02')
    const objetivo = skills.find((s) => !s.verificada) ?? skills[0]
    const endoso = await endosarHabilidad(objetivo.id, scout, 'Jugada probada')
    expect(endoso.autorId).toBe(scout.id)

    // Unicidad por (habilidad, autor).
    await expect(
      endosarHabilidad(objetivo.id, scout, 'Repetido'),
    ).rejects.toThrow(/Ya endosaste/)
  })

  it('el catalogo de habilidades esta disponible', async () => {
    const catalogo = await listarHabilidades()
    expect(catalogo.length).toBeGreaterThan(0)
    expect(catalogo.every((h) => h.categoria === 'TECNICA' || h.categoria === 'BLANDA')).toBe(
      true,
    )
  })
})

describe('Control de acceso por rol (RNF-04)', () => {
  it('solo la organizacion publica ofertas', async () => {
    await expect(crearOferta(ofertaVacia, jugador)).rejects.toThrow(
      /Solo las organizaciones/,
    )
  })

  it('la organizacion publica una oferta correctamente', async () => {
    const oferta = await crearOferta(ofertaVacia, equipo)
    expect(oferta.estado).toBe('ABIERTA')
    expect((await listarOfertas()).some((o) => o.id === oferta.id)).toBe(true)
  })

  it('el scout no puede cerrar la vacante de otra organizacion', async () => {
    const oferta = (await listarOfertas()).find((o) => o.equipoId === 'e-01-team')!
    await expect(cerrarOferta(oferta.id, scout)).rejects.toThrow(
      /No puedes cerrar una vacante de otra organizacion/,
    )
  })
})

describe('Postulaciones (RF-10)', () => {
  it('devuelve las postulaciones de un jugador con su oferta', async () => {
    const perfil = perfilDeUsuario(jugador.id)!
    const mias = await listarMisPostulaciones(perfil.id)
    expect(mias.length).toBeGreaterThan(0)
    expect(mias.every((x) => x.oferta.id === x.postulacion.ofertaId)).toBe(true)
  })

  it('no duplica postulaciones para la misma vacante', async () => {
    const perfil = perfilDeUsuario(jugador.id)!
    const [existente] = await listarMisPostulaciones(perfil.id)
    await expect(
      postular(existente.oferta.id, 'Repetida', jugador),
    ).rejects.toThrow(/Ya existe una postulacion/)
  })

  it('impide que un equipo se postule a una vacante', async () => {
    const oferta = (await listarOfertas('ABIERTA'))[0]
    await expect(postular(oferta.id, 'Prueba', equipo)).rejects.toThrow(
      /Solo los perfiles de jugador/,
    )
  })

  it('el conjunto global de postulaciones incluye las del jugador', async () => {
    const todas = await listarPostulaciones()
    const mias = await listarMisPostulaciones('p-01')
    expect(todas.length).toBeGreaterThanOrEqual(mias.length)
  })
})

describe('Notificaciones (RF-12)', () => {
  it('lista los eventos dirigidos al usuario', async () => {
    const avisos = await listarNotificaciones(jugador.id)
    expect(avisos.length).toBeGreaterThan(0)
    expect(avisos.every((n) => n.usuarioId === jugador.id)).toBe(true)
  })

  it('marca una notificacion como leida', async () => {
    const [primera] = await listarNotificaciones(jugador.id)
    await marcarNotificacionLeida(primera.id)
    const despues = await listarNotificaciones(jugador.id)
    expect(despues.find((n) => n.id === primera.id)?.leida).toBe(true)
  })
})

describe('Trazabilidad (RNF-06)', () => {
  it('registra las operaciones sensibles con usuario, accion y fecha', async () => {
    const antes = obtenerAuditLog().length
    await crearOferta({ ...ofertaVacia, rol: 'Controlador' }, equipo)
    const log = obtenerAuditLog()
    expect(log.length).toBeGreaterThan(antes)
    expect(log[0].usuarioId).toBe(equipo.id)
    expect(log[0].accion).toBe('crear_oferta')
    expect(log[0].fecha).toBeTruthy()
  })
})

/**
 * Textos visibles de la interfaz (CLAUDE.md §6). Las vistas heredadas del
 * prototipo aun llevan sus textos en el JSX; todo texto nuevo entra aqui.
 */
export const es = {
  demo: {
    titulo: 'Datos de demostracion',
    detalle: (persona: string) =>
      `Lo que ves en esta seccion son datos de ejemplo de ${persona}, no de tu cuenta. Solo tu sesion es real.`,
  },
} as const

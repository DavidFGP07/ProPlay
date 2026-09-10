import { Badge, Card } from "../../components/ui";

/** Maqueta de la bandeja de mensajes con datos de ejemplo. */
export function BandejaMensajes() {
  // TODO: conectar con GET /api/v1/mensajeria/conversaciones
  const conversaciones = [
    { con: "Caribe eSports", ultimo: "Nos gustó tu perfil, ¿tienes disponibilidad para una prueba?", hace: "hace 2 h", sinLeer: 2 },
    { con: "Marcela Guzmán (scout)", ultimo: "Te comparto el calendario de tryouts de la próxima semana.", hace: "ayer", sinLeer: 0 },
    { con: "Andes Gaming", ultimo: "Gracias por postularte, estamos revisando.", hace: "hace 3 d", sinLeer: 0 },
  ];

  return (
    <Card
      titulo="Conversaciones"
      descripcion="Maqueta: el módulo mensajería todavía responde 501"
    >
      <ul className="divide-y divide-fondo-borde">
        {conversaciones.map((conversacion) => (
          <li key={conversacion.con} className="flex items-start gap-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primario-600/30 text-sm font-semibold text-primario-100">
              {conversacion.con.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-slate-100">
                  {conversacion.con}
                </p>
                <span className="shrink-0 text-xs text-slate-500">
                  {conversacion.hace}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-slate-400">
                {conversacion.ultimo}
              </p>
            </div>
            {conversacion.sinLeer > 0 && (
              <Badge tono="primario">{conversacion.sinLeer}</Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

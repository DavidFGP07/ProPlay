import { Badge, Card } from "../../components/ui";
import { porcentaje } from "../../lib/formato";

/** Maqueta del buscador de jugadores con datos de ejemplo. */
export function TablaJugadores() {
  // TODO: conectar con GET /api/v1/scouting/jugadores
  const jugadores = [
    { nombre: "Andrés Molina", juego: "League of Legends", rol: "MID", region: "LAN", kda: 3.4, winRate: 0.58, compatibilidad: 0.82 },
    { nombre: "Valentina Ríos", juego: "VALORANT", rol: "DUELISTA", region: "LAS", kda: 1.9, winRate: 0.61, compatibilidad: 0.77 },
    { nombre: "Camilo Ospina", juego: "Counter-Strike 2", rol: "AWPER", region: "LAN", kda: 1.4, winRate: 0.53, compatibilidad: 0.71 },
    { nombre: "Laura Beltrán", juego: "Dota 2", rol: "SOPORTE", region: "NA", kda: 2.6, winRate: 0.49, compatibilidad: 0.64 },
  ];

  return (
    <Card
      titulo="Jugadores sugeridos"
      descripcion="Maqueta: el módulo scouting todavía responde 501"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="pb-3">Jugador</th>
              <th className="pb-3">Juego</th>
              <th className="pb-3">Rol</th>
              <th className="pb-3">Región</th>
              <th className="pb-3">KDA</th>
              <th className="pb-3">Win rate</th>
              <th className="pb-3">Compatibilidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fondo-borde">
            {jugadores.map((jugador) => (
              <tr key={jugador.nombre}>
                <td className="py-3 font-medium text-slate-100">{jugador.nombre}</td>
                <td className="py-3 text-slate-300">{jugador.juego}</td>
                <td className="py-3 text-slate-300">{jugador.rol}</td>
                <td className="py-3 text-slate-300">{jugador.region}</td>
                <td className="py-3 text-slate-300">{jugador.kda.toFixed(2)}</td>
                <td className="py-3 text-slate-300">{porcentaje(jugador.winRate)}</td>
                <td className="py-3">
                  <Badge tono={jugador.compatibilidad >= 0.75 ? "exito" : "primario"}>
                    {porcentaje(jugador.compatibilidad)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

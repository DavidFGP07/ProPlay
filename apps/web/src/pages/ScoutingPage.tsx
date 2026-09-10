import { TablaJugadores } from "../features/scouting/TablaJugadores";

export function ScoutingPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Scouting</h1>
        <p className="mt-1 text-sm text-slate-400">
          Búsqueda de talento por juego, rol, región y rendimiento.
        </p>
      </header>
      <TablaJugadores />
    </div>
  );
}

import { ListaOfertas } from "../features/ofertas/ListaOfertas";

export function OfertasPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Ofertas</h1>
        <p className="mt-1 text-sm text-slate-400">
          Vacantes publicadas por los equipos. Maqueta con datos de ejemplo.
        </p>
      </header>
      <ListaOfertas />
    </div>
  );
}

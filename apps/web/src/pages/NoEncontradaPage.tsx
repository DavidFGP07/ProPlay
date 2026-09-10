import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export function NoEncontradaPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-bold text-primario-300">404</p>
      <h1 className="text-xl font-semibold text-white">
        Esta página no existe
      </h1>
      <p className="max-w-sm text-sm text-slate-400">
        Puede que el enlace esté mal escrito o que la sección todavía no forme
        parte de este esqueleto.
      </p>
      <Link to="/app">
        <Button>Volver al inicio</Button>
      </Link>
    </div>
  );
}

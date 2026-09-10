import { Link } from "react-router-dom";
import { FormularioRegistro } from "../features/auth/FormularioRegistro";

export function RegistroPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Crea tu cuenta</h1>
        <p className="mt-1 text-sm text-slate-400">
          Jugadores, equipos y scouts en un mismo lugar.
        </p>
      </header>

      <FormularioRegistro />

      <p className="text-sm text-slate-400">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="font-medium text-primario-200 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}

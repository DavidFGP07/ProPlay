import { Link } from "react-router-dom";
import { FormularioLogin } from "../features/auth/FormularioLogin";

export function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Inicia sesión</h1>
        <p className="mt-1 text-sm text-slate-400">
          Entra para ver tus ofertas, tu perfil y tus mensajes.
        </p>
      </header>

      <FormularioLogin />

      <p className="text-sm text-slate-400">
        ¿Todavía no tienes cuenta?{" "}
        <Link to="/registro" className="font-medium text-primario-200 hover:underline">
          Crea una gratis
        </Link>
      </p>
    </div>
  );
}

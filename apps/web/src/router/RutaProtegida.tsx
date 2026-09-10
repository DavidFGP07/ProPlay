import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Rol } from "@proplay/shared";
import { Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";

/**
 * Puerta de las rutas privadas: espera a que se resuelva la sesión, redirige a
 * /login si no hay usuario y bloquea por rol cuando se indican roles.
 */
export function RutaProtegida({ roles }: { roles?: Rol[] }) {
  const { usuario, cargando } = useAuth();
  const ubicacion = useLocation();

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-primario-200">
        <Spinner tamano="lg" />
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  }

  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}

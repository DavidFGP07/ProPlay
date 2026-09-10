import { NavLink, Outlet, useNavigate } from "react-router-dom";
import type { Rol } from "@proplay/shared";
import { Badge, Button } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/cn";
import { etiquetaRol } from "../lib/formato";

interface EnlaceNav {
  a: string;
  texto: string;
  roles: Rol[];
}

/** Navegación por rol: cada perfil ve sólo lo que le corresponde. */
const ENLACES: EnlaceNav[] = [
  { a: "/app", texto: "Inicio", roles: ["JUGADOR", "EQUIPO", "SCOUT", "ADMIN"] },
  { a: "/app/perfil", texto: "Mi perfil", roles: ["JUGADOR", "EQUIPO", "SCOUT", "ADMIN"] },
  { a: "/app/ofertas", texto: "Ofertas", roles: ["JUGADOR", "EQUIPO", "ADMIN"] },
  { a: "/app/scouting", texto: "Scouting", roles: ["EQUIPO", "SCOUT", "ADMIN"] },
  { a: "/app/mensajeria", texto: "Mensajes", roles: ["JUGADOR", "EQUIPO", "SCOUT", "ADMIN"] },
];

export function AppLayout() {
  const { usuario, logout } = useAuth();
  const navegar = useNavigate();

  const enlaces = ENLACES.filter(
    (enlace) => usuario && enlace.roles.includes(usuario.rol),
  );

  const cerrarSesion = async () => {
    await logout();
    navegar("/login", { replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-fondo-borde bg-fondo-elevado/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <NavLink to="/app" className="text-lg font-bold text-white">
            ProPlay
          </NavLink>

          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {enlaces.map((enlace) => (
              <NavLink
                key={enlace.a}
                to={enlace.a}
                end={enlace.a === "/app"}
                className={({ isActive }) =>
                  cn("enlace-nav", isActive && "enlace-nav-activo")
                }
              >
                {enlace.texto}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {usuario && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-white">{usuario.nombre}</p>
                <Badge tono="primario">{etiquetaRol(usuario.rol)}</Badge>
              </div>
            )}
            <Button variante="fantasma" tamano="sm" onClick={cerrarSesion}>
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

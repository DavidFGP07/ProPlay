import { Link, Outlet } from "react-router-dom";

/** Marco de las páginas públicas de autenticación. */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-primario-700 via-primario to-secundario-700 p-10 lg:flex">
        <Link to="/" className="text-2xl font-bold text-white">
          ProPlay
        </Link>
        <div className="max-w-md">
          <h1 className="text-3xl font-bold leading-tight text-white">
            La red profesional del talento en eSports
          </h1>
          <p className="mt-4 text-white/80">
            Perfiles verificables, estadísticas de tus partidas y ofertas de
            equipos que buscan exactamente tu rol.
          </p>
        </div>
        <p className="text-sm text-white/60">
          Proyecto de grado · Universidad del Norte
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-8 block text-xl font-bold text-white lg:hidden"
          >
            ProPlay
          </Link>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

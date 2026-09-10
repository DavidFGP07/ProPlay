import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { AuthLayout } from "../layouts/AuthLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { MensajeriaPage } from "../pages/MensajeriaPage";
import { NoEncontradaPage } from "../pages/NoEncontradaPage";
import { OfertasPage } from "../pages/OfertasPage";
import { PerfilPage } from "../pages/PerfilPage";
import { RegistroPage } from "../pages/RegistroPage";
import { ScoutingPage } from "../pages/ScoutingPage";
import { RutaProtegida } from "./RutaProtegida";

/** Mapa de rutas de la aplicación. */
export function AppRouter() {
  return (
    <Routes>
      {/* Públicas */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />
      </Route>

      {/* Privadas: requieren sesión */}
      <Route element={<RutaProtegida />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="ofertas" element={<OfertasPage />} />
          <Route path="mensajeria" element={<MensajeriaPage />} />

          {/* Scouting: sólo equipos, scouts y administración */}
          <Route element={<RutaProtegida roles={["EQUIPO", "SCOUT", "ADMIN"]} />}>
            <Route path="scouting" element={<ScoutingPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<NoEncontradaPage />} />
    </Routes>
  );
}

import { Badge, Card } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { etiquetaRol, fechaCorta } from "../../lib/formato";

/** Maqueta del perfil. Los datos de habilidades son de ejemplo. */
export function ResumenPerfil() {
  const { usuario } = useAuth();

  // TODO: conectar con GET /api/v1/perfiles/me
  const habilidadesEjemplo = [
    { nombre: "Map awareness", categoria: "TECNICA", nivel: 4, verificada: true },
    { nombre: "Wave management", categoria: "TECNICA", nivel: 3, verificada: false },
    { nombre: "Comunicación", categoria: "BLANDA", nivel: 5, verificada: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card titulo="Datos de la cuenta" descripcion="Vienen de GET /api/v1/auth/me">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Nombre</dt>
            <dd className="text-sm text-slate-100">{usuario?.nombre}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Correo</dt>
            <dd className="text-sm text-slate-100">{usuario?.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Rol</dt>
            <dd className="text-sm text-slate-100">
              {usuario ? etiquetaRol(usuario.rol) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Miembro desde
            </dt>
            <dd className="text-sm text-slate-100">
              {usuario ? fechaCorta(usuario.creadoEn) : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card
        titulo="Habilidades"
        descripcion="Maqueta: el módulo perfiles todavía responde 501"
      >
        <ul className="flex flex-col gap-3">
          {habilidadesEjemplo.map((habilidad) => (
            <li
              key={habilidad.nombre}
              className="flex items-center justify-between rounded-xl border border-fondo-borde px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {habilidad.nombre}
                </p>
                <p className="text-xs text-slate-500">
                  {habilidad.categoria === "TECNICA" ? "Técnica" : "Blanda"} · nivel{" "}
                  {habilidad.nivel} de 5
                </p>
              </div>
              {habilidad.verificada ? (
                <Badge tono="exito">Verificada</Badge>
              ) : (
                <Badge tono="neutro">Sin verificar</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

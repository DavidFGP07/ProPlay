import { Badge, Card } from "../../components/ui";
import { useSalud } from "../../api/health";
import { useAuth } from "../../context/AuthContext";
import { etiquetaRol } from "../../lib/formato";

/**
 * Panel de inicio. El estado de la API es real (GET /api/v1/health); las
 * tarjetas de actividad son maqueta con datos de ejemplo.
 */
export function ResumenDashboard() {
  const { usuario } = useAuth();
  const { data: salud, isPending, isError } = useSalud();

  // TODO: conectar con GET /api/v1/matching/jugador/me y
  // GET /api/v1/notificaciones/contador cuando esos módulos estén implementados.
  const tarjetas = [
    { titulo: "Ofertas compatibles", valor: "—", nota: "Pendiente del módulo matching" },
    { titulo: "Postulaciones activas", valor: "—", nota: "Pendiente del módulo ofertas" },
    { titulo: "Mensajes sin leer", valor: "—", nota: "Pendiente del módulo mensajería" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-white">
          Hola, {usuario?.nombre.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Entraste como {usuario ? etiquetaRol(usuario.rol) : "invitado"}. Este es
          el esqueleto de ProPlay: la autenticación ya funciona de punta a punta.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {tarjetas.map((tarjeta) => (
          <Card key={tarjeta.titulo} titulo={tarjeta.titulo}>
            <p className="text-3xl font-bold text-white">{tarjeta.valor}</p>
            <p className="mt-2 text-xs text-slate-500">{tarjeta.nota}</p>
          </Card>
        ))}
      </div>

      <Card
        titulo="Estado de la plataforma"
        descripcion="Respuesta real de GET /api/v1/health"
        acciones={
          isError ? (
            <Badge tono="alerta">Sin conexión</Badge>
          ) : (
            <Badge tono={salud?.status === "ok" ? "exito" : "alerta"}>
              {isPending ? "Consultando" : (salud?.status ?? "desconocido")}
            </Badge>
          )
        }
      >
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">API</dt>
            <dd className="text-sm text-slate-200">
              {isError ? "no responde" : `versión ${salud?.version ?? "—"}`}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              PostgreSQL
            </dt>
            <dd className="text-sm text-slate-200">
              {salud?.servicios.postgres ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Redis</dt>
            <dd className="text-sm text-slate-200">
              {salud?.servicios.redis ?? "—"}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

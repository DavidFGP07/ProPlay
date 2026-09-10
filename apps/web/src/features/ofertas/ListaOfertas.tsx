import { Badge, Button, Card } from "../../components/ui";

/** Maqueta del listado de ofertas con datos de ejemplo. */
export function ListaOfertas() {
  // TODO: conectar con GET /api/v1/ofertas
  const ofertas = [
    {
      titulo: "Buscamos MID para academia de League of Legends",
      equipo: "Caribe eSports",
      juego: "League of Legends",
      rol: "MID",
      region: "LAN",
      rango: "Diamante II",
      horas: 25,
    },
    {
      titulo: "Duelista para roster principal de VALORANT",
      equipo: "Andes Gaming",
      juego: "VALORANT",
      rol: "DUELISTA",
      region: "LAS",
      rango: "Inmortal I",
      horas: 30,
    },
    {
      titulo: "IGL para división universitaria",
      equipo: "Uninorte Legends",
      juego: "Counter-Strike 2",
      rol: "IGL",
      region: "LAN",
      rango: "Faceit 6",
      horas: 15,
    },
  ];

  return (
    <div className="grid gap-4">
      {ofertas.map((oferta) => (
        <Card
          key={oferta.titulo}
          titulo={oferta.titulo}
          descripcion={`${oferta.equipo} · ${oferta.juego}`}
          acciones={<Badge tono="exito">Abierta</Badge>}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <Badge tono="primario">{oferta.rol}</Badge>
            <Badge tono="secundario">{oferta.region}</Badge>
            <span>Rango mínimo: {oferta.rango}</span>
            <span>· {oferta.horas} h/semana</span>
          </div>
          <div className="mt-4 flex gap-2">
            {/* TODO: conectar con POST /api/v1/ofertas/:id/postulaciones */}
            <Button tamano="sm" disabled>
              Postularme
            </Button>
            <Button tamano="sm" variante="fantasma" disabled>
              Ver detalle
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

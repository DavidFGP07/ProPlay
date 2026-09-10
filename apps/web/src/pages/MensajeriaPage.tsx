import { BandejaMensajes } from "../features/mensajeria/BandejaMensajes";

export function MensajeriaPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-white">Mensajes</h1>
      <BandejaMensajes />
    </div>
  );
}

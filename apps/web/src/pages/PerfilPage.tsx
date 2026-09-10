import { ResumenPerfil } from "../features/perfil/ResumenPerfil";

export function PerfilPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-white">Mi perfil</h1>
      <ResumenPerfil />
    </div>
  );
}

import { useEffect, type ReactNode } from "react";
import { Button } from "./Button";

export interface ModalProps {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
}

export function Modal({ abierto, titulo, onCerrar, children, pie }: ModalProps) {
  useEffect(() => {
    if (!abierto) return;

    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-fondo-borde bg-fondo-elevado p-6"
        onClick={(evento) => evento.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{titulo}</h2>
          <Button variante="fantasma" tamano="sm" onClick={onCerrar}>
            Cerrar
          </Button>
        </header>
        <div className="text-sm text-slate-300">{children}</div>
        {pie && <footer className="mt-6 flex justify-end gap-2">{pie}</footer>}
      </div>
    </div>
  );
}

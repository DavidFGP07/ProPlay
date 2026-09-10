import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tono = "primario" | "secundario" | "exito" | "alerta" | "neutro";

const TONOS: Record<Tono, string> = {
  primario: "bg-primario-600/20 text-primario-200 border-primario-500/40",
  secundario: "bg-secundario-600/20 text-secundario-100 border-secundario-500/40",
  exito: "bg-emerald-600/20 text-emerald-200 border-emerald-500/40",
  alerta: "bg-amber-600/20 text-amber-200 border-amber-500/40",
  neutro: "bg-slate-600/20 text-slate-300 border-slate-500/40",
};

export function Badge({
  children,
  tono = "neutro",
  className,
}: {
  children: ReactNode;
  tono?: Tono;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONOS[tono],
        className,
      )}
    >
      {children}
    </span>
  );
}

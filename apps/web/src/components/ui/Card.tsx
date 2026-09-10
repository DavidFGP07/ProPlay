import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface CardProps {
  titulo?: ReactNode;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Card({
  titulo,
  descripcion,
  acciones,
  children,
  className,
}: CardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-fondo-borde bg-fondo-elevado p-5",
        className,
      )}
    >
      {(titulo || acciones) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {titulo && (
              <h2 className="text-base font-semibold text-white">{titulo}</h2>
            )}
            {descripcion && (
              <p className="mt-1 text-sm text-slate-400">{descripcion}</p>
            )}
          </div>
          {acciones}
        </header>
      )}
      {children}
    </section>
  );
}

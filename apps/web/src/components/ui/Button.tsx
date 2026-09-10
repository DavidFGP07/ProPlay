import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";

type Variante = "primario" | "secundario" | "fantasma" | "peligro";
type Tamano = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
  anchoCompleto?: boolean;
}

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-primario text-white hover:bg-primario-400 shadow-marca disabled:hover:bg-primario",
  secundario:
    "bg-secundario text-white hover:bg-secundario-400 disabled:hover:bg-secundario",
  fantasma:
    "bg-transparent text-slate-200 border border-fondo-borde hover:bg-fondo-elevado",
  peligro: "bg-red-600 text-white hover:bg-red-500",
};

const TAMANOS: Record<Tamano, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variante = "primario",
      tamano = "md",
      cargando = false,
      anchoCompleto = false,
      className,
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled ?? cargando}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition",
          "disabled:cursor-not-allowed disabled:opacity-60",
          VARIANTES[variante],
          TAMANOS[tamano],
          anchoCompleto && "w-full",
          className,
        )}
        {...props}
      >
        {cargando && <Spinner tamano="sm" />}
        {children}
      </button>
    );
  },
);

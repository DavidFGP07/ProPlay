import { forwardRef, type SelectHTMLAttributes, useId } from "react";
import { cn } from "../../lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ etiqueta, error, className, id, children, ...props }, ref) {
    const idGenerado = useId();
    const idSelect = id ?? idGenerado;

    return (
      <div className="flex flex-col gap-1.5">
        {etiqueta && (
          <label htmlFor={idSelect} className="text-sm font-medium text-slate-200">
            {etiqueta}
          </label>
        )}
        <select
          ref={ref}
          id={idSelect}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-10 rounded-xl border bg-fondo-elevado px-3 text-sm text-slate-100",
            error ? "border-red-500" : "border-fondo-borde",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  },
);

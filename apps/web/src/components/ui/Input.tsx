import { forwardRef, type InputHTMLAttributes, useId } from "react";
import { cn } from "../../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta?: string;
  error?: string;
  ayuda?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { etiqueta, error, ayuda, className, id, ...props },
  ref,
) {
  const idGenerado = useId();
  const idInput = id ?? idGenerado;

  return (
    <div className="flex flex-col gap-1.5">
      {etiqueta && (
        <label htmlFor={idInput} className="text-sm font-medium text-slate-200">
          {etiqueta}
        </label>
      )}
      <input
        ref={ref}
        id={idInput}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${idInput}-error` : undefined}
        className={cn(
          "h-10 rounded-xl border bg-fondo-elevado px-3 text-sm text-slate-100",
          "placeholder:text-slate-500 focus:border-primario-300",
          error ? "border-red-500" : "border-fondo-borde",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${idInput}-error`} className="text-xs text-red-400">
          {error}
        </p>
      ) : (
        ayuda && <p className="text-xs text-slate-500">{ayuda}</p>
      )}
    </div>
  );
});

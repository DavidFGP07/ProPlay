import { cn } from "../../lib/cn";

const TAMANOS = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
} as const;

export function Spinner({
  tamano = "md",
  className,
}: {
  tamano?: keyof typeof TAMANOS;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        "inline-block animate-spin rounded-full border-current border-r-transparent",
        TAMANOS[tamano],
        className,
      )}
    />
  );
}

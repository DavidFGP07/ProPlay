import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useLocation } from "react-router-dom";
// El MISMO esquema con el que el backend valida POST /api/v1/auth/login.
import { loginSchema, type LoginInput } from "@proplay/shared";
import { Button, Input } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { mensajeDeError } from "../../api/client";

export function FormularioLogin() {
  const { login } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const alEnviar = handleSubmit(async (datos) => {
    setErrorGeneral(null);
    try {
      await login(datos);
      const destino =
        (ubicacion.state as { desde?: string } | null)?.desde ?? "/app";
      navegar(destino, { replace: true });
    } catch (error) {
      setErrorGeneral(mensajeDeError(error, "No pudimos iniciar tu sesión"));
    }
  });

  return (
    <form onSubmit={alEnviar} className="flex flex-col gap-4" noValidate>
      <Input
        etiqueta="Correo electrónico"
        type="email"
        autoComplete="email"
        placeholder="tu@correo.com"
        error={errors.email?.message}
        {...register("email")}
      />

      <Input
        etiqueta="Contraseña"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register("password")}
      />

      {errorGeneral && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {errorGeneral}
        </p>
      )}

      <Button type="submit" cargando={isSubmitting} anchoCompleto tamano="lg">
        Entrar
      </Button>
    </form>
  );
}

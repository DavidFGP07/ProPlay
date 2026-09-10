import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
// El MISMO esquema y los MISMOS enums que usa el backend en POST /auth/register.
import {
  registerSchema,
  ROLES_REGISTRABLES,
  type RegisterInput,
} from "@proplay/shared";
import { Button, Input, Select } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { mensajeDeError } from "../../api/client";
import { etiquetaRol } from "../../lib/formato";

export function FormularioRegistro() {
  const { registrar } = useAuth();
  const navegar = useNavigate();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", nombre: "", rol: "JUGADOR" },
  });

  const alEnviar = handleSubmit(async (datos) => {
    setErrorGeneral(null);
    try {
      await registrar(datos);
      navegar("/app", { replace: true });
    } catch (error) {
      setErrorGeneral(mensajeDeError(error, "No pudimos crear tu cuenta"));
    }
  });

  return (
    <form onSubmit={alEnviar} className="flex flex-col gap-4" noValidate>
      <Input
        etiqueta="Nombre"
        autoComplete="name"
        placeholder="Nombre y apellido, u organización"
        error={errors.nombre?.message}
        {...register("nombre")}
      />

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
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres, con letras y números"
        error={errors.password?.message}
        {...register("password")}
      />

      <Select etiqueta="Tipo de cuenta" error={errors.rol?.message} {...register("rol")}>
        {ROLES_REGISTRABLES.map((rol) => (
          <option key={rol} value={rol}>
            {etiquetaRol(rol)}
          </option>
        ))}
      </Select>

      {errorGeneral && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {errorGeneral}
        </p>
      )}

      <Button type="submit" cargando={isSubmitting} anchoCompleto tamano="lg">
        Crear cuenta
      </Button>
    </form>
  );
}

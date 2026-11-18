import { describe, expect, it } from "vitest";
import {
  ESTADOS_EXPLICACION_GENERADA,
  LONGITUD_MAXIMA_EXPLICACION_GENERADA,
  MOTIVOS_EXPLICACION_NO_DISPONIBLE,
  candidatoOfertaParamsSchema,
  explicacionGeneradaParamsSchema,
  explicacionGeneradaSchema,
  type ExplicacionGenerada,
} from "@proplay/shared";

/**
 * RF-11 · Contrato del explicador con modelo de lenguaje (tareas 4.1 y 4.3).
 * Lo consumen el módulo `explicador` (api) y el detalle del candidato (web).
 */

const generada: ExplicacionGenerada = {
  estado: "GENERADA",
  texto: "Lo que más suma es la técnica: juega de ADC en el 80 % de sus partidas.",
  motivo: null,
  modelo: "claude-haiku-5-5",
  versionPrompt: 1,
  deCache: false,
};

const noDisponible: ExplicacionGenerada = {
  estado: "NO_DISPONIBLE",
  texto: null,
  motivo: "TIEMPO_AGOTADO",
  modelo: "claude-haiku-5-5",
  versionPrompt: 1,
  deCache: false,
};

describe("explicacionGeneradaSchema", () => {
  it("acepta una explicación generada, también servida desde la caché", () => {
    expect(explicacionGeneradaSchema.parse(generada)).toEqual(generada);
    expect(explicacionGeneradaSchema.parse({ ...generada, deCache: true }).deCache).toBe(true);
  });

  it("acepta cada motivo de degradación, sin texto", () => {
    for (const motivo of MOTIVOS_EXPLICACION_NO_DISPONIBLE) {
      expect(explicacionGeneradaSchema.parse({ ...noDisponible, motivo }).motivo).toBe(motivo);
    }
    expect(MOTIVOS_EXPLICACION_NO_DISPONIBLE).toEqual([
      "DESACTIVADO",
      "ERROR",
      "TIEMPO_AGOTADO",
      "FIDELIDAD",
      "LIMITE",
    ]);
  });

  it("con el explicador desactivado no hay modelo", () => {
    const desactivado = { ...noDisponible, motivo: "DESACTIVADO", modelo: null };
    expect(explicacionGeneradaSchema.parse(desactivado).modelo).toBeNull();
  });

  it("los dos estados son excluyentes: texto sólo si se generó, motivo sólo si no", () => {
    expect(ESTADOS_EXPLICACION_GENERADA).toEqual(["GENERADA", "NO_DISPONIBLE"]);
    expect(explicacionGeneradaSchema.safeParse({ ...generada, motivo: "ERROR" }).success).toBe(false);
    expect(explicacionGeneradaSchema.safeParse({ ...generada, texto: null }).success).toBe(false);
    expect(explicacionGeneradaSchema.safeParse({ ...noDisponible, texto: "algo" }).success).toBe(false);
    expect(explicacionGeneradaSchema.safeParse({ ...noDisponible, motivo: null }).success).toBe(false);
  });

  it("una degradación nunca viene de la caché", () => {
    expect(explicacionGeneradaSchema.safeParse({ ...noDisponible, deCache: true }).success).toBe(false);
  });

  it("rechaza un motivo desconocido, un texto vacío o demasiado largo y una versión no positiva", () => {
    expect(explicacionGeneradaSchema.safeParse({ ...noDisponible, motivo: "CAIDO" }).success).toBe(false);
    expect(explicacionGeneradaSchema.safeParse({ ...generada, texto: "   " }).success).toBe(false);
    expect(
      explicacionGeneradaSchema.safeParse({
        ...generada,
        texto: "a".repeat(LONGITUD_MAXIMA_EXPLICACION_GENERADA + 1),
      }).success,
    ).toBe(false);
    expect(explicacionGeneradaSchema.safeParse({ ...generada, versionPrompt: 0 }).success).toBe(false);
  });
});

describe("explicacionGeneradaParamsSchema", () => {
  it("son los mismos parámetros que el detalle del candidato", () => {
    expect(explicacionGeneradaParamsSchema).toBe(candidatoOfertaParamsSchema);
  });
});

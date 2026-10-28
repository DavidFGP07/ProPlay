import {
  crearPublicacionSchema,
  perfilEquipoSchema,
  perfilJugadorSchema,
  urlHttpSchema,
} from "@proplay/shared";
import { describe, expect, it } from "vitest";

/**
 * Contrato de las URL: todo campo de URL admite sólo `http:` y `https:`. Un
 * `javascript:` o un `data:` guardado y pintado en un `href` ejecuta código.
 */
describe("urlHttpSchema", () => {
  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["javascript: con mayúsculas y espacios", " JavaScript:alert(1)"],
    ["javascript: con tabulador intercalado", "java\tscript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["ftp:", "ftp://archivos.proplay.gg"],
    ["mailto:", "mailto:equipo@proplay.gg"],
    ["sin esquema", "lobos.gg"],
    ["mal formada", "https://"],
    ["con espacios dentro del dominio", "https://lobos del caribe.gg"],
    ["vacía", ""],
  ])("rechaza %s", (_caso, valor) => {
    const resultado = urlHttpSchema.safeParse(valor);
    expect(resultado.success).toBe(false);
    // Sin mensaje propio: el cliente lo traduce por código.
    expect(resultado.error?.issues[0]).toMatchObject({
      code: "invalid_string",
      validation: "url",
    });
  });

  it.each([
    ["https", "https://lobos.gg"],
    ["http", "http://lobos.gg/equipo"],
    ["esquema en mayúsculas", "HTTPS://lobos.gg"],
  ])("acepta %s", (_caso, valor) => {
    expect(urlHttpSchema.safeParse(valor).success).toBe(true);
  });

  it("recorta los espacios de los extremos", () => {
    expect(urlHttpSchema.parse("  https://lobos.gg  ")).toBe("https://lobos.gg");
  });
});

describe("campos de URL del contrato", () => {
  it.each([
    ["sitioWeb del equipo", perfilEquipoSchema, { sitioWeb: "javascript:alert(1)" }],
    ["logoUrl del equipo", perfilEquipoSchema, { logoUrl: "data:image/png;base64,AAAA" }],
    ["avatarUrl del jugador", perfilJugadorSchema, { avatarUrl: "javascript:alert(1)" }],
    ["mediaUrls de una publicación", crearPublicacionSchema, { texto: "Hola", mediaUrls: ["ftp://x.gg"] }],
  ])("%s sólo admite http y https", (_caso, esquema, valor) => {
    expect(esquema.safeParse(valor).success).toBe(false);
  });
});

describe("PATCH: ausente no cambia, null borra", () => {
  it("el equipo admite cualquier subconjunto de campos, incluido ninguno", () => {
    expect(perfilEquipoSchema.parse({})).toEqual({});
    expect(perfilEquipoSchema.parse({ descripcion: "Club del Caribe" })).toEqual({
      descripcion: "Club del Caribe",
    });
  });

  it("null borra la descripción, el sitio web y el logo del equipo", () => {
    expect(
      perfilEquipoSchema.parse({ descripcion: null, sitioWeb: null, logoUrl: null }),
    ).toEqual({ descripcion: null, sitioWeb: null, logoUrl: null });
  });

  it("el nombre de la organización se puede omitir pero no borrar", () => {
    expect(perfilEquipoSchema.safeParse({ nombreOrg: null }).success).toBe(false);
    expect(perfilEquipoSchema.safeParse({ nombreOrg: " X " }).success).toBe(false);
    expect(perfilEquipoSchema.parse({ nombreOrg: "  Lobos  " })).toEqual({ nombreOrg: "Lobos" });
  });

  it("null borra el avatar del jugador", () => {
    expect(perfilJugadorSchema.parse({ avatarUrl: null })).toEqual({ avatarUrl: null });
  });
});

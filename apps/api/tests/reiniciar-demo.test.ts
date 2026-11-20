import { describe, expect, it } from "vitest";
import { motivoParaNoReiniciar } from "../scripts/reiniciar-demo";

/**
 * `npm run demo:reiniciar` borra la base entera: sólo se permite contra una
 * base local de desarrollo.
 */
describe("guarda de demo:reiniciar", () => {
  it("permite la base local de desarrollo", () => {
    expect(motivoParaNoReiniciar("postgresql://u:p@localhost:5432/proplay", "development")).toBeNull();
    expect(motivoParaNoReiniciar("postgresql://u:p@127.0.0.1:5432/proplay", undefined)).toBeNull();
  });

  it("se niega en producción, sin URL o con una URL inválida", () => {
    expect(motivoParaNoReiniciar("postgresql://u:p@localhost:5432/proplay", "production")).toMatch(
      /producción/,
    );
    expect(motivoParaNoReiniciar(undefined, "development")).toMatch(/DATABASE_URL/);
    expect(motivoParaNoReiniciar("no es una url", "development")).toMatch(/no es una URL/);
  });

  it("se niega contra un servidor que no es local", () => {
    expect(
      motivoParaNoReiniciar("postgresql://u:p@db.railway.internal:5432/proplay", "development"),
    ).toMatch(/no es local/);
  });

  it("se niega contra la base de las pruebas", () => {
    expect(motivoParaNoReiniciar("postgresql://u:p@localhost:5432/proplay_test", "test")).toMatch(
      /base de las pruebas/,
    );
  });
});

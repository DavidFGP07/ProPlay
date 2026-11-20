import { describe, expect, it } from "vitest";
import { METRICAS_TECNICA_LOL, candidatoRankingSchema, type CandidatoRanking } from "@proplay/shared";
import { construirEntrada, serializarEntrada } from "../src/modules/explicador/redaccion/entrada";
import { comprobarFidelidad } from "../src/modules/explicador/redaccion/fidelidad";
import { pulirFormato } from "../src/modules/explicador/redaccion/formato";
import { PROMPT_SISTEMA, VERSION_PROMPT } from "../src/modules/explicador/redaccion/prompt";

/**
 * RF-11 · Funciones puras del explicador: la entrada (sólo cifras y códigos),
 * el prompt y la comprobación de fidelidad. El candidato es el primero del
 * ranking de la oferta «ADC para la liga en línea» del seed (77 %).
 */

const ADC: CandidatoRanking = candidatoRankingSchema.parse({
  puesto: 1,
  jugador: {
    id: "cmvr981x7003phyql0a6ecteq",
    nombre: "Valentina Ríos Secreta",
    avatarUrl: "https://res.cloudinary.com/demo/avatar-secreto.png",
    pais: "CO",
    departamento: "ATLANTICO",
    disponibilidadHoras: 15,
    dispuestoRelocalizar: true,
    verificacion: { plataforma: "RIOT", verificadaEn: "2026-11-01T00:00:00Z" },
    posicion: "ADC",
    rango: "PLATINO_IV",
    datosDel: "2026-11-10T01:28:12.133Z",
  },
  puntaje: 0.7676821,
  desglose: { tecnica: 0.7794701666666667, experiencia: 0, habilidadesBlandas: 0, geografica: 1, disponibilidad: 0.75 },
  explicacion: {
    pesos: { tecnica: 0.6, experiencia: 0, habilidadesBlandas: 0, geografica: 0, disponibilidad: 0.4 },
    dimensiones: {
      tecnica: {
        faltanDatos: false,
        motivo: null,
        posicionPedida: "ADC",
        posicionPrincipal: "ADC",
        fraccionEnPosicion: 0.8,
        rango: "PLATINO_IV",
        rangoMinimo: "PLATINO_IV",
        partidasAnalizadas: 20,
        datosDel: "2026-11-10T01:28:12.133Z",
        componentes: { posicion: 1, rango: 1, rendimiento: 0.5990366666666667 },
        metricas: [
          { metrica: "winRate", valor: 0.45, normalizado: 0.3333333333333333 },
          { metrica: "kda", valor: 5.38, normalizado: 1 },
          { metrica: "csPorMinuto", valor: 6.65, normalizado: 0.53 },
          { metrica: "danoPorMinuto", valor: 656.19, normalizado: 0.5936500000000001 },
          { metrica: "oroPorMinuto", valor: 407.64, normalizado: 0.5381999999999999 },
        ],
      },
      experiencia: { faltanDatos: true, motivo: "SIN_DATOS_PILOTO" },
      habilidadesBlandas: { faltanDatos: true, motivo: "SIN_ENDORSEMENTS", endorsementsDeEquipos: 0 },
      geografica: { faltanDatos: false, motivo: "OFERTA_REMOTA", modalidad: "REMOTA", cercania: null, relocalizacionAplicada: false },
      disponibilidad: { faltanDatos: false, motivo: null, horasJugador: 15, horasOferta: 20 },
    },
  },
  similitud: 0.93,
  postulacion: { id: "cmpostulacionsecreta00001", estado: "ENVIADA" },
});

/** Mismo candidato con los pesos repartidos para que la técnica encabece sólo lo que suma. */
function conPesos(tecnica: number, geografica: number, disponibilidad: number): CandidatoRanking {
  return {
    ...ADC,
    explicacion: {
      ...ADC.explicacion,
      pesos: { tecnica, experiencia: 0, habilidadesBlandas: 0, geografica, disponibilidad },
    },
  };
}

/**
 * Mismo candidato con otra técnica y otras horas. `pesoTecnica` 0 deja la
 * técnica fuera de las dimensiones, pero sus requisitos siguen contando.
 */
function conRequisitos(
  tecnica: Partial<CandidatoRanking["explicacion"]["dimensiones"]["tecnica"]>,
  pesoTecnica = 0.6,
  horasJugador: number | null = 20,
): CandidatoRanking {
  const { dimensiones } = ADC.explicacion;
  return {
    ...ADC,
    explicacion: {
      pesos: { ...ADC.explicacion.pesos, tecnica: pesoTecnica, disponibilidad: 1 - pesoTecnica },
      dimensiones: {
        ...dimensiones,
        tecnica: { ...dimensiones.tecnica, ...tecnica },
        disponibilidad: { ...dimensiones.disponibilidad, horasJugador },
      },
    },
  };
}

describe("requisitos no cumplidos", () => {
  it("el puesto 1 del seed cumple posición y rango, pero no las horas", () => {
    expect(construirEntrada(ADC).requisitosNoCumplidos).toEqual([
      { requisito: "horasSemana", pedido: 20, candidato: 15 },
    ]);
  });

  it("si cumple todo, la lista queda vacía", () => {
    expect(construirEntrada(conRequisitos({})).requisitosNoCumplidos).toEqual([]);
    // Por encima del mínimo y con más horas de las pedidas también cumple.
    expect(construirEntrada(conRequisitos({ rango: "DIAMANTE_IV" }, 0.6, 30)).requisitosNoCumplidos).toEqual([]);
  });

  it("lista cada requisito que falla, con lo que pide la oferta y lo que tiene", () => {
    const ninguno = conRequisitos({ posicionPrincipal: "MID", rango: "ORO_II" }, 0.6, 10);
    expect(construirEntrada(ninguno).requisitosNoCumplidos).toEqual([
      { requisito: "posicion", pedido: "ADC", candidato: "MID" },
      { requisito: "rangoMinimo", pedido: "PLATINO_IV", candidato: "ORO_II" },
      { requisito: "horasSemana", pedido: 20, candidato: 10 },
    ]);
  });

  it("sin datos verificados, el requisito no se da por cumplido", () => {
    const sinDatos = conRequisitos({ posicionPrincipal: null, rango: null }, 0.6, null);
    expect(construirEntrada(sinDatos).requisitosNoCumplidos).toEqual([
      { requisito: "posicion", pedido: "ADC", candidato: null },
      { requisito: "rangoMinimo", pedido: "PLATINO_IV", candidato: null },
      { requisito: "horasSemana", pedido: 20, candidato: null },
    ]);
  });

  it("sin rango mínimo ni horas en la oferta, no hay nada que incumplir", () => {
    const libre = conRequisitos({ rangoMinimo: null, rango: "HIERRO_IV" });
    libre.explicacion.dimensiones.disponibilidad = { ...libre.explicacion.dimensiones.disponibilidad, horasOferta: null };
    expect(construirEntrada(libre).requisitosNoCumplidos).toEqual([]);
  });

  it("cuentan aunque la técnica no pese en la oferta", () => {
    const sinPeso = construirEntrada(conRequisitos({ rango: "ORO_II" }, 0));
    expect(sinPeso.dimensiones.map((d) => d.dimension)).not.toContain("tecnica");
    expect(sinPeso.requisitosNoCumplidos).toEqual([{ requisito: "rangoMinimo", pedido: "PLATINO_IV", candidato: "ORO_II" }]);
  });
});

describe("construirEntrada", () => {
  const entrada = construirEntrada(ADC);

  it("da los requisitos de la oferta, el puntaje y sólo las dimensiones visibles con peso", () => {
    expect(entrada.oferta).toEqual({ posicion: "ADC", rangoMinimo: "PLATINO_IV", modalidad: "REMOTA", horasSemana: 20 });
    expect(entrada.compatibilidad).toBe(77);
    // La geográfica pesa 0 en esta oferta; experiencia y habilidades blandas están ocultas.
    expect(entrada.dimensiones.map((d) => d.dimension)).toEqual(["tecnica", "disponibilidad"]);
    expect(entrada.dimensiones[0]).toMatchObject({ valor: 78, peso: 60, faltanDatos: false, motivo: null });
    expect(entrada.dimensiones[1]).toMatchObject({ valor: 75, peso: 40, detalle: { horasJugador: 15, horasOferta: 20 } });
  });

  it("da las cifras de la técnica ya calculadas, en % o redondeadas", () => {
    expect(entrada.dimensiones[0]!.detalle).toEqual({
      posicionPrincipal: "ADC",
      partidasEnPosicion: 80,
      rango: "PLATINO_IV",
      partidasAnalizadas: 20,
      componentes: { posicion: 100, rango: 100, rendimiento: 60 },
      metricas: [
        { metrica: "winRate", valor: 45, unidad: "%", escala: 33 },
        { metrica: "kda", valor: 5.38, escala: 100 },
        { metrica: "csPorMinuto", valor: 6.65, escala: 53 },
        { metrica: "danoPorMinuto", valor: 656, escala: 59 },
        { metrica: "oroPorMinuto", valor: 408, escala: 54 },
      ],
    });
  });

  it("no lleva ningún dato personal ni identificador", () => {
    const texto = serializarEntrada(entrada);
    for (const dato of [
      ADC.jugador.id,
      ADC.jugador.nombre,
      "Valentina",
      ADC.jugador.avatarUrl!,
      "ATLANTICO",
      "2026-11",
      "cmpostulacionsecreta00001",
      "0.93",
    ]) {
      expect(texto).not.toContain(dato);
    }
    expect(Object.keys(entrada)).not.toContain("jugador");
  });

  it("si la misma dimensión es la que más suma y la que más resta, dice qué parte suma y cuál resta", () => {
    // Técnica: aporta 0,6 × 0,78 y le falta 0,6 × 0,22 (más que 0,4 × 0,25 de la disponibilidad).
    expect(entrada.ordenPorAporte).toEqual(["tecnica", "disponibilidad"]);
    expect(entrada.ordenPorLoQueResta).toEqual(["tecnica", "disponibilidad"]);
    expect(entrada.mismaDimension).toEqual({
      dimension: "tecnica",
      suma: { componente: "posicion", valor: 100 },
      resta: { componente: "rendimiento", valor: 60 },
    });
  });

  it("fuera de la técnica, la parte que resta es el dato de la dimensión (las horas)", () => {
    // Con la disponibilidad pesando 0,7, encabeza las dos listas.
    const otra = construirEntrada(conPesos(0.3, 0, 0.7));
    expect(otra.ordenPorAporte[0]).toBe("disponibilidad");
    expect(otra.ordenPorLoQueResta[0]).toBe("disponibilidad");
    expect(otra.mismaDimension).toEqual({
      dimension: "disponibilidad",
      suma: null,
      resta: { componente: "horasJugador", valor: 15 },
    });
  });

  it("si son dimensiones distintas, no hay parte que señalar", () => {
    const sinCoincidir = construirEntrada({ ...conPesos(0.5, 0.25, 0.25), desglose: { ...ADC.desglose, tecnica: 0.95 } });
    expect(sinCoincidir.ordenPorAporte[0]).toBe("tecnica");
    expect(sinCoincidir.ordenPorLoQueResta[0]).toBe("disponibilidad");
    expect(sinCoincidir.mismaDimension).toBeNull();
  });

  it("una dimensión completa no resta nada, y con todo al 100 % la lista queda vacía", () => {
    const perfecto = construirEntrada({ ...ADC, desglose: { ...ADC.desglose, tecnica: 1, disponibilidad: 1 } });
    expect(perfecto.ordenPorLoQueResta).toEqual([]);
    expect(perfecto.mismaDimension).toBeNull();
  });

  it("el mismo candidato da siempre el mismo texto (clave de la caché)", () => {
    expect(serializarEntrada(construirEntrada(ADC))).toBe(serializarEntrada(entrada));
  });
});

describe("prompt", () => {
  it("está versionado y pide lo que más suma, lo que más resta y la parte de la misma dimensión", () => {
    expect(VERSION_PROMPT).toBeGreaterThan(0);
    expect(PROMPT_SISTEMA).toContain("ordenPorAporte");
    expect(PROMPT_SISTEMA).toContain("ordenPorLoQueResta");
    expect(PROMPT_SISTEMA).toContain("mismaDimension");
    expect(PROMPT_SISTEMA).toMatch(/No calcules cifras nuevas/);
    expect(PROMPT_SISTEMA).toMatch(/no de la persona/);
  });

  // Prueba manual con la clave real (v1): la tercera frase repetía la misma
  // dimensión y el texto citaba «winRate» y «la escala 33».
  it("prohíbe repetir, no cita la escala y da nombre en español a cada métrica", () => {
    expect(VERSION_PROMPT).toBeGreaterThanOrEqual(3);
    expect(PROMPT_SISTEMA).toMatch(/no repitas nada de lo ya dicho/);
    expect(PROMPT_SISTEMA).toMatch(/no la cites/);
    expect(PROMPT_SISTEMA).toContain("requisitosNoCumplidos");
    expect(PROMPT_SISTEMA).toMatch(/empiece exactamente por «No cumple» \(nunca «Además, no cumple»/);
    for (const metrica of METRICAS_TECNICA_LOL) {
      expect(PROMPT_SISTEMA).toContain(`${metrica} es «`);
    }
    expect(PROMPT_SISTEMA).toContain("coma decimal («7,95», nunca «7.95»)");
    expect(PROMPT_SISTEMA).toContain("nunca «winRate» ni «win rate»");
    expect(PROMPT_SISTEMA).toContain("nunca «MID», «TOP», «JUNGLA» ni «SOPORTE»");
    expect(PROMPT_SISTEMA).toContain("Las horas por semana las declara el jugador");
  });
});

describe("comprobarFidelidad", () => {
  const entrada = construirEntrada(ADC);

  it("acepta un texto con cifras y rangos de la entrada, en cualquiera de sus formas", () => {
    const texto =
      "Lo que más suma es la técnica: juega de ADC en el 80 % de sus partidas y ya está en Platino IV, " +
      "el mínimo que pide la oferta. Dentro de la técnica, lo que más resta es el rendimiento (60 de 100), " +
      "con una tasa de victorias de 0,45 y un KDA de 5,38. No cumple las horas: dedica 15 frente a las 20 que se piden. " +
      "Su oro por minuto es 408.";
    expect(comprobarFidelidad(texto, entrada)).toEqual({ fiel: true });
  });

  it("rechaza los nombres de campo del JSON y «win rate» en inglés", () => {
    const fin = " No cumple las horas: dedica 15 frente a las 20 que se piden.";
    expect(comprobarFidelidad(`Su winRate es de 0,45.${fin}`, entrada)).toMatchObject({
      fiel: false,
      causa: "NOMBRE_DE_CAMPO",
      detalle: "winRate",
    });
    expect(comprobarFidelidad(`Su csPorMinuto queda por encima de lo esperable.${fin}`, entrada)).toMatchObject({
      causa: "NOMBRE_DE_CAMPO",
      detalle: "csPorMinuto",
    });
    expect(comprobarFidelidad(`Su Win Rate es de 0,45.${fin}`, entrada)).toMatchObject({
      causa: "NOMBRE_DE_CAMPO",
      detalle: "win rate",
    });
  });

  it("rechaza que las horas por semana estén verificadas: las declara el jugador", () => {
    for (const frase of [
      "No cumple las horas: la oferta pide 20 y el candidato tiene 15 horas verificadas.",
      "No cumple la disponibilidad verificada: 15 frente a 20 horas.",
      "No cumple: tiene 15 verificadas frente a las 20 horas que pide la oferta.",
    ]) {
      expect(comprobarFidelidad(frase, entrada)).toMatchObject({ fiel: false, causa: "HORAS_VERIFICADAS" });
    }
    expect(comprobarFidelidad("No cumple las horas: declara 15 frente a las 20 que pide la oferta.", entrada)).toEqual({
      fiel: true,
    });
    // «Verificado» en otra frase (el rango, de Riot) no cuenta.
    expect(
      comprobarFidelidad("Su rango verificado es Platino IV. No cumple las horas: declara 15 de 20.", entrada),
    ).toEqual({ fiel: true });
  });

  it("la frase de los requisitos tiene que empezar por «No cumple»", () => {
    const inicio = "Lo que más suma es la técnica.";
    expect(comprobarFidelidad(`${inicio} Además, no cumple las horas: 15 frente a 20.`, entrada)).toMatchObject({
      fiel: false,
      causa: "REQUISITOS_OMITIDOS",
    });
    expect(comprobarFidelidad(`${inicio} No cumple las horas: 15 frente a 20.`, entrada)).toEqual({ fiel: true });
  });

  it("rechaza una cifra que no está en la entrada", () => {
    expect(comprobarFidelidad("Su win rate es del 52 %.", entrada)).toMatchObject({ fiel: false, causa: "CIFRA", detalle: "52" });
    // Una cifra calculada por el modelo (78 − 60) tampoco vale.
    expect(comprobarFidelidad("Le faltan 18 puntos.", entrada)).toMatchObject({ fiel: false, causa: "CIFRA" });
  });

  it("rechaza un rango que no está en la entrada, también por la división", () => {
    expect(comprobarFidelidad("Está en Diamante.", entrada)).toMatchObject({ fiel: false, causa: "RANGO", detalle: "diamante" });
    expect(comprobarFidelidad("Está en Platino II.", entrada)).toMatchObject({ fiel: false, causa: "RANGO", detalle: "platino ii" });
    expect(comprobarFidelidad("Está en Gran Maestro.", entrada)).toMatchObject({ fiel: false, causa: "RANGO" });
  });

  it("no confunde el oro por minuto con la liga Oro", () => {
    const sinRequisitos = { ...entrada, requisitosNoCumplidos: [] };
    expect(comprobarFidelidad("Su oro por minuto es 408 y su oro/min se mantiene.", sinRequisitos)).toEqual({ fiel: true });
    expect(comprobarFidelidad("Juega en Oro.", entrada)).toMatchObject({ fiel: false, causa: "RANGO" });
  });

  it("rechaza que mencione una dimensión oculta", () => {
    expect(comprobarFidelidad("Tiene mucha experiencia.", entrada)).toMatchObject({ fiel: false, causa: "DIMENSION_OCULTA", detalle: "experiencia" });
    expect(comprobarFidelidad("Le faltan habilidades blandas.", entrada)).toMatchObject({ fiel: false, causa: "DIMENSION_OCULTA" });
  });

  it("rechaza un texto que calla los requisitos que no cumple", () => {
    // Dedica 15 horas y la oferta pide 20: no basta con resaltar lo bueno.
    const soloLoBueno = "Lo que más suma es la técnica: juega de ADC en el 80 % de sus partidas y está en Platino IV.";
    expect(comprobarFidelidad(soloLoBueno, entrada)).toEqual({
      fiel: false,
      causa: "REQUISITOS_OMITIDOS",
      detalle: "horasSemana",
    });
    expect(comprobarFidelidad(`${soloLoBueno} No cumple las 20 horas por semana: dedica 15.`, entrada)).toEqual({ fiel: true });
  });

  it("acepta el rango del candidato que está por debajo del mínimo aunque la técnica no pese", () => {
    const debajo = construirEntrada(conRequisitos({ rango: "ORO_II" }, 0));
    expect(comprobarFidelidad("No cumple el rango mínimo: está en Oro II y se pide Platino IV.", debajo)).toEqual({ fiel: true });
  });
});

describe("pulirFormato", () => {
  it("pasa los decimales a coma y las posiciones a como las escribe la interfaz, sin tocar las cifras", () => {
    expect(pulirFormato("Juega de MID con 7.95 súbditos por minuto y un KDA de 5.38.")).toBe(
      "Juega de Mid con 7,95 súbditos por minuto y un KDA de 5,38.",
    );
    expect(pulirFormato("TOP, JUNGLA, SOPORTE y ADC.")).toBe("Top, Jungla, Soporte y ADC.");
    // Una palabra que sólo contiene el código no cambia; un final de frase tras un número, tampoco.
    expect(pulirFormato("MIDLANER. Tiene 15. Luego 20 horas.")).toBe("MIDLANER. Tiene 15. Luego 20 horas.");
  });
});

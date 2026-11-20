import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { API_PREFIX, JUEGO_PILOTO, explicacionGeneradaSchema, type ExplicacionGenerada } from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import { clienteRedis } from "../src/config/redis";
import { ErrorLLM, ErrorLLMTiempoAgotado, usarProveedorLLM } from "../src/integrations";
import { PREFIJO_CLAVES } from "../src/modules/explicador/explicador.repository";
import { configuracion } from "../src/modules/explicador/explicador.service";
import { PREFIJO_PRUEBA, app, cerrarConexiones, limpiarUsuariosDePrueba } from "./utils/entorno";
import { conToken, crearOferta, postular, registrar } from "./utils/ofertas";
import { ProveedorLLMFalso } from "./utils/proveedorLLMFalso";

/**
 * RF-11 · GET /explicaciones/ofertas/:id/candidatos/:jugadorId con el
 * proveedor falso: el CI nunca llama al modelo real. Comprueba la generación,
 * la caché, cada degradación, la fidelidad, la minimización y los límites.
 */

const haceDias = (dias: number) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
const configuracionOriginal = { ...configuracion };

let tokenEquipo: string;
let tokenScout: string;
let tokenJugador: string;
let tokenOtroEquipo: string;
let oferta: string;
let jugadorId: string;
let ruta: string;
const RIOT_ID = "test-puuid-secreto";

async function perfilDe(etiqueta: string) {
  return prisma.perfilJugador.findFirstOrThrow({
    where: { usuario: { email: { startsWith: `${PREFIJO_PRUEBA}+${etiqueta}-` } } },
    include: { usuario: true },
  });
}

/** Cuenta de Riot verificada con una captura de MID en Diamante II, como en las pruebas del matching. */
async function verificar(id: string): Promise<void> {
  await prisma.perfilJugador.update({ where: { id }, data: { pais: "CO", departamento: "GUAINIA", disponibilidadHoras: 15 } });
  const cuenta = await prisma.cuentaGaming.create({
    data: { jugadorId: id, plataforma: "RIOT", externalId: RIOT_ID, handle: "SecretoRiot#LAN", verificadaEn: haceDias(30) },
  });
  await prisma.estadistica.create({
    data: {
      jugadorId: id,
      cuentaId: cuenta.id,
      juego: JUEGO_PILOTO,
      rol: "MID",
      rango: "DIAMANTE_II",
      partidas: 20,
      victorias: 11,
      kda: 3.2,
      winRate: 0.55,
      fuente: "RIOT",
      metricas: {
        partidasAnalizadas: 20,
        csPorMinuto: 7,
        danoPorMinuto: 650,
        visionPorMinuto: 1.1,
        participacionKills: 0.6,
        oroPorMinuto: 400,
        distribucionRoles: { MID: 20 },
        rangoSoloDuo: { liga: "DIAMOND", division: "II", puntosLiga: 10, victorias: 60, derrotas: 50 },
      },
      capturadaEn: haceDias(2),
    },
  });
}

async function limpiarRedis(): Promise<void> {
  const redis = await clienteRedis();
  const claves = await redis.keys(`${PREFIJO_CLAVES}*`);
  if (claves.length > 0) await redis.del(...claves);
}

async function explicar(token = tokenEquipo): Promise<ExplicacionGenerada> {
  const respuesta = await conToken(token).get(ruta);
  expect(respuesta.status).toBe(200);
  return explicacionGeneradaSchema.parse(respuesta.body);
}

/** Un texto fiel a la entrada de este candidato (cifras y rango de la entrada). */
const TEXTO_FIEL =
  "Lo que más suma es la técnica: juega de Mid en el 100 % de sus partidas y está en Diamante II. " +
  "Lo que más resta es la disponibilidad. No cumple las horas por semana: dedica 15 frente a las 20 que pide la oferta.";

let falso: ProveedorLLMFalso;

beforeAll(async () => {
  await limpiarUsuariosDePrueba();
  tokenEquipo = await registrar("explicador-equipo", "EQUIPO");
  tokenOtroEquipo = await registrar("explicador-otro-equipo", "EQUIPO");
  tokenScout = await registrar("explicador-scout", "SCOUT");
  tokenJugador = await registrar("explicador-jugador", "JUGADOR");
  jugadorId = (await perfilDe("explicador-jugador")).id;
  await verificar(jugadorId);
  oferta = (
    await crearOferta(tokenEquipo, {
      rol: "MID",
      rangoMinimo: "PLATA_I",
      modalidad: "PRESENCIAL",
      departamento: "GUAINIA",
      horasSemana: 20,
    })
  ).id;
  await postular(tokenJugador, oferta);
  ruta = `${API_PREFIX}/explicaciones/ofertas/${oferta}/candidatos/${jugadorId}`;
});

beforeEach(async () => {
  await limpiarRedis();
  Object.assign(configuracion, configuracionOriginal);
  falso = new ProveedorLLMFalso("modelo-falso");
  falso.respuesta = { texto: TEXTO_FIEL, tokensEntrada: 700, tokensSalida: 80 };
  usarProveedorLLM(falso);
});

afterEach(() => usarProveedorLLM(null));

afterAll(async () => {
  await limpiarRedis();
  await limpiarUsuariosDePrueba();
  await cerrarConexiones();
});

describe("GET /explicaciones/ofertas/:id/candidatos/:jugadorId", () => {
  it("genera la explicación con el modelo configurado", async () => {
    const cuerpo = await explicar();
    expect(cuerpo).toMatchObject({ estado: "GENERADA", texto: TEXTO_FIEL, motivo: null, modelo: "modelo-falso", deCache: false });
    expect(cuerpo.versionPrompt).toBeGreaterThan(0);
    expect(falso.peticiones).toHaveLength(1);
    expect(falso.peticiones[0]!.timeoutMs).toBe(configuracion.timeoutMs);
  });

  it("la segunda petición sale de la caché y no llama al modelo", async () => {
    await explicar();
    const segunda = await explicar(tokenScout);
    expect(segunda).toMatchObject({ estado: "GENERADA", texto: TEXTO_FIEL, deCache: true });
    expect(falso.peticiones).toHaveLength(1);
  });

  it("la entrada no lleva datos personales ni identificadores", async () => {
    await explicar();
    const { entrada, sistema } = falso.peticiones[0]!;
    const perfil = await perfilDe("explicador-jugador");
    for (const dato of [jugadorId, perfil.usuario.id, perfil.usuario.nombre, perfil.usuario.email, RIOT_ID, "SecretoRiot", "GUAINIA", oferta]) {
      expect(entrada).not.toContain(dato);
      expect(sistema).not.toContain(dato);
    }
    // Sí lleva lo que el texto necesita: cifras y códigos.
    expect(entrada).toContain('"compatibilidad"');
    expect(entrada).toContain("DIAMANTE_II");
  });

  it("sin proveedor activo (sin clave o apagado) no llama a nadie", async () => {
    usarProveedorLLM(null); // en las pruebas la configuración lo deja desactivado
    expect(await explicar()).toEqual({
      estado: "NO_DISPONIBLE",
      texto: null,
      motivo: "DESACTIVADO",
      modelo: null,
      versionPrompt: expect.any(Number),
      deCache: false,
    });
  });

  it("un fallo o una negativa del proveedor se degradan a ERROR", async () => {
    falso.respuesta = () => Promise.reject(new ErrorLLM("Anthropic respondió 500", "API"));
    expect(await explicar()).toMatchObject({ estado: "NO_DISPONIBLE", motivo: "ERROR", modelo: "modelo-falso" });
    falso.respuesta = () => Promise.reject(new ErrorLLM("El modelo declinó la petición", "RECHAZO"));
    expect(await explicar()).toMatchObject({ estado: "NO_DISPONIBLE", motivo: "ERROR" });
    falso.respuesta = () => Promise.reject(new Error("inesperado"));
    expect(await explicar()).toMatchObject({ estado: "NO_DISPONIBLE", motivo: "ERROR" });
  });

  it("el tiempo agotado se degrada a TIEMPO_AGOTADO", async () => {
    falso.respuesta = () => Promise.reject(new ErrorLLMTiempoAgotado());
    expect(await explicar()).toMatchObject({ estado: "NO_DISPONIBLE", motivo: "TIEMPO_AGOTADO" });
  });

  it("un texto con una cifra inventada se descarta y no se guarda", async () => {
    falso.respuesta = { texto: "Lo que más suma es la técnica, con un 93 % de victorias.", tokensEntrada: 700, tokensSalida: 30 };
    expect(await explicar()).toMatchObject({ estado: "NO_DISPONIBLE", motivo: "FIDELIDAD" });
    // No quedó en la caché: la siguiente petición vuelve a llamar al modelo.
    falso.respuesta = { texto: TEXTO_FIEL, tokensEntrada: 700, tokensSalida: 80 };
    expect(await explicar()).toMatchObject({ estado: "GENERADA", deCache: false });
    expect(falso.peticiones).toHaveLength(2);
  });

  it("el texto se pule antes de comprobarlo y guardarlo: la posición como en la interfaz", async () => {
    falso.respuesta = {
      texto: TEXTO_FIEL.replace("juega de Mid", "juega de MID"),
      tokensEntrada: 700,
      tokensSalida: 80,
    };
    const cuerpo = await explicar();
    expect(cuerpo).toMatchObject({ estado: "GENERADA", texto: TEXTO_FIEL });
  });

  it("un rango inventado también se descarta", async () => {
    falso.respuesta = { texto: "Está en Retador y juega de Mid.", tokensEntrada: 700, tokensSalida: 20 };
    expect(await explicar()).toMatchObject({ estado: "NO_DISPONIBLE", motivo: "FIDELIDAD" });
  });

  it("callar un requisito que no cumple también se descarta", async () => {
    // Dedica 15 horas y la oferta pide 20: el texto sólo resalta lo bueno.
    falso.respuesta = {
      texto: "Lo que más suma es la técnica: juega de Mid en el 100 % de sus partidas y está en Diamante II.",
      tokensEntrada: 700,
      tokensSalida: 30,
    };
    expect(await explicar()).toMatchObject({ estado: "NO_DISPONIBLE", motivo: "FIDELIDAD" });
    expect(falso.peticiones[0]!.entrada).toContain('"requisito": "horasSemana"');
  });

  it("agotado el límite por usuario y hora, se degrada a LIMITE; la caché sigue sirviendo", async () => {
    configuracion.limiteUsuarioHora = 1;
    expect(await explicar()).toMatchObject({ estado: "GENERADA", deCache: false });
    // Un acierto de caché no gasta el límite.
    expect(await explicar()).toMatchObject({ estado: "GENERADA", deCache: true });
    // Sin caché, la segunda generación del mismo usuario en la hora ya no entra.
    const redis = await clienteRedis();
    await redis.del(...(await redis.keys(`${PREFIJO_CLAVES}texto:*`)));
    expect(await explicar()).toMatchObject({ estado: "NO_DISPONIBLE", motivo: "LIMITE" });
    // Otro usuario sí puede.
    expect(await explicar(tokenScout)).toMatchObject({ estado: "GENERADA" });
    expect(falso.peticiones).toHaveLength(2);
  });

  it("agotado el tope diario global, se degrada a LIMITE para todos", async () => {
    configuracion.limiteDiario = 1;
    expect(await explicar()).toMatchObject({ estado: "GENERADA" });
    const redis = await clienteRedis();
    await redis.del(...(await redis.keys(`${PREFIJO_CLAVES}texto:*`)));
    expect(await explicar(tokenScout)).toMatchObject({ estado: "NO_DISPONIBLE", motivo: "LIMITE" });
    expect(falso.peticiones).toHaveLength(1);
  });

  it("el detalle del candidato y el ranking no dependen del explicador", async () => {
    falso.respuesta = () => Promise.reject(new ErrorLLMTiempoAgotado());
    const detalle = await conToken(tokenEquipo).get(`${API_PREFIX}/matching/ofertas/${oferta}/candidatos/${jugadorId}`);
    expect(detalle.status).toBe(200);
    const ranking = await conToken(tokenEquipo).get(`${API_PREFIX}/matching/ofertas/${oferta}/ranking`);
    expect(ranking.status).toBe(200);
    expect(falso.peticiones).toHaveLength(0);
  });
});

describe("permisos del explicador (RNF-04)", () => {
  it("sin sesión responde 401", async () => {
    expect((await request(app).get(ruta)).status).toBe(401);
  });

  it("el jugador recibe 403; otro equipo, 403 en una oferta publicada", async () => {
    expect((await conToken(tokenJugador).get(ruta)).status).toBe(403);
    expect((await conToken(tokenOtroEquipo).get(ruta)).status).toBe(403);
    expect(falso.peticiones).toHaveLength(0);
  });

  it("un jugador que no está en el ranking responde 404 sin llamar al modelo", async () => {
    const otro = "cmnoesunjugador0000000000"; // id que no es de ningún candidato
    const respuesta = await conToken(tokenEquipo).get(`${API_PREFIX}/explicaciones/ofertas/${oferta}/candidatos/${otro}`);
    expect(respuesta.status).toBe(404);
    expect(falso.peticiones).toHaveLength(0);
  });
});

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import {
  API_PREFIX,
  MAX_COMPROBACIONES_DESAFIO,
  SEGUNDOS_MINIMOS_ENTRE_COMPROBACIONES,
  cuentaGamingSchema,
  desafioActivoRiotSchema,
  desafioVerificacionRiotSchema,
  resultadoVerificacionRiotSchema,
} from "@proplay/shared";
import { clienteRedis } from "../src/config/redis";
import { obtenerProveedorRiot } from "../src/integrations";
import { CuotaRiotAgotadaError } from "../src/utils/errors";
import {
  CONSENTIMIENTO,
  app,
  cerrarConexiones,
  emailDePrueba,
  limpiarUsuariosDePrueba,
} from "./utils/entorno";

/**
 * RF-02 · Desafío de verificación por icono guardado en el servidor (Redis):
 * sobrevive a una nueva consulta, «generar otro» invalida el anterior, caduca,
 * admite una verificación tardía, tiene su propio cupo de comprobaciones y no
 * sirve a otro usuario. Riot se simula con espías sobre el proveedor.
 */

const riot = obtenerProveedorRiot();
const RUTA = `${API_PREFIX}/perfiles/cuentas-gaming/riot`;
const ENTRADA = { gameName: "Jugador Uno", tagLine: "LAN", servidor: "LA1" };

async function registrar(etiqueta: string) {
  const registro = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email: emailDePrueba(etiqueta),
      password: "ProPlay123",
      nombre: "Jugador Desafío",
      rol: "JUGADOR",
      ...CONSENTIMIENTO,
    });
  expect(registro.status).toBe(201);
  const token = registro.body.accessToken as string;
  const me = await request(app).get(`${API_PREFIX}/perfiles/me`).set("Authorization", `Bearer ${token}`);
  return { token, usuarioId: me.body.perfil?.usuarioId as string, perfilId: me.body.perfil?.id as string };
}

type Sesion = Awaited<ReturnType<typeof registrar>>;

const con = (sesion: Sesion) => ({ Authorization: `Bearer ${sesion.token}` });

async function iniciar(sesion: Sesion, entrada = ENTRADA) {
  return request(app).post(RUTA).set(con(sesion)).send(entrada);
}

async function verificar(sesion: Sesion, tokenDesafio: string) {
  return request(app).post(`${RUTA}/verificar`).set(con(sesion)).send({ tokenDesafio });
}

async function desafioActivo(sesion: Sesion) {
  const respuesta = await request(app).get(`${RUTA}/desafio`).set(con(sesion));
  expect(respuesta.status).toBe(200);
  return desafioActivoRiotSchema.parse(respuesta.body).desafio;
}

/** Simula que la comprobación anterior fue hace más del mínimo entre comprobaciones. */
async function olvidarUltimaComprobacion(sesion: Sesion) {
  const redis = await clienteRedis();
  const clave = `proplay:riot:desafio:${sesion.usuarioId}`;
  const atras = Date.now() - (SEGUNDOS_MINIMOS_ENTRE_COMPROBACIONES + 1) * 1000;
  if (await redis.hexists(clave, "ultimaComprobacionEn")) {
    await redis.hset(clave, "ultimaComprobacionEn", atras);
  }
}

let iconoEnRiot = 7;

let prueba = 0;

beforeEach(() => {
  iconoEnRiot = 7;
  prueba += 1;
  // Puuid propio de cada prueba (y de cada Riot ID): una prueba que verifica la
  // cuenta no la deja «vinculada a otro jugador» para las siguientes.
  vi.spyOn(riot, "buscarCuenta").mockImplementation(async (gameName, tagLine, servidor) => ({
    puuid: `puuid-desafio-${prueba}-${gameName.toLowerCase()}-${tagLine.toLowerCase()}`,
    riotId: `${gameName}#${tagLine}`,
    servidor,
    iconoActual: iconoEnRiot,
    nivelInvocador: 245,
  }));
  vi.spyOn(riot, "iconoActual").mockImplementation(async () => iconoEnRiot);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("desafío de verificación de Riot guardado en el servidor", () => {
  beforeAll(async () => {
    await limpiarUsuariosDePrueba();
  });

  afterAll(async () => {
    await limpiarUsuariosDePrueba();
    await cerrarConexiones();
  });

  it("sin desafío, la consulta devuelve null", async () => {
    const jugador = await registrar("desafio-vacio");
    expect(await desafioActivo(jugador)).toBeNull();
  });

  it("el desafío sobrevive a una nueva consulta y volver a iniciar devuelve el mismo", async () => {
    const jugador = await registrar("desafio-persiste");
    const primero = await iniciar(jugador);
    expect(primero.status).toBe(200);
    const desafio = desafioVerificacionRiotSchema.parse(primero.body);
    expect(desafio.iconoRequerido).not.toBe(7);
    expect(desafio.comprobacionesRestantes).toBe(MAX_COMPROBACIONES_DESAFIO);
    expect(desafio.ultimaComprobacionEn).toBeNull();

    // Salir de la vista y volver: la consulta trae el mismo icono y token.
    const recuperado = await desafioActivo(jugador);
    expect(recuperado?.iconoRequerido).toBe(desafio.iconoRequerido);
    expect(recuperado?.tokenDesafio).toBe(desafio.tokenDesafio);
    expect(recuperado?.expiraEn.getTime()).toBe(desafio.expiraEn.getTime());

    // Iniciar otra vez para la misma cuenta (otro formato del Riot ID) no crea otro.
    const otraVez = await iniciar(jugador, { ...ENTRADA, gameName: "jugador uno", tagLine: "lan" });
    expect(otraVez.status).toBe(200);
    expect(otraVez.body.tokenDesafio).toBe(desafio.tokenDesafio);
    expect(riot.buscarCuenta).toHaveBeenCalledTimes(1);
  });

  it("con un desafío activo, iniciar con otra cuenta da 409 hasta cancelarlo", async () => {
    const jugador = await registrar("desafio-otra-cuenta");
    expect((await iniciar(jugador)).status).toBe(200);
    const otra = await iniciar(jugador, { ...ENTRADA, gameName: "Otra Cuenta" });
    expect(otra.status).toBe(409);
    expect(otra.body.error.code).toBe("DESAFIO_ACTIVO");

    const cancelar = await request(app).delete(`${RUTA}/desafio`).set(con(jugador));
    expect(cancelar.status).toBe(204);
    expect(await desafioActivo(jugador)).toBeNull();
    expect((await iniciar(jugador, { ...ENTRADA, gameName: "Otra Cuenta" })).status).toBe(200);
  });

  it("«generar otro» cambia el icono e invalida el anterior", async () => {
    const jugador = await registrar("desafio-regenerar");
    const anterior = desafioVerificacionRiotSchema.parse((await iniciar(jugador)).body);

    const regenerar = await request(app).post(`${RUTA}/desafio/regenerar`).set(con(jugador));
    expect(regenerar.status).toBe(200);
    const nuevo = desafioVerificacionRiotSchema.parse(regenerar.body);
    expect(nuevo.tokenDesafio).not.toBe(anterior.tokenDesafio);
    expect(nuevo.iconoRequerido).not.toBe(anterior.iconoRequerido);
    expect(nuevo.iconoRequerido).not.toBe(iconoEnRiot);
    expect((await desafioActivo(jugador))?.tokenDesafio).toBe(nuevo.tokenDesafio);

    // Aunque el jugador se ponga el icono anterior, el token anterior ya no vale.
    iconoEnRiot = anterior.iconoRequerido;
    const conAnterior = await verificar(jugador, anterior.tokenDesafio);
    expect(conAnterior.status).toBe(409);
    expect(conAnterior.body.error.code).toBe("DESAFIO_REEMPLAZADO");
  });

  it("un desafío caducado ya no se devuelve ni se puede verificar", async () => {
    const jugador = await registrar("desafio-caducado");
    const desafio = desafioVerificacionRiotSchema.parse((await iniciar(jugador)).body);

    const redis = await clienteRedis();
    await redis.pexpire(`proplay:riot:desafio:${jugador.usuarioId}`, 1);
    await new Promise((resolver) => setTimeout(resolver, 20));

    expect(await desafioActivo(jugador)).toBeNull();
    iconoEnRiot = desafio.iconoRequerido;
    const respuesta = await verificar(jugador, desafio.tokenDesafio);
    expect(respuesta.status).toBe(410);
    expect(respuesta.body.error.code).toBe("DESAFIO_CADUCADO");
    const regenerar = await request(app).post(`${RUTA}/desafio/regenerar`).set(con(jugador));
    expect(regenerar.status).toBe(410);
  });

  it("verificación tardía: PENDIENTE mientras Riot no refleja el icono y VERIFICADA después", async () => {
    const jugador = await registrar("desafio-tardio");
    const desafio = desafioVerificacionRiotSchema.parse((await iniciar(jugador)).body);

    // Riot todavía muestra el icono anterior: 200, no un error.
    const primera = await verificar(jugador, desafio.tokenDesafio);
    expect(primera.status).toBe(200);
    const pendiente = resultadoVerificacionRiotSchema.parse(primera.body);
    expect(pendiente.estado).toBe("PENDIENTE");
    if (pendiente.estado !== "PENDIENTE") return;
    expect(pendiente.desafio.ultimaComprobacionEn).not.toBeNull();
    expect(pendiente.desafio.iconoVisto).toBe(7);
    expect(pendiente.desafio.comprobacionesRestantes).toBe(MAX_COMPROBACIONES_DESAFIO - 1);

    // Otra comprobación pegada a la anterior no vuelve a consultar a Riot ni cuenta.
    const pegada = resultadoVerificacionRiotSchema.parse((await verificar(jugador, desafio.tokenDesafio)).body);
    expect(pegada.estado).toBe("PENDIENTE");
    expect(riot.iconoActual).toHaveBeenCalledTimes(1);
    if (pegada.estado === "PENDIENTE") {
      expect(pegada.desafio.comprobacionesRestantes).toBe(MAX_COMPROBACIONES_DESAFIO - 1);
    }

    // Unos minutos después Riot ya lo refleja.
    await olvidarUltimaComprobacion(jugador);
    iconoEnRiot = desafio.iconoRequerido;
    const tardia = await verificar(jugador, desafio.tokenDesafio);
    expect(tardia.status).toBe(201);
    const verificada = resultadoVerificacionRiotSchema.parse(tardia.body);
    expect(verificada.estado).toBe("VERIFICADA");
    if (verificada.estado === "VERIFICADA") {
      expect(cuentaGamingSchema.parse(verificada.cuenta).handle).toBe("Jugador Uno#LAN");
    }
    // El desafío se consume al verificarse.
    expect(await desafioActivo(jugador)).toBeNull();
  });

  it("las comprobaciones tienen su propio cupo por desafío", async () => {
    const jugador = await registrar("desafio-cupo");
    const desafio = desafioVerificacionRiotSchema.parse((await iniciar(jugador)).body);
    const redis = await clienteRedis();
    await redis.hset(
      `proplay:riot:desafio:${jugador.usuarioId}`,
      "comprobaciones",
      MAX_COMPROBACIONES_DESAFIO - 1,
    );

    const ultima = resultadoVerificacionRiotSchema.parse((await verificar(jugador, desafio.tokenDesafio)).body);
    expect(ultima.estado).toBe("PENDIENTE");
    if (ultima.estado === "PENDIENTE") expect(ultima.desafio.comprobacionesRestantes).toBe(0);

    await olvidarUltimaComprobacion(jugador);
    const agotada = await verificar(jugador, desafio.tokenDesafio);
    expect(agotada.status).toBe(429);
    expect(agotada.body.error.code).toBe("COMPROBACIONES_AGOTADAS");
    expect(riot.iconoActual).toHaveBeenCalledTimes(1);

    // «Generar otro icono» empieza un cupo nuevo.
    const nuevo = desafioVerificacionRiotSchema.parse(
      (await request(app).post(`${RUTA}/desafio/regenerar`).set(con(jugador))).body,
    );
    expect(nuevo.comprobacionesRestantes).toBe(MAX_COMPROBACIONES_DESAFIO);
  });

  it("el desafío de otro usuario no sirve", async () => {
    const duena = await registrar("desafio-duena");
    const intruso = await registrar("desafio-intruso");
    const desafio = desafioVerificacionRiotSchema.parse((await iniciar(duena)).body);
    iconoEnRiot = desafio.iconoRequerido;

    const respuesta = await verificar(intruso, desafio.tokenDesafio);
    expect(respuesta.status).toBe(400);
    // Ni lo ve, ni le gasta comprobaciones a la dueña, ni vincula nada.
    expect(await desafioActivo(intruso)).toBeNull();
    expect((await desafioActivo(duena))?.comprobacionesRestantes).toBe(MAX_COMPROBACIONES_DESAFIO);
    const cuentas = await request(app).get(`${API_PREFIX}/perfiles/cuentas-gaming`).set(con(intruso));
    expect(cuentas.body).toEqual([]);
  });

  describe("sin cupo en la cuota de Riot", () => {
    it("la comprobación responde PENDIENTE «mucha demanda» sin gastar comprobaciones", async () => {
      const jugador = await registrar("desafio-sin-cupo");
      const desafio = desafioVerificacionRiotSchema.parse((await iniciar(jugador)).body);
      vi.spyOn(riot, "iconoActual").mockRejectedValue(new CuotaRiotAgotadaError(40_000));

      const respuesta = await verificar(jugador, desafio.tokenDesafio);
      expect(respuesta.status).toBe(200);
      const resultado = resultadoVerificacionRiotSchema.parse(respuesta.body);
      expect(resultado).toMatchObject({ estado: "PENDIENTE", motivo: "MUCHA_DEMANDA" });
      if (resultado.estado !== "PENDIENTE") return;
      expect(resultado.desafio.comprobacionesRestantes).toBe(MAX_COMPROBACIONES_DESAFIO);
      // Tampoco cuenta como comprobación hecha: la siguiente no se trata como «pegada».
      expect(resultado.desafio.ultimaComprobacionEn).toBeNull();

      vi.spyOn(riot, "iconoActual").mockResolvedValue(desafio.iconoRequerido);
      const despues = await verificar(jugador, desafio.tokenDesafio);
      expect(despues.status).toBe(201);
    });

    it("iniciar la vinculación responde 503 «mucha demanda» con la espera, no un error genérico", async () => {
      const jugador = await registrar("desafio-inicio-sin-cupo");
      vi.spyOn(riot, "buscarCuenta").mockRejectedValue(new CuotaRiotAgotadaError(12_000));
      const respuesta = await iniciar(jugador);
      expect(respuesta.status).toBe(503);
      expect(respuesta.body.error.code).toBe("MUCHA_DEMANDA");
      expect(respuesta.body.error.details.reintentarEnSegundos).toBe(12);
      expect(await desafioActivo(jugador)).toBeNull();
    });
  });
});

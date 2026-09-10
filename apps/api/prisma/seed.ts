import bcrypt from "bcrypt";
import { PrismaClient, Prisma } from "@prisma/client";
import {
  PERFIL_VECTOR_DIMENSIONES,
  PERFIL_VECTOR_VERSION,
} from "@proplay/shared";

/**
 * Datos de prueba de ProPlay.
 *
 * Carga: el catálogo de habilidades, 3 equipos, 15 jugadores con estadísticas
 * y vectores sintéticos, 5 ofertas abiertas, un scout y un administrador.
 *
 * Es idempotente (usa upsert), así que se puede ejecutar varias veces:
 *   npm run db:seed
 */
const prisma = new PrismaClient();

/** Contraseña común de todas las cuentas de prueba. */
const PASSWORD_DEMO = "ProPlay123";

/** Generador pseudoaleatorio determinista: el seed siempre produce lo mismo. */
function crearAleatorio(semilla: number) {
  let estado = semilla;
  return () => {
    estado = (estado * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return estado / 4_294_967_296;
  };
}

const HABILIDADES_TECNICAS = [
  "Aim",
  "Map awareness",
  "Last hitting",
  "Wave management",
  "Rotaciones",
  "Control de objetivos",
  "Uso de utilidad",
  "Entry fragging",
  "Micro",
  "Macro",
];

const HABILIDADES_BLANDAS = [
  "Comunicación",
  "Liderazgo",
  "Trabajo en equipo",
  "Adaptabilidad",
  "Disciplina",
  "Gestión del tiempo",
];

const JUEGOS = [
  { nombre: "League of Legends", roles: ["TOP", "JUNGLA", "MID", "ADC", "SUPPORT"], fuente: "RIOT" as const },
  { nombre: "VALORANT", roles: ["DUELISTA", "CENTINELA", "CONTROLADOR", "INICIADOR"], fuente: "RIOT" as const },
  { nombre: "Counter-Strike 2", roles: ["AWPER", "ENTRY", "IGL", "SUPPORT"], fuente: "STEAM" as const },
  { nombre: "Dota 2", roles: ["CARRY", "MID", "OFFLANE", "SOPORTE"], fuente: "STEAM" as const },
];

const REGIONES = ["LAN", "LAS", "NA", "EU", "BR"];
const PAISES = ["Colombia", "México", "Argentina", "España", "Chile", "Perú"];

const EQUIPOS = [
  {
    email: "equipo@caribeesports.gg",
    nombre: "Caribe eSports",
    nombreOrg: "Caribe eSports",
    descripcion: "Organización de la costa Caribe con divisiones de LoL y VALORANT.",
    sitioWeb: "https://caribeesports.gg",
    region: "LAN",
  },
  {
    email: "equipo@andesgaming.co",
    nombre: "Andes Gaming",
    nombreOrg: "Andes Gaming",
    descripcion: "Academia de desarrollo de talento para escenas emergentes.",
    sitioWeb: "https://andesgaming.co",
    region: "LAS",
  },
  {
    email: "equipo@uninortelegends.edu.co",
    nombre: "Uninorte Legends",
    nombreOrg: "Uninorte Legends",
    descripcion: "Equipo universitario de la Universidad del Norte.",
    sitioWeb: "https://uninortelegends.edu.co",
    region: "LAN",
  },
];

const NOMBRES_JUGADORES = [
  "Andrés Molina",
  "Valentina Ríos",
  "Camilo Ospina",
  "Laura Beltrán",
  "Sebastián Duarte",
  "Mariana Pardo",
  "Julián Castaño",
  "Daniela Quintero",
  "Tomás Herrera",
  "Sofía Naranjo",
  "Emilio Vargas",
  "Isabela Cortés",
  "Nicolás Mejía",
  "Paula Restrepo",
  "Samuel Arango",
];

async function main() {
  console.log("Sembrando datos de prueba de ProPlay...");
  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 10);
  const aleatorio = crearAleatorio(20_260_910);

  // ---------------------------------------------------------------- catálogo
  const habilidades = await Promise.all([
    ...HABILIDADES_TECNICAS.map((nombre) =>
      prisma.habilidad.upsert({
        where: { nombre },
        update: {},
        create: { nombre, categoria: "TECNICA" },
      }),
    ),
    ...HABILIDADES_BLANDAS.map((nombre) =>
      prisma.habilidad.upsert({
        where: { nombre },
        update: {},
        create: { nombre, categoria: "BLANDA" },
      }),
    ),
  ]);
  console.log(`  · ${habilidades.length} habilidades en el catálogo`);

  const tecnicas = habilidades.filter((h) => h.categoria === "TECNICA");
  const blandas = habilidades.filter((h) => h.categoria === "BLANDA");

  // ------------------------------------------------------- admin y scout demo
  await prisma.usuario.upsert({
    where: { email: "admin@proplay.gg" },
    update: {},
    create: {
      email: "admin@proplay.gg",
      passwordHash,
      nombre: "Administración ProPlay",
      rol: "ADMIN",
      emailVerificado: true,
    },
  });

  await prisma.usuario.upsert({
    where: { email: "scout@proplay.gg" },
    update: {},
    create: {
      email: "scout@proplay.gg",
      passwordHash,
      nombre: "Marcela Guzmán",
      rol: "SCOUT",
      emailVerificado: true,
    },
  });

  // ----------------------------------------------------------------- equipos
  const perfilesEquipo = [];
  for (const equipo of EQUIPOS) {
    const usuario = await prisma.usuario.upsert({
      where: { email: equipo.email },
      update: {},
      create: {
        email: equipo.email,
        passwordHash,
        nombre: equipo.nombre,
        rol: "EQUIPO",
        emailVerificado: true,
      },
    });

    const perfil = await prisma.perfilEquipo.upsert({
      where: { usuarioId: usuario.id },
      update: {},
      create: {
        usuarioId: usuario.id,
        nombreOrg: equipo.nombreOrg,
        descripcion: equipo.descripcion,
        sitioWeb: equipo.sitioWeb,
        region: equipo.region,
      },
    });
    perfilesEquipo.push(perfil);
  }
  console.log(`  · ${perfilesEquipo.length} equipos`);

  // ---------------------------------------------------------------- jugadores
  let estadisticasCreadas = 0;
  for (const [indice, nombre] of NOMBRES_JUGADORES.entries()) {
    const email = `jugador${indice + 1}@proplay.gg`;
    const juego = JUEGOS[indice % JUEGOS.length]!;
    const rol = juego.roles[indice % juego.roles.length]!;

    const usuario = await prisma.usuario.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        nombre,
        rol: "JUGADOR",
        emailVerificado: true,
      },
    });

    const jugador = await prisma.perfilJugador.upsert({
      where: { usuarioId: usuario.id },
      update: {},
      create: {
        usuarioId: usuario.id,
        bio: `${rol} de ${juego.nombre} buscando equipo competitivo.`,
        region: REGIONES[indice % REGIONES.length]!,
        pais: PAISES[indice % PAISES.length]!,
        fechaNacimiento: new Date(1998 + (indice % 8), indice % 12, 1 + (indice % 27)),
        disponibilidadHoras: 15 + (indice % 4) * 5,
        dispuestoRelocalizar: indice % 3 === 0,
      },
    });

    // Dos habilidades técnicas y una blanda por jugador.
    const asignaciones = [
      tecnicas[indice % tecnicas.length]!,
      tecnicas[(indice + 3) % tecnicas.length]!,
      blandas[indice % blandas.length]!,
    ];
    for (const [posicion, habilidad] of asignaciones.entries()) {
      await prisma.habilidadJugador.upsert({
        where: {
          jugadorId_habilidadId: {
            jugadorId: jugador.id,
            habilidadId: habilidad.id,
          },
        },
        update: {},
        create: {
          jugadorId: jugador.id,
          habilidadId: habilidad.id,
          nivel: 3 + ((indice + posicion) % 3),
          verificada: posicion === 0,
        },
      });
    }

    // Estadísticas sintéticas del juego principal.
    const partidas = 80 + Math.round(aleatorio() * 220);
    const winRate = Number((0.42 + aleatorio() * 0.24).toFixed(3));
    const victorias = Math.round(partidas * winRate);
    const kda = Number((1.6 + aleatorio() * 2.4).toFixed(2));

    const existente = await prisma.estadistica.findFirst({
      where: { jugadorId: jugador.id, juego: juego.nombre },
    });
    if (!existente) {
      await prisma.estadistica.create({
        data: {
          jugadorId: jugador.id,
          juego: juego.nombre,
          rol,
          partidas,
          victorias,
          kda,
          winRate,
          fuente: juego.fuente,
          metricas: {
            csPorMinuto: Number((5.5 + aleatorio() * 3).toFixed(2)),
            danoPorMinuto: Math.round(400 + aleatorio() * 500),
            visionScore: Math.round(20 + aleatorio() * 40),
          } satisfies Prisma.InputJsonObject,
        },
      });
      estadisticasCreadas += 1;
    }

    // Vector de características sintético (64 dimensiones).
    const dimensiones = Array.from(
      { length: PERFIL_VECTOR_DIMENSIONES },
      () => Number(aleatorio().toFixed(4)),
    );

    const vector = await prisma.perfilVector.upsert({
      where: { jugadorId: jugador.id },
      update: { dimensiones, version: PERFIL_VECTOR_VERSION },
      create: {
        jugadorId: jugador.id,
        dimensiones,
        version: PERFIL_VECTOR_VERSION,
      },
    });

    // La columna nativa de pgvector no la maneja Prisma: se escribe en SQL.
    await prisma.$executeRaw`
      UPDATE "PerfilVector"
      SET "embedding" = ${`[${dimensiones.join(",")}]`}::vector
      WHERE "id" = ${vector.id}
    `;
  }
  console.log(
    `  · ${NOMBRES_JUGADORES.length} jugadores con habilidades, ${estadisticasCreadas} series de estadísticas y vectores de ${PERFIL_VECTOR_DIMENSIONES} dimensiones`,
  );

  // ------------------------------------------------------------------ ofertas
  const ofertas = [
    {
      titulo: "Buscamos MID para academia de League of Legends",
      juego: "League of Legends",
      rol: "MID",
      rangoMinimo: "Diamante II",
      experienciaMinAnios: 1,
      region: "LAN",
      horasSemana: 25,
      descripcion:
        "Roster de academia con miras al circuito nacional. Entrenamientos de lunes a viernes y scrims los fines de semana.",
    },
    {
      titulo: "Duelista para roster principal de VALORANT",
      juego: "VALORANT",
      rol: "DUELISTA",
      rangoMinimo: "Inmortal I",
      experienciaMinAnios: 2,
      region: "LAS",
      horasSemana: 30,
      descripcion:
        "Buscamos duelista con experiencia en torneos regionales, buena comunicación y disponibilidad para bootcamp.",
    },
    {
      titulo: "AWPER para equipo de Counter-Strike 2",
      juego: "Counter-Strike 2",
      rol: "AWPER",
      rangoMinimo: "Faceit 8",
      experienciaMinAnios: 2,
      region: "LAN",
      horasSemana: 20,
      descripcion:
        "Proyecto a un año con objetivo de clasificar a las ligas abiertas. Se valora disposición a relocalizarse.",
    },
    {
      titulo: "Soporte para línea inferior de Dota 2",
      juego: "Dota 2",
      rol: "SOPORTE",
      rangoMinimo: "Divine",
      experienciaMinAnios: 1,
      region: "NA",
      horasSemana: 22,
      descripcion:
        "Equipo en formación busca soporte con buena lectura de mapa y experiencia en ligas amateur.",
    },
    {
      titulo: "IGL para división universitaria",
      juego: "Counter-Strike 2",
      rol: "IGL",
      rangoMinimo: "Faceit 6",
      experienciaMinAnios: 0,
      region: "LAN",
      horasSemana: 15,
      descripcion:
        "Programa universitario que busca un líder en juego para su plantel de primer año. Compatible con estudios.",
    },
  ];

  let ofertasCreadas = 0;
  for (const [indice, oferta] of ofertas.entries()) {
    const equipo = perfilesEquipo[indice % perfilesEquipo.length]!;
    const existente = await prisma.oferta.findFirst({
      where: { titulo: oferta.titulo, equipoId: equipo.id },
    });
    if (!existente) {
      await prisma.oferta.create({
        data: { ...oferta, equipoId: equipo.id, estado: "ABIERTA" },
      });
      ofertasCreadas += 1;
    }
  }
  console.log(`  · ${ofertasCreadas} ofertas abiertas`);

  console.log(
    `\nListo. Todas las cuentas de prueba usan la contraseña ${PASSWORD_DEMO}\n` +
      "  admin@proplay.gg (ADMIN) · scout@proplay.gg (SCOUT)\n" +
      "  equipo@caribeesports.gg (EQUIPO) · jugador1@proplay.gg … jugador15@proplay.gg (JUGADOR)",
  );
}

main()
  .catch((error) => {
    console.error("El seed falló:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });

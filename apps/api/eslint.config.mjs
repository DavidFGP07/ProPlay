import base from "../../eslint.config.base.mjs";

/** Lo que haría salir del proceso: red, colas, Redis o las integraciones externas. */
const RED = {
  paths: ["axios", "undici", "bullmq", "ioredis", "http", "https", "net", "node:http", "node:https", "node:net"],
  patterns: ["**/integrations", "**/integrations/**", "**/ingesta", "**/ingesta/**", "**/config/redis"],
};

export default [
  ...base,
  { ignores: ["dist/**", "prisma/migrations/**"] },
  {
    // RF-09 · El motor de matching sólo lee datos guardados: nunca llama a Riot
    // ni a nada por red (decisión «Motor de matching»). Lo comprueba también
    // tests/matching-sin-red.test.ts.
    files: ["src/modules/matching/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: RED.paths.map((name) => ({ name, message: "El motor de matching no hace llamadas de red." })),
          patterns: [{ group: RED.patterns, message: "El motor de matching no depende de integraciones, ingesta ni Redis." }],
        },
      ],
    },
  },
  {
    // Las funciones puras de motor/ tampoco tocan la base: sólo @proplay/shared y entre ellas.
    files: ["src/modules/matching/motor/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: RED.paths.map((name) => ({ name, message: "El motor de matching no hace llamadas de red." })),
          patterns: [
            {
              group: [...RED.patterns, "**/config/**", "@prisma/client", "../*", "../**"],
              message: "motor/ son funciones puras: sólo @proplay/shared y sus propios archivos.",
            },
          ],
        },
      ],
    },
  },
];

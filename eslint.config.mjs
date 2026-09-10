import base from "./eslint.config.base.mjs";

// Los workspaces se lintean con su propia configuración (npm run lint --workspaces).
// Esta configuración sólo cubre los archivos sueltos de la raíz.
export default [
  ...base,
  { ignores: ["apps/**", "packages/**"] },
];

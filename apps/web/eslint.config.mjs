import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import base from "../../eslint.config.base.mjs";

export default [
  ...base,
  { ignores: ["dist/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];

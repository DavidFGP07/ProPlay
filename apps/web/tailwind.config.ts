import type { Config } from "tailwindcss";

/**
 * Paleta de marca de ProPlay.
 * Cualquier color nuevo se declara aquí, no en clases arbitrarias.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primario: {
          DEFAULT: "#4C2FBF",
          50: "#EFEBFB",
          100: "#DAD1F6",
          200: "#B7A5ED",
          300: "#9279E3",
          400: "#6E4ED6",
          500: "#4C2FBF",
          600: "#3E2699",
          700: "#301D77",
          800: "#221454",
          900: "#150C33",
        },
        secundario: {
          DEFAULT: "#1F77B4",
          50: "#EAF4FB",
          100: "#CFE6F5",
          200: "#9FCDEB",
          300: "#6FB3E0",
          400: "#3F9AD6",
          500: "#1F77B4",
          600: "#195F90",
          700: "#13486C",
          800: "#0D3048",
          900: "#061824",
        },
        fondo: {
          DEFAULT: "#0F1117",
          elevado: "#171A23",
          borde: "#242833",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        marca: "0 10px 30px -12px rgba(76, 47, 191, 0.45)",
      },
    },
  },
  plugins: [],
} satisfies Config;

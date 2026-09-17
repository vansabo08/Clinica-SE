import type { Config } from "tailwindcss";

// Tokens da Clínica Sagrada Esperança.
// Teal como cor principal, Raleway em tudo, botões em pílula e cantos generosos.
// As cores de estado vivem só nos pontos e etiquetas de estado.
export default {
  // relative: os caminhos contam a partir deste ficheiro, mesmo que o
  // servidor seja lançado de outra pasta.
  content: { relative: true, files: ["./index.html", "./src/**/*.{ts,tsx}"] },
  theme: {
    extend: {
      colors: {
        esperanca: {
          DEFAULT: "#16837A",
          900: "#083B37",
          800: "#0C5751",
          700: "#106B64",
          400: "#3FA89F",
          300: "#7CCFC6",
          200: "#BDE5E0",
          100: "#DCF1EE",
          50: "#EEF8F6",
        },
        papel: "#F3F8F7",
        tinta: "#1A2B2A",
        grafite: "#5D6F6D",
        nevoa: "#8FA19E",
        linha: { DEFAULT: "#DFEAE7", forte: "#C7D8D4" },
        estado: {
          ambar: "#9A6212",
          "ambar-fundo": "#FBF1DE",
          verde: "#1C7A51",
          "verde-fundo": "#E1F2E8",
          azul: "#2A5CB5",
          "azul-fundo": "#E6EDFA",
          cinza: "#4B5A55",
          "cinza-fundo": "#ECF0EE",
          vermelho: "#B23A32",
          "vermelho-fundo": "#FAE9E6",
          escuro: "#2C3230",
          "escuro-fundo": "#E3E6E5",
        },
      },
      fontFamily: {
        sans: ['"Raleway Variable"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        // Os títulos usam a mesma família, mais pesada (ver index.css).
        serif: ['"Raleway Variable"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      // Escala clássica: 12 · 14 · 16 · 18 · 21 · 24 · 36 · 48
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.625rem" }],
        xl: ["1.3125rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "1.875rem" }],
        "3xl": ["2.25rem", { lineHeight: "2.5rem" }],
        "4xl": ["3rem", { lineHeight: "3.25rem" }],
      },
      borderRadius: {
        vaga: "12px",
        botao: "14px",
        cartao: "22px",
        senha: "24px",
        folha: "28px",
      },
      boxShadow: {
        suave: "0 1px 2px rgba(12, 87, 81, 0.04), 0 8px 24px rgba(12, 87, 81, 0.06)",
        flutua: "0 24px 60px rgba(12, 87, 81, 0.14), 0 2px 6px rgba(12, 87, 81, 0.06)",
        botao: "0 10px 24px rgba(22, 131, 122, 0.28)",
      },
      transitionTimingFunction: {
        suave: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;

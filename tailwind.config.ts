import type { Config } from "tailwindcss";

// Tokens da Clínica Sagrada Esperança.
// Uma só cor forte (o verde-esperança). As cores de estado vivem só nos
// pontos e etiquetas de estado — nunca como decoração.
export default {
  // relative: os caminhos contam a partir deste ficheiro, mesmo que o
  // servidor seja lançado de outra pasta.
  content: { relative: true, files: ["./index.html", "./src/**/*.{ts,tsx}"] },
  theme: {
    extend: {
      colors: {
        esperanca: {
          DEFAULT: "#0F5C4A",
          700: "#0B4B3C",
          800: "#083A2F",
          300: "#8CC0A9",
          200: "#C3DED1",
          100: "#E0EEE7",
          50: "#EEF6F2",
        },
        papel: "#F4F7F6",
        tinta: "#1A2622",
        grafite: "#5B6A65",
        nevoa: "#8A9793",
        linha: { DEFAULT: "#DFE7E3", forte: "#C8D4CF" },
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
        sans: ['"Atkinson Hyperlegible Next Variable"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        serif: ['"Newsreader Variable"', "Georgia", "Cambria", "serif"],
      },
      // Escala clássica (Bringhurst): 12 · 14 · 16 · 18 · 21 · 24 · 36 · 48
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
        vaga: "10px",
        botao: "12px",
        cartao: "16px",
        senha: "20px",
        folha: "24px",
      },
      boxShadow: {
        suave: "0 1px 2px rgba(16, 42, 35, 0.04), 0 6px 20px rgba(16, 42, 35, 0.04)",
        flutua: "0 10px 40px rgba(16, 42, 35, 0.10), 0 1px 3px rgba(16, 42, 35, 0.06)",
        botao: "0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 18px rgba(15, 92, 74, 0.22)",
      },
      transitionTimingFunction: {
        suave: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;

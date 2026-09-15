import { fileURLToPath } from "node:url";

export default {
  plugins: {
    // Caminho explícito: lançado de outra pasta, o Tailwind apanharia outra configuração.
    tailwindcss: { config: fileURLToPath(new URL("./tailwind.config.ts", import.meta.url)) },
    autoprefixer: {},
  },
};

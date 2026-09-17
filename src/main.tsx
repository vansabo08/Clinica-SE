import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/raleway";
import "./index.css";
import { iniciarRepositorio } from "./lib/dados";
import { App } from "./App";

const raiz = createRoot(document.getElementById("raiz")!);

iniciarRepositorio().then(
  () =>
    raiz.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  (erro: unknown) => {
    console.error(erro);
    document.getElementById("raiz")!.textContent = "Não foi possível abrir a aplicação. Recarregue a página.";
  },
);

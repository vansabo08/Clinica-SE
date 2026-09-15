import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Botao, BotaoIcone, cx } from "./ui";

/**
 * Folha: sobe do fundo no telemóvel, aparece ao centro (ou encostada à
 * direita, com lado="direita") em ecrãs largos.
 */
export function Folha({
  aberta,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  largura = "md",
  lado = "centro",
  antesDoTitulo,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: "sm" | "md" | "lg" | "xl";
  lado?: "centro" | "direita";
  antesDoTitulo?: ReactNode;
}) {
  const idTitulo = useId();
  const painel = useRef<HTMLDivElement>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    if (!aberta) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const primeiro = painel.current?.querySelector<HTMLElement>("[data-autofocus], input, select, textarea");
    (primeiro ?? painel.current)?.focus({ preventScroll: true });

    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        fechar.current();
      }
      if (e.key !== "Tab" || !painel.current) return;
      const focaveis = painel.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focaveis.length) return;
      const [p, u] = [focaveis[0], focaveis[focaveis.length - 1]];
      if (e.shiftKey && document.activeElement === p) {
        e.preventDefault();
        u.focus();
      } else if (!e.shiftKey && document.activeElement === u) {
        e.preventDefault();
        p.focus();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
      anterior?.focus?.({ preventScroll: true });
    };
  }, [aberta]);

  if (!aberta) return null;

  const larguras = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" }[largura];

  return createPortal(
    <div className={cx("fixed inset-0 z-50 flex items-end justify-center", lado === "direita" ? "sm:items-stretch sm:justify-end" : "sm:items-center sm:p-6")}>
      <div className="anim-aparecer absolute inset-0 bg-[#0c1d18]/30" onClick={aoFechar} aria-hidden="true" />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={cx(
          "relative flex max-h-[92dvh] w-full flex-col bg-white shadow-flutua outline-none",
          "anim-subir rounded-t-folha",
          lado === "direita" ? "sm:anim-deslizar sm:h-full sm:max-h-none sm:rounded-none sm:rounded-l-folha" : "sm:anim-surgir sm:rounded-folha",
          larguras,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-linha-forte sm:hidden" aria-hidden="true" />
        <header className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-4 sm:px-6 sm:pt-6">
          <div className="min-w-0 flex-1">
            {antesDoTitulo}
            <h2 id={idTitulo} className="font-serif text-2xl leading-tight text-tinta">
              {titulo}
            </h2>
            {descricao && <div className="mt-1 text-sm text-grafite">{descricao}</div>}
          </div>
          <BotaoIcone rotulo="Fechar" onClick={aoFechar} className="-mr-2 -mt-1">
            <X />
          </BotaoIcone>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
        {rodape && <footer className="shrink-0 border-t border-linha px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-5">{rodape}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Confirmacao({
  aberta,
  aoFechar,
  titulo,
  texto,
  confirmar,
  voltar = "Voltar",
  perigo,
  aCarregar,
  aoConfirmar,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  texto?: ReactNode;
  confirmar: string;
  voltar?: string;
  perigo?: boolean;
  aCarregar?: boolean;
  aoConfirmar: () => void;
}) {
  return (
    <Folha
      aberta={aberta}
      aoFechar={aoFechar}
      titulo={titulo}
      largura="sm"
      rodape={
        <div className="grid grid-cols-2 gap-2">
          <Botao variante="secundario" tamanho="lg" onClick={aoFechar} data-autofocus>
            {voltar}
          </Botao>
          <Botao variante={perigo ? "perigo" : "primario"} tamanho="lg" onClick={aoConfirmar} aCarregar={aCarregar}>
            {confirmar}
          </Botao>
        </div>
      }
    >
      {texto && <div className="text-grafite">{texto}</div>}
    </Folha>
  );
}

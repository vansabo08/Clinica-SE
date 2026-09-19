import { X } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { destinoNotificacao, type Chegada } from "../lib/notificacoes";
import type { Papel } from "../lib/tipos";
import { ICONES_NOTIFICACAO } from "./icones";
import { cx } from "./ui";

/** O cartão que desce do topo quando chega um aviso novo. */
export function AvisoChegada({ chegada, papel, aoFechar }: { chegada: Chegada | null; papel: Papel | undefined; aoFechar: () => void }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!chegada) return;
    const t = setTimeout(aoFechar, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chegada?.chave]);

  if (!chegada) return null;
  const { n, mais } = chegada;
  const Icone = ICONES_NOTIFICACAO[n.tipo];
  const alerta = n.tipo === "cancelamento";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-[max(12px,env(safe-area-inset-top))] lg:justify-end lg:px-6 lg:pt-6">
      <div key={chegada.chave} role="status" aria-live="polite" className="anim-chegar pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-[24px] bg-white shadow-flutua ring-1 ring-linha">
        <button
          type="button"
          onClick={() => {
            aoFechar();
            navigate(mais > 0 ? destinoNotificacao({ consultaId: null }, papel) : destinoNotificacao(n, papel));
          }}
          className="flex w-full items-start gap-3 p-4 pr-12 text-left"
        >
          <span className={cx("relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white", alerta ? "bg-estado-vermelho" : "bg-esperanca")}>
            <span className={cx("anim-onda absolute inset-0 rounded-full", alerta ? "bg-estado-vermelho" : "bg-esperanca")} aria-hidden="true" />
            <Icone className="anim-sino relative h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold leading-6 text-tinta">{n.titulo}</span>
            <span className="mt-0.5 line-clamp-2 block text-sm text-grafite">{n.corpo}</span>
            <span className="mt-2 block text-sm font-semibold text-esperanca">{mais > 0 ? `Ver os ${mais + 1} avisos novos` : n.consultaId ? "Ver consulta" : "Ver avisos"}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar aviso"
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-grafite transition-colors hover:bg-papel hover:text-tinta"
        >
          <X className="h-4 w-4" />
        </button>
        {/* O tempo que falta até fechar sozinho. */}
        <span className="anim-esvaziar absolute inset-x-0 bottom-0 h-1 origin-left bg-esperanca/70" aria-hidden="true" />
      </div>
    </div>
  );
}

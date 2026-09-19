import { Bell, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ICONES_NOTIFICACAO } from "../componentes/icones";
import { Pagina } from "../componentes/Shell";
import { Botao, CabecalhoPagina, Esqueleto, Vazio, cx } from "../componentes/ui";
import { repo } from "../lib/dados";
import { useSessao } from "../lib/sessao";
import { destinoNotificacao } from "../lib/notificacoes";
import { definirSom, somLigado, tocarNotificacao } from "../lib/som";
import { haQuanto } from "../lib/tempo";
import type { Notificacao } from "../lib/tipos";
import { useAgora, useDados } from "../lib/usarDados";

function BotaoSom() {
  const [ligado, setLigado] = useState(somLigado);
  return (
    <Botao
      variante="secundario"
      tamanho="sm"
      aria-pressed={ligado}
      icone={ligado ? <Volume2 /> : <VolumeX />}
      onClick={() => {
        definirSom(!ligado);
        setLigado(!ligado);
        if (!ligado) tocarNotificacao(true);
      }}
    >
      {ligado ? "Som ligado" : "Som desligado"}
    </Botao>
  );
}

export function Notificacoes() {
  const { utilizador } = useSessao();
  const navigate = useNavigate();
  const agora = useAgora(60_000);
  const { dados } = useDados((r) => r.notificacoes(), [], ["notificacoes"]);
  const paciente = utilizador?.papel === "paciente";

  // Ao abrir, dá-se tudo como lido — mas o destaque fica até sair da página.
  const porLer = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!dados || porLer.current) return;
    porLer.current = new Set(dados.filter((n) => !n.lidaEm).map((n) => n.id));
    if (porLer.current.size === 0) return;
    const t = setTimeout(() => repo().marcarLida().catch(() => undefined), 1200);
    return () => clearTimeout(t);
  }, [dados]);

  const abrirConsulta = (n: Notificacao) => navigate(destinoNotificacao(n, utilizador?.papel));
  const novas = porLer.current?.size ?? dados?.filter((n) => !n.lidaEm).length ?? 0;

  return (
    <Pagina largura="estreita">
      <CabecalhoPagina titulo="Notificações" texto={dados ? (novas ? `${novas} ${novas === 1 ? "nova" : "novas"}` : "Está tudo visto.") : undefined} accoes={<BotaoSom />} />

      {!dados ? (
        <Esqueleto className="h-72" />
      ) : dados.length === 0 ? (
        <div className="cartao">
          <Vazio icone={<Bell />} titulo="Sem notificações" texto={
              paciente
                ? "Lembretes, confirmações e vagas que abrirem aparecem aqui."
                : utilizador?.papel === "medico"
                  ? "As consultas novas, reagendadas e canceladas da sua agenda aparecem aqui."
                  : "As marcações feitas pela aplicação aparecem aqui."
            } />
        </div>
      ) : (
        <ul className="cartao anim-lista divide-y divide-linha overflow-hidden">
          {dados.map((n) => {
            const Icone = ICONES_NOTIFICACAO[n.tipo];
            const nova = porLer.current?.has(n.id) ?? !n.lidaEm;
            const vagaViva = n.tipo === "vaga" && paciente && n.dados?.inicio && Date.parse(n.dados.inicio) > agora.getTime();
            return (
              <li key={n.id} className={cx("flex gap-3 px-4 py-4 sm:px-5", nova && "bg-esperanca-50/60")}>
                <span
                  className={cx(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    n.tipo === "vaga" ? "bg-esperanca text-white" : n.tipo === "cancelamento" ? "bg-estado-vermelho-fundo text-estado-vermelho" : "bg-white text-esperanca ring-1 ring-linha",
                  )}
                >
                  <Icone className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-bold text-tinta">
                      {nova && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-esperanca align-middle" aria-label="Nova" />}
                      {n.titulo}
                    </p>
                    <time dateTime={n.agendadaPara} className="shrink-0 text-xs text-grafite">
                      {haQuanto(n.agendadaPara, agora)}
                    </time>
                  </div>
                  <p className="mt-0.5 text-grafite">{n.corpo}</p>
                  {vagaViva ? (
                    <Botao tamanho="sm" className="mt-3" onClick={() => navigate(`/marcar?medico=${n.dados!.medicoId}&inicio=${encodeURIComponent(n.dados!.inicio!)}&vaga=${n.id}`)}>
                      Marcar esta vaga
                    </Botao>
                  ) : (
                    n.consultaId && (
                      <button type="button" onClick={() => abrirConsulta(n)} className="mt-2 text-sm font-semibold text-esperanca underline-offset-4 hover:underline">
                        Ver consulta
                      </button>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Pagina>
  );
}

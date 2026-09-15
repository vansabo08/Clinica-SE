import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { DetalheConsulta } from "../../componentes/agenda/DetalheConsulta";
import { Pagina } from "../../componentes/Shell";
import { Botao, BotaoIcone, CabecalhoPagina, Esqueleto, cx } from "../../componentes/ui";
import { BORDA_ESTADO, ESTADOS, MOTIVOS_BLOQUEIO } from "../../lib/estados";
import { useUtilizador } from "../../lib/sessao";
import { DIAS_SEMANA, dataCurta, diaDaSemana, diaDe, hoje, horaDe, inicioDaSemana, instanteISO, mesAno, somarDias } from "../../lib/tempo";
import { plural } from "../../lib/texto";
import { useAgora, useDados } from "../../lib/usarDados";

const LISTRAS = "repeating-linear-gradient(135deg, #E6EBE9 0 6px, #F4F7F5 6px 12px)";

export function AgendaMedico() {
  const u = useUtilizador();
  const agora = useAgora(60_000);
  const hojeD = hoje(agora);
  const [inicio, setInicio] = useState(inicioDaSemana(hojeD));
  const [consultaId, setConsultaId] = useState<string | null>(null);

  const intervalo = { de: instanteISO(inicio, "00:00"), ate: instanteISO(somarDias(inicio, 7), "00:00") };
  const { dados: consultas } = useDados((r) => r.consultas({ medicoId: u.medicoId!, ...intervalo }), [inicio], ["consultas"]);
  const { dados: horarios } = useDados((r) => r.horarios(u.medicoId!), [], ["horarios"]);
  const { dados: bloqueios } = useDados((r) => r.bloqueios({ medicoId: u.medicoId!, ...intervalo }), [inicio], ["bloqueios"]);

  const trabalha = (d: string) => (horarios ?? []).some((h) => h.diaSemana === diaDaSemana(d));
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i)).filter((d) => {
    const ds = diaDaSemana(d);
    return (ds >= 1 && ds <= 5) || trabalha(d) || (consultas ?? []).some((c) => diaDe(c.inicio) === d);
  });
  const fim = somarDias(inicio, 6);
  const titulo = inicio.slice(0, 7) === fim.slice(0, 7) ? `${Number(inicio.slice(8))} a ${Number(fim.slice(8))} ${mesAno(fim)}` : `${dataCurta(inicio)} a ${dataCurta(fim)}`;

  return (
    <Pagina largura="larga">
      <CabecalhoPagina titulo="A minha agenda" />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="-ml-2 flex items-center">
          <BotaoIcone rotulo="Semana anterior" onClick={() => setInicio(somarDias(inicio, -7))}>
            <ChevronLeft />
          </BotaoIcone>
          <BotaoIcone rotulo="Semana seguinte" onClick={() => setInicio(somarDias(inicio, 7))}>
            <ChevronRight />
          </BotaoIcone>
        </div>
        <p className="text-xl font-bold text-tinta">{titulo}</p>
        {inicio !== inicioDaSemana(hojeD) && (
          <Botao variante="secundario" tamanho="sm" onClick={() => setInicio(inicioDaSemana(hojeD))}>
            Esta semana
          </Botao>
        )}
      </div>

      {!consultas || !horarios || !bloqueios ? (
        <Esqueleto className="h-96" />
      ) : (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          {dias.map((d) => {
            const doDia = consultas.filter((c) => diaDe(c.inicio) === d && c.estado !== "cancelada");
            const bloqueiosDia = bloqueios.filter((b) => diaDe(b.inicio) <= d && d <= diaDe(new Date(Date.parse(b.fim) - 1).toISOString()));
            const itens = [...doDia.map((c) => ({ tipo: "c" as const, inicio: c.inicio, c })), ...bloqueiosDia.map((b) => ({ tipo: "b" as const, inicio: b.inicio, b }))].sort((a, b) =>
              a.inicio.localeCompare(b.inicio),
            );
            return (
              <section key={d} className={cx("cartao flex flex-col overflow-hidden", d === hojeD && "border-esperanca-300 ring-2 ring-esperanca/15")} aria-label={`${DIAS_SEMANA[diaDaSemana(d)]}, ${dataCurta(d)}`}>
                <header className="border-b border-linha px-3.5 py-2.5">
                  <p className={cx("text-xs font-semibold", d === hojeD ? "text-esperanca" : "text-grafite")}>{d === hojeD ? "Hoje" : DIAS_SEMANA[diaDaSemana(d)]}</p>
                  <p className="num text-lg font-bold leading-6 text-tinta">{dataCurta(d)}</p>
                  <p className="text-xs text-grafite">{trabalha(d) || doDia.length ? plural(doDia.length, "consulta", "consultas") : "Não atende"}</p>
                </header>
                <ul className="flex-1 space-y-1.5 p-2">
                  {itens.map((i) =>
                    i.tipo === "c" ? (
                      <li key={i.c.id}>
                        <button
                          type="button"
                          onClick={() => setConsultaId(i.c.id)}
                          title={ESTADOS[i.c.estado].rotulo}
                          className={cx("w-full rounded-[10px] border-l-[3px] px-2.5 py-1.5 text-left transition-shadow hover:shadow-suave", ESTADOS[i.c.estado].etiqueta, BORDA_ESTADO[i.c.estado])}
                        >
                          <span className="num block text-xs font-bold">{horaDe(i.c.inicio)}</span>
                          <span className="block truncate text-sm font-semibold text-tinta">{i.c.paciente.nome}</span>
                        </button>
                      </li>
                    ) : (
                      <li key={i.b.id} className="rounded-[10px] px-2.5 py-1.5 text-xs font-semibold text-grafite" style={{ backgroundImage: LISTRAS }}>
                        {MOTIVOS_BLOQUEIO[i.b.motivo]}
                        {horaDe(i.b.inicio) !== "00:00" && (
                          <span className="num block font-normal">
                            {horaDe(i.b.inicio)} às {horaDe(i.b.fim)}
                          </span>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <DetalheConsulta consultaId={consultaId} aoFechar={() => setConsultaId(null)} papel="medico" />
    </Pagina>
  );
}

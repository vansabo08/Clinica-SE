import { CalendarPlus, History, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Pagina } from "../../componentes/Shell";
import { Botao, CabecalhoPagina, Esqueleto, EtiquetaEstado, Segmentado, Vazio, cx } from "../../componentes/ui";
import { ESTADOS_ALTERAVEIS } from "../../lib/estados";
import { primeiroNome } from "../../lib/sessao";
import { dataCurta, diaDe, horaDe, mesAno } from "../../lib/tempo";
import type { ConsultaDetalhada } from "../../lib/tipos";
import { useAgora, useDados } from "../../lib/usarDados";

export function LinhaConsulta({ c, para }: { c: ConsultaDetalhada; para: string }) {
  const riscada = c.estado === "cancelada";
  return (
    <Link to={para} className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-esperanca-50/60 sm:px-5">
      <div className="w-[3.75rem] shrink-0 text-center">
        <p className={cx("num text-xl font-bold leading-6", riscada ? "text-grafite line-through" : "text-tinta")}>{horaDe(c.inicio)}</p>
        <p className="text-xs font-semibold text-grafite">{dataCurta(diaDe(c.inicio))}</p>
      </div>
      <span className="h-10 w-px shrink-0 bg-linha" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-tinta">
          {c.medico.titulo} {c.medico.nome}
        </p>
        <p className="truncate text-sm text-grafite">
          {c.especialidade.nome}
          {c.parentesco ? `, para ${primeiroNome(c.paciente.nome)}` : ""}
        </p>
        <EtiquetaEstado estado={c.estado} curto className="mt-1.5 sm:hidden" />
      </div>
      <EtiquetaEstado estado={c.estado} className="hidden sm:inline-flex" />
    </Link>
  );
}

export function Consultas() {
  const navigate = useNavigate();
  const agora = useAgora(60_000);
  const [aba, setAba] = useState<"proximas" | "historico">("proximas");
  const { dados } = useDados((r) => r.consultas(), [], ["consultas"]);

  const eProxima = (c: ConsultaDetalhada) => c.estado === "em_atendimento" || (ESTADOS_ALTERAVEIS.includes(c.estado) && Date.parse(c.fim) > agora.getTime());
  const proximas = dados?.filter(eProxima) ?? [];
  const historico = (dados?.filter((c) => !eProxima(c)) ?? []).reverse();

  const meses = new Map<string, ConsultaDetalhada[]>();
  for (const c of historico) {
    const m = mesAno(diaDe(c.inicio));
    meses.set(m, [...(meses.get(m) ?? []), c]);
  }

  return (
    <Pagina largura="estreita">
      <CabecalhoPagina
        titulo="Minhas consultas"
        accoes={
          <Botao className="hidden sm:inline-flex" icone={<Plus className="h-5 w-5" />} onClick={() => navigate("/marcar")}>
            Marcar consulta
          </Botao>
        }
      />
      <Segmentado
        rotulo="Mostrar"
        larguraTotal
        className="sm:inline-flex sm:w-auto"
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { valor: "proximas", rotulo: <>Próximas {dados && <span className="num ml-1 text-grafite">{proximas.length}</span>}</> },
          { valor: "historico", rotulo: "Histórico" },
        ]}
      />

      <div className="mt-5">
        {!dados ? (
          <Esqueleto className="h-64" />
        ) : aba === "proximas" ? (
          proximas.length ? (
            <ul className="cartao divide-y divide-linha overflow-hidden">
              {proximas.map((c) => (
                <li key={c.id}>
                  <LinhaConsulta c={c} para={`/consultas/${c.id}`} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="cartao">
              <Vazio icone={<CalendarPlus />} titulo="Sem consultas marcadas" texto="Quando marcar uma consulta, ela aparece aqui com o dia, a hora e o estado.">
                <Botao onClick={() => navigate("/marcar")}>Marcar consulta</Botao>
              </Vazio>
            </div>
          )
        ) : historico.length ? (
          <div className="space-y-6">
            {[...meses.entries()].map(([mes, lista]) => (
              <section key={mes}>
                <h2 className="mb-2 text-sm font-semibold text-grafite">{mes}</h2>
                <ul className="cartao divide-y divide-linha overflow-hidden">
                  {lista.map((c) => (
                    <li key={c.id}>
                      <LinhaConsulta c={c} para={`/consultas/${c.id}`} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="cartao">
            <Vazio icone={<History />} titulo="Ainda sem histórico" texto="As consultas que já passaram, as canceladas e as faltas ficam guardadas aqui." />
          </div>
        )}
      </div>
    </Pagina>
  );
}

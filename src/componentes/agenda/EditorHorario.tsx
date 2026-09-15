import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { repo } from "../../lib/dados";
import { DIAS_SEMANA, horaDeMinutos, minutosDe } from "../../lib/tempo";
import { useDados } from "../../lib/usarDados";
import { mensagemDeErro, useAviso } from "../Aviso";
import { Botao, BotaoIcone, Esqueleto, cx } from "../ui";

const ORDEM = [1, 2, 3, 4, 5, 6, 0]; // a semana da clínica começa à segunda
type Periodo = { inicio: string; fim: string };

const campoHora =
  "num h-10 w-[6.5rem] rounded-[10px] border border-linha-forte bg-white px-2.5 font-semibold text-tinta focus:border-esperanca focus:outline-none focus:ring-4 focus:ring-esperanca/10";

export function Alternar({ ligado, aoMudar, rotulo }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={() => aoMudar(!ligado)}
      className={cx("relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200", ligado ? "bg-esperanca" : "bg-linha-forte")}
    >
      <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-suave", ligado ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

/** Horário semanal de um médico: dias em que atende e períodos de cada dia. */
export function EditorHorario({ medicoId, podeEditar }: { medicoId: string; podeEditar: boolean }) {
  const avisar = useAviso();
  const { dados } = useDados((r) => r.horarios(medicoId), [medicoId], ["horarios"]);

  const guardado = useMemo(() => {
    const m: Record<number, Periodo[]> = Object.fromEntries(ORDEM.map((d) => [d, []]));
    for (const h of dados ?? []) m[h.diaSemana].push({ inicio: h.inicio, fim: h.fim });
    for (const d of ORDEM) m[d].sort((a, b) => a.inicio.localeCompare(b.inicio));
    return m;
  }, [dados]);

  const [rascunho, setRascunho] = useState<Record<number, Periodo[]> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const valor = rascunho ?? guardado;
  const sujo = rascunho !== null && JSON.stringify(rascunho) !== JSON.stringify(guardado);

  const mudarDia = (d: number, lista: Periodo[]) => {
    setRascunho({ ...valor, [d]: lista });
    setErro(null);
  };

  async function guardar() {
    setAGuardar(true);
    setErro(null);
    try {
      await repo().guardarHorarios(
        medicoId,
        ORDEM.flatMap((d) => valor[d].map((p) => ({ diaSemana: d, ...p }))),
      );
      setRascunho(null);
      avisar("Horário guardado. As vagas já seguem o novo horário.");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setAGuardar(false);
    }
  }

  if (!dados) return <Esqueleto className="h-80" />;

  return (
    <div>
      <ul className="divide-y divide-linha">
        {ORDEM.map((d) => {
          const lista = valor[d];
          const atende = lista.length > 0;
          return (
            <li key={d} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex items-center gap-3 sm:h-10 sm:w-36">
                {podeEditar && <Alternar ligado={atende} rotulo={`Atende ${DIAS_SEMANA[d].toLowerCase()}`} aoMudar={(v) => mudarDia(d, v ? [{ inicio: "08:00", fim: "17:00" }] : [])} />}
                <span className={cx("font-bold", atende ? "text-tinta" : "text-grafite")}>{DIAS_SEMANA[d]}</span>
              </div>
              <div className="flex-1 space-y-2">
                {!atende ? (
                  <p className="text-grafite sm:leading-10">Não atende</p>
                ) : (
                  lista.map((p, i) =>
                    podeEditar ? (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          step={900}
                          aria-label={`${DIAS_SEMANA[d]}, início do período ${i + 1}`}
                          value={p.inicio}
                          onChange={(e) => mudarDia(d, lista.map((x, j) => (j === i ? { ...x, inicio: e.target.value } : x)))}
                          className={campoHora}
                        />
                        <span className="text-grafite">às</span>
                        <input
                          type="time"
                          step={900}
                          aria-label={`${DIAS_SEMANA[d]}, fim do período ${i + 1}`}
                          value={p.fim}
                          onChange={(e) => mudarDia(d, lista.map((x, j) => (j === i ? { ...x, fim: e.target.value } : x)))}
                          className={campoHora}
                        />
                        <BotaoIcone rotulo="Remover período" onClick={() => mudarDia(d, lista.filter((_, j) => j !== i))}>
                          <X />
                        </BotaoIcone>
                      </div>
                    ) : (
                      <p key={i} className="num font-semibold text-tinta sm:leading-10">
                        {p.inicio} às {p.fim}
                      </p>
                    ),
                  )
                )}
                {atende && podeEditar && lista.length < 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      const ultimo = lista[lista.length - 1];
                      const inicio = horaDeMinutos(Math.min(minutosDe(ultimo.fim) + 60, 21 * 60));
                      mudarDia(d, [...lista, { inicio, fim: horaDeMinutos(Math.min(minutosDe(inicio) + 180, 23 * 60)) }]);
                    }}
                    className="inline-flex items-center gap-1 rounded-botao text-sm font-semibold text-esperanca hover:underline"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Acrescentar período
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {erro && (
        <p role="alert" className="mt-3 rounded-botao bg-estado-vermelho-fundo px-3.5 py-3 text-sm font-semibold text-estado-vermelho">
          {erro}
        </p>
      )}
      {podeEditar && sujo && (
        <div className="vidro anim-surgir sticky bottom-24 z-10 mt-4 flex flex-wrap items-center justify-end gap-2 rounded-cartao p-3 lg:bottom-4">
          <p className="mr-auto px-1 text-sm font-semibold text-tinta">Alterações por guardar</p>
          <Botao
            variante="fantasma"
            onClick={() => {
              setRascunho(null);
              setErro(null);
            }}
          >
            Descartar
          </Botao>
          <Botao onClick={guardar} aCarregar={aGuardar}>
            Guardar horário
          </Botao>
        </div>
      )}
    </div>
  );
}

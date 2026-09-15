import { ArrowDown, ArrowUp, Pencil, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { Confirmacao, Folha } from "../../componentes/Folha";
import { ICONES_ESPECIALIDADE, IconeEspecialidade } from "../../componentes/icones";
import { Pagina } from "../../componentes/Shell";
import { Botao, BotaoIcone, CabecalhoPagina, Campo, Esqueleto, cx } from "../../componentes/ui";
import type { DadosEspecialidade } from "../../lib/dados/repositorio";
import { repo } from "../../lib/dados";
import { plural } from "../../lib/texto";
import type { Especialidade } from "../../lib/tipos";
import { useDados } from "../../lib/usarDados";

export function Especialidades() {
  const avisar = useAviso();
  const { dados } = useDados(
    async (r) => {
      const [especialidades, medicos] = await Promise.all([r.especialidades(), r.medicos()]);
      return { especialidades, medicos };
    },
    [],
    ["especialidades", "medicos"],
  );
  const [form, setForm] = useState<DadosEspecialidade | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [aRemover, setARemover] = useState<Especialidade | null>(null);
  const [aApagar, setAApagar] = useState(false);

  async function guardar() {
    if (!form) return;
    setAGuardar(true);
    setErro(null);
    try {
      await repo().guardarEspecialidade(form);
      avisar(form.id ? "Especialidade guardada." : `${form.nome.trim()} já aparece aos pacientes.`);
      setForm(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setAGuardar(false);
    }
  }

  async function mover(lista: Especialidade[], i: number, delta: -1 | 1) {
    const a = lista[i];
    const b = lista[i + delta];
    if (!a || !b) return;
    try {
      await repo().guardarEspecialidade({ ...a, ordem: b.ordem });
      await repo().guardarEspecialidade({ ...b, ordem: a.ordem });
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
    }
  }

  async function remover() {
    if (!aRemover) return;
    setAApagar(true);
    try {
      await repo().removerEspecialidade(aRemover.id);
      avisar(`${aRemover.nome} deixou de aparecer aos pacientes.`);
      setARemover(null);
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
      setARemover(null);
    } finally {
      setAApagar(false);
    }
  }

  const lista = dados?.especialidades ?? [];

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Especialidades"
        texto="O primeiro passo da marcação. Os pacientes vêem-nas por esta ordem."
        accoes={
          <Botao icone={<Plus className="h-5 w-5" />} onClick={() => setForm({ nome: "", descricao: "", icone: "estetoscopio", ordem: lista.length ? Math.max(...lista.map((e) => e.ordem)) + 1 : 0, activa: true })}>
            Nova especialidade
          </Botao>
        }
      />

      {!dados ? (
        <Esqueleto className="h-96" />
      ) : (
        <ul className="cartao divide-y divide-linha overflow-hidden">
          {lista.map((e, i) => {
            const n = dados.medicos.filter((m) => m.especialidadeId === e.id && m.activo).length;
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-esperanca-50 text-esperanca">
                  <IconeEspecialidade icone={e.icone} className="h-[22px] w-[22px]" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-tinta">{e.nome}</p>
                  <p className="truncate text-sm text-grafite">{e.descricao}</p>
                </div>
                <span className={cx("hidden whitespace-nowrap text-sm sm:block", n ? "text-grafite" : "font-semibold text-estado-ambar")}>{n ? plural(n, "médico", "médicos") : "Sem médicos"}</span>
                <div className="flex shrink-0 items-center">
                  <BotaoIcone rotulo={`Subir ${e.nome}`} disabled={i === 0} onClick={() => mover(lista, i, -1)} className="hidden sm:inline-flex">
                    <ArrowUp />
                  </BotaoIcone>
                  <BotaoIcone rotulo={`Descer ${e.nome}`} disabled={i === lista.length - 1} onClick={() => mover(lista, i, 1)} className="hidden sm:inline-flex">
                    <ArrowDown />
                  </BotaoIcone>
                  <BotaoIcone rotulo={`Editar ${e.nome}`} onClick={() => setForm({ ...e })}>
                    <Pencil />
                  </BotaoIcone>
                  <BotaoIcone rotulo={`Remover ${e.nome}`} onClick={() => setARemover(e)}>
                    <Trash />
                  </BotaoIcone>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Folha
        aberta={!!form}
        aoFechar={() => setForm(null)}
        titulo={form?.id ? "Editar especialidade" : "Nova especialidade"}
        largura="sm"
        rodape={
          <Botao tamanho="lg" larguraTotal onClick={guardar} aCarregar={aGuardar}>
            {form?.id ? "Guardar" : "Criar especialidade"}
          </Botao>
        }
      >
        {form && (
          <div className="space-y-5">
            <Campo rotulo="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoComplete="off" />
            <Campo rotulo="Descrição" value={form.descricao} maxLength={70} onChange={(e) => setForm({ ...form, descricao: e.target.value })} dica="Uma linha, por baixo do nome. Por exemplo: coração, tensão arterial e circulação." />
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-tinta">Ícone</legend>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(ICONES_ESPECIALIDADE).map(([chave, { rotulo }]) => {
                  const activo = form.icone === chave;
                  return (
                    <button
                      key={chave}
                      type="button"
                      aria-pressed={activo}
                      aria-label={rotulo}
                      title={rotulo}
                      onClick={() => setForm({ ...form, icone: chave })}
                      className={cx("flex h-14 items-center justify-center rounded-botao border transition-colors", activo ? "border-esperanca bg-esperanca text-white" : "border-linha-forte bg-white text-esperanca hover:border-esperanca-300")}
                    >
                      <IconeEspecialidade icone={chave} className="h-6 w-6" strokeWidth={1.8} />
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {erro && (
              <p role="alert" className="text-sm font-semibold text-estado-vermelho">
                {erro}
              </p>
            )}
          </div>
        )}
      </Folha>

      <Confirmacao
        aberta={!!aRemover}
        aoFechar={() => setARemover(null)}
        titulo={`Remover ${aRemover?.nome ?? ""}?`}
        texto="Deixa de aparecer aos pacientes. O histórico de consultas mantém-se."
        confirmar="Remover especialidade"
        perigo
        aCarregar={aApagar}
        aoConfirmar={remover}
      />
    </Pagina>
  );
}

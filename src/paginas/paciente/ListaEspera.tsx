import { CalendarDays, Hourglass, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { Folha } from "../../componentes/Folha";
import { Pagina } from "../../componentes/Shell";
import { Botao, CabecalhoPagina, Campo, Esqueleto, Seleccao, Vazio, cx } from "../../componentes/ui";
import { repo } from "../../lib/dados";
import { primeiroNome, useUtilizador } from "../../lib/sessao";
import { diaRelativo, hoje, horaDe, somarDias } from "../../lib/tempo";
import { useAgora, useDados } from "../../lib/usarDados";

export function ListaEsperaPaciente() {
  const u = useUtilizador();
  const navigate = useNavigate();
  const avisar = useAviso();
  const agora = useAgora(60_000);
  const [params, setParams] = useSearchParams();

  const { dados: lista } = useDados((r) => r.listaEspera(), [], ["espera"]);
  const { dados: notificacoes } = useDados((r) => r.notificacoes(), [], ["notificacoes"]);
  const { dados: base } = useDados(
    async (r) => {
      const [especialidades, medicos, familiares] = await Promise.all([r.especialidades(), r.medicos(), r.familiares()]);
      return { especialidades, medicos, familiares };
    },
    [],
    ["especialidades", "medicos", "familiares"],
  );

  const aberta = params.get("nova") === "1";
  const [form, setForm] = useState({ pacienteId: "", especialidadeId: "", medicoId: "", dia: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    setForm({
      pacienteId: params.get("para") ?? u.pacienteId ?? "",
      especialidadeId: params.get("especialidade") ?? "",
      medicoId: params.get("medico") ?? "",
      dia: params.get("dia") ?? somarDias(hoje(), 1),
    });
    setErro(null);
  }, [aberta, params, u.pacienteId]);

  const fechar = () => setParams({}, { replace: true });

  async function guardar() {
    if (!form.especialidadeId) return setErro("Escolha a especialidade.");
    if (!form.dia || form.dia < hoje()) return setErro("Escolha uma data de hoje em diante.");
    setAGuardar(true);
    try {
      await repo().entrarListaEspera({ pacienteId: form.pacienteId || u.pacienteId!, especialidadeId: form.especialidadeId, medicoId: form.medicoId || null, dataDesejada: form.dia });
      fechar();
      avisar("Está na lista de espera. Avisamos assim que abrir uma vaga.");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setAGuardar(false);
    }
  }

  const hojeD = hoje(agora);
  const activas = (lista ?? []).filter((e) => e.estado === "activa" && e.dataDesejada >= hojeD);
  const outras = (lista ?? []).filter((e) => !(e.estado === "activa" && e.dataDesejada >= hojeD));

  return (
    <Pagina largura="estreita">
      <CabecalhoPagina
        titulo="Lista de espera"
        texto="Quando a agenda está cheia, avisamos se abrir uma vaga no dia que escolheu."
        accoes={
          activas.length ? (
            <Botao icone={<Plus className="h-5 w-5" />} onClick={() => setParams({ nova: "1" })}>
              Entrar na lista de espera
            </Botao>
          ) : undefined
        }
      />

      {!lista ? (
        <Esqueleto className="h-48" />
      ) : activas.length === 0 ? (
        <div className="cartao">
          <Vazio icone={<Hourglass />} titulo="Não está em nenhuma lista" texto="Se o dia que quer estiver cheio, peça para ser avisado quando alguém cancelar.">
            <Botao onClick={() => setParams({ nova: "1" })}>Entrar na lista de espera</Botao>
          </Vazio>
        </div>
      ) : (
        <ul className="space-y-3">
          {activas.map((e) => {
            const vaga = e.ultimaVaga && Date.parse(e.ultimaVaga) > agora.getTime() ? notificacoes?.find((n) => n.tipo === "vaga" && n.dados?.inicio === e.ultimaVaga) : undefined;
            return (
              <li key={e.id} className="cartao p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-tinta">{e.especialidade.nome}</p>
                    <p className="text-grafite">{e.medico ? `${e.medico.titulo} ${e.medico.nome}` : "Qualquer médico"}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-estado-ambar-fundo px-2.5 py-1 text-xs font-semibold text-estado-ambar">
                    <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />À espera
                  </span>
                </div>
                <p className="mt-3 flex items-center gap-2 text-tinta">
                  <CalendarDays className="h-4 w-4 text-grafite" aria-hidden="true" />
                  {diaRelativo(e.dataDesejada, agora)}
                  {e.paciente.id !== u.pacienteId && <span className="text-grafite">, para {primeiroNome(e.paciente.nome)}</span>}
                </p>
                {vaga?.dados?.medicoId && (
                  <div className="anim-surgir mt-4 flex flex-wrap items-center justify-between gap-3 rounded-botao bg-esperanca-50 p-3">
                    <p className="font-semibold text-esperanca">Abriu uma vaga às {horaDe(e.ultimaVaga!)}</p>
                    <Botao tamanho="sm" onClick={() => navigate(`/marcar?medico=${vaga.dados!.medicoId}&inicio=${encodeURIComponent(e.ultimaVaga!)}&vaga=${vaga.id}&para=${e.pacienteId}`)}>
                      Marcar esta vaga
                    </Botao>
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <Botao
                    variante="perigo-suave"
                    tamanho="sm"
                    onClick={async () => {
                      try {
                        await repo().sairListaEspera(e.id);
                        avisar("Saiu da lista de espera.");
                      } catch (x) {
                        avisar(mensagemDeErro(x), "erro");
                      }
                    }}
                  >
                    Sair da lista
                  </Botao>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {outras.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-grafite">Pedidos anteriores</h2>
          <ul className="cartao anim-lista divide-y divide-linha">
            {outras.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <span className="min-w-0 truncate text-grafite">
                  {e.especialidade.nome}, {diaRelativo(e.dataDesejada, agora).toLowerCase()}
                </span>
                <span className={cx("shrink-0 text-sm font-semibold", e.estado === "marcada" ? "text-estado-verde" : "text-grafite")}>{e.estado === "marcada" ? "Marcada" : "Terminou"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Folha
        aberta={aberta}
        aoFechar={fechar}
        titulo="Entrar na lista de espera"
        descricao="Avisamos assim que abrir uma vaga nesse dia."
        largura="sm"
        rodape={
          <Botao tamanho="lg" larguraTotal onClick={guardar} aCarregar={aGuardar}>
            Entrar na lista de espera
          </Botao>
        }
      >
        {!base ? (
          <Esqueleto className="h-60" />
        ) : (
          <div className="space-y-4">
            {base.familiares.length > 0 && (
              <Seleccao rotulo="Para quem" value={form.pacienteId} onChange={(e) => setForm({ ...form, pacienteId: e.target.value })}>
                <option value={u.pacienteId ?? ""}>Eu, {primeiroNome(u.nome)}</option>
                {base.familiares.map((f) => (
                  <option key={f.id} value={f.pacienteId}>
                    {f.paciente.nome}
                  </option>
                ))}
              </Seleccao>
            )}
            <Seleccao rotulo="Especialidade" value={form.especialidadeId} onChange={(e) => setForm({ ...form, especialidadeId: e.target.value, medicoId: "" })}>
              <option value="">Escolha</option>
              {base.especialidades.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </Seleccao>
            <Seleccao rotulo="Médico" value={form.medicoId} onChange={(e) => setForm({ ...form, medicoId: e.target.value })} disabled={!form.especialidadeId}>
              <option value="">Qualquer médico</option>
              {base.medicos
                .filter((m) => m.activo && m.especialidadeId === form.especialidadeId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.titulo} {m.nome}
                  </option>
                ))}
            </Seleccao>
            <Campo rotulo="Data desejada" type="date" min={hoje()} value={form.dia} onChange={(e) => setForm({ ...form, dia: e.target.value })} />
            {erro && (
              <p role="alert" className="text-sm font-semibold text-estado-vermelho">
                {erro}
              </p>
            )}
          </div>
        )}
      </Folha>
    </Pagina>
  );
}

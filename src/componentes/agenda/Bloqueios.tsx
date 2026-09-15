import { Ban, Trash } from "lucide-react";
import { useState } from "react";
import { repo } from "../../lib/dados";
import { ESTADOS_ALTERAVEIS, MOTIVOS_BLOQUEIO } from "../../lib/estados";
import { textoIntervalo } from "../../lib/horario";
import { hoje, instanteISO, quandoCurto, somarDias } from "../../lib/tempo";
import { plural } from "../../lib/texto";
import type { MotivoBloqueio } from "../../lib/tipos";
import { useDados } from "../../lib/usarDados";
import { mensagemDeErro, useAviso } from "../Aviso";
import { Folha } from "../Folha";
import { Botao, BotaoIcone, Campo, Esqueleto, Fichas, Interruptor, Segmentado } from "../ui";

/** Bloqueios de agenda (férias, reuniões, feriados…). Nunca aparecem aos pacientes. */
export function Bloqueios({ medicoId, podeEditar, permitirClinica }: { medicoId: string; podeEditar: boolean; permitirClinica?: boolean }) {
  const avisar = useAviso();
  const { dados } = useDados((r) => r.bloqueios({ medicoId, de: new Date().toISOString() }), [medicoId], ["bloqueios"]);

  const [aberta, setAberta] = useState(false);
  const [motivo, setMotivo] = useState<MotivoBloqueio>("reuniao");
  const [clinicaInteira, setClinicaInteira] = useState(false);
  const [diaInteiro, setDiaInteiro] = useState(false);
  const [de, setDe] = useState(hoje());
  const [ate, setAte] = useState(hoje());
  const [horaInicio, setHoraInicio] = useState("12:00");
  const [horaFim, setHoraFim] = useState("13:00");
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  const valido = !!de && (diaInteiro ? (ate || de) >= de : horaInicio < horaFim);
  const inicio = valido ? instanteISO(de, diaInteiro ? "00:00" : horaInicio) : null;
  const fim = valido ? (diaInteiro ? instanteISO(somarDias(ate || de, 1), "00:00") : instanteISO(de, horaFim)) : null;

  const { dados: afectadas } = useDados(
    (r) =>
      aberta && inicio && fim
        ? r
            .consultas({ medicoId: clinicaInteira ? undefined : medicoId, de: new Date(Date.parse(inicio) - 4 * 3_600_000).toISOString(), ate: fim })
            .then((l) => l.filter((c) => ESTADOS_ALTERAVEIS.includes(c.estado) && Date.parse(c.inicio) < Date.parse(fim) && Date.parse(c.fim) > Date.parse(inicio)))
        : Promise.resolve([]),
    [aberta, inicio, fim, clinicaInteira, medicoId],
    ["consultas"],
  );

  function abrir() {
    setMotivo("reuniao");
    setClinicaInteira(false);
    setDiaInteiro(false);
    setDe(hoje());
    setAte(hoje());
    setHoraInicio("12:00");
    setHoraFim("13:00");
    setNota("");
    setErro(null);
    setAberta(true);
  }

  function escolherMotivo(m: MotivoBloqueio) {
    setMotivo(m);
    if (m === "ferias" || m === "feriado") setDiaInteiro(true);
    if (m === "feriado" && permitirClinica) setClinicaInteira(true);
  }

  async function guardar() {
    if (!valido || !inicio || !fim) return setErro(diaInteiro ? "A data final não pode ser antes da inicial." : "A hora de fim tem de ser depois da de início.");
    setAGuardar(true);
    try {
      await repo().bloquear({ medicoId: clinicaInteira ? null : medicoId, inicio, fim, motivo, nota: nota.trim() });
      setAberta(false);
      avisar(clinicaInteira ? "Clínica fechada nesse período. Os horários deixam de aparecer." : "Horário bloqueado. Deixa de aparecer para os pacientes.");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setAGuardar(false);
    }
  }

  async function remover(id: string) {
    try {
      await repo().desbloquear(id);
      avisar("Bloqueio removido. Os horários voltam a estar disponíveis.");
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
    }
  }

  return (
    <div>
      {!dados ? (
        <Esqueleto className="h-24" />
      ) : dados.length === 0 ? (
        <p className="text-grafite">Sem bloqueios marcados.</p>
      ) : (
        <ul className="divide-y divide-linha">
          {dados.map((b) => (
            <li key={b.id} className="flex items-start gap-3 py-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-papel text-grafite">
                <Ban className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-tinta">
                  {MOTIVOS_BLOQUEIO[b.motivo]}
                  {b.medicoId === null && <span className="ml-2 rounded-full bg-estado-vermelho-fundo px-2 py-0.5 align-middle text-xs font-semibold text-estado-vermelho">Toda a clínica</span>}
                </p>
                <p className="text-sm text-tinta">{textoIntervalo(b)}</p>
                {b.nota && <p className="text-sm text-grafite">{b.nota}</p>}
              </div>
              {podeEditar && (b.medicoId !== null || permitirClinica) && (
                <BotaoIcone rotulo={`Remover bloqueio: ${MOTIVOS_BLOQUEIO[b.motivo]}`} onClick={() => remover(b.id)}>
                  <Trash />
                </BotaoIcone>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeEditar && (
        <Botao variante="secundario" className="mt-3" icone={<Ban className="h-4 w-4" />} onClick={abrir}>
          Bloquear horário
        </Botao>
      )}

      <Folha
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Bloquear horário"
        descricao="Os horários bloqueados nunca aparecem aos pacientes."
        largura="sm"
        rodape={
          <Botao tamanho="lg" larguraTotal onClick={guardar} aCarregar={aGuardar}>
            Bloquear
          </Botao>
        }
      >
        <div className="space-y-5">
          <Fichas rotulo="Motivo" valor={motivo} aoMudar={escolherMotivo} opcoes={Object.entries(MOTIVOS_BLOQUEIO).map(([valor, rotulo]) => ({ valor: valor as MotivoBloqueio, rotulo }))} />
          {permitirClinica && (
            <div>
              <p className="mb-2 text-sm font-semibold text-tinta">Aplicar a</p>
              <Segmentado
                rotulo="Aplicar a"
                larguraTotal
                valor={clinicaInteira ? "clinica" : "medico"}
                aoMudar={(v) => setClinicaInteira(v === "clinica")}
                opcoes={[
                  { valor: "medico", rotulo: "Este médico" },
                  { valor: "clinica", rotulo: "Toda a clínica" },
                ]}
              />
            </div>
          )}
          <Interruptor rotulo="Dia inteiro" ligado={diaInteiro} aoMudar={setDiaInteiro} />
          {diaInteiro ? (
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="De" type="date" value={de} min={hoje()} onChange={(e) => setDe(e.target.value)} />
              <Campo rotulo="Até" type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Campo className="col-span-2" rotulo="Dia" type="date" value={de} min={hoje()} onChange={(e) => setDe(e.target.value)} />
              <Campo rotulo="Das" type="time" step={900} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
              <Campo rotulo="Às" type="time" step={900} value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </div>
          )}
          <Campo rotulo="Nota" placeholder="Por exemplo: congresso em Benguela" value={nota} onChange={(e) => setNota(e.target.value)} dica="Opcional. Só a equipa vê." />

          {afectadas && afectadas.length > 0 && (
            <div role="status" className="rounded-botao bg-estado-ambar-fundo p-3.5 text-sm text-estado-ambar">
              <p className="font-bold">{plural(afectadas.length, "consulta marcada", "consultas marcadas")} neste período</p>
              <p className="mt-0.5">Continuam marcadas depois do bloqueio. Reagende-as ou avise os pacientes.</p>
              <ul className="mt-2 space-y-0.5 text-tinta">
                {afectadas.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    {quandoCurto(c.inicio)}, {c.paciente.nome}
                  </li>
                ))}
                {afectadas.length > 5 && <li>e mais {afectadas.length - 5}</li>}
              </ul>
            </div>
          )}
          {erro && (
            <p role="alert" className="text-sm font-semibold text-estado-vermelho">
              {erro}
            </p>
          )}
        </div>
      </Folha>
    </div>
  );
}

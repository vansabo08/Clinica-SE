import { Hourglass, Trash } from "lucide-react";
import { useMemo } from "react";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { LogoWhatsApp } from "../../componentes/icones";
import { Pagina } from "../../componentes/Shell";
import { Avatar, Botao, BotaoIcone, CabecalhoPagina, Esqueleto, Vazio, estiloBotao } from "../../componentes/ui";
import { repo } from "../../lib/dados";
import { vagasLivres } from "../../lib/disponibilidade";
import { useNovoAgendamento } from "../../lib/novoAgendamento";
import { primeiroNome } from "../../lib/sessao";
import { type Dia, diaRelativo, haQuanto, hoje, instanteISO, somarDias } from "../../lib/tempo";
import { plural } from "../../lib/texto";
import type { EntradaEsperaDetalhada, Indisponivel } from "../../lib/tipos";
import { useAgora, useDados } from "../../lib/usarDados";
import { linkWhatsApp } from "../../lib/whatsapp";

export function ListaEsperaRececao() {
  const abrirNovo = useNovoAgendamento();
  const avisar = useAviso();
  const agora = useAgora(60_000);
  const hojeD = hoje(agora);

  const { dados: lista } = useDados((r) => r.listaEspera(), [], ["espera"]);
  const { dados: base } = useDados(
    async (r) => {
      const [medicos, horarios, clinica] = await Promise.all([r.medicos(), r.horarios(), r.clinica()]);
      return { medicos, horarios, clinica };
    },
    [],
    ["medicos", "horarios", "clinica"],
  );

  const activas = useMemo(() => (lista ?? []).filter((e) => e.estado === "activa" && e.dataDesejada >= hojeD), [lista, hojeD]);
  const medicosDe = (e: EntradaEsperaDetalhada) => (base?.medicos ?? []).filter((m) => m.activo && (e.medicoId ? m.id === e.medicoId : m.especialidadeId === e.especialidadeId));

  const ids = [...new Set(activas.flatMap((e) => medicosDe(e).map((m) => m.id)))].sort();
  const datas = activas.map((e) => e.dataDesejada).sort();
  const [primeira, ultima] = [datas[0] ?? hojeD, datas[datas.length - 1] ?? hojeD];

  const { dados: indisponiveis } = useDados(
    async (r) => {
      const listas = await Promise.all(ids.map((id) => r.indisponiveis(id, instanteISO(primeira, "00:00"), instanteISO(somarDias(ultima, 1), "00:00"))));
      return new Map<string, Indisponivel[]>(ids.map((id, i) => [id, listas[i]]));
    },
    [ids.join(","), primeira, ultima],
    ["consultas", "bloqueios"],
  );

  const vagasPara = (e: EntradaEsperaDetalhada) => {
    if (!base || !indisponiveis) return null;
    return medicosDe(e).reduce((t, m) => t + vagasLivres({ medico: m, horarios: base.horarios, indisponiveis: indisponiveis.get(m.id) ?? [], agora }, e.dataDesejada).length, 0);
  };

  const grupos = new Map<Dia, EntradaEsperaDetalhada[]>();
  for (const e of activas) grupos.set(e.dataDesejada, [...(grupos.get(e.dataDesejada) ?? []), e]);

  async function tirar(e: EntradaEsperaDetalhada) {
    try {
      await repo().sairListaEspera(e.id);
      avisar(`${e.paciente.nome} saiu da lista de espera.`);
    } catch (x) {
      avisar(mensagemDeErro(x), "erro");
    }
  }

  return (
    <Pagina>
      <CabecalhoPagina titulo="Lista de espera" texto={lista ? (activas.length ? `${plural(activas.length, "pessoa", "pessoas")} à espera de vaga` : undefined) : undefined} />

      {!lista ? (
        <Esqueleto className="h-80" />
      ) : activas.length === 0 ? (
        <div className="cartao">
          <Vazio icone={<Hourglass />} titulo="Ninguém à espera" texto="Quando um paciente pede para ser avisado de uma vaga, aparece aqui. Ao cancelar uma consulta, quem está à espera nesse dia é avisado sozinho." />
        </div>
      ) : (
        <div className="space-y-6">
          {[...grupos.entries()].map(([dia, entradas]) => (
            <section key={dia}>
              <h2 className="mb-2 text-sm font-semibold text-grafite">{diaRelativo(dia, agora)}</h2>
              <ul className="cartao divide-y divide-linha">
                {entradas.map((e) => {
                  const n = vagasPara(e);
                  const nome = primeiroNome(e.paciente.nome);
                  return (
                    <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
                      <Avatar nome={e.paciente.nome} tamanho="sm" />
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="font-bold text-tinta">{e.paciente.nome}</p>
                        <p className="text-sm text-grafite">
                          {e.especialidade.nome}, {e.medico ? `${e.medico.titulo} ${e.medico.nome}` : "qualquer médico"}
                        </p>
                        <p className="text-xs text-grafite">
                          Pediu {haQuanto(e.criadaEm, agora)}
                          {e.vagasOferecidas > 0 && `, já avisado de ${plural(e.vagasOferecidas, "vaga", "vagas")}`}
                        </p>
                      </div>
                      {n !== null &&
                        (n > 0 ? (
                          <span className="rounded-full bg-estado-verde-fundo px-2.5 py-1 text-xs font-semibold text-estado-verde">{plural(n, "vaga livre", "vagas livres")}</span>
                        ) : (
                          <span className="rounded-full bg-papel px-2.5 py-1 text-xs font-semibold text-grafite">Sem vagas</span>
                        ))}
                      <div className="flex items-center gap-1">
                        <Botao tamanho="sm" variante={n ? "primario" : "secundario"} onClick={() => abrirNovo({ pacienteId: e.pacienteId, especialidadeId: e.especialidadeId, medicoId: e.medicoId ?? undefined, dia: e.dataDesejada })}>
                          Marcar
                        </Botao>
                        {!!n && base && (
                          <a
                            href={linkWhatsApp(e.paciente.telefone, `Olá, ${nome}. Abriu uma vaga de ${e.especialidade.nome} para ${diaRelativo(e.dataDesejada).toLowerCase()} na ${base.clinica.nome}. Quer que a marquemos?`)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Avisar ${nome} pelo WhatsApp`}
                            title="Avisar pelo WhatsApp"
                            className={estiloBotao({ variante: "secundario", tamanho: "sm", className: "w-9 px-0" })}
                          >
                            <LogoWhatsApp />
                          </a>
                        )}
                        <BotaoIcone rotulo={`Tirar ${nome} da lista`} onClick={() => tirar(e)}>
                          <Trash />
                        </BotaoIcone>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Pagina>
  );
}

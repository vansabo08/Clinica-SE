import { CalendarPlus, Phone, Search, UserPlus, Users } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { Folha } from "../../componentes/Folha";
import { LogoWhatsApp } from "../../componentes/icones";
import { Pagina } from "../../componentes/Shell";
import { Avatar, Botao, CabecalhoPagina, Campo, Esqueleto, EtiquetaEstado, Vazio, estiloBotao } from "../../componentes/ui";
import { repo } from "../../lib/dados";
import { useNovoAgendamento } from "../../lib/novoAgendamento";
import { dataCurta, diaDe, hoje, horaDe, idadeLegivel, quandoCurto } from "../../lib/tempo";
import { plural } from "../../lib/texto";
import type { PacienteResumo } from "../../lib/tipos";
import { useDados } from "../../lib/usarDados";
import { linkTelefone, linkWhatsApp, telefoneLegivel } from "../../lib/whatsapp";

const POR_PAGINA = 50;

function dataComAno(iso: string) {
  const d = diaDe(iso);
  return d.slice(0, 4) === hoje().slice(0, 4) ? dataCurta(d) : `${dataCurta(d)} ${d.slice(0, 4)}`;
}

export function Pacientes() {
  const abrirNovo = useNovoAgendamento();
  const avisar = useAviso();
  const [pesquisa, setPesquisa] = useState("");
  const adiada = useDeferredValue(pesquisa);
  const [limite, setLimite] = useState(POR_PAGINA);
  const { dados } = useDados((r) => r.pacientes(adiada), [adiada], ["pacientes", "consultas"]);
  const [aberto, setAberto] = useState<PacienteResumo | null>(null);
  const { dados: historico } = useDados((r) => (aberto ? r.consultas({ pacienteId: aberto.id }) : Promise.resolve([])), [aberto?.id], ["consultas"]);

  const [novo, setNovo] = useState<{ nome: string; telefone: string; nascimento: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  async function registar() {
    if (!novo) return;
    setAGuardar(true);
    setErro(null);
    try {
      const p = await repo().criarPaciente({ nome: novo.nome, telefone: novo.telefone, dataNascimento: novo.nascimento || null });
      setNovo(null);
      avisar(`${p.nome} ficou registado.`);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setAGuardar(false);
    }
  }

  const lista = dados?.slice(0, limite) ?? [];

  return (
    <Pagina largura="larga">
      <CabecalhoPagina
        titulo="Pacientes"
        texto={dados ? plural(dados.length, "paciente", "pacientes") : undefined}
        accoes={
          <Botao icone={<UserPlus className="h-5 w-5" />} onClick={() => setNovo({ nome: "", telefone: "", nascimento: "" })}>
            Novo paciente
          </Botao>
        }
      />

      <div className="relative mb-4 sm:max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-grafite" aria-hidden="true" />
        <input
          type="search"
          value={pesquisa}
          onChange={(e) => {
            setPesquisa(e.target.value);
            setLimite(POR_PAGINA);
          }}
          placeholder="Pesquisar por nome ou telefone"
          aria-label="Pesquisar por nome ou telefone"
          className="h-12 w-full rounded-botao border border-linha-forte bg-white pl-12 pr-3 text-tinta placeholder:text-nevoa focus:border-esperanca focus:outline-none focus:ring-4 focus:ring-esperanca/10"
        />
      </div>

      {!dados ? (
        <Esqueleto className="h-96" />
      ) : dados.length === 0 ? (
        <div className="cartao">
          <Vazio icone={<Users />} titulo="Nenhum paciente encontrado" texto={pesquisa ? `Ninguém com “${pesquisa}”. Confirme o número ou registe o paciente.` : "Os pacientes aparecem aqui quando criam conta ou são registados."}>
            <Botao onClick={() => setNovo({ nome: /\d/.test(pesquisa) ? "" : pesquisa, telefone: /\d/.test(pesquisa) ? pesquisa : "", nascimento: "" })}>Registar paciente</Botao>
          </Vazio>
        </div>
      ) : (
        <>
          <div className="cartao hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="border-b border-linha text-sm text-grafite">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Nome
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Telefone
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Próxima consulta
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Último agendamento
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Consultas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {lista.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-esperanca-50/50">
                    <td className="px-5 py-2.5">
                      <button type="button" onClick={() => setAberto(p)} className="flex items-center gap-3 rounded-botao text-left font-bold text-tinta hover:text-esperanca">
                        <Avatar nome={p.nome} tamanho="sm" />
                        {p.nome}
                      </button>
                    </td>
                    <td className="num px-3 py-2.5 text-tinta">{telefoneLegivel(p.telefone)}</td>
                    <td className="px-3 py-2.5">{p.proximaConsulta ? <span className="text-tinta">{quandoCurto(p.proximaConsulta)}</span> : <span className="text-grafite">Sem marcação</span>}</td>
                    <td className="px-3 py-2.5 text-grafite">{p.ultimoAgendamento ? dataComAno(p.ultimoAgendamento) : "Nunca veio"}</td>
                    <td className="num px-5 py-2.5 text-right font-semibold text-tinta">{p.totalConsultas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="cartao anim-lista divide-y divide-linha overflow-hidden md:hidden">
            {lista.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setAberto(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <Avatar nome={p.nome} tamanho="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-tinta">{p.nome}</span>
                    <span className="num block text-sm text-grafite">{telefoneLegivel(p.telefone)}</span>
                  </span>
                  <span className="text-right text-sm text-grafite">{p.proximaConsulta ? quandoCurto(p.proximaConsulta) : plural(p.totalConsultas, "consulta", "consultas")}</span>
                </button>
              </li>
            ))}
          </ul>

          {dados.length > limite && (
            <div className="mt-4 flex justify-center">
              <Botao variante="secundario" onClick={() => setLimite((l) => l + POR_PAGINA)}>
                Mostrar mais {Math.min(POR_PAGINA, dados.length - limite)}
              </Botao>
            </div>
          )}
        </>
      )}

      <Folha
        aberta={!!aberto}
        aoFechar={() => setAberto(null)}
        lado="direita"
        titulo={aberto?.nome ?? "Paciente"}
        descricao={aberto ? [telefoneLegivel(aberto.telefone), idadeLegivel(aberto.dataNascimento)].filter(Boolean).join(", ") : undefined}
        rodape={
          aberto ? (
            <Botao
              tamanho="lg"
              larguraTotal
              icone={<CalendarPlus className="h-5 w-5" />}
              onClick={() => {
                const id = aberto.id;
                setAberto(null);
                abrirNovo({ pacienteId: id });
              }}
            >
              Marcar consulta
            </Botao>
          ) : undefined
        }
      >
        {aberto && (
          <div>
            <div className="flex flex-wrap gap-2">
              <a href={linkTelefone(aberto.telefone)} className={estiloBotao({ variante: "secundario", tamanho: "sm" })}>
                <Phone aria-hidden="true" />
                Ligar
              </a>
              <a href={linkWhatsApp(aberto.telefone)} target="_blank" rel="noreferrer" className={estiloBotao({ variante: "secundario", tamanho: "sm" })}>
                <LogoWhatsApp />
                WhatsApp
              </a>
            </div>
            <h3 className="mb-2 mt-6 font-bold text-tinta">Consultas</h3>
            {!historico ? (
              <Esqueleto className="h-40" />
            ) : historico.length === 0 ? (
              <p className="text-grafite">Ainda sem consultas.</p>
            ) : (
              <ul className="divide-y divide-linha rounded-cartao border border-linha">
                {[...historico].reverse().map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-16 shrink-0">
                      <p className="num font-bold text-tinta">{horaDe(c.inicio)}</p>
                      <p className="text-xs text-grafite">{dataComAno(c.inicio)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-tinta">
                        {c.medico.titulo} {c.medico.nome}
                      </p>
                      <p className="truncate text-xs text-grafite">{c.especialidade.nome}</p>
                    </div>
                    <EtiquetaEstado estado={c.estado} recusada={c.recusada} curto />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Folha>

      <Folha
        aberta={!!novo}
        aoFechar={() => setNovo(null)}
        titulo="Novo paciente"
        descricao="Só o essencial. O resto o paciente completa na aplicação."
        largura="sm"
        rodape={
          <Botao tamanho="lg" larguraTotal onClick={registar} aCarregar={aGuardar}>
            Registar paciente
          </Botao>
        }
      >
        {novo && (
          <div className="space-y-4">
            <Campo rotulo="Nome completo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} autoComplete="off" />
            <Campo rotulo="Telemóvel" inputMode="tel" placeholder="923 456 789" value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} />
            <Campo rotulo="Data de nascimento" type="date" dica="Opcional." value={novo.nascimento} onChange={(e) => setNovo({ ...novo, nascimento: e.target.value })} />
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

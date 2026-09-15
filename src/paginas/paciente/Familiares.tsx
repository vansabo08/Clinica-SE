import { Trash, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { Confirmacao, Folha } from "../../componentes/Folha";
import { Pagina } from "../../componentes/Shell";
import { Avatar, Botao, BotaoIcone, CabecalhoPagina, Campo, Esqueleto, Fichas, Vazio } from "../../componentes/ui";
import { repo } from "../../lib/dados";
import { PARENTESCOS } from "../../lib/estados";
import { idadeLegivel } from "../../lib/tempo";
import type { FamiliarDetalhado, Parentesco } from "../../lib/tipos";
import { useDados } from "../../lib/usarDados";

const textoIdade = idadeLegivel;

export function Familiares() {
  const navigate = useNavigate();
  const avisar = useAviso();
  const { dados } = useDados((r) => r.familiares(), [], ["familiares", "pacientes"]);

  const [aAdicionar, setAAdicionar] = useState(false);
  const [nome, setNome] = useState("");
  const [parentesco, setParentesco] = useState<Parentesco | null>(null);
  const [nascimento, setNascimento] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [aRemover, setARemover] = useState<FamiliarDetalhado | null>(null);
  const [aApagar, setAApagar] = useState(false);

  function abrir() {
    setNome("");
    setParentesco(null);
    setNascimento("");
    setErro(null);
    setAAdicionar(true);
  }

  async function guardar() {
    if (!nome.trim()) return setErro("Escreva o nome do familiar.");
    if (!parentesco) return setErro("Escolha o parentesco.");
    setAGuardar(true);
    try {
      await repo().adicionarFamiliar({ nome, parentesco, dataNascimento: nascimento || null });
      setAAdicionar(false);
      avisar(`${nome.trim().split(" ")[0]} foi adicionado aos seus familiares.`);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setAGuardar(false);
    }
  }

  async function remover() {
    if (!aRemover) return;
    setAApagar(true);
    try {
      await repo().removerFamiliar(aRemover.id);
      avisar("Familiar removido.");
      setARemover(null);
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
    } finally {
      setAApagar(false);
    }
  }

  return (
    <Pagina largura="estreita">
      <CabecalhoPagina
        titulo="Meus familiares"
        texto="Marque consultas para os seus filhos, pais ou cônjuge com a sua conta."
        accoes={
          dados?.length ? (
            <Botao icone={<UserPlus className="h-5 w-5" />} onClick={abrir}>
              Adicionar familiar
            </Botao>
          ) : undefined
        }
      />

      {!dados ? (
        <Esqueleto className="h-48" />
      ) : dados.length === 0 ? (
        <div className="cartao">
          <Vazio icone={<Users />} titulo="Ainda sem familiares" texto="Adicione quem costuma levar à clínica. Depois é só escolher o nome ao marcar.">
            <Botao icone={<UserPlus className="h-5 w-5" />} onClick={abrir}>
              Adicionar familiar
            </Botao>
          </Vazio>
        </div>
      ) : (
        <ul className="space-y-3">
          {dados.map((f) => {
            const anos = textoIdade(f.paciente.dataNascimento);
            return (
              <li key={f.id} className="cartao flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                <Avatar nome={f.paciente.nome} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-tinta">{f.paciente.nome}</p>
                  <p className="text-sm text-grafite">
                    {PARENTESCOS[f.parentesco]}
                    {anos && `, ${anos}`}
                  </p>
                </div>
                <div className="flex w-full items-center gap-1 sm:w-auto">
                  <Botao variante="suave" tamanho="sm" className="flex-1 sm:flex-none" onClick={() => navigate(`/marcar?para=${f.pacienteId}`)}>
                    Marcar consulta
                  </Botao>
                  <BotaoIcone rotulo={`Remover ${f.paciente.nome}`} onClick={() => setARemover(f)}>
                    <Trash />
                  </BotaoIcone>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Folha
        aberta={aAdicionar}
        aoFechar={() => setAAdicionar(false)}
        titulo="Adicionar familiar"
        largura="sm"
        rodape={
          <Botao tamanho="lg" larguraTotal onClick={guardar} aCarregar={aGuardar}>
            Adicionar
          </Botao>
        }
      >
        <div className="space-y-5">
          <Campo rotulo="Nome completo" autoComplete="off" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Fichas rotulo="Parentesco" valor={parentesco} aoMudar={setParentesco} opcoes={Object.entries(PARENTESCOS).map(([valor, rotulo]) => ({ valor: valor as Parentesco, rotulo }))} />
          <Campo rotulo="Data de nascimento" type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} dica="Opcional. Ajuda a pediatria a preparar a consulta." />
          {erro && (
            <p role="alert" className="text-sm font-semibold text-estado-vermelho">
              {erro}
            </p>
          )}
        </div>
      </Folha>

      <Confirmacao
        aberta={!!aRemover}
        aoFechar={() => setARemover(null)}
        titulo={`Remover ${aRemover?.paciente.nome.split(" ")[0] ?? ""}?`}
        texto="Deixa de poder marcar consultas para esta pessoa. O histórico de consultas fica guardado na clínica."
        confirmar="Remover"
        perigo
        aCarregar={aApagar}
        aoConfirmar={remover}
      />
    </Pagina>
  );
}

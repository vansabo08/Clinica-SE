import { Bell, ChevronRight, Hourglass, LogOut, MapPin, Users, type LucideProps } from "lucide-react";
import { useState, type ComponentType } from "react";
import { Link, useNavigate } from "react-router";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { Folha } from "../../componentes/Folha";
import { FolhaMudarSenha } from "../../componentes/FolhaMudarSenha";
import { Pagina } from "../../componentes/Shell";
import { Avatar, Botao, CabecalhoPagina, Campo, Interruptor } from "../../componentes/ui";
import { repo } from "../../lib/dados";
import { useSessao, useUtilizador } from "../../lib/sessao";
import { useDados } from "../../lib/usarDados";
import { telefoneLegivel } from "../../lib/whatsapp";

function LinhaLigacao({ para, Icone, titulo, detalhe }: { para: string; Icone: ComponentType<LucideProps>; titulo: string; detalhe: string }) {
  return (
    <li>
      <Link to={para} className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-esperanca-50/60 sm:px-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-esperanca-50 text-esperanca">
          <Icone className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-tinta">{titulo}</span>
          <span className="block truncate text-sm text-grafite">{detalhe}</span>
        </span>
        <ChevronRight className="h-5 w-5 text-nevoa" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function Perfil() {
  const u = useUtilizador();
  const { sair, modo } = useSessao();
  const navigate = useNavigate();
  const avisar = useAviso();
  const { dados: paciente } = useDados((r) => r.meuPaciente(), [], ["pacientes"]);
  const { dados: familiares } = useDados((r) => r.familiares(), [], ["familiares"]);
  const { dados: espera } = useDados((r) => r.listaEspera(), [], ["espera"]);

  const [aEditar, setAEditar] = useState(false);
  const [aMudarSenha, setAMudarSenha] = useState(false);
  const [form, setForm] = useState({ nome: "", telefone: "", dataNascimento: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  function abrirEdicao() {
    setForm({ nome: u.nome, telefone: telefoneLegivel(u.telefone), dataNascimento: paciente?.dataNascimento ?? "" });
    setErro(null);
    setAEditar(true);
  }

  async function guardar() {
    if (!form.nome.trim()) return setErro("Escreva o seu nome.");
    if (form.telefone.replace(/\D/g, "").replace(/^244/, "").length !== 9) return setErro("O telemóvel precisa de 9 dígitos.");
    setAGuardar(true);
    try {
      await repo().actualizarPaciente(u.pacienteId!, { nome: form.nome, telefone: form.telefone.replace(/\D/g, "").replace(/^244/, ""), dataNascimento: form.dataNascimento || null });
      setAEditar(false);
      avisar("Dados guardados.");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setAGuardar(false);
    }
  }

  const activas = espera?.filter((e) => e.estado === "activa").length ?? 0;

  return (
    <Pagina largura="estreita">
      <CabecalhoPagina titulo="Perfil" />

      <section className="cartao flex flex-wrap items-center gap-4 p-5">
        <Avatar nome={u.nome} tamanho="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-2xl text-tinta">{u.nome}</p>
          <p className="truncate text-grafite">{u.email}</p>
          <p className="num text-grafite">{u.telefone ? telefoneLegivel(u.telefone) : "Sem telemóvel"}</p>
        </div>
        <Botao variante="secundario" tamanho="sm" onClick={abrirEdicao}>
          Editar dados
        </Botao>
      </section>

      <ul className="cartao mt-4 divide-y divide-linha overflow-hidden">
        <LinhaLigacao
          para="/familiares"
          Icone={Users}
          titulo="Meus familiares"
          detalhe={familiares?.length ? familiares.map((f) => f.paciente.nome.split(" ")[0]).join(", ") : "Marque consultas para filhos, pais ou cônjuge"}
        />
        <LinhaLigacao para="/lista-de-espera" Icone={Hourglass} titulo="Lista de espera" detalhe={activas ? `${activas} ${activas === 1 ? "pedido activo" : "pedidos activos"}` : "Sem pedidos"} />
        <LinhaLigacao para="/notificacoes" Icone={Bell} titulo="Notificações" detalhe="Lembretes, confirmações e vagas" />
        <LinhaLigacao para="/clinica" Icone={MapPin} titulo="A clínica" detalhe="Endereço, contactos e como chegar" />
      </ul>

      <section className="cartao mt-4 p-5">
        <Interruptor
          rotulo="Lembretes por WhatsApp"
          descricao="Além do aviso na aplicação, receba o lembrete da consulta no WhatsApp."
          ligado={paciente?.lembreteWhatsapp ?? false}
          disabled={!paciente}
          aoMudar={async (v) => {
            try {
              await repo().actualizarPaciente(u.pacienteId!, { lembreteWhatsapp: v });
              avisar(v ? "Vai receber os lembretes também por WhatsApp." : "Os lembretes chegam só pela aplicação.");
            } catch (e) {
              avisar(mensagemDeErro(e), "erro");
            }
          }}
        />
      </section>

      <section className="cartao mt-4 flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="font-semibold text-tinta">Palavra-passe</p>
          <p className="text-sm text-grafite">Para entrar com {u.email}.</p>
        </div>
        <Botao variante="secundario" tamanho="sm" onClick={() => setAMudarSenha(true)}>
          Mudar palavra-passe
        </Botao>
      </section>

      <Botao
        variante="secundario"
        tamanho="lg"
        larguraTotal
        className="mt-6"
        icone={<LogOut className="h-5 w-5" />}
        onClick={async () => {
          await sair();
          navigate("/entrar", { replace: true });
        }}
      >
        Sair
      </Botao>

      {modo === "demo" && (
        <button
          type="button"
          className="mx-auto mt-6 block text-sm text-grafite underline underline-offset-4 hover:text-tinta"
          onClick={async () => {
            await repo().reporDemonstracao?.();
            avisar("Os dados de demonstração voltaram ao início.");
          }}
        >
          Repor os dados de demonstração
        </button>
      )}

      <FolhaMudarSenha aberta={aMudarSenha} aoFechar={() => setAMudarSenha(false)} />

      <Folha
        aberta={aEditar}
        aoFechar={() => setAEditar(false)}
        titulo="Os seus dados"
        largura="sm"
        rodape={
          <Botao tamanho="lg" larguraTotal onClick={guardar} aCarregar={aGuardar}>
            Guardar
          </Botao>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Nome completo" autoComplete="name" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Campo rotulo="Telemóvel" inputMode="tel" autoComplete="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          <Campo rotulo="Data de nascimento" type="date" value={form.dataNascimento} onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} dica="Opcional. Ajuda o médico a preparar a consulta." />
          {erro && (
            <p role="alert" className="text-sm font-semibold text-estado-vermelho">
              {erro}
            </p>
          )}
        </div>
      </Folha>
    </Pagina>
  );
}

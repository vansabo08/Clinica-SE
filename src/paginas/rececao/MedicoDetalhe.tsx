import { ArrowLeft, CalendarPlus, Mail } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { Bloqueios } from "../../componentes/agenda/Bloqueios";
import { EditorHorario } from "../../componentes/agenda/EditorHorario";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { CarregandoPagina, Pagina } from "../../componentes/Shell";
import { Avatar, Botao, Vazio } from "../../componentes/ui";
import { repo } from "../../lib/dados";
import { useNovoAgendamento } from "../../lib/novoAgendamento";
import { useDados } from "../../lib/usarDados";
import { FormMedico } from "./Medicos";

export function MedicoDetalhe() {
  const { id } = useParams();
  const avisar = useAviso();
  const abrirNovo = useNovoAgendamento();
  const [aEditar, setAEditar] = useState(false);
  const [aConvidar, setAConvidar] = useState(false);
  const { dados } = useDados(
    async (r) => {
      const [medicos, especialidades] = await Promise.all([r.medicos(), r.especialidades()]);
      return { medico: medicos.find((m) => m.id === id) ?? null, especialidades };
    },
    [id],
    ["medicos", "especialidades"],
  );

  if (!dados) return <CarregandoPagina />;
  const m = dados.medico;
  if (!m)
    return (
      <Pagina>
        <Vazio titulo="Médico não encontrado" texto="Pode ter sido removido.">
          <Link to="/rececao/medicos" className="font-semibold text-esperanca">
            Ver todos os médicos
          </Link>
        </Vazio>
      </Pagina>
    );

  const nome = `${m.titulo} ${m.nome}`;
  const especialidade = dados.especialidades.find((e) => e.id === m.especialidadeId);

  async function convidar() {
    setAConvidar(true);
    try {
      const { enviado } = await repo().convidarMedico(m!.id);
      avisar(enviado ? `Convite enviado para ${m!.email}.` : `Na demonstração não sai email. Com o Supabase ligado, ${m!.email} recebe o convite.`);
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
    } finally {
      setAConvidar(false);
    }
  }

  return (
    <Pagina>
      <Link to="/rececao/medicos" className="mb-5 inline-flex items-center gap-1.5 rounded-botao font-semibold text-grafite hover:text-tinta">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Médicos
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <Avatar nome={nome} foto={m.fotoUrl} tamanho="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[2rem] leading-tight text-tinta">{nome}</h1>
          <p className="text-grafite">
            {especialidade?.nome}, consultas de {m.duracaoMin} minutos
            {!m.activo && <span className="ml-2 rounded-full bg-estado-escuro-fundo px-2.5 py-0.5 text-sm font-semibold text-estado-escuro">Inactivo</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => setAEditar(true)}>
            Editar dados
          </Botao>
          {m.activo && (
            <Botao icone={<CalendarPlus className="h-5 w-5" />} onClick={() => abrirNovo({ especialidadeId: m.especialidadeId, medicoId: m.id })}>
              Marcar consulta
            </Botao>
          )}
        </div>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="cartao p-5 sm:p-6" aria-labelledby="titulo-horario">
          <h2 id="titulo-horario" className="text-lg font-bold text-tinta">
            Horário semanal
          </h2>
          <p className="text-sm text-grafite">As vagas para pacientes saem destes períodos, em blocos de {m.duracaoMin} minutos.</p>
          <div className="mt-2">
            <EditorHorario medicoId={m.id} podeEditar />
          </div>
        </section>

        <div className="space-y-6">
          <section className="cartao p-5 sm:p-6" aria-labelledby="titulo-bloqueios">
            <h2 id="titulo-bloqueios" className="text-lg font-bold text-tinta">
              Bloqueios
            </h2>
            <p className="mb-2 text-sm text-grafite">Férias, reuniões, ausências, intervalos e feriados.</p>
            <Bloqueios medicoId={m.id} podeEditar permitirClinica />
          </section>

          <section className="cartao p-5 sm:p-6" aria-labelledby="titulo-conta">
            <h2 id="titulo-conta" className="text-lg font-bold text-tinta">
              Conta do médico
            </h2>
            {m.userId ? (
              <p className="mt-1 text-grafite">Entra com {m.email} e vê só a própria agenda.</p>
            ) : (
              <>
                <p className="mt-1 text-grafite">Ainda sem conta. O convite chega a {m.email || "um email que ainda falta preencher"}.</p>
                <Botao variante="secundario" className="mt-3" icone={<Mail className="h-4 w-4" />} disabled={!m.email} aCarregar={aConvidar} onClick={convidar}>
                  Enviar convite
                </Botao>
              </>
            )}
            <p className="mt-3 border-t border-linha pt-3 text-sm text-grafite">
              {m.podeEditarDisponibilidade ? "Pode alterar a própria disponibilidade." : "A disponibilidade é gerida pela receção."}
            </p>
          </section>
        </div>
      </div>

      <FormMedico dados={aEditar ? { ...m } : null} especialidades={dados.especialidades} aoFechar={() => setAEditar(false)} aoGuardar={() => setAEditar(false)} />
    </Pagina>
  );
}

import { ArrowLeft, CalendarClock, CalendarPlus, CalendarX2, Navigation } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { Confirmacao } from "../../componentes/Folha";
import { LogoWhatsApp } from "../../componentes/icones";
import { Senha } from "../../componentes/Senha";
import { CarregandoPagina, Pagina } from "../../componentes/Shell";
import { Botao, Par, Vazio, estiloBotao } from "../../componentes/ui";
import { repo } from "../../lib/dados";
import { ESTADOS_ALTERAVEIS } from "../../lib/estados";
import { linkComoChegar } from "../../lib/mapa";
import { dataLonga, diaDe, horaDe, quandoCurto } from "../../lib/tempo";
import type { EstadoConsulta } from "../../lib/tipos";
import { useAgora, useDados } from "../../lib/usarDados";
import { linkWhatsApp, mensagens } from "../../lib/whatsapp";
import { paraQuem } from "./Inicio";

const EXPLICACAO: Record<EstadoConsulta, string> = {
  aguardando: "O médico ou a clínica ainda vão confirmar esta consulta. Recebe um aviso quando isso acontecer.",
  confirmada: "Está tudo certo. Chegue 10 minutos antes; recebe um lembrete 24 horas antes.",
  em_atendimento: "Está a ser atendido neste momento.",
  concluida: "Consulta concluída.",
  cancelada: "Esta consulta foi cancelada e o horário ficou livre.",
  faltou: "Esta consulta ficou registada como falta. Marque outra quando precisar.",
};

export function ConsultaPaciente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const avisar = useAviso();
  const agora = useAgora(60_000);
  const { dados: c, carregando } = useDados((r) => r.consulta(id!), [id], ["consultas"]);
  const { dados: clinica } = useDados((r) => r.clinica(), [], ["clinica"]);
  const [aPerguntar, setAPerguntar] = useState(false);
  const [aCancelar, setACancelar] = useState(false);

  if (carregando && !c) return <CarregandoPagina />;
  if (!c)
    return (
      <Pagina largura="estreita">
        <Vazio titulo="Não encontrámos esta consulta" texto="Pode pertencer a outra conta ou ter sido removida.">
          <Botao onClick={() => navigate("/consultas")}>Ver as minhas consultas</Botao>
        </Vazio>
      </Pagina>
    );

  const alteravel = ESTADOS_ALTERAVEIS.includes(c.estado) && Date.parse(c.inicio) > agora.getTime();
  const terminou = ["cancelada", "faltou", "concluida"].includes(c.estado);
  const duracao = Math.round((Date.parse(c.fim) - Date.parse(c.inicio)) / 60_000);

  async function cancelar() {
    setACancelar(true);
    try {
      await repo().cancelar(c!.id);
      setAPerguntar(false);
      avisar("Consulta cancelada. O horário ficou livre.");
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
    } finally {
      setACancelar(false);
    }
  }

  return (
    <Pagina largura="estreita">
      <Link to="/consultas" className="mb-5 inline-flex items-center gap-1.5 rounded-botao font-semibold text-grafite hover:text-tinta">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Minhas consultas
      </Link>

      <Senha
        medico={`${c.medico.titulo} ${c.medico.nome}`}
        fotoMedico={c.medico.fotoUrl}
        especialidade={c.especialidade.nome}
        icone={c.especialidade.icone}
        dia={diaDe(c.inicio)}
        hora={horaDe(c.inicio)}
        estado={c.estado}
        paraQuem={paraQuem(c)}
        riscada={c.estado === "cancelada"}
        recusada={c.recusada}
      />

      {c.recusada ? (
        <div className="anim-surgir mt-4 rounded-[24px] border border-estado-ambar/25 bg-estado-ambar-fundo p-4">
          <p className="font-bold text-tinta">
            {c.medico.titulo} {c.medico.nome} não pode atender neste horário.
          </p>
          {c.motivoRecusa && <p className="mt-1 text-grafite">Motivo: {c.motivoRecusa}</p>}
          <p className="mt-1 text-grafite">O horário ficou livre. Escolha outro dia ou outro médico; é rápido.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Botao tamanho="lg" icone={<CalendarPlus className="h-5 w-5" />} onClick={() => navigate(`/marcar?medico=${c.medicoId}&para=${c.pacienteId}`)}>
              Escolher outro horário
            </Botao>
            <Botao tamanho="lg" variante="secundario" onClick={() => navigate(`/marcar?especialidade=${c.especialidadeId}&para=${c.pacienteId}`)}>
              Outro médico de {c.especialidade.nome}
            </Botao>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-grafite">{EXPLICACAO[c.estado]}</p>
      )}
      {c.reagendadaDe && <p className="mt-1 text-sm text-grafite">Reagendada: estava marcada para {quandoCurto(c.reagendadaDe)}.</p>}

      {alteravel && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Botao tamanho="lg" variante="secundario" icone={<CalendarClock className="h-5 w-5" />} onClick={() => navigate(`/marcar?reagendar=${c.id}`)}>
            Reagendar
          </Botao>
          <Botao tamanho="lg" variante="perigo-suave" className="border border-estado-vermelho/25" icone={<CalendarX2 className="h-5 w-5" />} onClick={() => setAPerguntar(true)}>
            Cancelar consulta
          </Botao>
        </div>
      )}
      {terminou && !c.recusada && (
        <Botao tamanho="lg" variante="secundario" className="mt-5" icone={<CalendarPlus className="h-5 w-5" />} onClick={() => navigate(`/marcar?medico=${c.medicoId}&para=${c.pacienteId}`)}>
          Marcar nova consulta com {c.medico.titulo} {c.medico.nome.split(" ")[0]}
        </Botao>
      )}

      <dl className="cartao mt-6 divide-y divide-linha px-5">
        <Par rotulo="Paciente">{c.paciente.nome}</Par>
        <Par rotulo="Data">{dataLonga(diaDe(c.inicio))}</Par>
        <Par rotulo="Hora">
          <span className="num">
            {horaDe(c.inicio)} às {horaDe(c.fim)}
          </span>
        </Par>
        <Par rotulo="Duração">
          <span className="num">{duracao} minutos</span>
        </Par>
        {c.observacao && <Par rotulo="Observação">{c.observacao}</Par>}
      </dl>

      {clinica && (
        <section className="cartao mt-4 p-5" aria-labelledby="titulo-onde">
          <h2 id="titulo-onde" className="font-bold text-tinta">
            Onde
          </h2>
          <p className="mt-1 text-tinta">{clinica.nome}</p>
          <p className="text-grafite">
            {clinica.endereco}, {clinica.cidade}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={linkComoChegar(clinica.latitude, clinica.longitude)} target="_blank" rel="noreferrer" className={estiloBotao({ variante: "secundario" })}>
              <Navigation aria-hidden="true" />
              Como chegar
            </a>
            <a href={linkWhatsApp(clinica.whatsapp, mensagens.sobreConsulta(c, clinica))} target="_blank" rel="noreferrer" className={estiloBotao({ variante: "secundario" })}>
              <LogoWhatsApp />
              Falar com a clínica
            </a>
          </div>
        </section>
      )}

      <Confirmacao
        aberta={aPerguntar}
        aoFechar={() => setAPerguntar(false)}
        titulo="Tem certeza que deseja cancelar esta consulta?"
        texto={`O horário das ${horaDe(c.inicio)} de ${dataLonga(diaDe(c.inicio))} fica livre para outra pessoa.`}
        confirmar="Cancelar consulta"
        perigo
        aCarregar={aCancelar}
        aoConfirmar={cancelar}
      />
    </Pagina>
  );
}

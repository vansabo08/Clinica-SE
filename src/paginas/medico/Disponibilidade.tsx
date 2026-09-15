import { Bloqueios } from "../../componentes/agenda/Bloqueios";
import { EditorHorario } from "../../componentes/agenda/EditorHorario";
import { CarregandoPagina, Pagina } from "../../componentes/Shell";
import { CabecalhoPagina } from "../../componentes/ui";
import { useUtilizador } from "../../lib/sessao";
import { useDados } from "../../lib/usarDados";

export function Disponibilidade() {
  const u = useUtilizador();
  const { dados: medico } = useDados((r) => r.medicos().then((l) => l.find((m) => m.id === u.medicoId) ?? null), [], ["medicos"]);
  if (!medico) return <CarregandoPagina />;
  const pode = medico.podeEditarDisponibilidade;

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Disponibilidade"
        texto={pode ? "Abra e feche horários e marque ausências. Os pacientes só vêem as vagas que sobram." : "A receção gere a sua disponibilidade. Para mudar um horário ou marcar férias, fale com a receção."}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="cartao p-5 sm:p-6" aria-labelledby="titulo-semana">
          <h2 id="titulo-semana" className="text-lg font-bold text-tinta">
            Horário semanal
          </h2>
          <p className="text-sm text-grafite">Consultas de {medico.duracaoMin} minutos.</p>
          <div className="mt-2">
            <EditorHorario medicoId={medico.id} podeEditar={pode} />
          </div>
        </section>
        <section className="cartao p-5 sm:p-6" aria-labelledby="titulo-ausencias">
          <h2 id="titulo-ausencias" className="text-lg font-bold text-tinta">
            Bloqueios
          </h2>
          <p className="mb-2 text-sm text-grafite">Férias, reuniões e ausências. Nunca aparecem aos pacientes.</p>
          <Bloqueios medicoId={medico.id} podeEditar={pode} />
        </section>
      </div>
    </Pagina>
  );
}

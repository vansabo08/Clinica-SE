import { useMemo } from "react";
import { proximaVaga, type Vaga } from "../../lib/disponibilidade";
import type { Especialidade, Medico } from "../../lib/tipos";
import { hoje, instanteISO, quandoCurto, somarDias } from "../../lib/tempo";
import { useAgora, useDados } from "../../lib/usarDados";
import { Avatar, Botao, Esqueleto } from "../ui";

const HORIZONTE = 45;

export function EscolhaMedico({
  medicos,
  especialidade,
  aoEscolher,
  aoEscolherVaga,
}: {
  medicos: Medico[];
  especialidade: Especialidade;
  aoEscolher: (m: Medico) => void;
  aoEscolherVaga: (m: Medico, v: Vaga) => void;
}) {
  const agora = useAgora(60_000);
  const hojeD = hoje(agora);
  const activos = useMemo(() => medicos.filter((m) => m.activo), [medicos]);
  const ids = activos.map((m) => m.id).join(",");

  const { dados } = useDados(
    async (r) => {
      const de = instanteISO(hojeD, "00:00");
      const ate = instanteISO(somarDias(hojeD, HORIZONTE), "00:00");
      const [horarios, ...indisponiveis] = await Promise.all([r.horarios(), ...activos.map((m) => r.indisponiveis(m.id, de, ate))]);
      const agoraReal = new Date();
      return activos
        .map((medico, i) => ({ medico, vaga: proximaVaga({ medico, horarios, indisponiveis: indisponiveis[i], agora: agoraReal }, HORIZONTE) }))
        .sort((a, b) => (a.vaga ? Date.parse(a.vaga.inicio) : Infinity) - (b.vaga ? Date.parse(b.vaga.inicio) : Infinity));
    },
    [ids, hojeD],
    ["consultas", "bloqueios", "horarios", "medicos"],
  );

  if (!dados)
    return (
      <div className="space-y-3">
        {activos.map((m) => (
          <Esqueleto key={m.id} className="h-[168px]" />
        ))}
      </div>
    );

  return (
    <ul className="anim-lista space-y-3">
      {dados.map(({ medico, vaga }) => {
        const nome = `${medico.titulo} ${medico.nome}`;
        return (
          <li key={medico.id} className="cartao p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <Avatar nome={nome} foto={medico.fotoUrl} tamanho="lg" />
              <div className="min-w-0">
                <p className="font-serif text-2xl leading-7 text-tinta">{nome}</p>
                <p className="text-grafite">{especialidade.nome}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-linha pt-4">
              <div className="min-w-0">
                <p className="text-sm text-grafite">Próximo horário</p>
                {vaga ? (
                  <button
                    type="button"
                    onClick={() => aoEscolherVaga(medico, vaga)}
                    className="num mt-1 inline-flex h-9 items-center rounded-full bg-esperanca-50 px-3.5 font-bold text-esperanca transition-colors hover:bg-esperanca-100"
                    aria-label={`Marcar já: ${quandoCurto(vaga.inicio, agora)}`}
                  >
                    {quandoCurto(vaga.inicio, agora)}
                  </button>
                ) : (
                  <p className="mt-1 font-semibold text-tinta">Sem vagas nas próximas semanas</p>
                )}
              </div>
              <Botao variante={vaga ? "primario" : "secundario"} onClick={() => aoEscolher(medico)}>
                Escolher
              </Botao>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

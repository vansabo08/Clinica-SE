import type { ReactNode } from "react";
import type { EstadoConsulta } from "../lib/tipos";
import { type Dia, type Hora, dataLonga, diaRelativo, nomeDiaSemana } from "../lib/tempo";
import { IconeEspecialidade } from "./icones";
import { Avatar, EtiquetaEstado, cx } from "./ui";

/**
 * A senha: a consulta que o paciente leva consigo.
 * É o papel das filas que a aplicação substitui — por isso tem picotado.
 */
export function Senha({
  medico,
  fotoMedico,
  especialidade,
  icone,
  dia,
  hora,
  estado,
  paraQuem,
  accoes,
  className,
  riscada,
  recusada,
}: {
  medico: string;
  fotoMedico?: string | null;
  especialidade: string;
  icone: string;
  dia: Dia;
  hora: Hora;
  estado?: EstadoConsulta;
  paraQuem?: string | null;
  accoes?: ReactNode;
  className?: string;
  riscada?: boolean;
  recusada?: boolean;
}) {
  const relativo = diaRelativo(dia);
  const perto = relativo === "Hoje" || relativo === "Amanhã";
  return (
    <article className={cx("senha", className)}>
      <div className="senha-topo px-5 pb-6 pt-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-esperanca">
            <IconeEspecialidade icone={icone} className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{especialidade}</span>
          </span>
          {estado && <EtiquetaEstado estado={estado} recusada={recusada} />}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Avatar nome={medico} foto={fotoMedico} tamanho="md" />
          <div className="min-w-0">
            <p className="truncate font-serif text-[1.625rem] leading-8 text-tinta">{medico}</p>
            {paraQuem && <p className="truncate text-sm text-grafite">{paraQuem}</p>}
          </div>
        </div>
      </div>
      <div className="senha-base px-5 pb-5 pt-5">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-grafite">{perto ? `${relativo}, ${nomeDiaSemana(dia).toLowerCase()}` : nomeDiaSemana(dia)}</p>
            <p className={cx("text-lg font-bold text-tinta", riscada && "text-grafite line-through")}>{dataLonga(dia)}</p>
          </div>
          <p className={cx("num text-[2.75rem] font-bold leading-none tracking-[-0.02em] text-esperanca", riscada && "text-grafite line-through")}>{hora}</p>
        </div>
        {accoes && <div className="mt-5 grid grid-cols-2 gap-2">{accoes}</div>}
      </div>
    </article>
  );
}

import { ChevronDown, ChevronRight, Shapes } from "lucide-react";
import { useState } from "react";
import type { Especialidade, Medico } from "../../lib/tipos";
import { IconeEspecialidade } from "../icones";

const VISIVEIS = 6;

const juntar = (nomes: string[]) => (nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`);

export function EscolhaEspecialidade({ especialidades, medicos, aoEscolher }: { especialidades: Especialidade[]; medicos: Medico[]; aoEscolher: (e: Especialidade) => void }) {
  const [todas, setTodas] = useState(false);
  const activos = (id: string) => medicos.filter((m) => m.activo && m.especialidadeId === id).length;
  const visiveis = todas || especialidades.length <= VISIVEIS + 1 ? especialidades : especialidades.slice(0, VISIVEIS);
  const escondidas = especialidades.slice(visiveis.length);

  return (
    <ul className="cartao anim-lista divide-y divide-linha overflow-hidden">
      {visiveis.map((e) => {
        const n = activos(e.id);
        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => aoEscolher(e)}
              disabled={n === 0}
              className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-esperanca-50/70 focus-visible:bg-esperanca-50/70 disabled:opacity-50 sm:px-5"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-esperanca-50 text-esperanca">
                <IconeEspecialidade icone={e.icone} className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold leading-6 text-tinta">{e.nome}</span>
                <span className="block truncate text-sm text-grafite">{n === 0 ? "Sem médicos a receber marcações" : e.descricao}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-nevoa" aria-hidden="true" />
            </button>
          </li>
        );
      })}
      {escondidas.length > 0 && (
        <li>
          <button type="button" onClick={() => setTodas(true)} aria-expanded="false" className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-esperanca-50/70 sm:px-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-papel text-grafite">
              <Shapes className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold leading-6 text-tinta">Outras</span>
              <span className="block truncate text-sm text-grafite">{juntar(escondidas.map((e) => e.nome))}</span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-nevoa" aria-hidden="true" />
          </button>
        </li>
      )}
    </ul>
  );
}

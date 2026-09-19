import { useEffect, useState } from "react";
import { repo } from "../../lib/dados";
import { MOTIVOS_RECUSA } from "../../lib/estados";
import { primeiroNome } from "../../lib/sessao";
import { quandoCurto } from "../../lib/tempo";
import type { ConsultaDetalhada } from "../../lib/tipos";
import { mensagemDeErro, useAviso } from "../Aviso";
import { Folha } from "../Folha";
import { AreaTexto, Botao, cx } from "../ui";

/** O médico diz que não pode atender. O paciente recebe o motivo e escolhe outro horário. */
export function FolhaRecusar({ consulta, aoFechar, aoRecusar }: { consulta: ConsultaDetalhada | null; aoFechar: () => void; aoRecusar?: (c: ConsultaDetalhada) => void }) {
  const avisar = useAviso();
  const [motivo, setMotivo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    if (consulta) setMotivo("");
  }, [consulta?.id]);

  async function recusar() {
    if (!consulta) return;
    setAEnviar(true);
    try {
      await repo().recusar(consulta.id, motivo);
      avisar(`Consulta recusada. ${primeiroNome(consulta.paciente.nome)} foi avisado para escolher outro horário.`);
      aoRecusar?.(consulta);
      aoFechar();
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <Folha
      aberta={!!consulta}
      aoFechar={aoFechar}
      titulo="Recusar consulta"
      descricao={consulta ? `${consulta.paciente.nome}, ${quandoCurto(consulta.inicio)}. O paciente é avisado e o horário fica livre.` : undefined}
      largura="sm"
      rodape={
        <div className="grid grid-cols-2 gap-2">
          <Botao variante="secundario" tamanho="lg" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao variante="perigo" tamanho="lg" aCarregar={aEnviar} onClick={recusar}>
            Recusar
          </Botao>
        </div>
      }
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-tinta">Porquê? (o paciente vê este motivo)</legend>
        <div className="flex flex-col gap-2">
          {MOTIVOS_RECUSA.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={motivo === m}
              onClick={() => setMotivo(motivo === m ? "" : m)}
              className={cx(
                "rounded-[18px] border px-4 py-3 text-left font-semibold transition-colors",
                motivo === m ? "border-esperanca bg-esperanca-50 text-esperanca-800" : "border-linha-forte bg-white text-tinta hover:border-esperanca-300",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </fieldset>
      <AreaTexto
        className="mt-4"
        rotulo="Ou escreva outro motivo"
        placeholder="Opcional"
        maxLength={300}
        value={MOTIVOS_RECUSA.includes(motivo) ? "" : motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
    </Folha>
  );
}

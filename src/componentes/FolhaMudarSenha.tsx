import { useEffect, useState, type FormEvent } from "react";
import { repo } from "../lib/dados";
import { mensagemDeErro, useAviso } from "./Aviso";
import { Folha } from "./Folha";
import { Botao, Campo } from "./ui";

const VAZIO = { actual: "", nova: "", repetir: "" };

export function FolhaMudarSenha({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const avisar = useAviso();
  const [f, setF] = useState(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    setF(VAZIO);
    setErro(null);
  }, [aberta]);

  const campo = (k: keyof typeof VAZIO) => ({
    value: f[k],
    onChange: (e: { target: { value: string } }) => {
      setF((a) => ({ ...a, [k]: e.target.value }));
      setErro(null);
    },
  });

  async function guardar(e?: FormEvent) {
    e?.preventDefault();
    if (!f.actual) return setErro("Escreva a palavra-passe actual.");
    if (f.nova.length < 6) return setErro("A nova palavra-passe precisa de pelo menos 6 caracteres.");
    if (f.nova !== f.repetir) return setErro("As duas palavras-passe novas não são iguais.");
    setAGuardar(true);
    try {
      await repo().mudarSenha(f.nova, f.actual);
      aoFechar();
      avisar("Palavra-passe alterada.");
    } catch (x) {
      setErro(mensagemDeErro(x));
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <Folha
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Mudar palavra-passe"
      descricao="Pedimos a actual para confirmar que é você."
      largura="sm"
      rodape={
        <Botao tamanho="lg" larguraTotal aCarregar={aGuardar} onClick={() => guardar()}>
          Guardar palavra-passe
        </Botao>
      }
    >
      <form onSubmit={guardar} className="space-y-4" noValidate>
        <Campo rotulo="Palavra-passe actual" type="password" autoComplete="current-password" {...campo("actual")} />
        <Campo rotulo="Nova palavra-passe" type="password" autoComplete="new-password" dica="Pelo menos 6 caracteres." {...campo("nova")} />
        <Campo rotulo="Repetir a nova palavra-passe" type="password" autoComplete="new-password" {...campo("repetir")} />
        {erro && (
          <p role="alert" className="rounded-botao bg-estado-vermelho-fundo px-3.5 py-3 text-sm font-semibold text-estado-vermelho">
            {erro}
          </p>
        )}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Folha>
  );
}

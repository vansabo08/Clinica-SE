import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { mensagemDeErro, useAviso } from "../componentes/Aviso";
import { Marca } from "../componentes/Marca";
import { EcraArranque } from "../componentes/Shell";
import { Botao, Campo, Vazio } from "../componentes/ui";
import { repo } from "../lib/dados";
import { linkRecuperacao } from "../lib/linkRecuperacao";
import { casaDoPapel } from "../lib/rotas";
import { useSessao } from "../lib/sessao";

/** Onde leva o link do email "Esqueci-me da palavra-passe". */
export function NovaSenha() {
  const { utilizador, aCarregar } = useSessao();
  const navigate = useNavigate();
  const avisar = useAviso();
  const [f, setF] = useState({ nova: "", repetir: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  if (aCarregar) return <EcraArranque />;
  const valido = linkRecuperacao.valido && !linkRecuperacao.erro && !!utilizador;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (f.nova.length < 6) return setErro("A nova palavra-passe precisa de pelo menos 6 caracteres.");
    if (f.nova !== f.repetir) return setErro("As duas palavras-passe não são iguais.");
    setAGuardar(true);
    try {
      await repo().mudarSenha(f.nova);
      avisar("Palavra-passe criada. Já está dentro da sua conta.");
      navigate(casaDoPapel(utilizador!.papel), { replace: true });
    } catch (x) {
      setErro(mensagemDeErro(x));
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-12 pt-8 sm:px-8 lg:justify-center">
      <div className="mx-auto w-full max-w-[420px]">
        <Marca />
        {valido ? (
          <>
            <h1 className="mt-10 font-serif text-[2.25rem] leading-tight text-tinta">Nova palavra-passe</h1>
            <p className="mt-1.5 text-grafite">Para a conta {utilizador!.email}.</p>
            <form onSubmit={guardar} className="mt-7 space-y-4" noValidate>
              <Campo
                rotulo="Nova palavra-passe"
                type="password"
                autoComplete="new-password"
                dica="Pelo menos 6 caracteres."
                value={f.nova}
                onChange={(e) => {
                  setF({ ...f, nova: e.target.value });
                  setErro(null);
                }}
              />
              <Campo
                rotulo="Repetir a nova palavra-passe"
                type="password"
                autoComplete="new-password"
                value={f.repetir}
                onChange={(e) => {
                  setF({ ...f, repetir: e.target.value });
                  setErro(null);
                }}
              />
              {erro && (
                <p role="alert" className="rounded-botao bg-estado-vermelho-fundo px-3.5 py-3 text-sm font-semibold text-estado-vermelho">
                  {erro}
                </p>
              )}
              <Botao type="submit" tamanho="lg" larguraTotal aCarregar={aGuardar}>
                Guardar palavra-passe
              </Botao>
            </form>
          </>
        ) : (
          <div className="cartao mt-10">
            <Vazio icone={<KeyRound />} titulo="Este link já não serve" texto="Os links para criar uma palavra-passe nova só funcionam uma vez e expiram ao fim de uma hora. Peça outro.">
              <Botao onClick={() => navigate("/entrar", { replace: true, state: { recuperar: true } })}>Pedir outro link</Botao>
            </Vazio>
          </div>
        )}
      </div>
    </main>
  );
}

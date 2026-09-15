import { Navigation } from "lucide-react";
import { useEffect, useState } from "react";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { Pagina } from "../../componentes/Shell";
import { AreaTexto, Botao, CabecalhoPagina, Campo, Esqueleto, estiloBotao } from "../../componentes/ui";
import { repo } from "../../lib/dados";
import { linkComoChegar, urlMapaEmbutido } from "../../lib/mapa";
import type { Clinica } from "../../lib/tipos";
import { useDados } from "../../lib/usarDados";

export function DefinicoesClinica() {
  const avisar = useAviso();
  const { dados } = useDados((r) => r.clinica(), [], ["clinica"]);
  const [f, setF] = useState<Clinica | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    if (dados && !f) setF(dados);
  }, [dados, f]);

  if (!f)
    return (
      <Pagina>
        <Esqueleto className="h-[32rem]" />
      </Pagina>
    );

  const campo = (k: "nome" | "endereco" | "cidade" | "telefone" | "whatsapp" | "email" | "horario") => ({
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
  });
  const coordenadasValidas = Number.isFinite(f.latitude) && Number.isFinite(f.longitude) && Math.abs(f.latitude) <= 90 && Math.abs(f.longitude) <= 180;
  const sujo = JSON.stringify(f) !== JSON.stringify(dados);

  async function guardar() {
    if (!f) return;
    if (!f.nome.trim() || !f.endereco.trim()) return setErro("O nome e o endereço não podem ficar vazios.");
    if (!coordenadasValidas) return setErro("As coordenadas do mapa não são válidas.");
    setAGuardar(true);
    setErro(null);
    try {
      await repo().guardarClinica({ ...f, telefone: f.telefone.replace(/\D/g, ""), whatsapp: f.whatsapp.replace(/\D/g, "") });
      avisar("Dados da clínica guardados. Os pacientes já vêem as alterações.");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <Pagina>
      <CabecalhoPagina titulo="Dados da clínica" texto="O que os pacientes vêem em “Contactar clínica”, nas confirmações e nos lembretes." />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <section className="cartao space-y-4 p-5 sm:p-6">
          <Campo rotulo="Nome" {...campo("nome")} />
          <Campo rotulo="Endereço" {...campo("endereco")} />
          <Campo rotulo="Bairro e cidade" {...campo("cidade")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Telefone" inputMode="tel" {...campo("telefone")} />
            <Campo rotulo="WhatsApp" inputMode="tel" dica="Recebe as mensagens dos pacientes." {...campo("whatsapp")} />
          </div>
          <Campo rotulo="Email" type="email" {...campo("email")} />
          <AreaTexto rotulo="Horário de funcionamento" dica="Uma linha por período." {...campo("horario")} />
        </section>

        <section className="cartao p-5 sm:p-6">
          <h2 className="text-lg font-bold text-tinta">Localização no mapa</h2>
          <p className="text-sm text-grafite">No Google Maps, carregue com o botão direito no edifício e copie os dois números.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Campo rotulo="Latitude" inputMode="decimal" value={String(f.latitude)} onChange={(e) => setF({ ...f, latitude: Number(e.target.value.replace(",", ".")) })} />
            <Campo rotulo="Longitude" inputMode="decimal" value={String(f.longitude)} onChange={(e) => setF({ ...f, longitude: Number(e.target.value.replace(",", ".")) })} />
          </div>
          {coordenadasValidas && (
            <>
              <div className="mt-4 overflow-hidden rounded-botao border border-linha">
                <iframe title="Pré-visualização do mapa" src={urlMapaEmbutido(f.latitude, f.longitude)} className="block aspect-[4/3] w-full max-w-full" loading="lazy" referrerPolicy="no-referrer" />
              </div>
              <a href={linkComoChegar(f.latitude, f.longitude)} target="_blank" rel="noreferrer" className={estiloBotao({ variante: "secundario", tamanho: "sm", className: "mt-3" })}>
                <Navigation aria-hidden="true" />
                Testar “Como chegar”
              </a>
            </>
          )}
        </section>
      </div>

      {erro && (
        <p role="alert" className="mt-4 rounded-botao bg-estado-vermelho-fundo px-3.5 py-3 font-semibold text-estado-vermelho">
          {erro}
        </p>
      )}
      <div className="vidro sticky bottom-24 z-10 mt-6 flex items-center justify-end gap-3 rounded-cartao p-3 lg:bottom-4">
        <p className="mr-auto px-1 text-sm text-grafite">{sujo ? "Alterações por guardar" : "Tudo guardado"}</p>
        <Botao onClick={guardar} aCarregar={aGuardar} disabled={!sujo}>
          Guardar
        </Botao>
      </div>
    </Pagina>
  );
}

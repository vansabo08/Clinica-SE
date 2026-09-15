import { Navigation, Phone } from "lucide-react";
import { LogoWhatsApp } from "../../componentes/icones";
import { CarregandoPagina, Pagina } from "../../componentes/Shell";
import { CabecalhoPagina, estiloBotao } from "../../componentes/ui";
import { linkComoChegar, urlMapaEmbutido } from "../../lib/mapa";
import { useDados } from "../../lib/usarDados";
import { linkTelefone, linkWhatsApp, mensagens, telefoneLegivel } from "../../lib/whatsapp";

export function ClinicaInfo() {
  const { dados: c } = useDados((r) => r.clinica(), [], ["clinica"]);
  if (!c) return <CarregandoPagina />;

  return (
    <Pagina largura="estreita">
      <CabecalhoPagina
        titulo={c.nome}
        texto={
          <>
            {c.endereco}
            <br />
            {c.cidade}
          </>
        }
      />

      <div className="overflow-hidden rounded-cartao border border-linha bg-white">
        <iframe
          title={`Mapa com a localização da ${c.nome}`}
          src={urlMapaEmbutido(c.latitude, c.longitude)}
          className="block aspect-[4/3] w-full max-w-full sm:aspect-[16/9]"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <a href={linkComoChegar(c.latitude, c.longitude)} target="_blank" rel="noreferrer" className={estiloBotao({ tamanho: "lg" })}>
          <Navigation aria-hidden="true" />
          Como chegar
        </a>
        <a href={linkWhatsApp(c.whatsapp, mensagens.falar(c))} target="_blank" rel="noreferrer" className={estiloBotao({ variante: "secundario", tamanho: "lg" })}>
          <LogoWhatsApp />
          Falar com a clínica
        </a>
        <a href={linkWhatsApp(c.whatsapp, mensagens.agendar(c))} target="_blank" rel="noreferrer" className={estiloBotao({ variante: "secundario", tamanho: "lg" })}>
          <LogoWhatsApp />
          Agendar pelo WhatsApp
        </a>
        <a href={linkTelefone(c.telefone)} className={estiloBotao({ variante: "secundario", tamanho: "lg" })}>
          <Phone aria-hidden="true" />
          Ligar
        </a>
      </div>

      <dl className="cartao mt-6 divide-y divide-linha px-5">
        <div className="py-4">
          <dt className="text-sm text-grafite">Horário de funcionamento</dt>
          <dd className="mt-1 whitespace-pre-line font-semibold text-tinta">{c.horario}</dd>
        </div>
        <div className="py-4">
          <dt className="text-sm text-grafite">Telefone e WhatsApp</dt>
          <dd className="num mt-1 font-semibold text-tinta">{telefoneLegivel(c.telefone)}</dd>
        </div>
        <div className="py-4">
          <dt className="text-sm text-grafite">Email</dt>
          <dd className="mt-1 font-semibold">
            <a href={`mailto:${c.email}`} className="text-esperanca underline-offset-4 hover:underline">
              {c.email}
            </a>
          </dd>
        </div>
      </dl>
    </Pagina>
  );
}

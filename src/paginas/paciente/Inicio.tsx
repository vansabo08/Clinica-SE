import { CalendarDays, Hourglass, Phone, Plus, Sparkles, Users, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { Link, useNavigate } from "react-router";
import { LogoWhatsApp } from "../../componentes/icones";
import { Simbolo } from "../../componentes/Marca";
import { Senha } from "../../componentes/Senha";
import { Pagina } from "../../componentes/Shell";
import { Avatar, Botao, Esqueleto } from "../../componentes/ui";
import { ESTADOS_ALTERAVEIS, PARENTESCOS } from "../../lib/estados";
import { FOTOS } from "../../lib/fotos";
import { primeiroNome, useUtilizador } from "../../lib/sessao";
import { diaDe, horaDe } from "../../lib/tempo";
import type { ConsultaDetalhada } from "../../lib/tipos";
import { useAgora, useDados } from "../../lib/usarDados";
import { linkWhatsApp, mensagens } from "../../lib/whatsapp";

export function paraQuem(c: ConsultaDetalhada) {
  return c.parentesco ? `Para ${primeiroNome(c.paciente.nome)} (${PARENTESCOS[c.parentesco].toLowerCase()})` : null;
}

export function Inicio() {
  const u = useUtilizador();
  const navigate = useNavigate();
  const agora = useAgora(60_000);

  const { dados: consultas } = useDados((r) => r.consultas({ de: new Date(Date.now() - 3 * 3_600_000).toISOString() }), [], ["consultas"]);
  const { dados: notificacoes } = useDados((r) => r.notificacoes(), [], ["notificacoes"]);
  const { dados: espera } = useDados((r) => r.listaEspera(), [], ["espera"]);
  const { dados: familiares } = useDados((r) => r.familiares(), [], ["familiares"]);
  const { dados: clinica } = useDados((r) => r.clinica(), [], ["clinica"]);

  const futuras = (consultas ?? []).filter((c) => c.estado === "em_atendimento" || (ESTADOS_ALTERAVEIS.includes(c.estado) && Date.parse(c.inicio) > agora.getTime()));
  const proxima = futuras[0];
  const vaga = notificacoes?.find((n) => n.tipo === "vaga" && !n.lidaEm && n.dados?.inicio && Date.parse(n.dados.inicio) > agora.getTime());
  const activas = espera?.filter((e) => e.estado === "activa").length ?? 0;
  const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

  const atalhos: { para: string; rotulo: string; detalhe: string; Icone: ComponentType<LucideProps> }[] = [
    { para: "/consultas", rotulo: "Minhas consultas", detalhe: futuras.length ? plural(futuras.length, "marcada", "marcadas") : "Nenhuma marcada", Icone: CalendarDays },
    { para: "/lista-de-espera", rotulo: "Lista de espera", detalhe: activas ? plural(activas, "pedido activo", "pedidos activos") : "Sem pedidos", Icone: Hourglass },
    { para: "/familiares", rotulo: "Meus familiares", detalhe: familiares?.length ? familiares.map((f) => primeiroNome(f.paciente.nome)).join(", ") : "Marcar por filhos ou pais", Icone: Users },
    { para: "/clinica", rotulo: "Contactar clínica", detalhe: "WhatsApp, telefone e mapa", Icone: Phone },
  ];

  return (
    <Pagina>
      <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <div className="min-w-0">
          <div className="relative isolate overflow-hidden rounded-[32px] bg-esperanca-800 px-6 pb-7 pt-5 sm:px-9 sm:pb-9 sm:pt-9">
            <img src={FOTOS.abertura} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,rgba(8,59,55,0.92)_0%,rgba(12,87,81,0.84)_50%,rgba(22,131,122,0.7)_100%)]" />
            <div className="flex items-center justify-between lg:hidden">
              <Simbolo className="h-9 w-9" clara />
              <Link to="/perfil" aria-label="Perfil" className="rounded-full ring-2 ring-white/30">
                <Avatar nome={u.nome} tamanho="sm" />
              </Link>
            </div>

            <h1 className="mt-8 font-serif text-[2.625rem] leading-[1.08] tracking-[-0.02em] text-white lg:mt-0 lg:text-[3rem]">Olá, {primeiroNome(u.nome)}</h1>
            <p className="mt-2 text-lg text-white/80">Pronto para cuidar da sua saúde?</p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Botao variante="claro" tamanho="xl" larguraTotal className="sm:w-auto sm:px-10" icone={<Plus className="h-6 w-6" strokeWidth={2.5} />} onClick={() => navigate("/marcar")}>
                Marcar consulta
              </Botao>
              {clinica?.whatsapp && (
                <a
                  href={linkWhatsApp(clinica.whatsapp, mensagens.agendar(clinica))}
                  target="_blank"
                  rel="noreferrer"
                  className="vidro-foto inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 font-semibold text-white transition-colors hover:bg-white/20"
                >
                  <LogoWhatsApp className="h-5 w-5" />
                  Agendar pelo WhatsApp
                </a>
              )}
            </div>
          </div>

          {vaga?.dados?.inicio && (
            <div className="anim-surgir mt-7 flex flex-col gap-3 rounded-cartao border border-esperanca-200 bg-esperanca-50 p-4 sm:flex-row sm:items-center">
              <Sparkles className="h-5 w-5 shrink-0 text-esperanca" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-tinta">{vaga.titulo}</p>
                <p className="text-sm text-grafite">{vaga.corpo}</p>
              </div>
              <Botao tamanho="sm" onClick={() => navigate(`/marcar?medico=${vaga.dados!.medicoId}&inicio=${encodeURIComponent(vaga.dados!.inicio!)}&vaga=${vaga.id}`)}>
                Marcar esta vaga
              </Botao>
            </div>
          )}

          <section className="mt-10" aria-labelledby="titulo-proxima">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="titulo-proxima" className="text-lg font-bold text-tinta">
                Próxima consulta
              </h2>
              {futuras.length > 1 && (
                <Link to="/consultas" className="text-sm font-semibold text-esperanca underline-offset-4 hover:underline">
                  Ver as {futuras.length}
                </Link>
              )}
            </div>
            {!consultas ? (
              <Esqueleto className="h-[270px] max-w-xl" />
            ) : proxima ? (
              <Senha
                className="max-w-xl"
                medico={`${proxima.medico.titulo} ${proxima.medico.nome}`}
                fotoMedico={proxima.medico.fotoUrl}
                especialidade={proxima.especialidade.nome}
                icone={proxima.especialidade.icone}
                dia={diaDe(proxima.inicio)}
                hora={horaDe(proxima.inicio)}
                estado={proxima.estado}
                paraQuem={paraQuem(proxima)}
                accoes={
                  <>
                    <Botao variante="secundario" onClick={() => navigate(`/consultas/${proxima.id}`)}>
                      Ver consulta
                    </Botao>
                    <Botao variante="suave" disabled={!ESTADOS_ALTERAVEIS.includes(proxima.estado)} onClick={() => navigate(`/marcar?reagendar=${proxima.id}`)}>
                      Reagendar
                    </Botao>
                  </>
                }
              />
            ) : (
              <div className="max-w-xl rounded-senha border-2 border-dashed border-linha-forte px-6 py-10 text-center">
                <p className="font-serif text-2xl text-tinta">Ainda não tem consultas marcadas</p>
                <p className="mt-1 text-grafite">Escolha a especialidade e o horário em poucos toques.</p>
              </div>
            )}
          </section>
        </div>

        <nav aria-label="Atalhos" className="grid grid-cols-2 content-start gap-3 lg:grid-cols-1">
          {atalhos.map((a) => (
            <Link key={a.para} to={a.para} className="flex flex-col gap-3 rounded-[24px] border border-linha bg-white p-4 transition-colors hover:border-esperanca-300 hover:bg-esperanca-50/50 lg:flex-row lg:items-center">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-esperanca-50 text-esperanca">
                <a.Icone className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold leading-6 text-tinta">{a.rotulo}</span>
                <span className="block truncate text-sm text-grafite">{a.detalhe}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </Pagina>
  );
}

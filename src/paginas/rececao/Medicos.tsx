import { Camera, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Alternar } from "../../componentes/agenda/EditorHorario";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { Folha } from "../../componentes/Folha";
import { Pagina } from "../../componentes/Shell";
import { Avatar, Botao, CabecalhoPagina, Campo, Esqueleto, Filtro, Interruptor, Segmentado, Seleccao, cx, estiloBotao } from "../../componentes/ui";
import type { DadosMedico } from "../../lib/dados/repositorio";
import { repo } from "../../lib/dados";
import { reduzirFoto } from "../../lib/foto";
import { resumoHorario } from "../../lib/horario";
import { plural } from "../../lib/texto";
import type { Especialidade, Medico } from "../../lib/tipos";
import { useDados } from "../../lib/usarDados";
import { telefoneLegivel } from "../../lib/whatsapp";

export const medicoEmBranco = (especialidadeId = ""): DadosMedico => ({
  titulo: "Dr.",
  nome: "",
  especialidadeId,
  telefone: "",
  email: "",
  fotoUrl: null,
  activo: true,
  duracaoMin: 30,
  podeEditarDisponibilidade: false,
});

export function FormMedico({ dados, especialidades, aoFechar, aoGuardar }: { dados: DadosMedico | null; especialidades: Especialidade[]; aoFechar: () => void; aoGuardar: (m: Medico) => void }) {
  const avisar = useAviso();
  const [f, setF] = useState<DadosMedico | null>(dados);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    setF(dados);
    setErro(null);
  }, [dados]);

  async function guardar() {
    if (!f) return;
    if (!f.especialidadeId) return setErro("Escolha a especialidade.");
    setAGuardar(true);
    setErro(null);
    try {
      const m = await repo().guardarMedico({ ...f, telefone: f.telefone.replace(/\D/g, "").replace(/^244/, "") });
      avisar(f.id ? "Dados do médico guardados." : `${m.titulo} ${m.nome} foi adicionado. Falta definir o horário.`);
      aoGuardar(m);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <Folha
      aberta={!!dados}
      aoFechar={aoFechar}
      titulo={dados?.id ? "Editar médico" : "Adicionar médico"}
      rodape={
        <Botao tamanho="lg" larguraTotal onClick={guardar} aCarregar={aGuardar}>
          {dados?.id ? "Guardar" : "Adicionar médico"}
        </Botao>
      }
    >
      {f && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar nome={`${f.titulo} ${f.nome || "?"}`} foto={f.fotoUrl} tamanho="xl" />
            <div className="flex flex-col items-start gap-1.5">
              <label className={cx(estiloBotao({ variante: "secundario", tamanho: "sm" }), "cursor-pointer focus-within:ring-2 focus-within:ring-esperanca")}>
                <Camera aria-hidden="true" />
                {f.fotoUrl ? "Trocar foto" : "Escolher foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const ficheiro = e.target.files?.[0];
                    if (!ficheiro) return;
                    try {
                      setF({ ...f, fotoUrl: await reduzirFoto(ficheiro) });
                    } catch (x) {
                      setErro(mensagemDeErro(x));
                    }
                  }}
                />
              </label>
              {f.fotoUrl && (
                <button type="button" onClick={() => setF({ ...f, fotoUrl: null })} className="text-sm text-grafite underline underline-offset-4 hover:text-tinta">
                  Tirar foto
                </button>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-tinta">Título</p>
            <Segmentado
              rotulo="Título"
              valor={f.titulo}
              aoMudar={(titulo) => setF({ ...f, titulo })}
              opcoes={[
                { valor: "Dr.", rotulo: "Dr." },
                { valor: "Dra.", rotulo: "Dra." },
              ]}
            />
          </div>
          <Campo rotulo="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoComplete="off" />
          <Seleccao rotulo="Especialidade" value={f.especialidadeId} onChange={(e) => setF({ ...f, especialidadeId: e.target.value })}>
            <option value="">Escolha</option>
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Seleccao>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Telemóvel" inputMode="tel" value={telefoneLegivel(f.telefone)} onChange={(e) => setF({ ...f, telefone: e.target.value })} />
            <Campo rotulo="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} dica="Para o médico entrar na própria agenda." />
          </div>
          <Seleccao rotulo="Duração de cada consulta" value={String(f.duracaoMin)} onChange={(e) => setF({ ...f, duracaoMin: Number(e.target.value) })}>
            {[15, 20, 30, 45, 60].map((n) => (
              <option key={n} value={n}>
                {n} minutos
              </option>
            ))}
          </Seleccao>
          <div className="space-y-4 rounded-cartao border border-linha p-4">
            <Interruptor rotulo="A receber marcações" descricao="Desligado, deixa de aparecer aos pacientes." ligado={f.activo} aoMudar={(activo) => setF({ ...f, activo })} />
            <Interruptor
              rotulo="Pode alterar a própria disponibilidade"
              descricao="Abre e fecha horários e marca ausências sem passar pela receção."
              ligado={f.podeEditarDisponibilidade}
              aoMudar={(podeEditarDisponibilidade) => setF({ ...f, podeEditarDisponibilidade })}
            />
          </div>
          {erro && (
            <p role="alert" className="text-sm font-semibold text-estado-vermelho">
              {erro}
            </p>
          )}
        </div>
      )}
    </Folha>
  );
}

export function Medicos() {
  const avisar = useAviso();
  const navigate = useNavigate();
  const { dados } = useDados(
    async (r) => {
      const [medicos, especialidades, horarios] = await Promise.all([r.medicos(), r.especialidades(), r.horarios()]);
      return { medicos, especialidades, horarios };
    },
    [],
    ["medicos", "especialidades", "horarios"],
  );
  const [form, setForm] = useState<DadosMedico | null>(null);
  const [filtro, setFiltro] = useState("");

  if (!dados)
    return (
      <Pagina largura="larga">
        <Esqueleto className="h-96" />
      </Pagina>
    );

  const lista = dados.medicos.filter((m) => !filtro || m.especialidadeId === filtro).sort((a, b) => Number(b.activo) - Number(a.activo));
  const activos = dados.medicos.filter((m) => m.activo).length;

  async function alternar(m: Medico, activo: boolean) {
    try {
      await repo().guardarMedico({ ...m, activo });
      avisar(activo ? `${m.titulo} ${m.nome} volta a receber marcações.` : `${m.titulo} ${m.nome} deixou de aparecer aos pacientes.`);
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
    }
  }

  return (
    <Pagina largura="larga">
      <CabecalhoPagina
        titulo="Médicos"
        texto={`${plural(activos, "médico", "médicos")} a receber marcações`}
        accoes={
          <Botao icone={<Plus className="h-5 w-5" />} onClick={() => setForm(medicoEmBranco(dados.especialidades[0]?.id))}>
            Adicionar médico
          </Botao>
        }
      />
      <Filtro rotulo="Especialidade" value={filtro} onChange={(e) => setFiltro(e.target.value)} className="mb-4 sm:w-60">
        <option value="">Todas as especialidades</option>
        {dados.especialidades.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </Filtro>

      <ul className="anim-lista grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((m) => {
          const horario = resumoHorario(dados.horarios.filter((h) => h.medicoId === m.id));
          const nome = `${m.titulo} ${m.nome}`;
          return (
            <li key={m.id} className={cx("cartao flex flex-col p-5", !m.activo && "bg-white/60")}>
              <div className="flex items-start gap-4">
                <Avatar nome={nome} foto={m.fotoUrl} tamanho="lg" className={cx(!m.activo && "opacity-60")} />
                <div className="min-w-0 flex-1">
                  <Link to={`/rececao/medicos/${m.id}`} className="block truncate rounded-botao font-serif text-xl leading-7 text-tinta hover:text-esperanca">
                    {nome}
                  </Link>
                  <p className="truncate text-grafite">{dados.especialidades.find((e) => e.id === m.especialidadeId)?.nome ?? "Sem especialidade"}</p>
                  <p className="num text-sm text-grafite">{telefoneLegivel(m.telefone)}</p>
                </div>
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-grafite">Dias de atendimento</dt>
                  <dd className="text-right font-semibold text-tinta">{horario?.dias ?? "Sem horário"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-grafite">Horário de trabalho</dt>
                  <dd className="num text-right font-semibold text-tinta">{horario?.horas ?? "Por definir"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-grafite">Cada consulta</dt>
                  <dd className="num text-right font-semibold text-tinta">{m.duracaoMin} min</dd>
                </div>
              </dl>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-linha pt-4 [margin-top:1rem]">
                <span className="flex items-center gap-2.5 text-sm font-semibold text-tinta">
                  <Alternar ligado={m.activo} rotulo={`${nome} a receber marcações`} aoMudar={(v) => alternar(m, v)} />
                  {m.activo ? "Activo" : "Inactivo"}
                </span>
                <Link to={`/rececao/medicos/${m.id}`} className={estiloBotao({ variante: "secundario", tamanho: "sm" })}>
                  Horários e bloqueios
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <FormMedico
        dados={form}
        especialidades={dados.especialidades}
        aoFechar={() => setForm(null)}
        aoGuardar={(m) => {
          const eraNovo = !form?.id;
          setForm(null);
          if (eraNovo) navigate(`/rececao/medicos/${m.id}`);
        }}
      />
    </Pagina>
  );
}

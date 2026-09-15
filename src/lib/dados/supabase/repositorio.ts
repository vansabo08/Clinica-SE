// Repositório Supabase.
//
// As regras de agenda vivem na base de dados (supabase/migrations): as
// marcações passam por funções (RPC) que validam horário, bloqueios, passado
// e sobreposições, e as tabelas estão protegidas por RLS. Aqui só se
// traduzem nomes e erros.
//
// Tempo real: as mudanças de agenda chegam por um canal "broadcast" que só
// diz *o que* mudou (nunca quem marcou); as notificações e a lista de espera
// chegam por postgres_changes, filtradas pela RLS de cada utilizador.

import { createClient, type PostgrestError, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { type CodigoErroAgenda, erroAgenda } from "../../disponibilidade";
import type {
  Bloqueio,
  Clinica,
  ConsultaDetalhada,
  EntradaEsperaDetalhada,
  Especialidade,
  EstadoConsulta,
  FamiliarDetalhado,
  HorarioTrabalho,
  Indisponivel,
  Medico,
  Notificacao,
  Paciente,
  PacienteResumo,
  Parentesco,
  Utilizador,
} from "../../tipos";
import type { Dia } from "../../tempo";
import type { DadosEspecialidade, DadosMedico, FiltroConsultas, NovaConsulta, NovaConta, PeriodoTrabalho, Repositorio, Tabela } from "../repositorio";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Linha = Record<string, any>;

const CODIGOS: CodigoErroAgenda[] = ["passado", "fora_do_horario", "bloqueado", "ocupado", "paciente_ocupado", "medico_inactivo", "sem_permissao", "nao_encontrada", "estado_invalido"];
const TODAS: Tabela[] = ["clinica", "especialidades", "medicos", "horarios", "bloqueios", "consultas", "pacientes", "familiares", "espera", "notificacoes"];

const CLINICA_POR_OMISSAO: Clinica = {
  nome: "Clínica Sagrada Esperança",
  endereco: "",
  cidade: "Luanda",
  telefone: (import.meta.env.VITE_WHATSAPP_CLINICA as string | undefined) ?? "",
  whatsapp: (import.meta.env.VITE_WHATSAPP_CLINICA as string | undefined) ?? "",
  email: "",
  horario: "",
  latitude: -8.8383,
  longitude: 13.2344,
};

function traduzir(e: { message?: string; code?: string } | null): Error {
  const msg = (e?.message ?? "").trim();
  const codigo = CODIGOS.find((c) => msg === c || msg.startsWith(`${c}:`));
  if (codigo) return erroAgenda(codigo);
  if (e?.code === "23P01") return erroAgenda(msg.includes("paciente") ? "paciente_ocupado" : "ocupado");
  if (e?.code === "42501" || /row-level security/i.test(msg)) return erroAgenda("sem_permissao");
  if (/Invalid login credentials/i.test(msg)) return new Error("Email ou palavra-passe incorrectos.");
  if (/already registered/i.test(msg)) return new Error("Já existe uma conta com este email. Entre com ela.");
  if (/Email not confirmed/i.test(msg)) return new Error("Falta confirmar o email. Abra a mensagem que enviámos e depois entre.");
  if (/Password should be/i.test(msg)) return new Error("A palavra-passe precisa de pelo menos 6 caracteres.");
  if (/rate limit|only request this after/i.test(msg)) return new Error("Já enviámos um email há pouco. Espere um minuto e tente de novo.");
  if (/should be different from the old password/i.test(msg)) return new Error("A nova palavra-passe tem de ser diferente da actual.");
  if (/Auth session missing/i.test(msg)) return new Error("A sessão terminou. Peça um novo link para criar a palavra-passe.");
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return new Error("Sem ligação à internet. Verifique a rede e tente de novo.");
  return new Error(msg || "Não foi possível concluir. Tente de novo.");
}

/** Sem tipos gerados do esquema, as linhas chegam como Linha e são mapeadas à mão. */
async function ler<T = Linha>(pedido: PromiseLike<{ data: unknown; error: PostgrestError | null }>): Promise<T> {
  const { data, error } = await pedido;
  if (error) throw traduzir(error);
  return data as T;
}

const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);
const hhmm = (v: string) => v.slice(0, 5);

const aEspecialidade = (r: Linha): Especialidade => ({ id: r.id, nome: r.nome, descricao: r.descricao ?? "", icone: r.icone ?? "outra", ordem: r.ordem ?? 0, activa: r.activa });

const aMedico = (r: Linha): Medico => ({
  id: r.id,
  userId: r.user_id,
  titulo: r.titulo,
  nome: r.nome,
  especialidadeId: r.specialty_id,
  telefone: r.telefone ?? "",
  email: r.email ?? "",
  fotoUrl: r.foto_url,
  activo: r.activo,
  duracaoMin: r.duracao_min,
  podeEditarDisponibilidade: r.pode_editar_disponibilidade,
});

const aHorario = (r: Linha): HorarioTrabalho => ({ id: r.id, medicoId: r.doctor_id, diaSemana: r.dia_semana, inicio: hhmm(r.inicio), fim: hhmm(r.fim) });

const aBloqueio = (r: Linha): Bloqueio => ({ id: r.id, medicoId: r.doctor_id, inicio: iso(r.inicio)!, fim: iso(r.fim)!, motivo: r.motivo, nota: r.nota ?? "" });

const aPaciente = (r: Linha): Paciente => ({
  id: r.id,
  userId: r.user_id,
  nome: r.nome,
  telefone: r.telefone ?? "",
  dataNascimento: r.data_nascimento,
  lembreteWhatsapp: r.lembrete_whatsapp,
  criadoEm: iso(r.criado_em)!,
});

const aNotificacao = (r: Linha): Notificacao => ({
  id: r.id,
  userId: r.user_id,
  tipo: r.tipo,
  titulo: r.titulo,
  corpo: r.corpo,
  consultaId: r.appointment_id,
  canal: r.canal,
  agendadaPara: iso(r.agendada_para)!,
  enviadaEm: iso(r.enviada_em),
  lidaEm: iso(r.lida_em),
  dados: r.dados ? { medicoId: r.dados.medico_id, especialidadeId: r.dados.especialidade_id, inicio: iso(r.dados.inicio) ?? undefined } : null,
});

// Em doctors só se lêem colunas públicas; telefone e email vêm de medicos_completos() (equipa).
const COLUNAS_MEDICO = "id,user_id,titulo,nome,specialty_id,foto_url,activo,duracao_min,pode_editar_disponibilidade";
const SELECCAO_CONSULTA = "*, patient:patients(id,nome,telefone,data_nascimento), doctor:doctors(id,titulo,nome,foto_url), specialty:specialties(id,nome,icone)";

export class RepositorioSupabase implements Repositorio {
  readonly modo = "supabase" as const;
  private readonly sb: SupabaseClient;
  private readonly ouvintes = new Set<(t: Tabela[]) => void>();
  private canais: RealtimeChannel[] = [];
  private cacheUtilizador: Promise<Utilizador | null> | null = null;

  constructor(url: string, chave: string) {
    // flowType implicit: o link do email de recuperação traz type=recovery no endereço (ver linkRecuperacao.ts).
    this.sb = createClient(url, chave, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
    this.sb.auth.onAuthStateChange((evento) => {
      if (evento === "TOKEN_REFRESHED") return;
      this.cacheUtilizador = null;
      this.ligarCanais();
      this.emitir(["sessao", ...TODAS]);
    });
    this.ligarCanais();
  }

  private emitir(tabelas: Tabela[]) {
    for (const o of this.ouvintes) o(tabelas);
  }

  private ligarCanais() {
    for (const c of this.canais) this.sb.removeChannel(c);
    const agenda = this.sb.channel("agenda").on("broadcast", { event: "mudou" }, ({ payload }) => this.emitir((payload?.tabelas as Tabela[]) ?? ["consultas"]));
    const pessoais = this.sb
      .channel("pessoais")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => this.emitir(["notificacoes"]))
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, () => this.emitir(["espera"]))
      .on("postgres_changes", { event: "*", schema: "public", table: "family_members" }, () => this.emitir(["familiares"]))
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, () => this.emitir(["pacientes"]));
    agenda.subscribe();
    pessoais.subscribe();
    this.canais = [agenda, pessoais];
  }

  aoMudar(ouvinte: (tabelas: Tabela[]) => void) {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  }

  // ------------------------------------------------------------
  // Sessão
  // ------------------------------------------------------------

  private utilizador(): Promise<Utilizador | null> {
    this.cacheUtilizador ??= (async () => {
      const { data } = await this.sb.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) return null;
      const [perfil, paciente, medico] = await Promise.all([
        ler(this.sb.from("users").select("*").eq("id", uid).maybeSingle()),
        ler(this.sb.from("patients").select("id").eq("user_id", uid).maybeSingle()),
        ler(this.sb.from("doctors").select("id").eq("user_id", uid).maybeSingle()),
      ]);
      if (!perfil) return null;
      return {
        id: uid,
        papel: perfil.papel,
        nome: perfil.nome,
        email: perfil.email ?? data.session!.user.email ?? "",
        telefone: perfil.telefone ?? "",
        pacienteId: (paciente as Linha | null)?.id ?? null,
        medicoId: (medico as Linha | null)?.id ?? null,
      } satisfies Utilizador;
    })();
    return this.cacheUtilizador;
  }

  private async exigir(): Promise<Utilizador> {
    const u = await this.utilizador();
    if (!u) throw erroAgenda("sem_permissao");
    return u;
  }

  sessaoActual() {
    return this.utilizador();
  }

  async entrar(email: string, senha: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) throw traduzir(error);
    this.cacheUtilizador = null;
    return this.exigir();
  }

  async criarConta(d: NovaConta) {
    const telefone = d.telefone.replace(/\D/g, "").replace(/^244/, "");
    if (!d.nome.trim()) throw new Error("Escreva o seu nome.");
    if (telefone.length !== 9) throw new Error("O número de telemóvel precisa de 9 dígitos.");
    const { data, error } = await this.sb.auth.signUp({ email: d.email.trim(), password: d.senha, options: { data: { nome: d.nome.trim(), telefone } } });
    if (error) throw traduzir(error);
    if (!data.session) throw new Error("Conta criada. Enviámos um email para a confirmar: abra-o e depois entre.");
    this.cacheUtilizador = null;
    return this.exigir();
  }

  async pedirNovaSenha(email: string) {
    const destino = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(destino)) throw new Error("Esse email não parece completo.");
    // O Supabase responde igual exista ou não a conta, para não revelar quem é paciente.
    const { error } = await this.sb.auth.resetPasswordForEmail(destino, { redirectTo: `${window.location.origin}/nova-palavra-passe` });
    if (error) throw traduzir(error);
    return { enviado: true };
  }

  async mudarSenha(nova: string, actual?: string) {
    const u = await this.exigir();
    if (nova.length < 6) throw new Error("A nova palavra-passe precisa de pelo menos 6 caracteres.");
    if (actual !== undefined) {
      const { error } = await this.sb.auth.signInWithPassword({ email: u.email, password: actual });
      if (error) throw new Error("A palavra-passe actual não está certa.");
    }
    const { error } = await this.sb.auth.updateUser({ password: nova });
    if (error) throw traduzir(error);
  }

  async sair() {
    await this.sb.auth.signOut();
  }

  // ------------------------------------------------------------
  // Clínica, especialidades, médicos, horários, bloqueios
  // ------------------------------------------------------------

  async clinica(): Promise<Clinica> {
    const r = await ler(this.sb.from("clinic_settings").select("*").eq("id", 1).maybeSingle());
    if (!r) return CLINICA_POR_OMISSAO;
    const l = r as Linha;
    return { nome: l.nome, endereco: l.endereco, cidade: l.cidade, telefone: l.telefone, whatsapp: l.whatsapp, email: l.email, horario: l.horario, latitude: l.latitude, longitude: l.longitude };
  }

  async guardarClinica(c: Clinica) {
    await ler(this.sb.from("clinic_settings").upsert({ id: 1, ...c }));
    this.emitir(["clinica"]);
  }

  async especialidades() {
    return (await ler(this.sb.from("specialties").select("*").eq("activa", true).order("ordem"))).map(aEspecialidade);
  }

  async guardarEspecialidade(e: DadosEspecialidade) {
    const linha = { nome: e.nome.trim(), descricao: e.descricao.trim(), icone: e.icone, ordem: e.ordem, activa: e.activa };
    if (!linha.nome) throw new Error("Dê um nome à especialidade.");
    const r = e.id
      ? await ler(this.sb.from("specialties").update(linha).eq("id", e.id).select().single())
      : await ler(this.sb.from("specialties").insert(linha).select().single());
    this.emitir(["especialidades"]);
    return aEspecialidade(r as Linha);
  }

  async removerEspecialidade(id: string) {
    await ler(this.sb.rpc("remover_especialidade", { p_id: id }));
    this.emitir(["especialidades"]);
  }

  async medicos() {
    const u = await this.utilizador();
    const equipa = u?.papel === "rececao" || u?.papel === "admin";
    const linhas = equipa ? await ler(this.sb.rpc("medicos_completos")) : await ler(this.sb.from("doctors").select(COLUNAS_MEDICO).order("nome"));
    return (linhas as Linha[]).map(aMedico);
  }

  async guardarMedico(m: DadosMedico) {
    if (!m.nome.trim()) throw new Error("Escreva o nome do médico.");
    const linha = {
      titulo: m.titulo,
      nome: m.nome.trim(),
      specialty_id: m.especialidadeId,
      telefone: m.telefone,
      email: m.email.trim() || null,
      foto_url: m.fotoUrl,
      activo: m.activo,
      duracao_min: m.duracaoMin,
      pode_editar_disponibilidade: m.podeEditarDisponibilidade,
    };
    // Só se devolve o id: telefone e email não se lêem da tabela, vêm de medicos_completos().
    const r = m.id ? await ler(this.sb.from("doctors").update(linha).eq("id", m.id).select("id").single()) : await ler(this.sb.from("doctors").insert(linha).select("id").single());
    this.emitir(["medicos"]);
    return (await this.medicos()).find((x) => x.id === r.id)!;
  }

  async convidarMedico(medicoId: string) {
    const { error } = await this.sb.functions.invoke("convidar-medico", { body: { medicoId } });
    if (error) throw traduzir(error);
    return { enviado: true };
  }

  async horarios(medicoId?: string) {
    let q = this.sb.from("schedules").select("*");
    if (medicoId) q = q.eq("doctor_id", medicoId);
    return (await ler(q)).map(aHorario);
  }

  async guardarHorarios(medicoId: string, periodos: PeriodoTrabalho[]) {
    await ler(this.sb.rpc("guardar_horarios", { p_doctor: medicoId, p_periodos: periodos.map((p) => ({ dia_semana: p.diaSemana, inicio: p.inicio, fim: p.fim })) }));
    this.emitir(["horarios"]);
  }

  async bloqueios(f: { medicoId?: string; de?: string; ate?: string } = {}) {
    let q = this.sb.from("blocked_slots").select("*").order("inicio");
    if (f.medicoId) q = q.or(`doctor_id.eq.${f.medicoId},doctor_id.is.null`);
    if (f.de) q = q.gt("fim", f.de);
    if (f.ate) q = q.lt("inicio", f.ate);
    return (await ler(q)).map(aBloqueio);
  }

  async bloquear(b: Omit<Bloqueio, "id">) {
    const r = await ler(this.sb.from("blocked_slots").insert({ doctor_id: b.medicoId, inicio: b.inicio, fim: b.fim, motivo: b.motivo, nota: b.nota }).select().single());
    this.emitir(["bloqueios"]);
    return aBloqueio(r as Linha);
  }

  async desbloquear(id: string) {
    await ler(this.sb.from("blocked_slots").delete().eq("id", id));
    this.emitir(["bloqueios"]);
  }

  async indisponiveis(medicoId: string, de: string, ate: string): Promise<Indisponivel[]> {
    const linhas = await ler(this.sb.rpc("agenda_indisponivel", { p_doctor: medicoId, p_de: de, p_ate: ate }));
    return (linhas as Linha[]).map((l) => ({ medicoId: l.doctor_id, inicio: iso(l.inicio)!, fim: iso(l.fim)!, tipo: l.tipo }));
  }

  // ------------------------------------------------------------
  // Consultas
  // ------------------------------------------------------------

  private async detalhar(linhas: Linha[]): Promise<ConsultaDetalhada[]> {
    const u = await this.utilizador();
    const parentescos = new Map<string, Parentesco>();
    if (u?.pacienteId) {
      const fam = await ler(this.sb.from("family_members").select("patient_id,parentesco").eq("guardian_id", u.pacienteId));
      for (const f of fam as Linha[]) parentescos.set(f.patient_id, f.parentesco);
    }
    // "Primeira consulta" só interessa em listas curtas (dia, detalhe).
    const primeiras = new Map<string, number>();
    if (u && u.papel !== "paciente" && linhas.length > 0 && linhas.length <= 80) {
      const ids = [...new Set(linhas.map((l) => l.patient_id as string))];
      const r = await ler(this.sb.rpc("primeiras_consultas", { p_patients: ids }));
      for (const x of r as Linha[]) primeiras.set(x.patient_id, Date.parse(x.primeira));
    }
    return linhas.map((l) => ({
      id: l.id,
      pacienteId: l.patient_id,
      medicoId: l.doctor_id,
      especialidadeId: l.specialty_id,
      inicio: iso(l.inicio)!,
      fim: iso(l.fim)!,
      estado: l.estado as EstadoConsulta,
      observacao: l.observacao ?? "",
      canal: l.canal,
      marcadaPor: l.marcada_por,
      criadaEm: iso(l.criada_em)!,
      confirmadaEm: iso(l.confirmada_em),
      canceladaEm: iso(l.cancelada_em),
      reagendadaDe: iso(l.reagendada_de),
      paciente: { id: l.patient.id, nome: l.patient.nome, telefone: l.patient.telefone ?? "", dataNascimento: l.patient.data_nascimento },
      medico: { id: l.doctor.id, titulo: l.doctor.titulo, nome: l.doctor.nome, fotoUrl: l.doctor.foto_url },
      especialidade: { id: l.specialty.id, nome: l.specialty.nome, icone: l.specialty.icone },
      parentesco: parentescos.get(l.patient_id) ?? null,
      primeiraVez: !(primeiras.has(l.patient_id) && primeiras.get(l.patient_id)! < Date.parse(l.inicio)),
    }));
  }

  async consultas(f: FiltroConsultas = {}) {
    await this.exigir();
    let q = this.sb.from("appointments").select(SELECCAO_CONSULTA).order("inicio").limit(5000);
    if (f.de) q = q.gte("inicio", f.de);
    if (f.ate) q = q.lt("inicio", f.ate);
    if (f.medicoId) q = q.eq("doctor_id", f.medicoId);
    if (f.pacienteId) q = q.eq("patient_id", f.pacienteId);
    return this.detalhar(await ler(q));
  }

  async consulta(id: string) {
    await this.exigir();
    const r = await ler(this.sb.from("appointments").select(SELECCAO_CONSULTA).eq("id", id).maybeSingle());
    return r ? (await this.detalhar([r as Linha]))[0] : null;
  }

  async marcar(n: NovaConsulta) {
    const r = await ler(
      this.sb.rpc("marcar_consulta", {
        p_patient: n.pacienteId,
        p_doctor: n.medicoId,
        p_inicio: n.inicio,
        p_observacao: n.observacao ?? "",
        p_canal: n.canal ?? null,
        p_estado: n.estado ?? null,
      }),
    );
    this.emitir(["consultas", "notificacoes", "espera"]);
    return (await this.consulta((r as Linha).id))!;
  }

  async reagendar(id: string, novoInicio: string) {
    await ler(this.sb.rpc("reagendar_consulta", { p_id: id, p_inicio: novoInicio }));
    this.emitir(["consultas", "notificacoes"]);
    return (await this.consulta(id))!;
  }

  async cancelar(id: string) {
    await ler(this.sb.rpc("cancelar_consulta", { p_id: id }));
    this.emitir(["consultas", "notificacoes", "espera"]);
  }

  async mudarEstado(id: string, estado: EstadoConsulta) {
    await ler(this.sb.rpc("mudar_estado_consulta", { p_id: id, p_estado: estado }));
    this.emitir(["consultas", "notificacoes"]);
  }

  // ------------------------------------------------------------
  // Pacientes e familiares
  // ------------------------------------------------------------

  async pacientes(pesquisa = ""): Promise<PacienteResumo[]> {
    const linhas = await ler(this.sb.rpc("pacientes_resumo", { p_pesquisa: pesquisa.trim() }));
    return (linhas as Linha[]).map((l) => ({
      ...aPaciente(l),
      proximaConsulta: iso(l.proxima_consulta),
      ultimoAgendamento: iso(l.ultimo_agendamento),
      totalConsultas: Number(l.total_consultas ?? 0),
    }));
  }

  async criarPaciente(p: { nome: string; telefone: string; dataNascimento?: Dia | null }) {
    const telefone = p.telefone.replace(/\D/g, "").replace(/^244/, "");
    if (!p.nome.trim()) throw new Error("Escreva o nome do paciente.");
    if (telefone.length !== 9) throw new Error("O número de telemóvel precisa de 9 dígitos.");
    const r = await ler(this.sb.from("patients").insert({ nome: p.nome.trim(), telefone, data_nascimento: p.dataNascimento ?? null }).select().single());
    this.emitir(["pacientes"]);
    return aPaciente(r as Linha);
  }

  async meuPaciente() {
    const u = await this.utilizador();
    if (!u?.pacienteId) return null;
    const r = await ler(this.sb.from("patients").select("*").eq("id", u.pacienteId).maybeSingle());
    return r ? aPaciente(r as Linha) : null;
  }

  async actualizarPaciente(id: string, dados: Partial<Pick<Paciente, "nome" | "telefone" | "dataNascimento" | "lembreteWhatsapp">>) {
    const linha: Linha = {};
    if (dados.nome !== undefined) linha.nome = dados.nome.trim();
    if (dados.telefone !== undefined) linha.telefone = dados.telefone.replace(/\D/g, "");
    if (dados.dataNascimento !== undefined) linha.data_nascimento = dados.dataNascimento;
    if (dados.lembreteWhatsapp !== undefined) linha.lembrete_whatsapp = dados.lembreteWhatsapp;
    await ler(this.sb.from("patients").update(linha).eq("id", id));
    this.cacheUtilizador = null;
    this.emitir(["pacientes", "sessao"]);
  }

  async familiares(): Promise<FamiliarDetalhado[]> {
    const u = await this.utilizador();
    if (!u?.pacienteId) return [];
    const linhas = await ler(this.sb.from("family_members").select("*, patient:patients!family_members_patient_id_fkey(*)").eq("guardian_id", u.pacienteId));
    return (linhas as Linha[]).map((l) => ({ id: l.id, titularId: l.guardian_id, pacienteId: l.patient_id, parentesco: l.parentesco, paciente: aPaciente(l.patient) }));
  }

  async adicionarFamiliar(f: { nome: string; parentesco: Parentesco; dataNascimento?: Dia | null }) {
    if (!f.nome.trim()) throw new Error("Escreva o nome do familiar.");
    const id = await ler<string>(this.sb.rpc("adicionar_familiar", { p_nome: f.nome.trim(), p_parentesco: f.parentesco, p_data_nascimento: f.dataNascimento ?? null }));
    this.emitir(["familiares", "pacientes"]);
    return (await this.familiares()).find((x) => x.id === id)!;
  }

  async removerFamiliar(id: string) {
    await ler(this.sb.rpc("remover_familiar", { p_id: id }));
    this.emitir(["familiares"]);
  }

  // ------------------------------------------------------------
  // Lista de espera e notificações
  // ------------------------------------------------------------

  async listaEspera(): Promise<EntradaEsperaDetalhada[]> {
    await this.exigir();
    const linhas = await ler(
      this.sb
        .from("waitlist")
        .select("*, patient:patients(id,nome,telefone), specialty:specialties(id,nome), doctor:doctors(id,titulo,nome)")
        .neq("estado", "removida")
        .order("data_desejada")
        .order("criada_em"),
    );
    return (linhas as Linha[]).map((l) => ({
      id: l.id,
      pacienteId: l.patient_id,
      especialidadeId: l.specialty_id,
      medicoId: l.doctor_id,
      dataDesejada: l.data_desejada,
      estado: l.estado,
      criadaEm: iso(l.criada_em)!,
      ultimaVaga: iso(l.ultima_vaga),
      vagasOferecidas: l.vagas_oferecidas ?? 0,
      paciente: { id: l.patient.id, nome: l.patient.nome, telefone: l.patient.telefone ?? "" },
      especialidade: { id: l.specialty.id, nome: l.specialty.nome },
      medico: l.doctor ? { id: l.doctor.id, titulo: l.doctor.titulo, nome: l.doctor.nome } : null,
    }));
  }

  async entrarListaEspera(e: { pacienteId: string; especialidadeId: string; medicoId: string | null; dataDesejada: Dia }) {
    await ler(this.sb.rpc("entrar_lista_espera", { p_patient: e.pacienteId, p_specialty: e.especialidadeId, p_doctor: e.medicoId, p_data: e.dataDesejada }));
    this.emitir(["espera"]);
  }

  async sairListaEspera(id: string) {
    await ler(this.sb.from("waitlist").update({ estado: "removida" }).eq("id", id));
    this.emitir(["espera"]);
  }

  async notificacoes() {
    const u = await this.utilizador();
    if (!u) return [];
    const linhas = await ler(
      this.sb.from("notifications").select("*").eq("user_id", u.id).eq("canal", "app").lte("agendada_para", new Date().toISOString()).order("agendada_para", { ascending: false }).limit(100),
    );
    return (linhas as Linha[]).map(aNotificacao);
  }

  async marcarLida(id?: string) {
    const u = await this.exigir();
    let q = this.sb.from("notifications").update({ lida_em: new Date().toISOString() }).eq("user_id", u.id).is("lida_em", null).lte("agendada_para", new Date().toISOString());
    if (id) q = q.eq("id", id);
    await ler(q);
    this.emitir(["notificacoes"]);
  }
}

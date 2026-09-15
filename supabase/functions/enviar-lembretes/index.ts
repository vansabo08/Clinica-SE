// Envia os avisos por WhatsApp que já chegaram à hora.
//
// Lê notifications com canal = 'whatsapp', enviada_em nula e agendada_para
// no passado, e envia-os pela WhatsApp Business Cloud API (Meta) com um
// modelo aprovado. Agendar de 10 em 10 minutos (ver README).
//
// Segredos: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_MODELO_LEMBRETE
// (opcional, por omissão "lembrete_consulta") e CRON_SECRET.
// Sem token, não envia nada e os avisos ficam pendentes para quando houver.

import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const token = Deno.env.get("WHATSAPP_TOKEN");
const telefoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const modelo = Deno.env.get("WHATSAPP_MODELO_LEMBRETE") ?? "lembrete_consulta";
const segredo = Deno.env.get("CRON_SECRET");

const MAX_TENTATIVAS = 3;

/** Hora de parede em Luanda (UTC+1, sem hora de verão). */
const horaLuanda = (iso: string) => new Date(Date.parse(iso) + 3_600_000).toISOString().slice(11, 16);

async function enviarWhatsApp(para: string, parametros: string[]): Promise<string> {
  const resposta = await fetch(`https://graph.facebook.com/v21.0/${telefoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "template",
      template: {
        name: modelo,
        language: { code: "pt_PT" },
        components: [{ type: "body", parameters: parametros.map((text) => ({ type: "text", text })) }],
      },
    }),
  });
  if (!resposta.ok) throw new Error(`WhatsApp ${resposta.status}: ${await resposta.text()}`);
  const corpo = await resposta.json();
  return corpo.messages?.[0]?.id ?? "";
}

Deno.serve(async (pedido) => {
  if (segredo && pedido.headers.get("x-cron-secret") !== segredo) {
    return new Response("Proibido", { status: 403 });
  }

  const sb = createClient(url, chaveServico);
  const agora = new Date().toISOString();

  // Os avisos na aplicação não precisam de envio: fica só o registo de quando apareceram.
  await sb.from("notifications").update({ enviada_em: agora }).eq("canal", "app").is("enviada_em", null).lte("agendada_para", agora);

  if (!token || !telefoneId) {
    return Response.json({ enviadas: 0, nota: "WhatsApp por configurar: os lembretes ficam pendentes." });
  }

  const { data: clinica } = await sb.from("clinic_settings").select("nome").eq("id", 1).single();
  const { data: pendentes, error } = await sb
    .from("notifications")
    .select("id, user_id, appointment_id, tentativas")
    .eq("canal", "whatsapp")
    .is("enviada_em", null)
    .lte("agendada_para", agora)
    .lt("tentativas", MAX_TENTATIVAS)
    .order("agendada_para")
    .limit(50);
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  let enviadas = 0;
  for (const n of pendentes ?? []) {
    try {
      const { data: perfil } = await sb.from("users").select("telefone").eq("id", n.user_id).single();
      const { data: consulta } = await sb.from("appointments").select("inicio, estado").eq("id", n.appointment_id).single();
      if (!consulta || !["aguardando", "confirmada"].includes(consulta.estado)) {
        await sb.from("notifications").update({ enviada_em: agora, erro: "consulta já não está marcada" }).eq("id", n.id);
        continue;
      }
      const digitos = (perfil?.telefone ?? "").replace(/\D/g, "");
      if (digitos.length !== 9) throw new Error("paciente sem telemóvel válido");
      // Modelo sugerido: "Lembrete: você tem uma consulta amanhã às {{1}} na {{2}}."
      await enviarWhatsApp(`244${digitos}`, [horaLuanda(consulta.inicio), clinica?.nome ?? "Clínica Sagrada Esperança"]);
      await sb.from("notifications").update({ enviada_em: new Date().toISOString(), erro: null }).eq("id", n.id);
      enviadas++;
    } catch (e) {
      await sb
        .from("notifications")
        .update({ tentativas: (n.tentativas ?? 0) + 1, erro: e instanceof Error ? e.message.slice(0, 500) : String(e) })
        .eq("id", n.id);
    }
  }

  return Response.json({ enviadas, pendentes: (pendentes?.length ?? 0) - enviadas });
});

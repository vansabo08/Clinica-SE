// Convida um médico a criar conta, a partir da página do médico na receção.
//
// Só a receção e a administração o podem pedir. O convite sai pelo Supabase
// Auth; quando o médico aceita, o trigger criar_perfil liga a conta nova ao
// registo do médico pelo email e dá-lhe o papel 'medico'.
//
// Segredo opcional: SITE_URL (para onde o link do convite leva).

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: cors });

Deno.serve(async (pedido) => {
  if (pedido.method === "OPTIONS") return new Response(null, { headers: cors });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = pedido.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const { data: sessao } = await admin.auth.getUser(jwt);
  if (!sessao.user) return resposta({ message: "sem_permissao" }, 401);

  const { data: perfil } = await admin.from("users").select("papel").eq("id", sessao.user.id).single();
  if (!perfil || !["rececao", "admin"].includes(perfil.papel)) return resposta({ message: "sem_permissao" }, 403);

  const { medicoId } = await pedido.json().catch(() => ({ medicoId: null }));
  const { data: medico } = await admin.from("doctors").select("email, nome, user_id").eq("id", medicoId).single();
  if (!medico) return resposta({ message: "nao_encontrada" }, 404);
  if (medico.user_id) return resposta({ message: "Este médico já tem conta." }, 409);
  if (!medico.email) return resposta({ message: "Falta um email válido para este médico." }, 400);

  const { error } = await admin.auth.admin.inviteUserByEmail(medico.email, {
    data: { nome: medico.nome },
    redirectTo: Deno.env.get("SITE_URL") ?? undefined,
  });
  if (error) return resposta({ message: error.message }, 400);

  return resposta({ enviado: true });
});

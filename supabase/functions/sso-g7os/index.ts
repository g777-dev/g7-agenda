import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Entrada automática vinda do G7 OS (g7-flow.vercel.app → menu "G7 Agenda").
 * Recebe o token de login do G7 OS, confere no Supabase do G7 OS quem é, procura a pessoa em
 * public.g7os_sso_map e devolve uma sessão da conta da Agenda ligada a ela. A tela /entrar-g7 da Agenda
 * usa essa sessão. Quem não está na tabela continua usando o login normal (usuário e senha).
 */

const AGENDA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AGENDA_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "sb_publishable_8Tx5JEYOsy7uRALKelo1-A_tU6lbbX7";
const G7OS_URL = "https://bmigxffsoczyfctqzuhw.supabase.co";
const G7OS_KEY = "sb_publishable_WEtkLlGldBFp3QhvwYqgJw_LtvLwhT9";
const ORIGINS = ["https://g7-flow.vercel.app", "http://localhost:5173"];

const admin = createClient(AGENDA_URL, SERVICE_ROLE, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0]!,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const { token } = await req.json().catch(() => ({}));
    if (!token) return json({ error: "Sem login do G7 OS." }, 401);

    // quem é no G7 OS
    const who = await fetch(`${G7OS_URL}/auth/v1/user`, { headers: { apikey: G7OS_KEY, authorization: `Bearer ${token}` } });
    if (!who.ok) return json({ error: "Login do G7 OS inválido ou vencido." }, 401);
    const g7user = await who.json();

    const { data: map } = await admin.from("g7os_sso_map").select("agenda_email").eq("g7os_user_id", g7user.id).maybeSingle();
    if (!map) return json({ error: "Essa pessoa não tem entrada automática na Agenda." }, 403);

    // sessão da conta da Agenda (link mágico gerado e confirmado aqui mesmo, nada vai por e-mail)
    const { data: link, error: e1 } = await admin.auth.admin.generateLink({ type: "magiclink", email: map.agenda_email });
    if (e1 || !link?.properties?.hashed_token) return json({ error: `Não consegui gerar o acesso: ${e1?.message ?? "sem token"}` }, 500);
    const anon = createClient(AGENDA_URL, AGENDA_ANON, { auth: { persistSession: false } });
    const { data: s, error: e2 } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
    if (e2 || !s.session) return json({ error: `Não consegui abrir a sessão: ${e2?.message ?? "sem sessão"}` }, 500);

    return json({ access_token: s.session.access_token, refresh_token: s.session.refresh_token });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

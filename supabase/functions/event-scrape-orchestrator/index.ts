// ============================================
// event-scrape-orchestrator v1 (依頼書 #27 v2 Phase 2, 2026/5/28)
// event_sources の該当ソースを抽出 → 各ソースに event-scraper を非同期 fire
// 裏でタイムアウトしない設計 (#32 の教訓)
// ============================================
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonResponse = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MONTHLY_BUDGET_USD = 13.33;

async function checkMonthlyBudget(supabase: any): Promise<{ allowed: boolean; spent: number }> {
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0,0,0,0);
  const { data } = await supabase.from("event_scrape_logs").select("ai_cost_usd").gte("scraped_at", monthStart.toISOString());
  const spent = (data || []).reduce((s: number, r: any) => s + Number(r.ai_cost_usd || 0), 0);
  return { allowed: spent < MONTHLY_BUDGET_USD, spent };
}

async function notifyAgent(supabase: any, severity: string, title: string, body: string) {
  await supabase.from("meta_agent_notifications").insert({
    agent_name: "events_collection", notification_type: "orchestrator", title, body, severity,
  });
  if (severity === "error" || severity === "critical") {
    await supabase.from("meta_agent_state").update({
      agent_status: severity === "critical" ? "error" : "warning",
      last_error: title, updated_at: new Date().toISOString(),
    }).eq("agent_name", "events_collection");
  }
}

async function runOrchestrate(frequency: string | null, limit: number): Promise<any> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const budget = await checkMonthlyBudget(supabase);
  if (!budget.allowed) {
    await notifyAgent(supabase, "critical", "月予算上限超過", `今月の AI コスト $${budget.spent.toFixed(4)} が上限 $${MONTHLY_BUDGET_USD} を超過しました。自動収集を一時停止します。`);
    return { success: false, error: "budget_exceeded", spent_usd: budget.spent };
  }

  await supabase.from("meta_agent_state").update({
    last_run_at: new Date().toISOString(),
    agent_status: "healthy",
    updated_at: new Date().toISOString(),
  }).eq("agent_name", "events_collection");

  let q = supabase.from("event_sources").select("id, name, url, scrape_frequency, last_scraped_at")
    .eq("is_active", true).order("last_scraped_at", { ascending: true, nullsFirst: true }).limit(limit);
  if (frequency) q = q.eq("scrape_frequency", frequency);
  const { data: sources, error } = await q;
  if (error) return { success: false, error: "db_select", message: error.message };
  if (!sources || sources.length === 0) return { success: true, dispatched: 0, message: "対象ソースなし" };

  let dispatched = 0;
  for (const s of sources) {
    try {
      fetch(`${SUPABASE_URL}/functions/v1/event-scraper`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ source_id: s.id }),
      }).catch(e => console.error("[orchestrator] fire failed", s.id, e));
      dispatched++;
    } catch (e) { console.error(e); }
  }

  await supabase.from("meta_agent_state").update({
    last_success_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("agent_name", "events_collection");

  return { success: true, dispatched, total_sources: sources.length,
    budget_spent_usd: budget.spent, budget_limit_usd: MONTHLY_BUDGET_USD, frequency_filter: frequency };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let frequency: string | null = null;
  let limit = 20;
  let waitMode = false;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      if (body?.frequency) frequency = body.frequency;
      if (typeof body?.limit === "number") limit = Math.min(body.limit, 50);
      waitMode = body?.wait === true;
    }
  } catch (_) {}

  if (waitMode) {
    const result = await runOrchestrate(frequency, limit);
    return jsonResponse(result, result.success ? 200 : 500);
  }
  EdgeRuntime.waitUntil(runOrchestrate(frequency, limit).catch(err => console.error("[orchestrator] background error", err)));
  return jsonResponse({ success: true, step: "accepted", async: true, frequency_filter: frequency, limit });
});

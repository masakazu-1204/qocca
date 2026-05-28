// ============================================
// event-verifier v1 (依頼書 #27 v2 Phase 2, 2026/5/28)
// 過去30日に追加された events の official_url を再 fetch
// ページが消えてたら approval_status='expired'
// 月、5日起動 (手動 / Phase 5 で cron)
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

async function pingUrl(url: string): Promise<number> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; QoccaBot/1.0)" } });
    clearTimeout(timer);
    return res.status;
  } catch (_) { return 0; }
}

async function runVerify(days: number, limit: number): Promise<any> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  const { data: events, error } = await supabase.from("events")
    .select("id, official_url, approval_status, last_verified_at, title")
    .gte("created_at", since)
    .in("approval_status", ["auto_approved", "manual_approved"])
    .not("official_url", "eq", "")
    .order("last_verified_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) return { success: false, error: "db_select", message: error.message };
  if (!events || events.length === 0) return { success: true, verified: 0, expired: 0, message: "対象イベントなし" };

  let verified = 0, expired = 0;
  for (const e of events) {
    const status = await pingUrl(e.official_url);
    const now = new Date().toISOString();
    if (status === 0 || status === 404 || status === 410) {
      await supabase.from("events").update({
        approval_status: "expired", status: "ended", last_verified_at: now,
      }).eq("id", e.id);
      expired++;
    } else {
      await supabase.from("events").update({ last_verified_at: now }).eq("id", e.id);
    }
    verified++;
  }

  await supabase.from("meta_agent_state").update({
    last_run_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("agent_name", "events_collection");

  if (expired > 0) {
    await supabase.from("meta_agent_notifications").insert({
      agent_name: "events_collection", notification_type: "verifier",
      title: `${expired}件のイベントを expired 化`,
      body: `過去${days}日のイベント ${events.length}件を再検証し、${expired}件の official_url が存在しなくなっていたため expired としました。`,
      severity: "info",
    });
  }
  return { success: true, verified, expired };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let days = 30, limit = 50, waitMode = false;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      if (typeof body?.days === "number") days = body.days;
      if (typeof body?.limit === "number") limit = Math.min(body.limit, 100);
      waitMode = body?.wait === true;
    }
  } catch (_) {}
  if (waitMode) {
    const result = await runVerify(days, limit);
    return jsonResponse(result, result.success ? 200 : 500);
  }
  EdgeRuntime.waitUntil(runVerify(days, limit).catch(err => console.error("[verifier] background error", err)));
  return jsonResponse({ success: true, step: "accepted", async: true });
});

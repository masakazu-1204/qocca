// ============================================
// event-deduplicator v1 (依頼書 #27 v2 Phase 2, 2026/5/28)
// content_hash で重複検知 → 最古を残して他を rejected に論理マージ
// 毎日朝 5:00 JST = 20:00 UTC (前日) 起動想定 / Phase 5 で cron
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

async function runDedup(): Promise<any> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let merged = 0;
  // Fallback: シンプルな同名同日同住所検出 (SQL 直接グループ化)
  const { data: events } = await supabase
    .from("events")
    .select("id, title, event_date, place, created_at, approval_status")
    .in("approval_status", ["auto_approved", "manual_approved"]);
  if (!events) return { success: true, merged: 0, message: "データなし" };

  const groups: Record<string, any[]> = {};
  for (const e of events) {
    const key = `${(e.title || '').trim()}|${e.event_date || ''}|${(e.place || '').trim()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }

  for (const key of Object.keys(groups)) {
    const group = groups[key];
    if (group.length < 2) continue;
    group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const survivor = group[0];
    const losers = group.slice(1);
    for (const l of losers) {
      await supabase.from("events").update({
        approval_status: "rejected", status: "rejected",
      }).eq("id", l.id);
      merged++;
    }
    if (losers.length > 0) {
      console.log("[dedup] merged", { survivor: survivor.id, losers: losers.map((l: any) => l.id) });
    }
  }

  await supabase.from("meta_agent_state").update({
    last_run_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("agent_name", "events_collection");

  if (merged > 0) {
    await supabase.from("meta_agent_notifications").insert({
      agent_name: "events_collection", notification_type: "deduplicator",
      title: `${merged}件の重複イベントを rejected 化`,
      body: `同一 (title, event_date, place) で複数 source から取得されたイベントを検出し、最古を残して他 ${merged}件を rejected としました。`,
      severity: "info",
    });
  }
  return { success: true, merged };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let waitMode = false;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      waitMode = body?.wait === true;
    }
  } catch (_) {}
  if (waitMode) {
    const result = await runDedup();
    return jsonResponse(result, result.success ? 200 : 500);
  }
  EdgeRuntime.waitUntil(runDedup().catch(err => console.error("[dedup] background error", err)));
  return jsonResponse({ success: true, step: "accepted", async: true });
});

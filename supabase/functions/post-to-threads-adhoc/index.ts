// ============================================
// post-to-threads-adhoc v3 (2026/10/13): publish 前にコンテナ完成を待つ
//   【直したバグ】2026/10/12 9:00 の「今週のお題」自動投稿が 500 で落ちた (実行 3.3 秒)。
//     v2 はコンテナ作成直後に publish していた。threads-cron-handler が 2026/8/2 (v4) で直したのと同じ
//     「The requested resource does not exist」(コンテナ未完成) のタイミング問題。adhoc 側だけ取り残されていた。
//   修正: threads-cron-handler v4 と同じ waitForContainer (status FINISHED を待つ)。
//     ⚠️ 退行防止: status を返さない応答なら待たずに publish へ進む (従来動作)。
//   追加: 失敗したら threads_posts に status='failed' と理由を残す (今までは何も残らず気づけなかった)。
//   入出力 ({text, image_url?} → {success, thread_id, permalink}) は v2 と同じ。
//   ※ 本ファイルはリポジトリに無かったデプロイ実体 (v2) を取り込み、v3 にしたもの。以後はここが正。
// ----- 以下 v2 (依頼書 #125 教訓: /me/threads 使用) -----
// ============================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SNS_KILL_SWITCH = Deno.env.get("SNS_KILL_SWITCH") ?? "false";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// threads-cron-handler v4 と同じ待ち方。テキストは数秒で FINISHED になる。
async function waitForContainer(
  accessToken: string, containerId: string, maxWaitMs: number,
): Promise<{ ok: boolean; status?: string; error?: string; waitedMs: number }> {
  const started = Date.now();
  let delay = 2000;
  let sawStatus = false;
  while (Date.now() - started < maxWaitMs) {
    await sleep(delay);
    const url = `https://graph.threads.net/v1.0/${containerId}`
      + `?fields=status,error_message&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    const status = (data as any)?.status as string | undefined;

    if (status) sawStatus = true;
    if (status === "FINISHED") return { ok: true, status, waitedMs: Date.now() - started };
    if (status === "ERROR" || status === "EXPIRED") {
      return {
        ok: false, status,
        error: `container_${String(status).toLowerCase()}: ${String((data as any)?.error_message ?? "").slice(0, 300)}`,
        waitedMs: Date.now() - started,
      };
    }
    if (!sawStatus) return { ok: true, status: "unknown", waitedMs: Date.now() - started };
    delay = Math.min(Math.floor(delay * 1.5), 15000);
  }
  return { ok: false, status: "timeout", error: "container_wait_timeout", waitedMs: Date.now() - started };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (SNS_KILL_SWITCH === "true") return j({ error: "sns_kill_switch_active" }, 503);

  let text = ""; let image_url: string | null = null;
  try {
    const body = await req.json();
    text = (body?.text || "").toString();
    image_url = body?.image_url || null;
  } catch (_) {}
  if (!text || text.length > 500) return j({ error: "text_invalid" }, 400);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 失敗を残す (v3)。記録の失敗で応答を変えない。
  const recordFailure = async (reason: string) => {
    console.error("[post-to-threads-adhoc] failed:", reason);
    try {
      await supabase.from("threads_posts").insert({
        content: text, image_url, status: "failed",
        error_message: reason.slice(0, 500), scheduled_at: new Date().toISOString(), cost_usd: 0,
      });
    } catch (_) {}
  };

  const { data: conn } = await supabase
    .from("social_connections")
    .select("access_token, platform_user_id, platform_username, token_expires_at")
    .eq("platform", "threads")
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!conn?.access_token) { await recordFailure("threads_not_connected"); return j({ error: "threads_not_connected" }, 503); }
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) { await recordFailure("token_expired"); return j({ error: "token_expired" }, 401); }

  // Step 1: Container 作成 (依頼書 #125 教訓: /v1.0/me/threads 使用 / specific ID 不可)
  const cp = new URLSearchParams();
  cp.append("access_token", conn.access_token);
  cp.append("text", text);
  if (image_url) { cp.append("media_type", "IMAGE"); cp.append("image_url", image_url); }
  else cp.append("media_type", "TEXT");

  const cRes = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: cp,
  });
  const cData = await cRes.json().catch(() => ({}));
  if (!cRes.ok || !cData.id) {
    await recordFailure(`container_create_failed: ${JSON.stringify(cData).slice(0, 400)}`);
    return j({ error: "container_create_failed", meta: cData }, 500);
  }

  // Step 1.5 (v3): コンテナ完成を待つ。テキストは 25 秒まで (pg_net の 30 秒に収める)、画像は 120 秒。
  const waited = await waitForContainer(conn.access_token, cData.id, image_url ? 120000 : 25000);
  if (!waited.ok) {
    await recordFailure(waited.error || "container_not_ready");
    return j({ error: "container_not_ready", status: waited.status, waited_ms: waited.waitedMs, creation_id: cData.id }, 500);
  }

  // Step 2: Publish (ここも /me/threads_publish)
  const pp = new URLSearchParams();
  pp.append("access_token", conn.access_token);
  pp.append("creation_id", cData.id);

  const pRes = await fetch(`https://graph.threads.net/v1.0/me/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: pp,
  });
  const pData = await pRes.json().catch(() => ({}));
  if (!pRes.ok || !pData.id) {
    await recordFailure(`publish_failed: ${JSON.stringify(pData).slice(0, 400)}`);
    return j({ error: "publish_failed", meta: pData, creation_id: cData.id }, 500);
  }

  try {
    await supabase.from("threads_posts").insert({
      content: text, image_url, status: "posted",
      thread_id: pData.id, posted_at: new Date().toISOString(), cost_usd: 0,
    });
  } catch (_) {}

  return j({
    success: true, thread_id: pData.id, creation_id: cData.id,
    permalink: `https://www.threads.net/@${conn.platform_username}/post/${pData.id}`,
    posted_at: new Date().toISOString(),
    container_wait_ms: waited.waitedMs,
  });
});

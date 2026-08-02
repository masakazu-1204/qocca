// ============================================
// post-video-to-instagram v1 (2026/8/2 SNS動画 Phase 2)
//
// 目的: Instagram に「リール」を投稿する。稼働中の post-to-instagram(画像専用)には触れず、
//       別関数として実証する。動画は sns_video_assets から取る(生成元を問わない設計)。
//
// ⚠️ 画像版との決定的な違い:
//   画像版は「30秒 blind sleep して publish」。動画は処理時間が読めないため、
//   status_code が FINISHED になるまでポーリングしてから publish する。
//   (Threads で 26% の publish 失敗を起こしていたのと同じ落とし穴を、こちらでは最初から塞ぐ)
//
// ⚠️ Instagram は status_code (Threads は status)。値: IN_PROGRESS / FINISHED / ERROR / EXPIRED / PUBLISHED
//
// 呼び方: { video_id } / { pick: true } / { video_url, caption } / 共通 { dry_run, wait, max_wait_ms }
// ============================================
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SNS_KILL_SWITCH = Deno.env.get("SNS_KILL_SWITCH") ?? "false";

const PLATFORM = "instagram";
const IG_API = "https://graph.instagram.com/v21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** リールのコンテナを作る。REELS 指定が必須 (省略すると画像扱いで失敗する) */
async function createReelContainer(
  igUserId: string, token: string, videoUrl: string, caption: string,
): Promise<{ ok: boolean; creationId?: string; error?: string }> {
  const p = new URLSearchParams();
  p.append("media_type", "REELS");
  p.append("video_url", videoUrl);
  p.append("caption", caption);
  p.append("access_token", token);
  const res = await fetch(`${IG_API}/${igUserId}/media`, { method: "POST", body: p });
  const data = await res.json();
  if (!res.ok || !data?.id) {
    return { ok: false, error: `container_create_failed: ${JSON.stringify(data).slice(0, 400)}` };
  }
  return { ok: true, creationId: data.id };
}

/** status_code が FINISHED になるまで待つ。ERROR/EXPIRED は即中断。 */
async function waitForContainer(
  token: string, creationId: string, maxWaitMs: number,
): Promise<{ ok: boolean; status?: string; error?: string; waitedMs: number }> {
  const started = Date.now();
  let delay = 5000;
  while (Date.now() - started < maxWaitMs) {
    await sleep(delay);
    const res = await fetch(
      `${IG_API}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
    ).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    const code = (data as { status_code?: string })?.status_code;

    if (code === "FINISHED") return { ok: true, status: code, waitedMs: Date.now() - started };
    if (code === "ERROR" || code === "EXPIRED") {
      return {
        ok: false, status: code,
        error: `container_${code.toLowerCase()}: ${String((data as { status?: string })?.status ?? "").slice(0, 300)}`,
        waitedMs: Date.now() - started,
      };
    }
    delay = Math.min(Math.floor(delay * 1.5), 20000);
  }
  return { ok: false, status: "timeout", error: "container_wait_timeout", waitedMs: Date.now() - started };
}

type Body = { video_id?: string; pick?: boolean; video_url?: string; caption?: string; dry_run?: boolean; max_wait_ms?: number };

async function runJob(body: Body): Promise<Record<string, unknown>> {
  const startedAt = new Date().toISOString();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const dryRun = body.dry_run === true;
  const maxWaitMs = Math.min(Number(body.max_wait_ms) || 180000, 240000);

  if (SNS_KILL_SWITCH === "true") return { success: false, step: "kill_switch", started_at: startedAt };

  // ── 投稿する動画を決める ──────────────────────────
  let asset: { id: string; video_url: string; caption: string; hashtags: string | null; title: string | null } | null = null;
  let adhoc: { video_url: string; caption: string } | null = null;

  if (body.video_url) {
    adhoc = { video_url: body.video_url, caption: body.caption ?? "" };
  } else if (body.video_id || body.pick) {
    const { data: used } = await supabase.from("sns_video_uses").select("video_id").eq("platform", PLATFORM);
    const usedIds = new Set((used || []).map((r: { video_id: string }) => r.video_id));

    let q = supabase.from("sns_video_assets")
      .select("id, video_url, caption, hashtags, title, platforms").eq("is_active", true);
    if (body.video_id) q = q.eq("id", body.video_id);
    const { data: rows, error: qErr } = await q.order("created_at", { ascending: true }).limit(200);
    if (qErr) return { success: false, step: "asset_query", error: qErr.message, started_at: startedAt };

    const candidates = (rows || []).filter(
      (r: { id: string; platforms: string[] | null }) =>
        !usedIds.has(r.id) && (!r.platforms || r.platforms.includes(PLATFORM)),
    );
    if (candidates.length === 0) {
      return {
        success: false, step: body.video_id ? "video_unavailable" : "no_unused_video",
        depleted: !body.video_id, started_at: startedAt,
        hint: "sns_video_assets に instagram 未使用の動画がありません",
      };
    }
    asset = candidates[0];
  } else {
    return { success: false, step: "bad_request", error: "video_id / pick / video_url のいずれかが必要です" };
  }

  const videoUrl = adhoc?.video_url ?? asset!.video_url;
  const caption = (adhoc?.caption ?? [asset!.caption, asset!.hashtags].filter(Boolean).join("\n\n")).trim();
  if (caption.length > 2200) return { success: false, step: "caption_too_long", error: "2200文字以内" };

  if (dryRun) {
    return {
      success: true, dry_run: true, step: "dry_run", started_at: startedAt,
      video_id: asset?.id ?? null, title: asset?.title ?? null,
      video_url: videoUrl, caption_preview: caption.slice(0, 120),
    };
  }

  const { data: conn } = await supabase
    .from("social_connections")
    .select("access_token, platform_user_id, platform_username, token_expires_at")
    .eq("platform", PLATFORM).order("updated_at", { ascending: false }).limit(1).maybeSingle();

  if (!conn?.access_token) return { success: false, step: "no_connection", started_at: startedAt };
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    return { success: false, step: "token_expired", started_at: startedAt };
  }

  const { data: ip } = await supabase.from("instagram_posts").insert({
    template_id: null, caption, media_url: videoUrl,
    status: "scheduled", scheduled_at: new Date().toISOString(), cost_usd: 0,
  }).select().single();

  const created = await createReelContainer(conn.platform_user_id, conn.access_token, videoUrl, caption);
  if (!created.ok) {
    if (ip) await supabase.from("instagram_posts").update({ status: "failed", error_message: created.error?.slice(0, 500) }).eq("id", ip.id);
    return { success: false, step: "container_create", error: created.error, started_at: startedAt };
  }

  const waited = await waitForContainer(conn.access_token, created.creationId!, maxWaitMs);
  if (!waited.ok) {
    if (ip) await supabase.from("instagram_posts").update({ status: "failed", error_message: waited.error?.slice(0, 500) }).eq("id", ip.id);
    return { success: false, step: "container_wait", error: waited.error, container_status: waited.status, waited_ms: waited.waitedMs, started_at: startedAt };
  }

  const pubParams = new URLSearchParams();
  pubParams.append("creation_id", created.creationId!);
  pubParams.append("access_token", conn.access_token);
  const pubRes = await fetch(`${IG_API}/${conn.platform_user_id}/media_publish`, { method: "POST", body: pubParams });
  const pubData = await pubRes.json();
  if (!pubRes.ok || !pubData?.id) {
    const err = `publish_failed: ${JSON.stringify(pubData).slice(0, 400)}`;
    if (ip) await supabase.from("instagram_posts").update({ status: "failed", error_message: err.slice(0, 500) }).eq("id", ip.id);
    return { success: false, step: "publish", error: err, started_at: startedAt };
  }

  const mediaId = pubData.id;
  const permalink = `https://www.instagram.com/reel/${mediaId}/`;
  const postedAt = new Date().toISOString();
  if (ip) {
    await supabase.from("instagram_posts")
      .update({ status: "posted", media_id: mediaId, permalink, posted_at: postedAt }).eq("id", ip.id);
  }

  if (asset) {
    await supabase.from("sns_video_uses").insert({ video_id: asset.id, platform: PLATFORM, post_ref: mediaId });
    const { data: cur } = await supabase.from("sns_video_assets").select("use_count").eq("id", asset.id).maybeSingle();
    await supabase.from("sns_video_assets")
      .update({ use_count: (Number(cur?.use_count) || 0) + 1, last_used_at: postedAt }).eq("id", asset.id);
  }

  return {
    success: true, step: "complete", started_at: startedAt, completed_at: postedAt,
    video_id: asset?.id ?? null, media_id: mediaId, permalink,
    container_wait_ms: waited.waitedMs, caption_preview: caption.slice(0, 120),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: Body = {};
  let waitMode = false;
  try {
    if (new URL(req.url).searchParams.get("wait") === "true") waitMode = true;
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = (await req.json()) ?? {};
      if (body?.dry_run === true) waitMode = true;
      if ((body as { wait?: boolean })?.wait === true) waitMode = true;
    }
  } catch (_) { /* 壊れた body は空扱い */ }

  if (waitMode) {
    const r = await runJob(body);
    return jsonResponse(r, r.success ? 200 : 500);
  }
  EdgeRuntime.waitUntil(runJob(body).catch((e) => console.error("[post-video-to-instagram]", e)));
  return jsonResponse({ success: true, step: "accepted", async: true, received_at: new Date().toISOString() });
});

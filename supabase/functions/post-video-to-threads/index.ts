// ============================================
// post-video-to-threads v1 (2026/7/31 King指示「Higgsfield連携で動画投稿へ」)
//
// 目的: Threads に「動画」を投稿する。既存の threads-cron-handler(テキスト専用・日次稼働中)
//       には一切触れず、別関数として実証する。動画パイプラインが固まってから cron に繋ぐ。
//
// ★設計: 生成元を問わない
//   sns_video_assets.video_url しか見ない。Higgsfield でも fal.ai でも手動アップでも同じ。
//   生成エンジンを差し替えても、この関数は無傷でいられる。
//
// ⚠️ 画像と動画で決定的に違う点:
//   画像は「30秒待って publish」で足りたが、動画は処理時間が読めない。
//   → コンテナの status を FINISHED までポーリングする (盲目 sleep も盲目リトライもしない)。
//
// 呼び方:
//   { video_id: "<uuid>" }                    … プールから指定して投稿
//   { pick: true }                            … 未使用プールから1本選んで投稿
//   { video_url, caption }                    … 明示指定 (疎通確認用・プールに書かない)
//   共通: { dry_run: true } で選択だけ確認 (副作用ゼロ) / { wait: true } で同期実行
// ============================================
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SNS_KILL_SWITCH = Deno.env.get("SNS_KILL_SWITCH") ?? "false";

const PLATFORM = "threads";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Threads: 動画コンテナ作成 → 完了待ち → 公開 ──────────────────────
//   コンテナ作成は即返るが、動画は裏で処理される。status を見るまで publish してはいけない。
async function createVideoContainer(
  accessToken: string, text: string, videoUrl: string,
): Promise<{ ok: boolean; containerId?: string; error?: string }> {
  const params = new URLSearchParams();
  params.append("access_token", accessToken);
  params.append("text", text);
  params.append("media_type", "VIDEO");
  params.append("video_url", videoUrl);

  const res = await fetch("https://graph.threads.net/v1.0/me/threads", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data?.id) {
    return { ok: false, error: `container_create_failed: ${JSON.stringify(data).slice(0, 400)}` };
  }
  return { ok: true, containerId: data.id };
}

/** FINISHED になるまで待つ。ERROR/EXPIRED は即中断。制限時間を超えたら諦めて理由を返す。 */
async function waitForContainer(
  accessToken: string, containerId: string, maxWaitMs: number,
): Promise<{ ok: boolean; status?: string; error?: string; waitedMs: number }> {
  const started = Date.now();
  let delay = 5000; // 動画処理は最短でも数秒かかるので、最初から間を置く
  while (Date.now() - started < maxWaitMs) {
    await sleep(delay);
    const url = `https://graph.threads.net/v1.0/${containerId}`
      + `?fields=status,error_message&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    const status = data?.status as string | undefined;

    if (status === "FINISHED") return { ok: true, status, waitedMs: Date.now() - started };
    if (status === "ERROR" || status === "EXPIRED") {
      return {
        ok: false, status,
        error: `container_${String(status).toLowerCase()}: ${String(data?.error_message ?? "").slice(0, 300)}`,
        waitedMs: Date.now() - started,
      };
    }
    // IN_PROGRESS: 徐々に間隔を伸ばす (叩きすぎない)
    delay = Math.min(Math.floor(delay * 1.5), 20000);
  }
  return { ok: false, status: "timeout", error: "container_wait_timeout", waitedMs: Date.now() - started };
}

async function publishContainer(
  accessToken: string, containerId: string,
): Promise<{ ok: boolean; threadId?: string; error?: string }> {
  const params = new URLSearchParams();
  params.append("access_token", accessToken);
  params.append("creation_id", containerId);

  const res = await fetch("https://graph.threads.net/v1.0/me/threads_publish", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data?.id) {
    return { ok: false, error: `publish_failed: ${JSON.stringify(data).slice(0, 400)}` };
  }
  return { ok: true, threadId: data.id };
}

type Body = {
  video_id?: string;
  pick?: boolean;
  video_url?: string;
  caption?: string;
  dry_run?: boolean;
  max_wait_ms?: number;
};

async function runJob(body: Body): Promise<Record<string, unknown>> {
  const startedAt = new Date().toISOString();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const dryRun = body.dry_run === true;
  // Edge Function の実行上限を超えないよう既定は3分。呼び出し側で短縮も可能。
  const maxWaitMs = Math.min(Number(body.max_wait_ms) || 180000, 240000);

  // kill switch (既存のSNS停止スイッチをそのまま尊重する)
  const { data: settings } = await supabase
    .from("threads_post_settings").select("kill_switch").eq("id", 1).maybeSingle();
  if (settings?.kill_switch || SNS_KILL_SWITCH === "true") {
    return { success: false, step: "kill_switch", started_at: startedAt };
  }

  // ── 投稿する動画を決める ─────────────────────────────
  let asset: { id: string; video_url: string; caption: string; hashtags: string | null; title: string | null } | null = null;
  let adhoc: { video_url: string; caption: string } | null = null;

  if (body.video_url) {
    // 疎通確認用。プールに履歴を残さない (テストで在庫を消費しないため)
    adhoc = { video_url: body.video_url, caption: body.caption ?? "" };
  } else if (body.video_id || body.pick) {
    // 既に threads に出した動画は除外する (sns_video_uses が真実の記録)
    const { data: used } = await supabase
      .from("sns_video_uses").select("video_id").eq("platform", PLATFORM);
    const usedIds = new Set((used || []).map((r: { video_id: string }) => r.video_id));

    let q = supabase
      .from("sns_video_assets")
      .select("id, video_url, caption, hashtags, title, platforms")
      .eq("is_active", true);
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
        hint: "sns_video_assets に threads 未使用の動画がありません",
      };
    }
    asset = candidates[0];
  } else {
    return { success: false, step: "bad_request", error: "video_id / pick / video_url のいずれかが必要です" };
  }

  const videoUrl = adhoc?.video_url ?? asset!.video_url;
  const caption = (adhoc?.caption ?? [asset!.caption, asset!.hashtags].filter(Boolean).join("\n\n")).trim();

  if (dryRun) {
    return {
      success: true, dry_run: true, step: "dry_run", started_at: startedAt,
      video_id: asset?.id ?? null, title: asset?.title ?? null,
      video_url: videoUrl, caption_preview: caption.slice(0, 120),
    };
  }

  // ── 接続情報 ─────────────────────────────
  const { data: conn } = await supabase
    .from("social_connections")
    .select("access_token, platform_username, token_expires_at")
    .eq("platform", PLATFORM)
    .order("updated_at", { ascending: false })
    .limit(1).maybeSingle();

  if (!conn?.access_token) return { success: false, step: "no_connection", started_at: startedAt };
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    return { success: false, step: "token_expired", started_at: startedAt };
  }

  // ── 投稿記録を先に作る (失敗しても痕跡が残るように) ──────────
  const { data: tp } = await supabase
    .from("threads_posts")
    .insert({
      template_id: null, // 動画はテンプレ由来ではない
      content: caption,
      image_url: videoUrl, // 既存カラムを流用してメディアURLを残す
      status: "scheduled",
      scheduled_at: new Date().toISOString(),
      cost_usd: 0,
    }).select().single();

  // ── 作成 → 完了待ち → 公開 ─────────────────────
  const created = await createVideoContainer(conn.access_token, caption, videoUrl);
  if (!created.ok) {
    if (tp) await supabase.from("threads_posts").update({ status: "failed", error_message: created.error?.slice(0, 500) }).eq("id", tp.id);
    return { success: false, step: "container_create", error: created.error, started_at: startedAt };
  }

  const waited = await waitForContainer(conn.access_token, created.containerId!, maxWaitMs);
  if (!waited.ok) {
    if (tp) await supabase.from("threads_posts").update({ status: "failed", error_message: waited.error?.slice(0, 500) }).eq("id", tp.id);
    return {
      success: false, step: "container_wait", error: waited.error,
      container_status: waited.status, waited_ms: waited.waitedMs, started_at: startedAt,
    };
  }

  const published = await publishContainer(conn.access_token, created.containerId!);
  if (!published.ok) {
    if (tp) await supabase.from("threads_posts").update({ status: "failed", error_message: published.error?.slice(0, 500) }).eq("id", tp.id);
    return { success: false, step: "publish", error: published.error, started_at: startedAt };
  }

  const postedAt = new Date().toISOString();
  if (tp) {
    await supabase.from("threads_posts")
      .update({ status: "posted", thread_id: published.threadId, posted_at: postedAt })
      .eq("id", tp.id);
  }

  // ── 使用済みとして記録 (UNIQUE(video_id, platform) が二重投稿の最後の砦) ──
  if (asset) {
    await supabase.from("sns_video_uses").insert({
      video_id: asset.id, platform: PLATFORM, post_ref: published.threadId,
    });
    const { data: cur } = await supabase
      .from("sns_video_assets").select("use_count").eq("id", asset.id).maybeSingle();
    await supabase.from("sns_video_assets").update({
      use_count: (Number(cur?.use_count) || 0) + 1,
      last_used_at: postedAt,
    }).eq("id", asset.id);
  }

  return {
    success: true, step: "complete", started_at: startedAt, completed_at: postedAt,
    video_id: asset?.id ?? null,
    thread_id: published.threadId,
    permalink: `https://www.threads.net/@${conn.platform_username || "qocca_pet"}/post/${published.threadId}`,
    container_wait_ms: waited.waitedMs,
    caption_preview: caption.slice(0, 120),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Body = {};
  let waitMode = false;
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("wait") === "true") waitMode = true;
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = (await req.json()) ?? {};
      if (body?.dry_run === true) waitMode = true; // 確認は同期で返す
      if ((body as { wait?: boolean })?.wait === true) waitMode = true;
    }
  } catch (_) { /* 壊れた body は空扱い */ }

  if (waitMode) {
    const r = await runJob(body);
    return jsonResponse(r, r.success ? 200 : 500);
  }

  EdgeRuntime.waitUntil(
    runJob(body).catch((err) => console.error("[post-video-to-threads] background error", err)),
  );
  return jsonResponse({
    success: true, step: "accepted", async: true, received_at: new Date().toISOString(),
  });
});

// ============================================
// post-to-x v7 (依頼書 #32 A案 最終, 2026/5/30)
// v7 変更点:
//   - x-init-oauth v9 で media.write scope 追加済み
//   - King 再連携 (12:25 JST) で 新 token に media.write 付与済み
//   - X API v2 /2/media/upload (api.x.com) + media_category=tweet_image で simple upload
//   - エラー詳細を error_message に記録 (診断用)
//   - text-only fallback の仕組みを 保険として継続維持
//   - 401 エラーは 1回 refresh リトライ
// v6 (診断ログ付き production)
// v5 (4-variant debug: 全 403 判明)
// v4 (v2 endpoint 初試 - scope 不足で 403)
// v3 (v1.1 endpoint - OAuth 1.0a 未対応で 403)
// v2 (image upload 初実装)
// ============================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: any, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);

// === ヘルパー ===

async function callRefreshToken(force = false): Promise<{ ok: boolean; reason?: string }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/x-refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force_refresh: force }),
    });
    const data = await r.json();
    if (!r.ok || !data?.success) return { ok: false, reason: JSON.stringify(data).slice(0, 200) };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message };
  }
}

async function getXConnection(supabase: any) {
  return await supabase
    .from("social_connections")
    .select("access_token, platform_username, token_expires_at, metadata")
    .eq("platform", "x")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

// v7 (依頼書 #32 A案):
// King 再連携で media.write scope 付与済み → v2 endpoint (api.x.com/2/media/upload) で simple upload
// Bearer token で動作 / 5MB 以下の画像に対応 (gpt-image-1 は 一般 < 2MB)
async function uploadMediaToX(
  accessToken: string,
  imageBytes: Uint8Array,
  mimeType: string,
): Promise<{ mediaId: string | null; errorDetail: string | null }> {
  const formData = new FormData();
  const blob = new Blob([imageBytes], { type: mimeType });
  formData.append("media", blob, "image.png");
  formData.append("media_category", "tweet_image");

  const res = await fetch("https://api.x.com/2/media/upload", {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}` },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    const detail = `status=${res.status} body=${errText.slice(0, 300)}`;
    console.error("[post-to-x v7] media upload failed:", detail);
    return { mediaId: null, errorDetail: detail };
  }
  const data = await res.json();
  // v2 response: { data: { id: "1234567890", media_key: "13_1234567890" } }
  const mediaId = data?.data?.id || data?.media_id_string || data?.id || null;
  if (!mediaId) {
    return { mediaId: null, errorDetail: `no_media_id_in_response: ${JSON.stringify(data).slice(0, 200)}` };
  }
  return { mediaId, errorDetail: null };
}

async function downloadImage(url: string): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mimeType = res.headers.get("content-type") || "image/png";
    return { bytes: new Uint8Array(buf), mimeType };
  } catch (_) { return null; }
}

// === Main ===

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let xPostId: string | null = null;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      xPostId = body?.x_post_id || null;
    }
  } catch (_) {}

  if (!xPostId) return jsonResponse({ success: false, error: "x_post_id_required" }, 400);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: settings } = await supabase
    .from("x_post_settings")
    .select("kill_switch")
    .eq("id", 1)
    .single();
  if (settings?.kill_switch) {
    await supabase.from("x_posts").update({ status: "killed", error_message: "kill_switch active" }).eq("id", xPostId);
    return jsonResponse({ success: false, error: "kill_switch_active" }, 503);
  }

  const { data: xPost, error: postErr } = await supabase
    .from("x_posts").select("id, content, image_url, status, cost_usd").eq("id", xPostId).single();
  if (postErr || !xPost) return jsonResponse({ success: false, error: "post_not_found", message: postErr?.message }, 404);
  if (xPost.status !== "scheduled" && xPost.status !== "failed") {
    return jsonResponse({ success: false, error: "invalid_status", message: `status は scheduled or failed ですべき (現在: ${xPost.status})` }, 400);
  }

  // 現在の X 連携取得 + 期限チェック (残り < 5分なら refresh)
  let conn: any = (await getXConnection(supabase)).data;
  if (!conn?.access_token) {
    await supabase.from("x_posts").update({ status: "failed", error_message: "X 連携未設定" }).eq("id", xPostId);
    return jsonResponse({ success: false, error: "x_not_connected" }, 503);
  }
  let refreshAttempted = false;
  const minutesRemaining = conn.token_expires_at
    ? (new Date(conn.token_expires_at).getTime() - Date.now()) / 60000
    : -1;
  if (minutesRemaining < 5) {
    const r = await callRefreshToken(true);
    refreshAttempted = true;
    if (!r.ok) {
      await supabase.from("x_posts").update({ status: "failed", error_message: `auto_refresh_failed: ${r.reason}` }).eq("id", xPostId);
      return jsonResponse({ success: false, error: "auto_refresh_failed", message: r.reason }, 503);
    }
    conn = (await getXConnection(supabase)).data;
  }

  // image_url ありなら X media upload
  let mediaId: string | null = null;
  let mediaUploadFailed = false;
  let mediaErrorDetail: string | null = null;
  if (xPost.image_url) {
    const downloaded = await downloadImage(xPost.image_url);
    if (downloaded) {
      const uploadResult = await uploadMediaToX(conn.access_token, downloaded.bytes, downloaded.mimeType);
      mediaId = uploadResult.mediaId;
      mediaErrorDetail = uploadResult.errorDetail;
      if (!mediaId) mediaUploadFailed = true;
    } else {
      mediaUploadFailed = true;
      mediaErrorDetail = `download_failed: ${xPost.image_url.slice(0, 100)}`;
    }
  }

  // tweet 作成 (401 なら 1回 refresh リトライ)
  const tweetBody: any = { text: xPost.content };
  if (mediaId) tweetBody.media = { media_ids: [mediaId] };

  let attemptCount = 0;
  let tweetData: any = null;
  let lastStatus = 0;
  let usedAccessToken = conn.access_token;
  while (attemptCount < 2) {
    attemptCount++;
    const tweetRes = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${usedAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tweetBody),
    });
    tweetData = await tweetRes.json();
    lastStatus = tweetRes.status;
    if (tweetRes.ok && tweetData?.data?.id) break;
    if (tweetRes.status === 401 && attemptCount === 1 && !refreshAttempted) {
      const r = await callRefreshToken(true);
      refreshAttempted = true;
      if (!r.ok) break;
      const reConn = (await getXConnection(supabase)).data;
      usedAccessToken = reConn?.access_token || usedAccessToken;
      continue;
    }
    break;
  }

  if (lastStatus !== 200 && lastStatus !== 201 || !tweetData?.data?.id) {
    const errMsg = JSON.stringify(tweetData).slice(0, 500);
    await supabase.from("x_posts").update({ status: "failed", error_message: errMsg }).eq("id", xPostId);
    return jsonResponse({
      success: false, error: "x_api_error", message: errMsg,
      media_uploaded: !!mediaId, media_upload_failed: mediaUploadFailed,
      media_error_detail: mediaErrorDetail,
      refresh_attempted: refreshAttempted, last_status: lastStatus,
    }, 500);
  }

  const tweetId = tweetData.data.id;
  const postedAt = new Date().toISOString();
  const finalCost = xPost.cost_usd != null ? xPost.cost_usd : 0;

  // 画像 upload 失敗しても tweet 自体は text-only で成功 → status=posted
  // ただし error_message に診断詳細を記録 (text-only fallback 見える化)
  await supabase.from("x_posts").update({
    status: "posted",
    tweet_id: tweetId,
    posted_at: postedAt,
    cost_usd: finalCost,
    error_message: mediaUploadFailed
      ? `media_upload_failed (text-only fallback): ${(mediaErrorDetail || "").slice(0, 200)}`
      : null,
  }).eq("id", xPostId);

  return jsonResponse({
    success: true,
    x_post_id: xPostId,
    tweet_id: tweetId,
    permalink: `https://x.com/${conn.platform_username}/status/${tweetId}`,
    posted_at: postedAt,
    cost_usd: finalCost,
    content_preview: xPost.content.slice(0, 100),
    media_attached: !!mediaId,
    media_upload_failed: mediaUploadFailed,
    media_error_detail: mediaErrorDetail,
    image_url: xPost.image_url,
    refresh_attempted: refreshAttempted,
  });
});

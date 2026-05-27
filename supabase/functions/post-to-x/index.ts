// ============================================
// post-to-x v2 (2026/5/27, #25 Step 2 = #16 v2 Phase 1.3)
// 変更点 v1 → v2:
//   - image_url ある場合は X media upload して media_id 取得
//   - tweet 作成時に media.media_ids を含める
//   - v1.1 media upload (https://upload.twitter.com/1.1/media/upload.json) 使用
//     → OAuth 2.0 Bearer と multipart/form-data で動作、広く検証済
//   - 画像コスト (生成分) は generate-x-post で入済み、ここでは追加 $0.0001 のみ
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

// X media upload v1.1 (画像 < 5MB のシンプルアップロード)
async function uploadMediaToX(accessToken: string, imageBytes: Uint8Array, mimeType: string): Promise<string | null> {
  const formData = new FormData();
  const blob = new Blob([imageBytes], { type: mimeType });
  formData.append("media", blob, "image.png");

  const res = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      // Content-Type は FormData が自動設定 (boundary 含む)
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[post-to-x] X media upload failed:", res.status, errText.slice(0, 300));
    return null;
  }

  const data = await res.json();
  // v1.1 は media_id_string を返す (tweet API では string 推奨)
  return data?.media_id_string || null;
}

async function downloadImage(url: string): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("[post-to-x] Image download failed:", res.status);
      return null;
    }
    const buf = await res.arrayBuffer();
    const mimeType = res.headers.get("content-type") || "image/png";
    return { bytes: new Uint8Array(buf), mimeType };
  } catch (e) {
    console.error("[post-to-x] Image download error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let xPostId: string | null = null;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      xPostId = body?.x_post_id || null;
    }
  } catch (_) {}

  if (!xPostId) {
    return jsonResponse({ success: false, error: "x_post_id_required" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Step 1: settings (kill_switch) 確認
  const { data: settings } = await supabase
    .from("x_post_settings")
    .select("kill_switch")
    .eq("id", 1)
    .single();

  if (settings?.kill_switch) {
    await supabase.from("x_posts").update({ status: "killed", error_message: "kill_switch active" }).eq("id", xPostId);
    return jsonResponse({ success: false, error: "kill_switch_active" }, 503);
  }

  // Step 2: x_posts レコード取得
  const { data: xPost, error: postErr } = await supabase
    .from("x_posts")
    .select("id, content, image_url, status, cost_usd")
    .eq("id", xPostId)
    .single();

  if (postErr || !xPost) {
    return jsonResponse({ success: false, error: "post_not_found", message: postErr?.message }, 404);
  }

  if (xPost.status !== "scheduled") {
    return jsonResponse({ success: false, error: "invalid_status", message: `status は scheduled ですべき (現在: ${xPost.status})` }, 400);
  }

  // Step 3: @qocca_pet access_token 取得
  const { data: connection, error: connErr } = await supabase
    .from("social_connections")
    .select("access_token, platform_username, token_expires_at")
    .eq("platform", "x")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connErr || !connection?.access_token) {
    await supabase.from("x_posts").update({ status: "failed", error_message: "X 連携未設定" }).eq("id", xPostId);
    return jsonResponse({ success: false, error: "x_not_connected" }, 503);
  }

  if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
    await supabase.from("x_posts").update({ status: "failed", error_message: "access_token expired" }).eq("id", xPostId);
    return jsonResponse({ success: false, error: "token_expired" }, 401);
  }

  // Step 4: image_url ありなら画像をダウンロード → X media upload
  let mediaId: string | null = null;
  let mediaUploadFailed = false;
  if (xPost.image_url) {
    const downloaded = await downloadImage(xPost.image_url);
    if (downloaded) {
      mediaId = await uploadMediaToX(connection.access_token, downloaded.bytes, downloaded.mimeType);
      if (!mediaId) mediaUploadFailed = true;
    } else {
      mediaUploadFailed = true;
    }
  }

  // Step 5: X API v2 POST /2/tweets (media あるなら media.media_ids 含める)
  const tweetBody: any = { text: xPost.content };
  if (mediaId) {
    tweetBody.media = { media_ids: [mediaId] };
  }

  try {
    const tweetRes = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${connection.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tweetBody),
    });
    const tweetData = await tweetRes.json();

    if (!tweetRes.ok || !tweetData?.data?.id) {
      const errMsg = JSON.stringify(tweetData).slice(0, 500);
      await supabase.from("x_posts").update({ status: "failed", error_message: errMsg }).eq("id", xPostId);
      return jsonResponse({
        success: false, error: "x_api_error", message: errMsg,
        media_uploaded: !!mediaId, media_upload_failed: mediaUploadFailed,
      }, 500);
    }

    const tweetId = tweetData.data.id;
    const postedAt = new Date().toISOString();
    const finalCost = xPost.cost_usd != null ? xPost.cost_usd : 0;

    await supabase
      .from("x_posts")
      .update({
        status: "posted",
        tweet_id: tweetId,
        posted_at: postedAt,
        cost_usd: finalCost,
        error_message: mediaUploadFailed ? "media_upload_failed (text-only fallback)" : null,
      })
      .eq("id", xPostId);

    return jsonResponse({
      success: true,
      x_post_id: xPostId,
      tweet_id: tweetId,
      permalink: `https://x.com/${connection.platform_username}/status/${tweetId}`,
      posted_at: postedAt,
      cost_usd: finalCost,
      content_preview: xPost.content.slice(0, 100),
      media_attached: !!mediaId,
      media_upload_failed: mediaUploadFailed,
      image_url: xPost.image_url,
    });
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    await supabase.from("x_posts").update({ status: "failed", error_message: errMsg }).eq("id", xPostId);
    return jsonResponse({ success: false, error: "caught_error", message: errMsg }, 500);
  }
});

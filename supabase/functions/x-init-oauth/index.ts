// ============================================
// x-init-oauth v9 (依頼書 #32 A案, 2026/5/30)
// v9 変更点:
//   - scope に "media.write" を追加
//   - 真因: 既存 token (tweet.read tweet.write users.read offline.access) では
//     X API v2 /2/media/upload が 403 Forbidden を返す
//     (4-variant probe で全 endpoint 403 確認済)
//   - media.write を追加すれば再連携後の token で画像 upload が許可される
//   - DDL なし / 既存資産完全保護 / Portal 側変更不要 (Read+Write 既に通っている)
// v8 (依頼書 #22 最重要修正, 2026/5/27):
//   - authorize URL を twitter.com → x.com に変更
//   - 真因: twitter.com は 2024年廃止、x.com のみ動作
// v7: .catch() → try/catch
// ============================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const X_CLIENT_ID = Deno.env.get("X_CLIENT_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/x-oauth-callback`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: any, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);

function generateRandomString(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length * 3 / 4));
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, length);
}

async function sha256Base64Url(data: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "no_auth" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
    const user_id = userData.user.id;

    if (!X_CLIENT_ID) {
      return jsonResponse({
        error: "x_client_id_missing",
        message: "X 連携の設定が未完了です。運営にお問い合わせください。",
      }, 503);
    }

    // v7: PostgrestBuilder は .catch() 未サポート → try/catch ブロック
    try {
      await supabase.rpc("cleanup_expired_oauth_states");
    } catch (_) {
      // クリーンアップ失敗は許容
    }

    const codeVerifier = generateRandomString(64);
    const codeChallenge = await sha256Base64Url(codeVerifier);
    const stateId = generateRandomString(32);

    const { error: insertErr } = await supabase
      .from("oauth_states")
      .insert({
        id: stateId,
        user_id,
        platform: "x",
        code_verifier: codeVerifier,
      });

    if (insertErr) {
      return jsonResponse({
        error: "db_insert_error",
        message: insertErr.message,
      }, 500);
    }

    // v8 重大修正: twitter.com → x.com (旧ドメインは 2024年廃止、ループの真因)
    const url = new URL("https://x.com/i/oauth2/authorize");
    url.searchParams.append("response_type", "code");
    url.searchParams.append("client_id", X_CLIENT_ID);
    url.searchParams.append("redirect_uri", REDIRECT_URI);
    // v9 修正: media.write を追加 (画像 upload に必須)
    url.searchParams.append("scope", "tweet.read tweet.write users.read offline.access media.write");
    url.searchParams.append("state", stateId);
    url.searchParams.append("code_challenge", codeChallenge);
    url.searchParams.append("code_challenge_method", "S256");

    return jsonResponse({
      success: true,
      authorize_url: url.toString(),
      state: stateId,
      expires_in: 600,
    });
  } catch (err: any) {
    return jsonResponse({
      error: "caught_error",
      message: err?.message || String(err),
    }, 500);
  }
});

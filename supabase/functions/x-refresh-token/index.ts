// ============================================
// x-refresh-token v1 (依頼書 #29 緊急, 2026/5/28)
// X OAuth 2.0 refresh_token を用いて access_token を自動更新
//
// 動作:
//   1. social_connections platform='x' の metadata.refresh_token 取得
//   2. force_refresh=true または token_expires_at が残り《高い閾値》以下なら refresh 実行
//   3. X API v2 /2/oauth2/token grant_type=refresh_token で新 token 取得
//   4. social_connections を UPSERT (新 access_token / 新 refresh_token / 新 token_expires_at)
//   5. refresh_token もローテーション (X 仕様: refresh により新 refresh_token も返される)
//   6. metadata.last_refreshed_at 記録
//
// エラー:
//   - refresh_token なし → 503 (manual_reauth_required)
//   - X API エラー → metadata.last_refresh_error 記録 + 502
// ============================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const X_CLIENT_ID = Deno.env.get("X_CLIENT_ID") ?? "";
const X_CLIENT_SECRET = Deno.env.get("X_CLIENT_SECRET") ?? "";
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let forceRefresh = false;
  let userId: string | null = null;
  let thresholdMinutes = 30;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      forceRefresh = body?.force_refresh === true;
      userId = body?.user_id || null;
      if (typeof body?.threshold_minutes === "number") thresholdMinutes = body.threshold_minutes;
    }
  } catch (_) {}

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let query = supabase
    .from("social_connections")
    .select("id, user_id, platform_username, access_token, token_expires_at, metadata, updated_at")
    .eq("platform", "x")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (userId) query = supabase
    .from("social_connections")
    .select("id, user_id, platform_username, access_token, token_expires_at, metadata, updated_at")
    .eq("platform", "x")
    .eq("user_id", userId)
    .limit(1);
  const { data: rows, error: selErr } = await query;
  if (selErr) return jsonResponse({ success: false, error: "db_select", message: selErr.message }, 500);
  const row = rows?.[0];
  if (!row) return jsonResponse({ success: false, error: "no_x_connection", message: "X 連携が見つかりません" }, 404);

  const refreshToken: string | null = row.metadata?.refresh_token || null;
  if (!refreshToken) {
    return jsonResponse({
      success: false,
      error: "manual_reauth_required",
      message: "refresh_token が保存されていません。/settings/x で手動再連携が必要です",
    }, 503);
  }

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at) : null;
  const minutesRemaining = expiresAt ? (expiresAt.getTime() - Date.now()) / 60000 : 0;
  if (!forceRefresh && minutesRemaining > thresholdMinutes) {
    return jsonResponse({
      success: true,
      refreshed: false,
      message: "refresh 不要",
      minutes_remaining: Math.round(minutesRemaining),
      threshold_minutes: thresholdMinutes,
    });
  }

  const credentials = btoa(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`);
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);
  params.append("client_id", X_CLIENT_ID);

  let tokenRes: Response;
  try {
    tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
  } catch (e: any) {
    return jsonResponse({ success: false, error: "fetch_error", message: e?.message }, 502);
  }

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData?.access_token) {
    const errStr = JSON.stringify(tokenData).slice(0, 300);
    await supabase
      .from("social_connections")
      .update({
        metadata: { ...row.metadata, last_refresh_error: errStr, last_refresh_attempt_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return jsonResponse({
      success: false,
      error: "x_refresh_failed",
      message: `refresh_token も失効。/settings/x で手動再連携をしてください (詳細: ${errStr})`,
    }, 503);
  }

  const newAccessToken = tokenData.access_token;
  const newRefreshToken = tokenData.refresh_token || refreshToken;
  const expiresIn = tokenData.expires_in || 7200;
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const newMetadata = {
    ...row.metadata,
    refresh_token: newRefreshToken,
    has_refresh_token: true,
    last_refreshed_at: new Date().toISOString(),
    last_refresh_attempt_at: new Date().toISOString(),
    last_refresh_error: null,
  };

  const { error: updErr } = await supabase
    .from("social_connections")
    .update({
      access_token: newAccessToken,
      token_expires_at: newExpiresAt,
      metadata: newMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (updErr) return jsonResponse({ success: false, error: "db_update", message: updErr.message }, 500);

  return jsonResponse({
    success: true,
    refreshed: true,
    user_id: row.user_id,
    platform_username: row.platform_username,
    minutes_was_remaining: Math.round(minutesRemaining),
    new_token_expires_at: newExpiresAt,
    rotated_refresh_token: tokenData.refresh_token ? true : false,
  });
});

// ============================================
// x-retry-handler v1 (依頼書 #29 緊急, 2026/5/28)
// status='failed' の x_posts を自動再試行
//
// 動作:
//   1. status='failed' AND created_at > NOW() - 24h の件を取得
//   2. error_message が access_token expired / auto_refresh_failed / x_api_error 等なら再試行
//   3. retry_count 上限: error_message に [retry:N] タグで管理 / N>=3 で skip
//   4. post-to-x v3 を呼んで再投稿 (auto-refresh 付き)
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

const RETRYABLE_PATTERNS = [
  "access_token expired",
  "auto_refresh_failed",
  "x_api_error",
  "caught_error",
  "token_expired",
  "fetch_error",
];

function isRetryable(errMsg: string | null): boolean {
  if (!errMsg) return false;
  const lower = errMsg.toLowerCase();
  return RETRYABLE_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: failedPosts, error: selErr } = await supabase
    .from("x_posts")
    .select("id, content, error_message, scheduled_at, created_at, image_url, metrics_1h, metrics_24h")
    .eq("status", "failed")
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: true })
    .limit(5);

  if (selErr) return jsonResponse({ success: false, error: "db_select", message: selErr.message }, 500);
  if (!failedPosts || failedPosts.length === 0) {
    return jsonResponse({ success: true, retried: 0, skipped: 0, message: "再試行対象なし" });
  }

  const results: any[] = [];
  let retriedCount = 0;
  let skippedCount = 0;

  for (const p of failedPosts) {
    if (!isRetryable(p.error_message)) {
      results.push({ id: p.id, action: "skip", reason: "non_retryable", error: p.error_message?.slice(0, 100) });
      skippedCount++;
      continue;
    }

    let retryCount = 0;
    const match = (p.error_message || "").match(/\[retry:(\d+)\]/);
    if (match) retryCount = parseInt(match[1], 10);
    if (retryCount >= 3) {
      results.push({ id: p.id, action: "skip", reason: "max_retries", count: retryCount });
      skippedCount++;
      continue;
    }

    const newRetryCount = retryCount + 1;
    const retryTag = `[retry:${newRetryCount}]`;
    await supabase.from("x_posts")
      .update({ status: "scheduled", error_message: `${retryTag} (再試行中)` })
      .eq("id", p.id);

    try {
      const postRes = await fetch(`${SUPABASE_URL}/functions/v1/post-to-x`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x_post_id: p.id }),
      });
      const postData = await postRes.json();
      if (postRes.ok && postData.success) {
        results.push({ id: p.id, action: "retried_ok", tweet_id: postData.tweet_id, retry_count: newRetryCount });
        retriedCount++;
      } else {
        await supabase.from("x_posts")
          .update({ status: "failed", error_message: `${retryTag} ${JSON.stringify(postData).slice(0, 200)}` })
          .eq("id", p.id);
        results.push({ id: p.id, action: "retried_fail", error: postData?.error, retry_count: newRetryCount });
      }
    } catch (e: any) {
      await supabase.from("x_posts")
        .update({ status: "failed", error_message: `${retryTag} fetch_error: ${e?.message}` })
        .eq("id", p.id);
      results.push({ id: p.id, action: "retried_error", error: e?.message, retry_count: newRetryCount });
    }
  }

  return jsonResponse({
    success: true,
    total_failed_24h: failedPosts.length,
    retried: retriedCount,
    skipped: skippedCount,
    results,
  });
});

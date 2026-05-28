// ============================================
// x-cron-handler v2 (依頼書 #32 緊急, 2026/5/28)
// v2 変更点:
//   - EdgeRuntime.waitUntil() で background 実行化
//   - cron に即 200 返し (5秒タイムアウト回避)
//   - 裏で generate-x-post (gpt-image-1 ~30秒) → post-to-x を継続実行
//   - x_posts テーブルに状態が記録されるので cron 値は不要
// v1:
//   - 同期だったため pg_net 5秒タイムアウトで evening 画像投稿失敗 (5/28 11:00 UTC)
// ============================================
// 型定義: EdgeRuntime は Supabase Edge Function のグローバル
// deno-lint-ignore-file no-explicit-any
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

// 裏で実行されるメインロジック (generate → post)
async function runJob(timeSlot: "morning" | "evening", testMode: boolean, dryRun: boolean): Promise<any> {
  const startedAt = new Date().toISOString();
  // Step 1: generate-x-post
  let generated: any = null;
  try {
    const genRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-x-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ time_slot: timeSlot, test_mode: testMode }),
    });
    generated = await genRes.json();
    if (!genRes.ok || !generated.success) {
      console.error("[x-cron-handler] generate failed", generated);
      return { success: false, step: "generate", started_at: startedAt, error: generated?.error, message: generated?.message };
    }
  } catch (err: any) {
    console.error("[x-cron-handler] generate caught_error", err);
    return { success: false, step: "generate", started_at: startedAt, error: "caught_error", message: err?.message };
  }

  if (dryRun) {
    return { success: true, step: "generate_only", dry_run: true, started_at: startedAt, x_post_id: generated.x_post_id };
  }

  // Step 2: post-to-x
  let posted: any = null;
  try {
    const postRes = await fetch(`${SUPABASE_URL}/functions/v1/post-to-x`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ x_post_id: generated.x_post_id }),
    });
    posted = await postRes.json();
    if (!postRes.ok || !posted.success) {
      console.error("[x-cron-handler] post failed", posted);
      return { success: false, step: "post", started_at: startedAt, x_post_id: generated.x_post_id, error: posted?.error, message: posted?.message };
    }
  } catch (err: any) {
    console.error("[x-cron-handler] post caught_error", err);
    return { success: false, step: "post", started_at: startedAt, error: "caught_error", message: err?.message };
  }

  console.log("[x-cron-handler] complete", { tweet_id: posted.tweet_id, permalink: posted.permalink });
  return {
    success: true,
    step: "complete",
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    x_post_id: generated.x_post_id,
    tweet_id: posted.tweet_id,
    permalink: posted.permalink,
    theme: generated.theme,
    cost_usd: posted.cost_usd,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let timeSlot: "morning" | "evening" = "morning";
  let testMode = false;
  let dryRun = false;
  let waitMode = false; // ?wait=true もしくは body.wait=true で従来の同期動作 (テスト用)
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("wait") === "true") waitMode = true;
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      if (body?.time_slot === "evening") timeSlot = "evening";
      testMode = body?.test_mode === true;
      dryRun = body?.dry_run === true;
      if (body?.wait === true) waitMode = true;
    }
  } catch (_) {}

  // 同期モード (テスト用): 全部待ってから返す
  if (waitMode) {
    const result = await runJob(timeSlot, testMode, dryRun);
    return jsonResponse(result, result.success ? 200 : 500);
  }

  // 非同期モード (本番 / cron 用): cron に即 200 返し、裏で継続実行
  // Supabase Edge Function は EdgeRuntime.waitUntil で background task を保証
  EdgeRuntime.waitUntil(
    runJob(timeSlot, testMode, dryRun).catch((err) => {
      console.error("[x-cron-handler] background error", err);
    })
  );

  return jsonResponse({
    success: true,
    step: "accepted",
    async: true,
    time_slot: timeSlot,
    message: "裏で generate-x-post → post-to-x を実行中。結果は x_posts テーブルで確認してください。",
    received_at: new Date().toISOString(),
  });
});

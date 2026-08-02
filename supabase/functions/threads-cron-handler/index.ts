// ============================================
// threads-cron-handler v4 (2026/8/2 バグ修正: publish 前にコンテナ完成を待つ)
//   ★v3 → v4 の変更は postToThreadsDirectly の中だけ。
//     ネタ選択(未使用のみ)・枯渇通知・dry_run・同slot冪等ガードは1行も変えていない。
//
//   【直したバグ】Threads 投稿の 26% (failed 31件中30件) が
//     publish_failed: "The requested resource does not exist" (code 24 / メディアが見つかりません)
//     で静かに失敗していた (2026/6/4〜継続)。
//     原因: コンテナ作成は非同期なのに、テキスト投稿では作成直後に publish していた。
//           タイミング次第で「まだ存在しない」と言われて落ちる。
//     修正: status が FINISHED になってから publish する。
//     ⚠️ 退行防止: status を返さない場合は従来どおり publish に進む (待って壊すことはしない)。
//
//   ※ 本ファイルは 2026/8/2 にデプロイ済み実体をリポジトリへ取り込んだもの。
//     以後はここが正。デプロイのみで追跡できない状態を解消するため。
//   ----- 以下 v3 (2026/6/12): 「一度使ったネタは二度と使わない」化 -----
//     ① getUnusedTemplates: use_count=0 + threads_posts未出現(failed除く) のみ
//     ② 枯渇ガード: 未使用0 → meta_agent_notifications(critical) で King通知 + スキップ
//     ③ dry_run: 選択のみ確認し insert/post/use_count更新をしない
//     ④ 同slot冪等ガード: 本日(JST)・同slotに template投稿済みならスキップ
//   ----- 以下 v2 (依頼書 #125): /v1.0/me/threads 使用 -----
// ============================================
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

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

const jsonResponse = (body: any, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function jstDayOfWeek(): number {
  const utc = new Date();
  const jst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return jst.getUTCDay();
}

// JST の本日 00:00 を UTC ISO で返す (④ 同slot冪等ガード用)
function jstDayStartUtcIso(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return new Date(jst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

// ① 未使用テンプレ取得: use_count=0 + threads_posts未出現(failed除く) / is_active + slot + (dow null or 今日)
//   ※ use_count ドリフト(投稿後クラッシュで increment 未実行)対策で threads_posts と両方で判定
async function getUnusedTemplates(supabase: any, timeSlot: "morning" | "evening"): Promise<any[]> {
  const dow = jstDayOfWeek();
  const { data: usedRows } = await supabase
    .from("threads_posts").select("template_id").neq("status", "failed");
  const usedIds = new Set((usedRows || []).map((r: any) => r.template_id).filter(Boolean));

  const { data: templates } = await supabase
    .from("threads_post_templates")
    .select("id, theme, day_of_week, time_slot, template, variables, image_prompt, use_image, weight, use_count, last_used_at")
    .eq("is_active", true)
    .eq("time_slot", timeSlot)
    .eq("use_count", 0)
    .or(`day_of_week.is.null,day_of_week.eq.${dow}`);

  return (templates || []).filter((t: any) => !usedIds.has(t.id));
}

function renderTemplate(t: string, vars: any): string {
  if (!vars || typeof vars !== "object") return t;
  let result = t;
  Object.entries(vars).forEach(([k, v]) => {
    result = result.replace(new RegExp(`{${k}}`, "g"), String(v));
  });
  return result;
}

// ★v4 追加: コンテナが publish 可能になるまで待つ。
//   ⚠️ 退行防止の設計: status を一度も返さないAPI応答なら「待たずに進む」(従来動作に戻す)。
//      待ちすぎて投稿できなくなる方が、たまに失敗するより悪いため。
async function waitForContainer(
  accessToken: string, containerId: string, maxWaitMs: number,
): Promise<{ ok: boolean; status?: string; error?: string; waitedMs: number }> {
  const started = Date.now();
  let delay = 2000; // テキストは数秒で FINISHED になるので短く始める
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
    // status が取れない環境 → 従来どおり publish へ進む (退行させない)
    if (!sawStatus) return { ok: true, status: "unknown", waitedMs: Date.now() - started };

    delay = Math.min(Math.floor(delay * 1.5), 15000);
  }
  return { ok: false, status: "timeout", error: "container_wait_timeout", waitedMs: Date.now() - started };
}

// v2: /v1.0/me/threads を使う (Threads API 推奨 / token だけで user 識別)
async function postToThreadsDirectly(
  accessToken: string, _platformUserId: string,
  text: string, imageUrl: string | null,
): Promise<{ ok: boolean; thread_id?: string; error?: string; debug?: any }> {
  try {
    const params = new URLSearchParams();
    params.append("access_token", accessToken);
    params.append("text", text);
    if (imageUrl) {
      params.append("media_type", "IMAGE");
      params.append("image_url", imageUrl);
    } else {
      params.append("media_type", "TEXT");
    }

    const containerRes = await fetch("https://graph.threads.net/v1.0/me/threads", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const containerData = await containerRes.json();
    if (!containerRes.ok || !containerData.id) {
      return { ok: false, error: `container_create_failed: ${JSON.stringify(containerData).slice(0, 400)}`, debug: { status: containerRes.status, endpoint: "/v1.0/me/threads" } };
    }

    // ★v4: 旧コードは「テキストは即publish / 画像は30秒 blind sleep」だった。
    //   即publish がタイミング次第で "メディアが見つかりません" を起こしていた本体。
    const waited = await waitForContainer(accessToken, containerData.id, imageUrl ? 120000 : 60000);
    if (!waited.ok) {
      return {
        ok: false, error: waited.error || "container_not_ready",
        debug: { step: "container_wait", status: waited.status, waited_ms: waited.waitedMs },
      };
    }

    const pubParams = new URLSearchParams();
    pubParams.append("access_token", accessToken);
    pubParams.append("creation_id", containerData.id);

    const pubRes = await fetch("https://graph.threads.net/v1.0/me/threads_publish", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: pubParams,
    });
    const pubData = await pubRes.json();
    if (!pubRes.ok || !pubData.id) {
      return { ok: false, error: `publish_failed: ${JSON.stringify(pubData).slice(0, 400)}`, debug: { status: pubRes.status, endpoint: "/v1.0/me/threads_publish", container_wait_ms: waited.waitedMs } };
    }

    return { ok: true, thread_id: pubData.id };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function runJob(timeSlot: "morning" | "evening", testMode: boolean, dryRun: boolean): Promise<any> {
  const startedAt = new Date().toISOString();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: settings } = await supabase
    .from("threads_post_settings")
    .select("kill_switch")
    .eq("id", 1).maybeSingle();

  if (settings?.kill_switch || SNS_KILL_SWITCH === "true") {
    return { success: false, step: "kill_switch", started_at: startedAt };
  }

  // ④ 同slot冪等ガード (本日JST・同slotに template投稿済みならスキップ)
  //   手動adhoc(template_id=NULL)は除外され影響しない。failedはカウントしない(二重でない)
  if (!dryRun && !testMode) {
    const dayStart = jstDayStartUtcIso();
    const { data: todays } = await supabase
      .from("threads_posts")
      .select("scheduled_at, status, template_id")
      .gte("scheduled_at", dayStart)
      .in("status", ["posted", "scheduled"])
      .not("template_id", "is", null);
    const sameSlotExists = (todays || []).some((p: any) => {
      if (!p.scheduled_at) return false;
      const jstHour = new Date(new Date(p.scheduled_at).getTime() + 9 * 3600 * 1000).getUTCHours();
      const slotOfPost = jstHour < 14 ? "morning" : "evening";
      return slotOfPost === timeSlot;
    });
    if (sameSlotExists) {
      return { success: false, step: "already_posted_this_slot", skipped: true, started_at: startedAt, time_slot: timeSlot };
    }
  }

  // ① 未使用テンプレのみ選択
  const unused = await getUnusedTemplates(supabase, timeSlot);

  // ② 枯渇ガード: 未使用が0 → King に critical 通知 + スキップ (同じネタを再投稿しない)
  if (unused.length === 0) {
    if (!dryRun && !testMode) {
      await supabase.from("meta_agent_notifications").insert({
        agent_name: "threads_auto_post",
        notification_type: "template_depleted",
        title: `⚠️ Threads 未使用テンプレ枯渇 (${timeSlot}) — 自動投稿スキップ中`,
        body: `threads_post_templates の ${timeSlot} 用 未使用(use_count=0)テンプレが0です。新規ネタを追加するまで該当枠のThreads自動投稿はスキップされます（同じネタの再投稿はしません）。`,
        severity: "critical",
      });
    }
    return { success: false, step: "no_unused_template", depleted: true, alerted: !dryRun && !testMode, started_at: startedAt, time_slot: timeSlot };
  }

  // 未使用プールから random
  const template = unused[Math.floor(Math.random() * unused.length)];
  const content = renderTemplate(template.template, template.variables);

  // ③ dry_run: 選択のみ。insert/post/use_count更新 をしない (副作用ゼロ)
  if (dryRun) {
    return {
      success: true, dry_run: true, step: "dry_run", started_at: startedAt,
      template_id: template.id, theme: template.theme, time_slot: timeSlot,
      unused_pool_size: unused.length, content_preview: content.slice(0, 80),
    };
  }

  const imageUrl: string | null = null;

  const { data: tp, error: tpErr } = await supabase
    .from("threads_posts")
    .insert({
      template_id: template.id,
      content,
      image_url: imageUrl,
      status: testMode ? "test" : "scheduled",
      scheduled_at: new Date().toISOString(),
      cost_usd: 0,
    }).select().single();

  if (tpErr || !tp) {
    return { success: false, step: "threads_posts_insert", error: tpErr?.message };
  }

  if (testMode) {
    return {
      success: true, step: "test_mode_skip", started_at: startedAt,
      threads_post_id: tp.id, content_preview: content.slice(0, 80),
    };
  }

  const { data: conn } = await supabase
    .from("social_connections")
    .select("access_token, platform_user_id, platform_username, token_expires_at")
    .eq("platform", "threads")
    .order("updated_at", { ascending: false })
    .limit(1).maybeSingle();

  if (!conn?.access_token) {
    await supabase.from("threads_posts").update({ status: "failed", error_message: "threads_not_connected" }).eq("id", tp.id);
    return { success: false, step: "no_connection", started_at: startedAt };
  }

  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    await supabase.from("threads_posts").update({ status: "failed", error_message: "token_expired" }).eq("id", tp.id);
    return { success: false, step: "token_expired", started_at: startedAt };
  }

  const result = await postToThreadsDirectly(conn.access_token, conn.platform_user_id, content, imageUrl);

  if (!result.ok) {
    await supabase.from("threads_posts").update({
      status: "failed",
      error_message: (result.error || "unknown").slice(0, 500),
    }).eq("id", tp.id);
    return { success: false, step: "post_failed", started_at: startedAt, error: result.error, debug: result.debug };
  }

  const postedAt = new Date().toISOString();
  await supabase.from("threads_posts").update({
    status: "posted",
    thread_id: result.thread_id,
    posted_at: postedAt,
  }).eq("id", tp.id);

  await supabase.from("threads_post_templates").update({
    use_count: (Number(template.use_count) || 0) + 1,
    last_used_at: postedAt,
  }).eq("id", template.id);

  return {
    success: true, step: "complete", started_at: startedAt, completed_at: postedAt,
    threads_post_id: tp.id, thread_id: result.thread_id,
    permalink: `https://www.threads.net/@${conn.platform_username || "qocca_pet"}/post/${result.thread_id}`,
    content_preview: content.slice(0, 80),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let timeSlot: "morning" | "evening" = "morning";
  let testMode = false;
  let dryRun = false;
  let waitMode = false;
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

  if (waitMode) {
    const r = await runJob(timeSlot, testMode, dryRun);
    return jsonResponse(r, r.success ? 200 : 500);
  }

  EdgeRuntime.waitUntil(
    runJob(timeSlot, testMode, dryRun).catch((err) => {
      console.error("[threads-cron-handler] background error", err);
    })
  );

  return jsonResponse({
    success: true, step: "accepted", async: true, time_slot: timeSlot,
    received_at: new Date().toISOString(),
  });
});

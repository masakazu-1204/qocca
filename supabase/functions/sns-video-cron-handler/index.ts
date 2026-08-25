// ============================================================================
// sns-video-cron-handler (2026/8/26)
//
// おちゃの動画を Threads / Instagram へ自動投稿する。
//
// 背景: 動画投稿の部品 (post-video-to-threads / post-video-to-instagram) と
//   在庫テーブル (sns_video_assets) は前からあったのに、それを定期的に叩く
//   cron だけが無かった。そのため動画だけ手動投稿のまま在庫が8本たまっていた。
//   画像ネタ側 (sns-neta-cron-handler) と同じ形にして、動画も自動で流れるようにする。
//
// ⚠️ 各投稿関数は単体でも pick:true で在庫を選べるが、選ぶ基準が
//    「そのプラットフォームでまだ使っていない動画」なので、片方だけ失敗が続くと
//    Threads と Instagram で別々の動画が出てしまう。
//    そこで **ここで1本だけ選び、両方に同じ video_id を渡す**。
//
// pick: is_active AND use_count=0 を created_at 昇順で1本 (古い在庫から出す)
// 48hガード: 直近の投稿から48h未満ならスキップ (= 実質2日に1本)
// body: { test_mode?:bool (選ぶだけ・投稿しない), force?:bool (48hガード無視),
//         video_id?:string (指定の1本を出す), wait?:bool (同期実行) }
// ============================================================================
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SNS_KILL = Deno.env.get("SNS_KILL_SWITCH") ?? "false";

const GUARD_HOURS = 48;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

/** 投稿関数を叩く。ここでは待ち切る (cron 側は waitUntil で裏に回している)。 */
async function callPoster(fn: string, videoId: string) {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ video_id: videoId, wait: true }),
    });
    return await r.json();
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

async function runJob(opts: { testMode: boolean; force: boolean; videoId?: string }) {
  const startedAt = new Date().toISOString();
  if (SNS_KILL === "true") return { success: false, step: "kill_switch", startedAt };
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // 48hガード。連投を防ぐ。video_id 指定は「今すぐこれを出す」意図なので通す。
  if (!opts.force && !opts.videoId) {
    const { data: last } = await sb
      .from("sns_video_assets")
      .select("last_used_at").not("last_used_at", "is", null)
      .order("last_used_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.last_used_at) {
      const hrs = (Date.now() - new Date(last.last_used_at as string).getTime()) / 3600000;
      if (hrs < GUARD_HOURS) {
        return { success: false, step: "too_soon", hours_since_last: Math.round(hrs), startedAt };
      }
    }
  }

  // 出す1本を決める。古い在庫から順に (寝かせても良くならない)。
  let asset: { id: string; title: string | null } | null = null;
  if (opts.videoId) {
    const { data } = await sb.from("sns_video_assets")
      .select("id, title").eq("id", opts.videoId).maybeSingle();
    asset = data as typeof asset;
    if (!asset) return { success: false, step: "not_found", video_id: opts.videoId, startedAt };
  } else {
    const { data } = await sb.from("sns_video_assets")
      .select("id, title").eq("is_active", true).eq("use_count", 0)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    asset = data as typeof asset;
    if (!asset) {
      return { success: false, step: "depleted", message: "出せる動画が0。補充が必要", startedAt };
    }
  }

  if (opts.testMode) {
    return { success: true, step: "test_mode", picked: { id: asset.id, title: asset.title }, startedAt };
  }

  // 同じ1本を両方へ。片方が落ちてももう片方は出す。
  const threads = await callPoster("post-video-to-threads", asset.id);
  const instagram = await callPoster("post-video-to-instagram", asset.id);

  // use_count / last_used_at / sns_video_uses は各投稿関数が書くので、ここでは触らない
  const anyOk = Boolean(threads?.success || instagram?.success);
  return {
    success: anyOk,
    step: anyOk ? "complete" : "all_failed",
    video: { id: asset.id, title: asset.title },
    threads: { ok: Boolean(threads?.success), permalink: threads?.permalink, error: threads?.error ?? threads?.step },
    instagram: { ok: Boolean(instagram?.success), permalink: instagram?.permalink, error: instagram?.error ?? instagram?.step },
    startedAt,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let testMode = false, force = false, waitMode = false, videoId: string | undefined;
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("wait") === "true") waitMode = true;
    if (req.headers.get("content-type")?.includes("application/json")) {
      const b = await req.json();
      testMode = b?.test_mode === true;
      force = b?.force === true;
      if (b?.wait === true) waitMode = true;
      if (typeof b?.video_id === "string") videoId = b.video_id;
    }
  } catch (_) { /* body 無しでも動く */ }

  if (waitMode || testMode) {
    return json(await runJob({ testMode, force, videoId }));
  }
  // cron から: 即200を返して裏で実行 (pg_net の5秒制限を超えるため)
  EdgeRuntime.waitUntil(
    runJob({ testMode: false, force, videoId }).catch((e) => console.error("[sns-video] bg error", e)),
  );
  return json({ success: true, step: "accepted", async: true, received_at: new Date().toISOString() });
});

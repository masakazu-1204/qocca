// ============================================================================
// sns-neta-cron-handler (2026/7/4)
//   ネタ画像を 3SNS(X/Threads/IG)へ同一画像・同一キャプションで自動投稿。
//   独立系統: 既存の日常テンプレ(x/threads/instagram_post_templates)・
//   既存 cron-handler には一切触れない。sns_neta_posts + 既存投稿APIの再利用のみ。
//   pick: is_active AND use_count=0 を sort_order 昇順で1本 → 48hガード → 3SNS投稿 → use_count++
//   body: { test_mode?:bool (pickのみ・投稿しない), force?:bool (48hガード無視) }
//
// v2 (2026/8/5): 投稿前に画像の実在チェックを追加。
//   背景: DBに登録はあるがストレージに画像が無いネタが5件あり、Instagram が
//   「Only photo or video can be accepted as media type」という紛らわしい
//   エラーで落ちていた(21日で4件失敗)。しかも X は本文だけ投稿できてしまうため
//   use_count が加算され、"投稿済み" 扱いでネタだけ消費されていた。
//   → 画像が取れないネタは自動で is_active=false にし、次のネタへ回す。
// ============================================================================
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SNS_KILL = Deno.env.get("SNS_KILL_SWITCH") ?? "false";
const BUCKET = "sns-neta";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

/**
 * 画像が公開URLで実際に取得できるかを確認する。
 * ストレージから消えている / 画像でないものが返る場合は false。
 * ここで弾けないと SNS 側が意味の分かりにくいエラーを返し、原因究明に時間がかかる。
 */
async function imageIsFetchable(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    const ct = r.headers.get("content-type") ?? "";
    if (!r.ok) return { ok: false, detail: `http_${r.status}` };
    if (!ct.startsWith("image/")) return { ok: false, detail: `content_type_${ct}` };
    return { ok: true, detail: ct };
  } catch (e) {
    return { ok: false, detail: `fetch_error_${String(e)}` };
  }
}

async function runJob(testMode: boolean, force: boolean) {
  const startedAt = new Date().toISOString();
  if (SNS_KILL === "true") return { success: false, step: "kill_switch", startedAt };
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // 48hガード: 前回投稿から48h未満ならスキップ (= 実質2日に1回)
  if (!force) {
    const { data: last } = await sb.from("sns_neta_posts")
      .select("last_used_at").not("last_used_at", "is", null)
      .order("last_used_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.last_used_at) {
      const hrs = (Date.now() - new Date(last.last_used_at).getTime()) / 3600000;
      if (hrs < 48) return { success: false, step: "too_soon", hours_since_last: Math.round(hrs), startedAt };
    }
  }

  // pick: 未使用・active を sort_order 昇順で1本。
  // ★画像が取れないものは無効化して次を引く(壊れたネタで1回分の枠を潰さないため)
  let post: any = null;
  let imageUrl = "";
  const skipped: Array<{ image_path: string; reason: string }> = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: cand } = await sb.from("sns_neta_posts")
      .select("*").eq("is_active", true).eq("use_count", 0)
      .order("sort_order", { ascending: true }).limit(1).maybeSingle();
    if (!cand) break;

    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${cand.image_path}`;
    const check = await imageIsFetchable(url);
    if (check.ok) { post = cand; imageUrl = url; break; }

    console.error(`[sns-neta] 画像が取得できないため無効化: ${cand.image_path} (${check.detail})`);
    await sb.from("sns_neta_posts").update({ is_active: false }).eq("id", cand.id);
    skipped.push({ image_path: cand.image_path, reason: check.detail });
  }
  if (!post) return { success: false, step: "depleted", message: "使えるネタが0。補充が必要", skipped, startedAt };

  if (testMode) return { success: true, step: "test_mode", picked: { slot_no: post.slot_no, image_path: post.image_path, caption: post.caption }, image_url: imageUrl, skipped, startedAt };

  const results: any = { x: null, threads: null, instagram: null };

  // --- X: x_posts INSERT(template_id=NULL・日常cron非干渉) → post-to-x ---
  try {
    const { data: xp } = await sb.from("x_posts").insert({ template_id: null, content: post.caption, image_url: imageUrl, status: "scheduled", scheduled_at: new Date().toISOString() }).select().single();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/post-to-x`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` }, body: JSON.stringify({ x_post_id: xp.id }) });
    results.x = await r.json();
  } catch (e) { results.x = { success: false, error: String(e) }; }

  // --- Threads: post-to-threads-adhoc {text, image_url} (画像あり=30秒待ち) ---
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/post-to-threads-adhoc`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` }, body: JSON.stringify({ text: post.caption, image_url: imageUrl }) });
    results.threads = await r.json();
  } catch (e) { results.threads = { success: false, error: String(e) }; }

  // --- IG: instagram_posts INSERT → post-to-instagram ---
  try {
    const { data: ig } = await sb.from("instagram_posts").insert({ template_id: null, caption: post.caption, media_url: imageUrl, status: "scheduled", scheduled_at: new Date().toISOString(), cost_usd: 0 }).select().single();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/post-to-instagram`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` }, body: JSON.stringify({ caption: post.caption, image_url: imageUrl, instagram_post_id: ig.id }) });
    results.instagram = await r.json();
  } catch (e) { results.instagram = { success: false, error: String(e) }; }

  // use_count++ (1つでも成功したら消費。全滅ならリトライ余地を残し消費しない)
  const anyOk = results.x?.success || results.threads?.success || results.instagram?.success;
  if (anyOk) {
    await sb.from("sns_neta_posts").update({ use_count: post.use_count + 1, last_used_at: new Date().toISOString() }).eq("id", post.id);
  }

  return { success: anyOk, step: anyOk ? "complete" : "all_failed", slot_no: post.slot_no, image_path: post.image_path,
    x: { ok: !!results.x?.success, permalink: results.x?.permalink, error: results.x?.error || results.x?.message },
    threads: { ok: !!results.threads?.success, permalink: results.threads?.permalink, error: results.threads?.error },
    instagram: { ok: !!results.instagram?.success, permalink: results.instagram?.permalink, error: results.instagram?.error || results.instagram?.message },
    consumed: anyOk, skipped, startedAt };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let testMode = false, force = false, waitMode = false;
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("wait") === "true") waitMode = true;
    if (req.headers.get("content-type")?.includes("application/json")) {
      const b = await req.json();
      testMode = b?.test_mode === true; force = b?.force === true; if (b?.wait === true) waitMode = true;
    }
  } catch (_) {}

  // テスト/同期モード: 全部待って返す
  if (waitMode || testMode) { const r = await runJob(testMode, force); return json(r, r.success ? 200 : 200); }
  // cron/非同期モード: 即200 + 裏で実行 (pg_net 5秒タイムアウト回避)
  EdgeRuntime.waitUntil(runJob(false, force).catch((e) => console.error("[sns-neta] bg error", e)));
  return json({ success: true, step: "accepted", async: true, received_at: new Date().toISOString() });
});

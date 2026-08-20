// ============================================================================
// sns-metrics-collector (2026/8/21)
//
// 背景: 月100回以上投稿しているのに、Qocca 側に指標が1件も残っていなかった。
//   metrics_24h は全投稿で null、フォロワー履歴は Threads/Instagram とも 0件。
//   「何が伸びたか」が分からないため、改善のしようがない状態だった。
//
// できること / できないこと (2026/8/21 実測):
//   ✅ Instagram のフォロワー数・投稿総数     … graph.instagram.com /me で取得可
//   ✅ Instagram の投稿一覧 (id/種別/日時/URL) … /me/media で取得可
//   ❌ 投稿ごとの表示数・いいね数              … insights は権限不足で 403
//        Instagram: instagram_manage_insights / Threads: threads_manage_insights
//        → King が拡張スコープで再連携すれば取れるようになる (別途)
//   ❌ Threads のフォロワー数                  … 同上
//
// そこで当面は「フォロワー数を毎日記録する」ことに絞る。
// 投稿ごとの表示数が無くても、投稿日とフォロワー増減を突き合わせれば
// 「どの投稿の翌日に伸びたか」は分かる。まずそこから始める。
//
// 呼び方: { dry_run?: true }  … 取得だけして DB に書かない
// ============================================================================
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Sb = ReturnType<typeof createClient>;

/** social_connections から有効なトークンを取り出す。期限切れは使わない。 */
async function getToken(sb: Sb, platform: string): Promise<string | null> {
  const { data } = await sb
    .from("social_connections")
    .select("access_token, token_expires_at")
    .eq("platform", platform)
    .order("updated_at", { ascending: false })
    .limit(1).maybeSingle();
  if (!data?.access_token) return null;
  if (data.token_expires_at && new Date(data.token_expires_at as string) < new Date()) return null;
  return data.access_token as string;
}

/** Instagram のアカウント指標。取れなければ null を返して静かに諦める。 */
async function fetchInstagramProfile(token: string) {
  try {
    const url = "https://graph.instagram.com/v21.0/me"
      + `?fields=followers_count,follows_count,media_count&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j?.error) return { ok: false as const, error: j?.error?.message ?? `http_${res.status}` };
    return {
      ok: true as const,
      followers: Number(j.followers_count ?? 0),
      following: Number(j.follows_count ?? 0),
      posts: Number(j.media_count ?? 0),
    };
  } catch (e) {
    return { ok: false as const, error: String(e) };
  }
}

/**
 * 直近の記録と比べて増減が無ければ書かない。
 * 毎時走らせても1日1行程度に収まり、履歴がノイズで埋まらない。
 */
async function recordFollowers(
  sb: Sb, table: string,
  snap: { followers: number; following: number; posts: number },
  dryRun: boolean,
) {
  const { data: last } = await sb
    .from(table)
    .select("follower_count, following_count, total_posts, recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(1).maybeSingle();

  const unchanged = last
    && Number(last.follower_count) === snap.followers
    && Number(last.following_count) === snap.following
    && Number(last.total_posts) === snap.posts;
  if (unchanged) return { written: false, reason: "変化なし", delta: 0 };

  const delta = last ? snap.followers - Number(last.follower_count) : 0;
  if (dryRun) return { written: false, reason: "dry_run", delta };

  const { error } = await sb.from(table).insert({
    recorded_at: new Date().toISOString(),
    follower_count: snap.followers,
    following_count: snap.following,
    total_posts: snap.posts,
  });
  if (error) return { written: false, reason: `insert_error: ${error.message}`, delta };
  return { written: true, reason: "記録した", delta };
}

async function run(dryRun: boolean) {
  const startedAt = new Date().toISOString();
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const result: Record<string, unknown> = { started_at: startedAt, dry_run: dryRun };

  // ── Instagram ────────────────────────────────────────────────
  const igToken = await getToken(sb, "instagram");
  if (!igToken) {
    result.instagram = { ok: false, step: "no_valid_token" };
  } else {
    const prof = await fetchInstagramProfile(igToken);
    if (!prof.ok) {
      result.instagram = { ok: false, step: "fetch_failed", error: prof.error };
    } else {
      const rec = await recordFollowers(sb, "instagram_followers_history", prof, dryRun);
      result.instagram = {
        ok: true, followers: prof.followers, posts: prof.posts,
        delta: rec.delta, written: rec.written, note: rec.reason,
      };
    }
  }

  // ── Threads ──────────────────────────────────────────────────
  // フォロワー数の取得には threads_manage_insights が要る。現状は権限が無いため
  // 「権限待ち」であることを結果に残すだけにする (握り潰さない)。
  const thToken = await getToken(sb, "threads");
  result.threads = thToken
    ? { ok: false, step: "insights_scope_missing",
        note: "threads_manage_insights が未付与。/settings/threads で拡張スコープの再連携が必要" }
    : { ok: false, step: "no_valid_token" };

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let dryRun = false, waitMode = false;
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("wait") === "true") waitMode = true;
    if (req.headers.get("content-type")?.includes("application/json")) {
      const b = await req.json();
      dryRun = b?.dry_run === true;
      if (b?.wait === true) waitMode = true;
    }
  } catch (_) { /* body 無しでも動く */ }

  // dry_run とテストは同期で返す。cron からは即200 + 裏で実行 (pg_net の5秒制限回避)
  if (dryRun || waitMode) return json(await run(dryRun));
  EdgeRuntime.waitUntil(run(false).catch((e) => console.error("[sns-metrics] bg error", e)));
  return json({ success: true, step: "accepted", async: true, received_at: new Date().toISOString() });
});

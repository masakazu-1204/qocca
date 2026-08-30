// ============================================================================
// storage-cleanup (2026/8/30)
//
// 自動投稿で作った古い画像をストレージから片づける。
//
// 背景: cron `instagram-storage-cleanup` が
//   `DELETE FROM storage.objects ...` を直接叩いていたが、Supabase 側の
//   トリガー storage.protect_delete に毎回弾かれていた。
//     ERROR: Direct deletion from storage tables is not allowed.
//            Use the Storage API instead.
//   そのため**一度も成功しておらず**、2026/5/28 から 89ファイル / 148MB が
//   溜まり続けていた (うち62件が30日超)。SQL では消せないので、
//   Storage API を使うこの関数に置き換える。
//
// 消す対象は「投稿し終えた自動生成画像」だけ。Instagram 側には投稿時点の
// コピーが残るので、こちらを消しても過去の投稿は壊れない。
//
// 呼び方: { dry_run?: true (数えるだけ), days?: number (既定30), prefix?, bucket? }
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const DEFAULT_BUCKET = "x-images";
const DEFAULT_PREFIX = "auto-instagram";
const DEFAULT_DAYS = 30;
// Storage API の remove() に一度に渡す数。多すぎるとリクエストが重くなる。
const CHUNK = 50;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function run(opts: { dryRun: boolean; days: number; bucket: string; prefix: string }) {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const cutoff = new Date(Date.now() - opts.days * 86400000);

  // list() は既定100件なので上限を明示する。1000件を超えるならページングが要るが、
  // 毎日走らせる前提なのでその手前で片づく。
  const { data: files, error } = await sb.storage.from(opts.bucket).list(opts.prefix, {
    limit: 1000,
    sortBy: { column: "created_at", order: "asc" },
  });
  if (error) return { success: false, step: "list_failed", error: error.message };

  const old = (files ?? []).filter((f) => f.created_at && new Date(f.created_at) < cutoff);
  const paths = old.map((f) => `${opts.prefix}/${f.name}`);

  const result = {
    success: true,
    bucket: opts.bucket,
    prefix: opts.prefix,
    older_than_days: opts.days,
    total_listed: files?.length ?? 0,
    matched: paths.length,
    oldest: old[0]?.created_at ?? null,
    dry_run: opts.dryRun,
    deleted: 0,
    errors: [] as string[],
  };
  if (opts.dryRun || paths.length === 0) return result;

  for (let i = 0; i < paths.length; i += CHUNK) {
    const chunk = paths.slice(i, i + CHUNK);
    const { error: delErr } = await sb.storage.from(opts.bucket).remove(chunk);
    if (delErr) result.errors.push(delErr.message);
    else result.deleted += chunk.length;
  }
  result.success = result.errors.length === 0;
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let dryRun = false, days = DEFAULT_DAYS, bucket = DEFAULT_BUCKET, prefix = DEFAULT_PREFIX;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const b = await req.json();
      dryRun = b?.dry_run === true;
      if (Number.isFinite(b?.days) && b.days > 0) days = b.days;
      if (typeof b?.bucket === "string" && b.bucket) bucket = b.bucket;
      if (typeof b?.prefix === "string" && b.prefix) prefix = b.prefix;
    }
  } catch (_) { /* body 無しでも既定値で動く */ }

  return json(await run({ dryRun, days, bucket, prefix }));
});

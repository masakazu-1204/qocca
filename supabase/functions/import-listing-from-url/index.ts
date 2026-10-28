// ============================================
// import-listing-from-url v1 (2026/10/29): よそで売っている自分の作品ページから、出品の下書きを作る
//   King「投稿と出品を増やす案」→ G。「その方向で大丈夫」(作家さん本人が貼った URL だけを読む形)。
//   8 月以降、新しい出品者が 0。minne / Creema / BASE で既に売っている作家さんが、Qocca に載せる手間を減らす。
//
//   - ログインした人だけ (中で auth.getUser で確かめる。verify_jwt=false: キーが sb_ 形式で JWT ではないため)。1 人 1 日 20 回まで (listing_imports)。
//     運用の確認は {url, check:true} + x-town-letter-key で、ログインなしに読み取り結果だけ見られる。
//   - 読むのは貼られた 1 ページだけ。巡回しない。名乗りは QoccaBot。robots.txt で許されている作品ページの形だけ受け付ける
//       minne   https://minne.com/items/<数字>
//       Creema  https://www.creema.jp/item/<数字>/detail
//       BASE    https://<shop>.base.shop/items/<数字> など BASE の独自ドメイン
//   - 取り出すのは og:title / og:description / product:price:amount と写真。
//     写真は Creema だけ作品番号入りの URL を最大 5 枚。minne と BASE はページに他の作品の写真も混ざるので og:image の 1 枚だけ。
//   - 写真は listing-images の <user.id>/import/ に置き、その URL を返す (画面側で File にして、いつもの出品と同じ流れで送る)。
//
//   POST { url } → { title, description, price, images: [url], source }
// ============================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const UA = "QoccaBot/1.0 (+https://www.qocca.pet)";
const DAILY_LIMIT = 20;
const MAX_HTML = 3 * 1024 * 1024;
const MAX_IMG = 8 * 1024 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const BASE_DOMAINS = ["base.shop", "thebase.in", "base.ec", "official.ec", "theshop.jp", "shopselect.net", "buyshop.jp",
  "fashionstore.jp", "handcrafted.jp", "kawaiishop.jp", "supersale.jp", "storeshop.jp", "base.place", "thebase.com"];

type Source = "minne" | "creema" | "base";
function classify(u: URL): Source | null {
  if (u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  if (h === "minne.com" && /^\/items\/\d+\/?$/.test(u.pathname)) return "minne";
  if ((h === "www.creema.jp" || h === "creema.jp") && /^\/item\/\d+\/detail\/?$/.test(u.pathname)) return "creema";
  if (BASE_DOMAINS.some((d) => h.endsWith("." + d)) && /^\/items\/\d+\/?$/.test(u.pathname)) return "base";
  return null;
}

const decode = (s: string) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&");
function meta(html: string, prop: string): string | null {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]*content=["']([^"']*)["']`, "i"))
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${esc}["']`, "i"));
  return a ? decode(a[1]).trim() : null;
}

function extract(html: string, src: Source, u: URL) {
  let title = meta(html, "og:title") ?? (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "");
  title = decode(title).replace(/\s*[|｜]\s*[^|｜]*powered by BASE\s*$/i, "").replace(/\s*[|｜]\s*(minne|Creema)[^|｜]*$/i, "").trim();
  let description = meta(html, "og:description") ?? meta(html, "description") ?? "";
  if (src === "minne") description = description.replace(/^[\d,]+円\s*[|｜]\s*/, "");
  const priceRaw = meta(html, "product:price:amount") ?? html.match(/"price"\s*:\s*"?(\d+)/)?.[1] ?? "";
  const price = /^\d+$/.test(priceRaw) ? Number(priceRaw) : null;

  let images: string[] = [];
  if (src === "creema") {
    const id = u.pathname.match(/\/item\/(\d+)\//)?.[1];
    if (id) {
      const re = new RegExp(`https://c\\.p\\d+\\.c4a\\.im/images/item/${id}/[0-9a-zA-Z_.\\-/]+`, "g");
      images = [...new Set(html.match(re) ?? [])];
    }
  }
  const og = meta(html, "og:image");
  if (og && /^https:\/\//.test(og) && !images.includes(og)) images.unshift(og);
  return { title: title.slice(0, 100), description: description.slice(0, 3000), price, images: images.slice(0, 5) };
}

async function readCapped(res: Response, cap: number): Promise<Uint8Array | null> {
  const reader = res.body?.getReader(); if (!reader) return null;
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length; if (size > cap) { try { await reader.cancel(); } catch (_) { /* no-op */ } return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(size); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  let body: any = {}; try { body = await req.json(); } catch (_) { /* 空 */ }
  let u: URL; try { u = new URL(String(body?.url ?? "").trim()); } catch (_) { return json({ error: "url_invalid" }, 400); }
  u.hash = ""; u.search = "";
  const src = classify(u);
  if (!src) return json({ error: "unsupported_url" }, 400);

  // 運用の確認用: 合言葉 (街だよりと同じ) つきの {check:true} は、ログインなしで読み取り結果だけ返す (写真は写さない・記録しない)
  if (body?.check === true) {
    const { data: okKey } = await sb.rpc("check_town_letter_key", { p_key: req.headers.get("x-town-letter-key") ?? "" });
    if (okKey !== true) return json({ error: "forbidden" }, 403);
    try {
      const res = await fetch(u.toString(), { headers: { "User-Agent": UA, "Accept": "text/html", "Accept-Language": "ja" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
      const buf = res.ok ? await readCapped(res, MAX_HTML) : null;
      if (!buf) return json({ check: true, ok: false, status: res.status });
      return json({ check: true, ok: true, status: res.status, source: src, ...extract(new TextDecoder("utf-8").decode(buf), src, u) });
    } catch (e) { return json({ check: true, ok: false, error: String((e as Error)?.message ?? e).slice(0, 200) }); }
  }

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: who } = await sb.auth.getUser(jwt);
  const user = who?.user; if (!user) return json({ error: "login_required" }, 401);

  const since = new Date(Date.now() - 86400e3).toISOString();
  const { count } = await sb.from("listing_imports").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: "too_many" }, 429);

  const log = (ok: boolean, error: string | null = null) =>
    sb.from("listing_imports").insert({ user_id: user.id, url: u.toString(), host: u.hostname, ok, error });

  let html = "";
  try {
    const res = await fetch(u.toString(), { headers: { "User-Agent": UA, "Accept": "text/html", "Accept-Language": "ja" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    const finalUrl = new URL(res.url || u.toString());
    if (!res.ok || classify(finalUrl) !== src) { await log(false, `fetch ${res.status} ${finalUrl.hostname}`); return json({ error: "fetch_failed", status: res.status }, 502); }
    const buf = await readCapped(res, MAX_HTML);
    if (!buf) { await log(false, "too_large"); return json({ error: "fetch_failed" }, 502); }
    html = new TextDecoder("utf-8").decode(buf);
  } catch (e) {
    await log(false, String((e as Error)?.message ?? e).slice(0, 200));
    return json({ error: "fetch_failed" }, 502);
  }

  const got = extract(html, src, u);
  if (!got.title) { await log(false, "no_title"); return json({ error: "nothing_found" }, 422); }

  // 写真を Qocca の置き場に写す (画面側で File にするため)
  const images: string[] = [];
  for (let i = 0; i < got.images.length; i++) {
    try {
      const r = await fetch(got.images[i], { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
      const type = (r.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!r.ok || !/^image\/(jpeg|png|webp|gif)$/.test(type)) continue;
      const bytes = await readCapped(r, MAX_IMG); if (!bytes) continue;
      const ext = type === "image/jpeg" ? "jpg" : type.split("/")[1];
      const path = `${user.id}/import/${Date.now()}_${i}.${ext}`;
      const { error } = await sb.storage.from("listing-images").upload(path, bytes, { contentType: type });
      if (error) continue;
      images.push(sb.storage.from("listing-images").getPublicUrl(path).data.publicUrl);
    } catch (_) { /* 1 枚落ちても続ける */ }
  }

  await log(true);
  return json({ source: src, title: got.title, description: got.description, price: got.price, images });
});

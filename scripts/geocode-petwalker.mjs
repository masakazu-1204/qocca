// ============================================================================
// ペットウォーカー 座標backfill (Phase 1) — Places Text Search (New) ジオコーディング
//   設計書: docs/petwalker-gps-design.md (2026/7/11 King承認・案A = name+pref+city)
//
// 動作モード (取得と書込を分離・レビューを挟める):
//   node scripts/geocode-petwalker.mjs --dry-run          … クエリ一覧のみ (API/DB非接触)
//   node scripts/geocode-petwalker.mjs                    … API取得+自動判定 → geocode-out/ にJSON/CSV出力 (DB書込なし)
//   node scripts/geocode-petwalker.mjs --write-from <json> … 既存結果JSONの verdict=AUTO のみ DB書込 (API非接触)
//   共通: --only id1,id2 で対象限定 / --limit N で先頭N件のみ
//
// 判定 (自動3段):
//   AUTO   = 日本境界内 + pref一致 + (名称類似 or city一致)  → --write-from で書込対象
//   REVIEW = 境界内だが pref不一致/名称非類似/座標重複(3+)   → review.csv へ (書かない)
//   REJECT = 境界外 or 結果0件                                → 座標なしのまま
//
// 書込は id 単位 PATCH + latitude=is.null ガード (冪等・二重書込防止)。
// キー: scripts/.gmapskey.local (Places) / scripts/.sbkey.local (Supabase service role)。
// ⚠️ キーをログ・チャット・コードに出さない。address カラムには書かない。
// ============================================================================
import { writeFile, mkdir, readFile } from "node:fs/promises";

const readLocal = async (f) => { try { return (await readFile(new URL(f, import.meta.url), "utf8")).trim(); } catch { return undefined; } };
const GKEY = await readLocal("./.gmapskey.local") || process.env.GMAPS_KEY;
const SBKEY = await readLocal("./.sbkey.local") || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB = "https://qufrqkuipzuqeqkvuhkx.supabase.co";

const DRY = process.argv.includes("--dry-run");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i >= 0 ? new Set(process.argv[i + 1].split(",").map(s => s.trim())) : null; })();
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i >= 0 ? Number(process.argv[i + 1]) : Infinity; })();
const WRITE_FROM = (() => { const i = process.argv.indexOf("--write-from"); return i >= 0 ? process.argv[i + 1] : null; })();

if (!SBKEY) { console.error("Supabase key 未設定 (scripts/.sbkey.local)"); process.exit(1); }
if (!WRITE_FROM && !DRY && !GKEY) { console.error("Places key 未設定 (scripts/.gmapskey.local)"); process.exit(1); }

const sbHeaders = { "Authorization": `Bearer ${SBKEY}`, "apikey": SBKEY };

// ── Supabase REST helpers ────────────────────────────────────────────────────
async function sbGetAll(pathQuery) {
  // Range ページング (REST デフォルト1000行上限対策)
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SB}/rest/v1/${pathQuery}`, { headers: { ...sbHeaders, "Range": `${from}-${from + 999}` } });
    if (!res.ok) throw new Error(`sb GET ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}
async function countNullCoords() {
  const res = await fetch(`${SB}/rest/v1/pet_walker_spots?latitude=is.null&select=id`, {
    headers: { ...sbHeaders, "Prefer": "count=exact", "Range": "0-0" },
  });
  return Number((res.headers.get("content-range") || "/0").split("/")[1]);
}

// ── Places Text Search (New) ────────────────────────────────────────────────
async function searchText(query) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GKEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "ja", regionCode: "JP" }),
    });
    if (res.ok) return (await res.json()).places?.[0] || null;
    const body = (await res.text()).slice(0, 200);
    // 429/5xx + 有効化直後の伝播中403(SERVICE_DISABLED) をリトライ
    if ((res.status === 429 || res.status >= 500 || (res.status === 403 && body.includes("SERVICE_DISABLED"))) && attempt < 3) {
      await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }
    throw new Error(`places ${res.status}: ${body}`);
  }
}

// ── 判定ロジック ─────────────────────────────────────────────────────────────
const norm = (s) => (s || "").normalize("NFKC").toLowerCase()
  .replace(/[\s　]/g, "").replace(/[()（）'’‘"『』「」・.、。&-]/g, "");
const inJapan = (lat, lng) => lat >= 24.0 && lat <= 46.0 && lng >= 122.0 && lng <= 146.0;

function judge(spot, place) {
  if (!place || place.location?.latitude == null) return { verdict: "REJECT", reason: "結果0件" };
  const lat = place.location.latitude, lng = place.location.longitude;
  if (!inJapan(lat, lng)) return { verdict: "REJECT", reason: "日本境界外" };
  const addr = place.formattedAddress || "";
  const prefOk = addr.includes(spot.pref);
  const cityOk = spot.city ? addr.includes(spot.city) : false;
  const n1 = norm(spot.name), n2 = norm(place.displayName?.text);
  const nameOk = n1.length > 0 && (n2.includes(n1) || n1.includes(n2));
  if (prefOk && (nameOk || cityOk)) return { verdict: "AUTO", reason: "" };
  const why = [!prefOk && "pref不一致", !nameOk && "名称非類似", !cityOk && "city不一致"].filter(Boolean).join("/");
  return { verdict: "REVIEW", reason: why };
}

// ── 書込モード (--write-from) ────────────────────────────────────────────────
if (WRITE_FROM) {
  const results = JSON.parse(await readFile(WRITE_FROM, "utf8"));
  let targets = results.filter(r => r.verdict === "AUTO");
  if (ONLY) targets = targets.filter(r => ONLY.has(r.id));
  const before = await countNullCoords();
  console.log(`書込前: latitude IS NULL = ${before}件 / 書込対象(AUTO) = ${targets.length}件`);
  let ok = 0, fail = 0;
  for (const r of targets) {
    const res = await fetch(`${SB}/rest/v1/pet_walker_spots?id=eq.${r.id}&latitude=is.null`, {
      method: "PATCH",
      headers: { ...sbHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ latitude: r.lat, longitude: r.lng }),
    });
    if (res.ok) { ok++; } else { fail++; console.error(`  失敗 ${r.name}: ${res.status}`); }
    if ((ok + fail) % 100 === 0) console.log(`  ${ok + fail}/${targets.length}…`);
  }
  const after = await countNullCoords();
  console.log(`書込完了: 成功${ok} 失敗${fail} / latitude IS NULL: ${before} → ${after}`);
  process.exit(0);
}

// ── 取得+判定モード (デフォルト) ─────────────────────────────────────────────
let spots = await sbGetAll("pet_walker_spots?latitude=is.null&select=id,name,pref,city&order=name");
if (ONLY) spots = spots.filter(s => ONLY.has(s.id));
spots = spots.slice(0, LIMIT);
console.log(`対象: ${spots.length}件 ${DRY ? "(dry-run)" : ""}`);

if (DRY) {
  for (const s of spots) console.log(`[${s.id.slice(0, 8)}] ${s.name} ${s.pref} ${s.city || ""}`);
  process.exit(0);
}

// 既存座標 (重複座標検知は既存179件も母集団に含める)
const existing = await sbGetAll("pet_walker_spots?latitude=not.is.null&select=id,latitude,longitude");

await mkdir("geocode-out", { recursive: true });
const results = [];
let done = 0;
for (const s of spots) {
  const query = [s.name, s.pref, s.city].filter(Boolean).join(" ");
  let rec;
  try {
    const place = await searchText(query);
    const { verdict, reason } = judge(s, place);
    rec = {
      id: s.id, name: s.name, pref: s.pref, city: s.city, query,
      result_name: place?.displayName?.text || null,
      result_address: place?.formattedAddress || null,
      lat: place?.location?.latitude ?? null,
      lng: place?.location?.longitude ?? null,
      place_id: place?.id || null,
      types: (place?.types || []).slice(0, 5),
      verdict, reason,
    };
  } catch (e) {
    rec = { id: s.id, name: s.name, pref: s.pref, city: s.city, query, verdict: "ERROR", reason: e.message.slice(0, 160) };
  }
  results.push(rec);
  done++;
  if (done % 50 === 0) console.log(`  ${done}/${spots.length}… (AUTO:${results.filter(r => r.verdict === "AUTO").length})`);
  await new Promise(r => setTimeout(r, 200)); // 5 QPS
}

// 重複座標検知: 同一座標(6桁丸め)に3件以上 → AUTO を REVIEW に降格 (既存座標も母集団)
const coordKey = (lat, lng) => `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
const freq = new Map();
for (const e of existing) { const k = coordKey(e.latitude, e.longitude); freq.set(k, (freq.get(k) || 0) + 1); }
for (const r of results) if (r.lat != null) { const k = coordKey(r.lat, r.lng); freq.set(k, (freq.get(k) || 0) + 1); }
for (const r of results) {
  if (r.verdict === "AUTO" && freq.get(coordKey(r.lat, r.lng)) >= 3) {
    r.verdict = "REVIEW"; r.reason = `座標重複(${freq.get(coordKey(r.lat, r.lng))}件)`;
  }
}

// 出力 (results_<n>.json は実行ごとに別ファイル)
let n = 1;
while (await readFile(`geocode-out/results_${n}.json`).then(() => true).catch(() => false)) n++;
await writeFile(`geocode-out/results_${n}.json`, JSON.stringify(results, null, 1));

const csvEsc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const review = results.filter(r => r.verdict === "REVIEW");
const csv = ["name,pref,city,reason,result_name,result_address,gmaps_url,id",
  ...review.map(r => [r.name, r.pref, r.city, r.reason, r.result_name, r.result_address,
    r.lat != null ? `https://www.google.com/maps?q=${r.lat},${r.lng}` : "", r.id].map(csvEsc).join(","))].join("\n");
await writeFile(`geocode-out/review_${n}.csv`, "﻿" + csv); // BOM付き (Excel文字化け防止)

const c = (v) => results.filter(r => r.verdict === v).length;
console.log(`\n完了: AUTO ${c("AUTO")} / REVIEW ${c("REVIEW")} / REJECT ${c("REJECT")} / ERROR ${c("ERROR")}`);
console.log(`出力: geocode-out/results_${n}.json, geocode-out/review_${n}.csv`);
console.log(`※DB書込なし。書込は --write-from geocode-out/results_${n}.json (King承認後)`);

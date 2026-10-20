// ペットウォーカー: 調査結果 JSON の根拠 URL が開けるか確かめる (登録の前に必ず流す)
// 実行: node scripts/petwalker-check-evidence.mjs <items.json> [...]
// 200 以外は 5 秒おいて 1 回だけやり直す (一時的な 500 で外さないため)。最後まで 200 でなければ exit 1。
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (!files.length) { console.error("使い方: node scripts/petwalker-check-evidence.mjs <items.json> [...]"); process.exit(1); }
const urls = new Map();
for (const f of files) for (const it of JSON.parse(readFileSync(f, "utf8"))) {
  if (!urls.has(it.evidence_url)) urls.set(it.evidence_url, []);
  urls.get(it.evidence_url).push(`${f}:${it.name}`);
}
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const status = async (u) => {
  try {
    const r = await fetch(u, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
    return r.status;
  } catch (e) { return `ERR ${e.name || e.message}`; }
};
let results = await Promise.all([...urls.keys()].map(async (u) => [u, await status(u)]));
const retry = results.filter(([, s]) => s !== 200);
if (retry.length) {
  await new Promise((r) => setTimeout(r, 5000));
  const again = new Map(await Promise.all(retry.map(async ([u]) => [u, await status(u)])));
  results = results.map(([u, s]) => [u, again.has(u) ? again.get(u) : s]);
}
const bad = results.filter(([, s]) => s !== 200);
console.log(`checked ${results.length} urls, non-200: ${bad.length}`);
for (const [u, s] of bad) console.log(s, u, "<-", urls.get(u).join(" | "));
process.exitCode = bad.length ? 1 : 0;

// 街のお知らせ: この一週間に街で増えたもの (ペットウォーカーの場所・ペットイベント・ブログ) を Threads と X で報告する
// King 2026/10/23「街をアプデした内容を SNS で報告していこう」
//
// 実行: node scripts/town-update-report.mjs          … 文面を表示するだけ (投稿しない)
//       node scripts/town-update-report.mjs --post   … Threads → X の順に投稿する
//
// - 数字はすべて DB から数える (書き換えない)。期間は「今日を含まない直近 7 日」(JST)
// - 増えたものが何も無い週は投稿しない
// - 同じ週に二度投稿しない: 直近 6 日の x_posts / threads_posts に「街のお知らせ」があれば止める
// - Threads は post-to-threads-adhoc (500 字以内・30 秒待つ)。失敗しても盲目リトライしない (二重投稿になる)
// - X は x_posts に scheduled で入れてから post-to-x (template_id は NULL。日常の自動投稿の冪等ガードに触らない)
// 鍵: scripts/.sbkey.local (gitignore 済・チャットに貼らない)
import { readFile } from "node:fs/promises";

const readLocal = async (f) => { try { return (await readFile(new URL(f, import.meta.url), "utf8")).trim(); } catch { return undefined; } };
const SB_KEY = await readLocal("./.sbkey.local") || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const POST = process.argv.includes("--post");
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const HEAD = "街のお知らせ";

const jstDate = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const today = jstDate(Date.now());
const from = jstDate(Date.now() - 7 * 86400e3);           // 7 日前 (含む)
const fromUtc = new Date(`${from}T00:00:00+09:00`).toISOString();
const toUtc = new Date(`${today}T00:00:00+09:00`).toISOString(); // 今日の 0 時 (含まない)
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const yesterday = jstDate(Date.now() - 86400e3);

const rest = async (q) => {
  let all = [];
  for (let o = 0; ; o += 1000) {
    const r = await fetch(`${SB_URL}/rest/v1/${q}`, { headers: { ...H, Range: `${o}-${o + 999}` } });
    const d = await r.json();
    if (!Array.isArray(d)) throw new Error(`${q.split("?")[0]}: ${JSON.stringify(d).slice(0, 200)}`);
    all = all.concat(d); if (d.length < 1000) break;
  }
  return all;
};
const count = async (q) => {
  const r = await fetch(`${SB_URL}/rest/v1/${q}`, { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });
  return Number(r.headers.get("content-range")?.split("/")[1] || 0);
};

// --- ペットウォーカー ---
const newSpots = await rest(`pet_walker_spots?select=area_tag&created_at=gte.${fromUtc}&created_at=lt.${toUtc}`);
const byArea = Object.entries(newSpots.reduce((a, s) => (a[s.area_tag] = (a[s.area_tag] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]);
const spotTotal = await count("pet_walker_spots?select=id");

// --- イベント (公開中・まだ終わっていないもの) ---
const live = `status=in.(approved,sold_out)&or=(event_date.gte.${today},end_date.gte.${today})`;
const eventTotal = await count(`events?select=id&${live}`);
const eventNew = await count(`events?select=id&${live}&created_at=gte.${fromUtc}&created_at=lt.${toUtc}`);
const prefs = new Set((await rest(`events?select=prefecture&${live}`)).map((e) => e.prefecture).filter((p) => p && !["全国", "未指定"].includes(p))).size;
// 次の土日 (今日が土日ならその週末)
const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
const sat = jstDate(Date.now() + ((6 - dow + 7) % 7 - (dow === 0 ? 7 : 0)) * 86400e3);
const sun = jstDate(new Date(`${sat}T00:00:00+09:00`).getTime() + 86400e3);
const weekend = await count(`events?select=id&status=in.(approved,sold_out)&event_date=lte.${sun}&or=(event_date.gte.${sat},end_date.gte.${sat})`);

// --- ブログ (この一週間に公開したもの) ---
const blogs = await rest(`blog_posts?select=title&published=eq.true&created_at=gte.${fromUtc}&created_at=lt.${toUtc}&order=created_at.asc`);

// --- 今週のお題 ---
const theme = (await rest(`weekly_themes?select=title,week_start&is_active=eq.true&week_start=lte.${today}&order=week_start.desc&limit=1`))[0];

if (!newSpots.length && !eventNew && !blogs.length) {
  console.log(`${md(from)}〜${md(yesterday)}: 増えたものが無いので投稿しない`);
  process.exit(0);
}

// --- 文面 (静かに・事実だけ・絵文字なし・「！」なし) ---
const fmt = (n) => n.toLocaleString("ja-JP");
const areaLine = byArea.slice(0, 5).map(([a, n]) => `${a} ${n}`).join(" / ") + (byArea.length > 5 ? ` ほか` : "");
const th = [`${HEAD} (${md(from)}〜${md(yesterday)})`, ""];
if (newSpots.length) {
  th.push(`ペットウォーカーに、犬と行ける場所が${fmt(newSpots.length)}か所増えました。`, areaLine,
    "どこも、犬と入れることを施設や観光協会の案内で確かめています。", `全国で${fmt(spotTotal)}か所になりました。`, "");
}
if (eventTotal) {
  th.push(`ペットイベントは、全国${prefs}都道府県で${fmt(eventTotal)}件。` + (eventNew ? `この一週間で${fmt(eventNew)}件が新しく入りました。` : ""));
  if (weekend) th.push(`${md(sat)}・${md(sun)}の週末に開かれるものは${fmt(weekend)}件あります。`);
  th.push("");
}
if (blogs.length) th.push(`読みもの: ${blogs.slice(0, 2).map((b) => `「${b.title}」`).join("")}${blogs.length > 2 ? ` ほか${blogs.length - 2}本` : ""}`, "");
if (theme) th.push(`今週のお題は「${theme.title}」です。`, "");
th.push("ペットウォーカー https://www.qocca.pet/petwalker", "イベント https://www.qocca.pet/events", "#Qocca");
const threadsText = th.join("\n");

const xParts = [`${HEAD}。`];
if (newSpots.length) xParts.push(`この一週間で、犬と行ける場所が${fmt(newSpots.length)}か所増えました (${byArea.slice(0, 3).map(([a]) => a).join("、")}${byArea.length > 3 ? "ほか" : ""})。`);
if (eventTotal) xParts.push(`ペットイベントは全国${fmt(eventTotal)}件${weekend ? `、今週末は${fmt(weekend)}件` : ""}。`);
let xText = xParts.join("") + "\nhttps://www.qocca.pet/petwalker\n#Qocca";
// X は全角 1 字を 2 と数えて 280 まで (URL は 23)。はみ出したら地域名を落とす
const xWeight = (s) => [...s.replace(/https?:\/\/\S+/g, "x".repeat(23))].reduce((w, c) => w + (c.charCodeAt(0) > 0x2fff ? 2 : 1), 0);
if (xWeight(xText) > 280) xText = xText.replace(/ \([^)]*\)。/, "。");

console.log("----- Threads (" + threadsText.length + " 字) -----\n" + threadsText);
console.log("\n----- X (重み " + xWeight(xText) + "/280) -----\n" + xText);
if (threadsText.length > 500) { console.error("Threads が 500 字を超えた。止める"); process.exitCode = 1; }
if (xWeight(xText) > 280) { console.error("X が 280 を超えた。止める"); process.exitCode = 1; }
if (!POST || process.exitCode) process.exit();

// --- 二度投稿しない ---
const sixDaysAgo = new Date(Date.now() - 6 * 86400e3).toISOString();
const dupX = await count(`x_posts?select=id&content=like.${encodeURIComponent(HEAD + "*")}&status=eq.posted&created_at=gte.${sixDaysAgo}`);
const dupT = await count(`threads_posts?select=id&content=like.${encodeURIComponent(HEAD + "*")}&status=eq.posted&created_at=gte.${sixDaysAgo}`);
console.log(`\n直近 6 日の「${HEAD}」: X ${dupX} / Threads ${dupT}`);

if (!dupT) {
  const r = await fetch(`${SB_URL}/functions/v1/post-to-threads-adhoc`, { method: "POST", headers: H, body: JSON.stringify({ text: threadsText }), signal: AbortSignal.timeout(90_000) })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
    .catch((e) => ({ status: 0, body: { error: e.message } }));
  console.log("Threads:", r.status, JSON.stringify(r.body).slice(0, 300));
  if (r.status !== 200) console.log("※ Threads は失敗でも投稿が成立していることがある。やり直す前に @qocca_pet を目で確認する");
} else console.log("Threads: 今週はもう投稿済みなので飛ばす");

if (!dupX) {
  const ins = await fetch(`${SB_URL}/rest/v1/x_posts`, { method: "POST", headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify({ template_id: null, content: xText, status: "scheduled", scheduled_at: new Date().toISOString(), cost_usd: 0 }) });
  const row = (await ins.json())[0];
  if (!row?.id) { console.log("X: x_posts に入れられなかった", ins.status); process.exit(1); }
  const r = await fetch(`${SB_URL}/functions/v1/post-to-x`, { method: "POST", headers: H, body: JSON.stringify({ x_post_id: row.id }), signal: AbortSignal.timeout(60_000) })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
    .catch((e) => ({ status: 0, body: { error: e.message } }));
  console.log("X:", r.status, JSON.stringify(r.body).slice(0, 300));
} else console.log("X: 今週はもう投稿済みなので飛ばす");

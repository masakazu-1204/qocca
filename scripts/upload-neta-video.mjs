// ネタ画像から作った縦動画を Supabase Storage に上げる。
//   使い方: node scripts/upload-neta-video.mjs <ローカルmp4> <保存名>
//   DB(sns_video_assets)登録は別途MCPでinsert。
import { readFile } from "node:fs/promises";

const readLocal = async (f) => { try { return (await readFile(new URL(f, import.meta.url), "utf8")).trim(); } catch { return undefined; } };
const SERVICE_KEY = await readLocal("./.sbkey.local") || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const BUCKET = "sns-neta";

const [src, name] = process.argv.slice(2);
if (!src || !name) { console.error("使い方: node scripts/upload-neta-video.mjs <mp4> <保存名>"); process.exit(1); }
if (!SERVICE_KEY) { console.error("❌ SERVICE_KEY未設定 (scripts/.sbkey.local)"); process.exit(1); }

const path = `video/${name}`;
const buf = await readFile(src);
const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY, "Content-Type": "video/mp4", "x-upsert": "true" },
  body: buf,
});
if (!res.ok) { console.error(`❌ storage ${res.status}: ${(await res.text()).slice(0,200)}`); process.exit(1); }
console.log(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}  (${Math.round(buf.length/1024)}KB)`);

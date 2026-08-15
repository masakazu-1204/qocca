// ============================================================================
// SNS動画 仕上げ→投稿待ち行列へ (2026/8/4)
//
// 生成済みクリップのURLを渡すと、以下を一気にやる:
//   ① ダウンロード → ② 結合(複数なら) → ③ Supabase Storage へアップ
//   → ④ sns_video_assets に登録(= 自動投稿の待ち行列に入る)
//
// 動画の「生成」だけは Higgsfield MCP 経由(クマの対話内)で行うため、この
// スクリプトには含まない。生成後のURLを渡すところから受け持つ。
//
// 使い方:
//   node scripts/publish-video-asset.mjs \
//     --title "そら:おかわり" \
//     --caption "ごはん、おかわり！$'\n'#柴犬 #犬のいる暮らし" \
//     --platforms threads,instagram \
//     --clips "https://.../c1.mp4,https://.../c2.mp4"
//
//   任意: --slug ep01_okawari (保存ファイル名。省略時は日時)
//         --dry-run          (アップと登録をせず、結合まで確認)
//
// ⚠️ 登録しただけでは投稿されない。投稿は既存の Edge Function が行う:
//      post-video-to-threads / post-video-to-instagram ({"pick": true})
// ============================================================================
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { statSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";

const SUPABASE_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const BUCKET = "sns-neta";
const PREFIX = "video";
const OUT_DIR = "video-out";

// ── 引数 ────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const DRY = argv.includes("--dry-run");
const title = arg("title");
const caption = arg("caption");
const platforms = (arg("platforms", "threads,instagram")).split(",").map(s => s.trim()).filter(Boolean);
const clipsArg = arg("clips");
const slug = arg("slug", `ep_${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}`);

if (!title || !caption || !clipsArg) {
  console.error("必須: --title / --caption / --clips");
  process.exit(1);
}
const clipUrls = clipsArg.split(",").map(s => s.trim()).filter(Boolean);

// ── キー読み込み (BOM混入に強くする。過去にBOMで認証が落ちた) ─────────
const readKey = async (f) => {
  try {
    const raw = await readFile(new URL(f, import.meta.url), "utf8");
    return raw.replace(/^﻿/, "").trim();
  } catch { return undefined; }
};
const SERVICE_KEY = (await readKey("./.sbkey.local")) || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY && !DRY) { console.error("scripts/.sbkey.local が読めません"); process.exit(1); }

// ── ① ダウンロード ────────────────────────────────────────
await mkdir(OUT_DIR, { recursive: true });
const localClips = [];
for (const [i, url] of clipUrls.entries()) {
  // ★ローカルの仕上げ済みファイルも渡せる。
  //   文字焼き込み・ロゴ・BGM合成をローカルで済ませてから登録したいことが多いため。
  if (!/^https?:\/\//.test(url)) {
    console.log(`① ローカル ${url} (${(statSync(url).size / 1024 / 1024).toFixed(2)} MB)`);
    localClips.push(url);
    continue;
  }
  const p = `${OUT_DIR}/${slug}_c${i + 1}.mp4`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`取得失敗(${res.status}): ${url}`); process.exit(1); }
  await writeFile(p, Buffer.from(await res.arrayBuffer()));
  console.log(`① 取得 ${p} (${(statSync(p).size / 1024 / 1024).toFixed(2)} MB)`);
  localClips.push(p);
}

// ── ② 結合 ───────────────────────────────────────────────
const finalPath = `${OUT_DIR}/${slug}.mp4`;
if (localClips.length === 1) {
  // ★1本でも必ず再エンコードする (2026/8/15)
  //   生成AIの生ファイルは 10,000kbps 超になることがあり、Instagram の
  //   コンテナが ERROR で落ちる。moov atom を先頭に置く +faststart も要る。
  //   「1本だからコピーで済む」は事故のもと。
  execFileSync(ffmpegPath, [
    "-y", "-v", "error", "-i", localClips[0],
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-profile:v", "high", "-level", "4.0",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
    "-movflags", "+faststart", finalPath,
  ], { stdio: ["ignore", "inherit", "inherit"] });
  console.log(`② 単体を再エンコード → ${finalPath} (${(statSync(finalPath).size / 1024 / 1024).toFixed(2)} MB)`);
} else {
  // concat filter で再エンコード。生成AIの出力は規格が微妙にズレることがあり、
  // 無再エンコード結合だと音ズレ・破損を起こすため安全側に倒す。
  const a = ["-y", "-v", "error"];
  for (const c of localClips) a.push("-i", c);
  const streams = localClips.map((_, i) => `[${i}:v:0][${i}:a:0]`).join("");
  a.push(
    "-filter_complex", `${streams}concat=n=${localClips.length}:v=1:a=1[v][a]`,
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", finalPath,
  );
  execFileSync(ffmpegPath, a, { stdio: ["ignore", "inherit", "inherit"] });
  console.log(`② 結合 ${localClips.length}本 → ${finalPath} (${(statSync(finalPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

if (DRY) { console.log("--dry-run のためここで終了(アップ・登録なし)"); process.exit(0); }

// ── ③ Supabase Storage へアップ ────────────────────────────
const objectPath = `${PREFIX}/${slug}.mp4`;
const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY,
    "Content-Type": "video/mp4", "x-upsert": "true",
  },
  body: await readFile(finalPath),
});
if (!up.ok) { console.error(`③ アップ失敗(${up.status}): ${(await up.text()).slice(0, 200)}`); process.exit(1); }
const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
console.log(`③ 公開URL ${publicUrl}`);

// 実際に取得できるか確認 (各SNSのAPIがここを取りに来るため)
const check = await fetch(publicUrl, { method: "HEAD" });
console.log(`   到達性 ${check.status} ${check.headers.get("content-type")}`);

// ── ④ 動画プールに登録 ─────────────────────────────────────
const ins = await fetch(`${SUPABASE_URL}/rest/v1/sns_video_assets`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY,
    "Content-Type": "application/json", Prefer: "return=representation",
  },
  body: JSON.stringify({
    title, video_url: publicUrl, caption,
    aspect_ratio: "9:16", source: "higgsfield", platforms,
  }),
});
if (!ins.ok) { console.error(`④ 登録失敗(${ins.status}): ${(await ins.text()).slice(0, 300)}`); process.exit(1); }
const row = (await ins.json())[0];
console.log(`④ 登録完了 video_id=${row.id} / 対象PF=${platforms.join(",")}`);
console.log("");
console.log("▼ 投稿するには (どちらも1本ずつ未使用の動画を選んで出す)");
console.log(`  curl -X POST "${SUPABASE_URL}/functions/v1/post-video-to-threads"   -H "Content-Type: application/json" -d '{"pick":true}'`);
console.log(`  curl -X POST "${SUPABASE_URL}/functions/v1/post-video-to-instagram" -H "Content-Type: application/json" -d '{"pick":true}'`);

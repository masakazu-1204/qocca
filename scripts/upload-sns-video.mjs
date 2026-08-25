// SNS 動画を Supabase Storage に上げる (2026/8/26)
//
//   node scripts/upload-sns-video.mjs <ファイル...>
//
// バケット `sns-neta` の `video/` 配下に、ファイル名そのままで置く。
// 出力した公開URLを sns_video_assets.video_url に入れて使う。
//
// ⚠️ service_role キーは scripts/.sbkey.local から読む。env より優先。
//    Windows のユーザー環境変数が古いまま残って 401 になる事故があったため。
// ⚠️ 新しい形式のキー (sb_secret_...) は Authorization だけでは通らない。
//    apikey ヘッダーも必ず一緒に送る (Bearer だけだと Invalid Compact JWS)。
// ⚠️ ファイル名は ASCII にしておく。日本語のままだと URL エンコードを挟むぶん、
//    投稿API側で扱いを間違えたときに原因が分かりにくくなる。
import { readFileSync, existsSync, statSync } from "node:fs";
import { basename } from "node:path";

const PROJECT = "qufrqkuipzuqeqkvuhkx";
const BUCKET = "sns-neta";
const PREFIX = "video";
const BASE = `https://${PROJECT}.supabase.co`;

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("使い方: node scripts/upload-sns-video.mjs <ファイル...>");
  process.exit(1);
}

const keyPath = "scripts/.sbkey.local";
if (!existsSync(keyPath)) {
  console.error(`service_role キーが無い: ${keyPath}`);
  console.error("PowerShell で絶対パス指定で作る (相対パスだと DirectoryNotFound になる):");
  console.error(`  Set-Content -Path C:\\Users\\reser\\qocca\\${keyPath.replace(/\//g, "\\")} -Value "キー" -NoNewline -Encoding utf8`);
  process.exit(1);
}
const KEY = readFileSync(keyPath, "utf8").trim();

const headers = {
  // 両方いる。片方だけだと 400 Invalid Compact JWS になる
  "apikey": KEY,
  "Authorization": `Bearer ${KEY}`,
  "Content-Type": "video/mp4",
  "x-upsert": "true",
};

let ok = 0, ng = 0;
for (const f of files) {
  if (!existsSync(f)) { console.error(`✗ 見つからない: ${f}`); ng++; continue; }
  const name = basename(f);
  const path = `${PREFIX}/${name}`;
  const body = readFileSync(f);
  const mb = (statSync(f).size / 1048576).toFixed(1);

  const res = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST", headers, body,
  });

  if (!res.ok) {
    // エラー本文にキーが混じることがあるため、状態と短い本文だけ出す
    const t = (await res.text()).slice(0, 200);
    console.error(`✗ ${name} (${mb}MB) HTTP ${res.status} ${t}`);
    ng++;
    continue;
  }
  console.log(`✓ ${name} (${mb}MB)`);
  console.log(`  ${BASE}/storage/v1/object/public/${BUCKET}/${path}`);
  ok++;
}

console.log(`\n成功 ${ok} / 失敗 ${ng}`);
if (ng > 0) process.exit(1);

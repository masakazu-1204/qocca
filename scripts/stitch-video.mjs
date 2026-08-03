// ============================================================================
// SNS動画 クリップ結合 (2026/8/4)
//   Seedance は1回15秒が上限のため、30秒動画は複数クリップを繋いで作る。
//   音声つきクリップを、映像も音声も途切れさせずに連結する。
//
// 使い方:
//   node scripts/stitch-video.mjs 出力先.mp4 クリップ1.mp4 クリップ2.mp4 [...]
//   例: node scripts/stitch-video.mjs video-out/ep01.mp4 video-out/c1.mp4 video-out/c2.mp4
//
// 設計メモ:
//   - concat demuxer(無再エンコード)は、クリップごとに解像度やフレームレートが
//     微妙に違うと音ズレ・破損を起こす。生成AIの出力は揃っている保証が無いため、
//     ★concat filter で再エンコードする方式を採る(安全側)。
//   - 9:16 縦動画・SNS投稿向けに H.264 + AAC で出力する。
// ============================================================================
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";

const [out, ...clips] = process.argv.slice(2);

if (!out || clips.length < 1) {
  console.error("使い方: node scripts/stitch-video.mjs 出力.mp4 クリップ1.mp4 [クリップ2.mp4 ...]");
  process.exit(1);
}
for (const c of clips) {
  if (!existsSync(c)) { console.error(`見つからない: ${c}`); process.exit(1); }
}

// 入力を並べ、concat filter で1本にする (映像・音声を同時に連結)
const args = ["-y", "-v", "error"];
for (const c of clips) args.push("-i", c);

const n = clips.length;
const streams = clips.map((_, i) => `[${i}:v:0][${i}:a:0]`).join("");
args.push(
  "-filter_complex", `${streams}concat=n=${n}:v=1:a=1[v][a]`,
  "-map", "[v]", "-map", "[a]",
  "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "128k",
  "-movflags", "+faststart",   // SNS/ブラウザで即再生できるように
  out,
);

console.log(`結合: ${clips.length}本 → ${out}`);
try {
  execFileSync(ffmpegPath, args, { stdio: ["ignore", "inherit", "inherit"] });
} catch (e) {
  console.error("ffmpeg 失敗:", e.message);
  process.exit(1);
}

const size = statSync(out).size;
// 尺を確認 (ffmpeg -i は stderr に出るので、失敗しても致命的でない形で拾う)
let dur = "?";
try {
  const info = execFileSync(ffmpegPath, ["-i", out], { stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
  const m = String(e.stderr || "").match(/Duration:\s*(\d+:\d+:\d+\.\d+)/);
  if (m) dur = m[1];
}
console.log(`完了: ${(size / 1024 / 1024).toFixed(2)} MB / 尺 ${dur}`);

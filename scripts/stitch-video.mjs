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

// ★音声トラックの有無を調べる。
//   ミーム用クリップは無音で生成する(テキストが主役・生成も速い)ため、
//   音声前提で組むと concat filter が [0:a:0] を見つけられず落ちる。
const hasAudio = (file) => {
  try {
    execFileSync(ffmpegPath, ["-i", file], { stdio: ["ignore", "pipe", "pipe"] });
    return false; // -i だけなら必ず例外になるのでここには来ない
  } catch (e) {
    return /Stream #\d+:\d+.*: Audio:/.test(String(e.stderr || ""));
  }
};
/** 尺(秒)を取る。無音クリップに同じ長さの無音音声を付けるために要る。 */
const durationOf = (file) => {
  try {
    execFileSync(ffmpegPath, ["-i", file], { stdio: ["ignore", "pipe", "pipe"] });
    return 0;
  } catch (e) {
    const m = String(e.stderr || "").match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    if (!m) return 0;
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
};

const audioFlags = clips.map(hasAudio);
const allHaveAudio = audioFlags.every(Boolean);
const noneHaveAudio = audioFlags.every(f => !f);

// 入力を並べ、concat filter で1本にする
const args = ["-y", "-v", "error"];
for (const c of clips) args.push("-i", c);

const n = clips.length;
if (noneHaveAudio) {
  // 全部無音 (ミーム用の標準ケース)
  const streams = clips.map((_, i) => `[${i}:v:0]`).join("");
  args.push("-filter_complex", `${streams}concat=n=${n}:v=1:a=0[v]`, "-map", "[v]");
} else {
  // 1本でも音声があれば音声トラックを持つ動画にする。
  // ★混在を許す: 「宣言だけ声を入れて、オチは無音」のような作り方をしたいため、
  //   無音クリップには同じ長さの無音音声を合成して尺を合わせる。
  const parts = [];
  clips.forEach((_, i) => {
    if (audioFlags[i]) { parts.push(`[${i}:v:0][${i}:a:0]`); }
    else { parts.push(`[${i}:v:0][qsil${i}]`); }
  });
  const silGen = clips
    .map((_, i) => audioFlags[i] ? null : `anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${durationOf(clips[i])}[qsil${i}]`)
    .filter(Boolean);
  args.push(
    "-filter_complex",
    `${silGen.length ? silGen.join(";") + ";" : ""}${parts.join("")}concat=n=${n}:v=1:a=1[v][a]`,
    "-map", "[v]", "-map", "[a]",
    "-c:a", "aac", "-b:a", "128k",
  );
}
args.push(
  "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",   // SNS/ブラウザで即再生できるように
  out,
);
console.log(
  noneHaveAudio ? "音声: 全クリップ無音"
  : allHaveAudio ? "音声: 全クリップあり"
  : `音声: 混在 (${audioFlags.map((f, i) => `${i + 1}=${f ? "有" : "無"}`).join(" ")}) → 無音側に同尺の無音を合成`
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

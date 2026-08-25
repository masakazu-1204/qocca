// Qocca CM ビルダー (2026/8/25)
//
// 生成済みの縦動画クリップを、静けさ Redesign 準拠の 1本の CM に組み立てる。
//
//   使い方:
//     node scripts/build-cm.mjs 出力.mp4 "clip.mp4:開始:終了" ... [--copy "..."] [--sub "..."]
//   例:
//     node scripts/build-cm.mjs cm-out/qocca_cm_15s.mp4 \
//       cm-out/cut1.mp4:0:4.0 cm-out/cut2.mp4:1.2:5.0 \
//       cm-out/cut3.mp4:1.0:5.0 cm-out/cut4.mp4:0.6:5.0
//
//   --copy     締めのコピー (既定: うちの子を愛してる人が集まる街。)
//   --sub      その下に置く小さい一行 (任意)。広告の飛び先ごとの一言に使う。
//   --vo       ナレーション音声。"ファイル:開始秒" 形式。無指定なら無音になる。
//              例: --vo "cm-out/vo/alden.wav:2.0"
//   --caption  本編に乗せる字幕。"開始:尺:本文" 形式で何度でも指定できる。
//              本文の | は改行。時刻は本編の頭からの秒数 (締めカードには乗らない)。
//              例: --caption "1.0:3.4:その首輪をつくった人の足元にも|待っている子がいる。"
//
// 字幕について: Meta 広告は大半が音を切って見られるため、実質こちらが本体になる。
//   ただしミーム動画のような極太の縁取りは静けさを壊すので使わない。
//   やわらかい影 + 薄いこげ茶の縁で、逆光の画でも読めるところまでに留める。
//
// やること:
//   1. 各クリップを指定区間で切り出し、1080x1920 に揃える (Meta 推奨サイズ)
//   2. カット間を 0.5秒のディゾルブで繋ぐ (静けさ: ハードカットを使わない)
//   3. 末尾に締めのカード (コピー + ロゴ) を 0.9秒かけて重ねる
//   4. 無音の AAC トラックを付ける (音楽は scripts/add-music.mjs で後乗せ)
//
// ⚠️ 静けさルール準拠: 絵文字なし / 純黒・純白なし / transition は 0.5s 以上 /
//    フォントは QC_FONT_DISPLAY のフォールバックである游明朝 / 煽り表現なし。
// ⚠️ Windows の drawtext は fontfile のコロンをエスケープする必要がある。

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";

// ── 静けさトークン (src/constants/theme.ts の QC と対応) ──────────────
// ⚠️ ffmpeg の 0xRRGGBB は RGB そのまま。BGR ではない (2026/8/25 実測で確認)。
const BG = "0xFAF7F2";        // QC.warmWhite
const INK = "0x8B6F5C";       // QC.softBrown  (コピー)
const MARK_INK = "0x2C2926";  // QC.charcoal   (ワードマーク)
const DEFAULT_COPY = "うちの子を愛してる人が集まる街。";
// 小さい一行は主役のコピーより一段引くが、QC.sage だと温白の上で薄くなりすぎて
// ほぼ読めなかった (2026/8/25 実測)。QC.warmGray まで濃くする。
const SUB_INK = "0x6B6259";   // QC.warmGray
const LOGO = "public/qocca_logo.png";

const W = 1080, H = 1920, FPS = 24;
const XFADE = 0.5;            // カット間のディゾルブ
const OUTRO_IN = 0.9;         // 締めカードへの溶け込み (ゆっくり)
const OUTRO_HOLD = 3.4;       // 締めカードの尺
const FONT = "C:/Windows/Fonts/yumin.ttf";      // 游明朝 (QC_FONT_DISPLAY のフォールバック)
const FONT_EN = "C:/Windows/Fonts/georgia.ttf"; // QC_FONT_EN のフォールバック (セリフ)
// 字幕は明朝だと動画の上で細って読めないため、ゴシックにする
const FONT_CAP = "C:/Windows/Fonts/YuGothM.ttc";
const CAP_INK = "0xFAF7F2";       // QC.warmWhite
const CAP_EDGE = "0x2C2926@0.35"; // QC.charcoal を薄く。輪郭は「足りるぶんだけ」
const CAP_SIZE = 44;
const CAP_LINE = 74;              // 行送り
const CAP_Y = 0.70;               // 画面の下から3割あたり
const CAP_FADE = 0.4;             // 出入りのやわらかさ
const SCRIM_INK = "0x1C1A18";     // 字幕の下地。純黒は使わない
const SCRIM_FROM = 0.55;          // ここから下だけ、じわっと沈める
// 逆光で床が明るいカットでは 0.42 だと字幕が飛んだ (2026/8/25 実測)。
// 文字側を太らせず、下地を濃くするほうで解決する。
const SCRIM_MAX = 0.55;           // 一番濃いところの不透明度

// --copy / --sub を先に抜き取り、残りを「出力 + クリップ指定」として扱う
const argv = process.argv.slice(2);
const takeOpt = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const v = argv[i + 1];
  if (v === undefined) { console.error(`${name} の値が無い`); process.exit(1); }
  argv.splice(i, 2);
  return v;
};
const COPY = takeOpt("--copy") ?? DEFAULT_COPY;
const SUB = takeOpt("--sub");

// --vo "ファイル:開始秒" (Windows の "C:/..." があるので末尾の数値だけ剥がす)
const voRaw = takeOpt("--vo");
let vo = null;
if (voRaw) {
  const p = voRaw.split(":");
  const at = Number(p.pop());
  const path = p.join(":");
  if (!Number.isFinite(at)) { console.error(`--vo は "ファイル:開始秒" : ${voRaw}`); process.exit(1); }
  if (!existsSync(path)) { console.error(`ナレーションが見つからない: ${path}`); process.exit(1); }
  vo = { path, at };
}

// --caption は繰り返し指定できるので、無くなるまで抜き取る
const captions = [];
for (let raw; (raw = takeOpt("--caption")) !== null; ) {
  const m = raw.match(/^([\d.]+):([\d.]+):([\s\S]+)$/);
  if (!m) { console.error(`--caption の形式は "開始:尺:本文" : ${raw}`); process.exit(1); }
  captions.push({ start: Number(m[1]), dur: Number(m[2]), lines: m[3].split("|") });
}

const [out, ...specs] = argv;
if (!out || specs.length < 2) {
  console.error('使い方: node scripts/build-cm.mjs 出力.mp4 "clip.mp4:開始:終了" ... [--copy "..."] [--sub "..."]');
  process.exit(1);
}

// "path:start:end" を分解する。Windows の "C:/..." があるので末尾2つだけを数値として剥がす。
const clips = specs.map((s) => {
  const parts = s.split(":");
  const end = Number(parts.pop());
  const start = Number(parts.pop());
  const path = parts.join(":");
  if (!existsSync(path)) { console.error(`見つからない: ${path}`); process.exit(1); }
  if (!(end > start)) { console.error(`区間がおかしい: ${s}`); process.exit(1); }
  return { path, start, dur: end - start };
});
if (!existsSync(LOGO)) { console.error(`ロゴが無い: ${LOGO}`); process.exit(1); }

// ディゾルブで重なる分、合計尺は (各尺の合計 - 重なり) になる
const filmDur = clips.reduce((a, c) => a + c.dur, 0) - XFADE * (clips.length - 1);
const total = filmDur + OUTRO_HOLD;

const esc = (p) => p.replace(/\\/g, "/").replace(/:/g, "\\:");
// drawtext の text= は単引用符で囲むため、'  \  % だけ潰せばよい
// (% は drawtext が strftime 展開に使う)
const escText = (t) => t.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/%/g, "\\%");

// ── フィルタグラフ ───────────────────────────────────────────
const parts = [];

// 1) 各クリップ: 指定区間を切り出し → 1080x1920 に揃える
clips.forEach((c, i) => {
  parts.push(
    `[${i}:v]trim=start=${c.start}:duration=${c.dur},setpts=PTS-STARTPTS,` +
    `scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuv420p[c${i}]`
  );
});

// 2) 順にディゾルブで連結。offset は「それまでの尺 - 重なり」
let prev = "c0", acc = clips[0].dur;
for (let i = 1; i < clips.length; i++) {
  const offset = (acc - XFADE).toFixed(3);
  const label = i === clips.length - 1 ? "film" : `x${i}`;
  parts.push(`[${prev}][c${i}]xfade=transition=dissolve:duration=${XFADE}:offset=${offset}[${label}]`);
  prev = label;
  acc += clips[i].dur - XFADE;
}

// 3) 締めのカード: 無地 → コピー → マーク → ワードマーク。フィルム側からゆっくり溶ける。
//    ⚠️ ロゴ画像はマークのみで社名が入らないため、CM の締めとして名前が読めない。
//       下にワードマークを描き足して「Qocca」を必ず残す。
// ⚠️ ロゴは透過PNG。overlay の前に yuv420p へ落とすとアルファが死んで
//    白い箱が出る (2026/8/25 実測)。rgba のまま重ね、最後に yuv420p にする。
const subLine = SUB
  ? `drawtext=fontfile='${esc(FONT)}':text='${escText(SUB)}':fontcolor=${SUB_INK}:fontsize=30:` +
    `x=(w-text_w)/2:y=(h/2)-130,`
  : "";

parts.push(
  `color=c=${BG}:s=${W}x${H}:r=${FPS}:d=${(OUTRO_HOLD + OUTRO_IN).toFixed(3)},format=rgba,` +
  `drawtext=fontfile='${esc(FONT)}':text='${escText(COPY)}':fontcolor=${INK}:fontsize=58:` +
  `x=(w-text_w)/2:y=(h/2)-220,` +
  subLine +
  `drawtext=fontfile='${esc(FONT_EN)}':text='Qocca':fontcolor=${MARK_INK}:fontsize=62:` +
  `x=(w-text_w)/2:y=(h/2)+250[card_t]`,
  `[${clips.length}:v]scale=${Math.round(W * 0.16)}:-1,format=rgba[lg]`,
  `[card_t][lg]overlay=x=(W-w)/2:y=(H/2)+40:format=auto,format=yuv420p[card]`,
);

// 3.5) 字幕を本編にだけ乗せる。締めカードには乗らない (コピーと二重になるため)。
//      ⚠️ フィルタ式の中のカンマは \, にしないと、そこでフィルタが切れたと解釈される。
const capChain = captions.flatMap((c) => {
  const end = c.start + c.dur;
  if (end > filmDur + 0.01) {
    console.warn(`⚠️ 字幕が本編(${filmDur.toFixed(1)}秒)をはみ出す: "${c.lines[0]}" ${c.start}〜${end}秒`);
  }
  const F = CAP_FADE;
  const a = `if(lt(t\\,${c.start})\\,0\\,if(lt(t\\,${c.start + F})\\,(t-${c.start})/${F}` +
            `\\,if(lt(t\\,${end - F})\\,1\\,if(lt(t\\,${end})\\,(${end}-t)/${F}\\,0))))`;
  // 複数行は1行ずつ別の drawtext にする (drawtext の改行は環境差が出るため)
  return c.lines.map((line, i) =>
    `drawtext=fontfile='${esc(FONT_CAP)}':text='${escText(line)}':` +
    `fontcolor=${CAP_INK}:fontsize=${CAP_SIZE}:` +
    `borderw=2:bordercolor=${CAP_EDGE}:shadowcolor=0x2C2926@0.45:shadowx=0:shadowy=2:` +
    `x=(w-text_w)/2:y=h*${CAP_Y}+${i * CAP_LINE}:alpha='${a}'`
  );
});
// 字幕の下地。逆光のカットでは文字が背景に負けるが、縁取りを太くすると
// ミーム動画の見た目になってしまう。CM と同じく「下だけに薄い影」を敷いて
// 文字の側は細いままにする。小さく作って拡大することで滑らかな階調にする。
if (capChain.length) {
  parts.push(
    `color=c=${SCRIM_INK}:s=2x256,format=rgba,` +
    `geq=r='r(X\\,Y)':g='g(X\\,Y)':b='b(X\\,Y)':` +
    `a='if(lt(Y\\,H*${SCRIM_FROM})\\,0\\,255*${SCRIM_MAX}*(Y-H*${SCRIM_FROM})/(H*${(1 - SCRIM_FROM).toFixed(3)}))',` +
    `scale=${W}:${H},setsar=1[scrim]`,
    `[film][scrim]overlay=0:0:format=auto:shortest=1[film_s]`,
    `[film_s]${capChain.join(",")}[film_c]`,
  );
} else {
  parts.push(`[film]null[film_c]`);
}

// 4) フィルム末尾に締めカードを重ねる (offset = フィルム尺 - 溶け込み時間)
parts.push(
  `[film_c][card]xfade=transition=fade:duration=${OUTRO_IN}:offset=${(filmDur - OUTRO_IN).toFixed(3)}[v]`
);

// 音声。ナレーションがあれば指定秒だけ遅らせ、後ろは無音で埋める (-t で切る)。
// 無ければ無音トラックだけ入れる (Meta は音声トラックがある方が扱いが素直)。
const SILENCE_IDX = clips.length + 1;
const VO_IDX = clips.length + 2;
if (vo) {
  const ms = Math.round(vo.at * 1000);
  parts.push(`[${VO_IDX}:a]aresample=44100,adelay=${ms}|${ms},apad[voa]`);
}

const args = [
  "-y", "-v", "error",
  ...clips.flatMap((c) => ["-i", c.path]),
  "-i", LOGO,
  "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
  ...(vo ? ["-i", vo.path] : []),
  "-filter_complex", parts.join(";"),
  "-map", "[v]", "-map", vo ? "[voa]" : `${SILENCE_IDX}:a`,
  "-t", total.toFixed(3),
  "-c:v", "libx264", "-preset", "slow", "-crf", "19",
  "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
  "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
  "-movflags", "+faststart",
  out,
];

execFileSync(ffmpegPath, args, { stdio: ["ignore", "inherit", "inherit"] });

console.log(`できた: ${out}`);
clips.forEach((c, i) => console.log(`  カット${i + 1}  ${c.path}  ${c.start}s から ${c.dur.toFixed(1)}秒`));
console.log(`  本編 ${filmDur.toFixed(1)}秒 + 締め ${OUTRO_HOLD}秒 = ${total.toFixed(1)}秒 / ${W}x${H} / ${vo ? "ナレ入り" : "無音"}`);
if (vo) console.log(`  ナレ: ${vo.path}  ${vo.at}秒 から`);
console.log(`  音楽: node scripts/add-music.mjs ${out} 曲.mp3 出力.mp4${vo ? " --keep-voice" : ""}`);

// 第5弾ネタ画像アップロード (2026/9/18・秋・人間の場所シリーズ)
//   ローカルPNG -> webp(q88) -> Supabase Storage sns-neta/
//   DB(sns_neta_posts)登録は別途MCPでinsert。
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const readLocal = async (f) => { try { return (await readFile(new URL(f, import.meta.url), "utf8")).trim(); } catch { return undefined; } };
const SERVICE_KEY = await readLocal("./.sbkey.local") || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const BUCKET = "sns-neta";

// n: slot番号, src: ローカルパス, key: ファイル名キー
const ITEMS = [
  { n: "48", src: "neta-new/batch5/48.png", key: "dogs_undokai"     },
  { n: "49", src: "neta-new/batch5/49.png", key: "cats_toshokan"    },
  { n: "50", src: "neta-new/batch5/50.png", key: "shiba_sento"      },
  { n: "51", src: "neta-new/batch5/51.png", key: "dogs_shinkansen"  },
  { n: "52", src: "neta-new/batch5/52.png", key: "dogs_haisha"      },
  { n: "53", src: "neta-new/batch5/53.png", key: "poodle_biyoushitsu" },
  { n: "54", src: "neta-new/batch5/54.png", key: "shiba_kouban"     },
  { n: "55", src: "neta-new/batch5/55.png", key: "cats_busstop"     },
  { n: "56", src: "neta-new/batch5/56.png", key: "dogs_kaigi"       },
  { n: "57", src: "neta-new/batch5/57.png", key: "dogs_momiji"      },
  { n: "58", src: "neta-new/batch5/58.png", key: "puppies_imohori"  },
  { n: "59", src: "neta-new/batch5/59.png", key: "dogs_kekkonshiki" },
];

async function upload(path, buf) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY, "Content-Type": "image/webp", "x-upsert": "true" },
    body: buf,
  });
  if (!res.ok) throw new Error(`storage ${res.status}: ${(await res.text()).slice(0, 180)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

if (!SERVICE_KEY) { console.error("❌ SERVICE_KEY未設定 (scripts/.sbkey.local)"); process.exit(1); }

const results = [];
for (const it of ITEMS) {
  const fname = `neta_${it.n}_${it.key}_a.webp`;
  try {
    const png = await readFile(it.src);
    const meta = await sharp(png).metadata();
    const webp = await sharp(png).webp({ quality: 88 }).toBuffer();
    await writeFile(`neta-new/batch5/${fname}`, webp);
    await upload(fname, webp);
    results.push({ n: it.n, path: fname, ok: true });
    console.log(`✅ ${fname}  ${meta.width}x${meta.height}  ${Math.round(webp.length / 1024)}KB`);
  } catch (e) {
    results.push({ n: it.n, path: fname, ok: false, err: String(e.message || e) });
    console.log(`❌ ${fname}  ${e.message || e}`);
  }
}
const ng = results.filter((r) => !r.ok);
console.log(`\n=== 完了: 成功 ${results.length - ng.length} / ${results.length} ===`);
if (ng.length) process.exit(1);

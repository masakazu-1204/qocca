// 第4弾ネタ画像アップロード (幼稚園・アイドル・季節)
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
  { n: "33", src: "neta-new/t1_matsuri.png",        key: "shiba_matsuri"   },
  { n: "34", src: "neta-new/t2_ryokan.png",         key: "pome_ryokan"     },
  { n: "35", src: "neta-new/t3_tokoya.png",         key: "dachs_tokoya"    },
  { n: "36", src: "neta-new/y1_ohirune.png",        key: "puppy_ohirune"   },
  { n: "37", src: "neta-new/y2_tenko.png",          key: "kitten_tenko"    },
  { n: "38", src: "neta-new/fuku/y3_oekaki.png",    key: "corgi_oekaki"    },
  { n: "39", src: "neta-new/fuku/y4_suberidai.png", key: "puppy_suberidai" },
  { n: "40", src: "neta-new/fuku/a1_stage.png",     key: "pome_idol"       },
  { n: "41", src: "neta-new/fuku/a2_akushu.png",    key: "cat_akushu"      },
  { n: "42", src: "neta-new/fuku/a3_gakuya.png",    key: "shiba_gakuya"    },
  { n: "43", src: "neta-new/fuku/a4_live.png",      key: "pome_live"       },
  { n: "44", src: "neta-new/s1_yakiimo.png",        key: "shiba_yakiimo"   },
  { n: "45", src: "neta-new/fuku/s2_ramen.png",     key: "frenchie_ramen"  },
  { n: "46", src: "neta-new/fuku/s3_jinja.png",     key: "cat_jinja"       },
  { n: "47", src: "neta-new/fuku/s4_densha.png",    key: "husky_densha"    },
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
    await writeFile(`neta-new/${fname}`, webp);
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

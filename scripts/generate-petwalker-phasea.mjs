// ============================================================================
// ペットウォーカー Phase A + 分割新タグ 画像生成 (2026/7/6) — fal.ai FLUX 2 Pro
//   ① エリアカード背景 7枚 (お台場 + 北海道4分割 + 九州2分割) → petwalker/<slug>.webp
//   ② スポット雰囲気画像 10枚 (お台場・東京ベイ) → petwalker/spots/<key>.webp
//   ※スポット画像は「実在店舗の写真」ではなく雰囲気イメージ (フォトリアル・人なし・文字なし)
// 実行: FAL_KEY / SUPABASE_SERVICE_ROLE_KEY を env に入れて node scripts/generate-petwalker-phasea.mjs [--dry-run] [--only slug]
// ============================================================================
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";

const FAL_KEY = process.env.FAL_KEY;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i >= 0 ? process.argv[i+1].split(",").map(s=>s.trim()) : null; })();
if (!DRY_RUN && (!FAL_KEY || !SB_KEY)) { console.error("❌ FAL_KEY / SUPABASE_SERVICE_ROLE_KEY 未設定"); process.exit(1); }

const COMMON = "photorealistic travel photography, soft natural light, no people, no text, no watermark, serene atmosphere, high detail";

const ITEMS = [
  // ── ① エリアカード背景 (petwalker/<slug>.webp・UI 即表示) ──
  { key: "odaiba",           path: "odaiba.webp",           prompt: "Tokyo Odaiba waterfront promenade at golden hour, Rainbow Bridge across the bay in the distance, gentle waves on urban beach, seaside walkway" },
  { key: "furano_biei",      path: "furano_biei.webp",      prompt: "Rolling flower fields and patchwork hills of Furano and Biei in Hokkaido summer, lavender rows, distant blue mountains, a single poplar tree" },
  { key: "sapporo_otaru",    path: "sapporo_otaru.webp",    prompt: "Otaru canal in Hokkaido at dusk, old stone warehouses reflected in calm water, warm gas lamps beginning to glow" },
  { key: "niseko_toya",      path: "niseko_toya.webp",      prompt: "Mount Yotei rising over Lake Toya in Hokkaido, clear summer morning, still lake reflection, green forest shoreline" },
  { key: "hakodate_onuma",   path: "hakodate_onuma.webp",   prompt: "Onuma pond near Hakodate with Mount Komagatake in the background, small islands and bridges, calm morning mist" },
  { key: "fukuoka_itoshima", path: "fukuoka_itoshima.webp", prompt: "Itoshima coastline near Fukuoka, white sandy beach with turquoise water, seaside cafe terrace with surfboards in distance, bright summer sky" },
  { key: "beppu",            path: "beppu.webp",            prompt: "Beppu onsen town in Oita at dawn, steam rising from many hot spring vents across the hillside town, bay and mountains beyond" },
  // ── ② スポット雰囲気画像 (petwalker/spots/<key>.webp・image_urls 配線・UI表示は今後) ──
  { key: "spot_odaiba_beach",   path: "spots/odaiba_beach.webp",   prompt: "Urban beach promenade in Odaiba Tokyo, boardwalk along sand, Rainbow Bridge view, morning joggers absent, clean calm scene" },
  { key: "spot_shiokaze",       path: "spots/shiokaze_park.webp",  prompt: "Wide grass lawn park by Tokyo bay, gentle slope of green grass, waterfront railing and ships in distance, late afternoon light" },
  { key: "spot_symbol_prom",    path: "spots/symbol_promenade.webp", prompt: "Long landscaped pedestrian promenade in Odaiba with trees and modern architecture, evening illumination beginning" },
  { key: "spot_aquacity",       path: "spots/aquacity.webp",       prompt: "Modern seaside shopping mall exterior in Odaiba Tokyo with bay view terrace, glass facade, palm trees, bright day" },
  { key: "spot_decks",          path: "spots/decks.webp",          prompt: "Wooden seaside deck of a Tokyo bay shopping complex, boardwalk terrace overlooking the water, string lights" },
  { key: "spot_tatsumi_dogrun", path: "spots/tatsumi_dogrun.webp", prompt: "Spacious fenced dog run in a green urban park, natural grass and trees, agility-friendly open space, no dogs visible, sunny" },
  { key: "spot_ilio_toyosu",    path: "spots/ilio_toyosu.webp",    prompt: "Natural grass rooftop dog run beside a modern waterfront mall in Toyosu Tokyo, canal and boats in background" },
  { key: "spot_dogdept_cafe",   path: "spots/dogdept_cafe.webp",   prompt: "Bright casual dog-friendly cafe interior with wooden tables near large windows facing the sea, empty seats, cozy American casual style" },
  { key: "spot_ushisuke",       path: "spots/ushisuke.webp",       prompt: "Cozy Japanese yakiniku restaurant interior with grill tables, warm lantern light, clean wooden decor, empty and calm" },
  { key: "spot_hilton_odaiba",  path: "spots/hilton_odaiba.webp",  prompt: "Elegant bayside hotel room in Tokyo with balcony view of Rainbow Bridge at dusk, soft interior lighting, pet bed subtly near window" },
];

async function gen(prompt) {
  const res = await fetch("https://fal.run/fal-ai/flux-2-pro", {
    method: "POST",
    headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: `${prompt}, ${COMMON}`, image_size: "landscape_16_9", num_images: 1 }),
  });
  if (!res.ok) throw new Error(`fal ${res.status}: ${(await res.text()).slice(0, 180)}`);
  const url = (await res.json())?.images?.[0]?.url;
  if (!url) throw new Error("no url");
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

async function upload(path, buf) {
  const res = await fetch(`${SB_URL}/storage/v1/object/petwalker/${path}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SB_KEY}`, "apikey": SB_KEY, "Content-Type": "image/webp", "x-upsert": "true" },
    body: buf,
  });
  if (!res.ok) throw new Error(`storage ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return `${SB_URL}/storage/v1/object/public/petwalker/${path}`;
}

const targets = ITEMS.filter(it => !ONLY || ONLY.includes(it.key));
await mkdir("petwalker-out/spots", { recursive: true });
console.log(`${targets.length}枚 ${DRY_RUN ? "(dry-run)" : ""}\n`);
const results = [];
for (const it of targets) {
  if (DRY_RUN) { console.log(`[${it.key}] ${it.prompt}`); continue; }
  try {
    const webp = await sharp(await gen(it.prompt)).resize({ width: 1280 }).webp({ quality: 85 }).toBuffer();
    await writeFile(`petwalker-out/${it.path}`, webp);
    const url = await upload(it.path, webp);
    results.push({ key: it.key, url, kb: Math.round(webp.length / 1024), ok: true });
    console.log(`✅ ${it.key} (${Math.round(webp.length / 1024)}KB) → ${url}`);
  } catch (e) {
    results.push({ key: it.key, error: e.message, ok: false });
    console.error(`❌ ${it.key}: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}
if (!DRY_RUN) {
  await writeFile("petwalker-out/phasea-results.json", JSON.stringify(results, null, 2));
  console.log(`\n成功 ${results.filter(r => r.ok).length}/${results.length}`);
}

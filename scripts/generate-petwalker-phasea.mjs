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
  // ── Phase A 第2マス: 堺・りんくう (大阪南) 2026/7/6 ──
  { key: "sakai_rinku",         path: "sakai_rinku.webp",          prompt: "Rinku town waterfront in southern Osaka at sunset, white marble pebble beach and calm sea, Kansai airport bridge silhouette in far distance, warm orange sky" },
  { key: "spot_rinku_outlet",   path: "spots/rinku_outlet.webp",   prompt: "Open-air American west coast style outlet mall promenade by the sea in Japan, palm trees, low white buildings, bright blue sky" },
  { key: "spot_harvest_hill",   path: "spots/harvest_hill.webp",   prompt: "Rolling farm park hills with colorful flower fields and a small ferris wheel in distance, green meadows, family farm atmosphere, sunny day" },
  { key: "spot_hamadera",       path: "spots/hamadera_park.webp",  prompt: "Historic pine tree forest park in Japan with wide walking paths through tall pines, dappled sunlight, calm morning" },
  { key: "spot_sennan_lp",      path: "spots/sennan_longpark.webp", prompt: "Long seaside boardwalk park with grass lawns and palm trees along Osaka bay, glamping domes in distance, golden hour" },
  { key: "spot_canmore",        path: "spots/canmore_glamping.webp", prompt: "Stylish glamping resort at dusk, illuminated dome tents and wooden decks, cozy outdoor lounge with lanterns, no people" },
  { key: "spot_wanto",          path: "spots/wanto_cafe.webp",     prompt: "Huge natural grass dog run field in a Japanese park with colorful agility equipment and a wooden deck cafe at the edge, bright day, no dogs visible" },
  { key: "spot_tonboike",       path: "spots/tonboike_park.webp",  prompt: "Large Japanese prefectural park with a pond shaped garden, rose garden and grassy hills, wide walking paths, soft afternoon light" },
  { key: "spot_whatawon",       path: "spots/whatawon.webp",       prompt: "Modern overseas-style open-air shopping mall with wooden terraces, string lights and relaxed outdoor seating areas, southern California vibes in Japan, clear sky" },
  // ── Phase A 第3マス: 北摂・箕面 (大阪北) 2026/7/6 ──
  { key: "hokusetsu_minoh",     path: "hokusetsu_minoh.webp",      prompt: "Minoh waterfall in northern Osaka surrounded by maple trees in early autumn, stone path along a mountain stream, soft forest light" },
  { key: "spot_hattori",        path: "spots/hattori_ryokuchi.webp", prompt: "Large Japanese metropolitan park with wide lawn, pond and tall trees, families' picnic area empty in early morning, gentle sunlight" },
  { key: "spot_fureai",         path: "spots/fureai_ryokuchi.webp",  prompt: "Grass field park under a wide sky with an airplane flying low overhead approaching an airport, fenced dog run area at the edge, afternoon" },
  { key: "spot_satsukiyama",    path: "spots/satsukiyama.webp",    prompt: "Hillside park overlooking an Osaka suburban town, cherry trees and winding walking trails up the mountain, observation deck view, spring" },
  { key: "spot_minoh_falls",    path: "spots/minoh_falls.webp",    prompt: "A beautiful waterfall cascading over red rocks framed by bright red maple leaves, wooden viewing area, japanese mountain gorge" },
  { key: "spot_settsukyo",      path: "spots/settsukyo.webp",      prompt: "River gorge with clear shallow stream over smooth rocks, forest hiking path along the water, summer greenery, northern Osaka" },
  { key: "spot_expocity",       path: "spots/expocity.webp",       prompt: "Modern large shopping complex exterior with a giant ferris wheel, wide plaza with trees, bright day, Osaka suburbs" },
  { key: "spot_banpaku_gaishu", path: "spots/banpaku_gaishu.webp", prompt: "Tree-lined perimeter walking path around a large park, iconic tower silhouette visible above the trees in distance, jogging path, morning" },
  { key: "spot_nose_toriko",    path: "spots/nose_toriko.webp",    prompt: "Countryside dog cafe with wooden interior and a grassy dog run outside, rural satoyama landscape of Nose, relaxed rustic vibe" },
  { key: "spot_mori_terrace",   path: "spots/mori_terrace.webp",   prompt: "Forest glamping site at dusk with illuminated bell tents among tall cedar trees, campfire glow, quiet mountain village in northern Osaka" },
  // ── Phase A 第4マス: 横浜・みなとみらい (神奈川東) 2026/7/6 ──
  { key: "yokohama_mm",         path: "yokohama_mm.webp",          prompt: "Yokohama Minato Mirai waterfront skyline at dusk, ferris wheel and landmark tower lights reflected in the harbor, seaside promenade in foreground" },
  { key: "spot_yamashita",      path: "spots/yamashita_park.webp", prompt: "Seaside park promenade along Yokohama harbor with flower beds and a classic ocean liner moored nearby, morning walk atmosphere" },
  { key: "spot_minato_oka",     path: "spots/minato_oka.webp",     prompt: "Hilltop garden park overlooking Yokohama port and bay bridge, western style historic house among trees, rose garden edge, soft light" },
  { key: "spot_rinko",          path: "spots/rinko_park.webp",     prompt: "Wide harbor-front lawn park in Minato Mirai Yokohama, gentle grassy slopes meeting the sea wall, city towers behind, afternoon" },
  { key: "spot_marine_walk",    path: "spots/marine_walk.webp",    prompt: "Stylish open-air seaside shopping street with brick and white wood facades, ocean visible between buildings, string lights, west coast mood in Yokohama" },
  { key: "spot_akarenga",       path: "spots/akarenga.webp",       prompt: "Historic red brick warehouses by Yokohama harbor at golden hour, wide plaza between the buildings, harbor cranes in distance" },
  { key: "spot_hakkeijima",     path: "spots/hakkeijima.webp",     prompt: "Island leisure park promenade by the sea with palm trees and pleasure boats, aquarium pyramid glass building in distance, bright marine day" },
  { key: "spot_uni_coffee",     path: "spots/uni_coffee.webp",     prompt: "Cozy modern coffee roastery cafe interior inside a historic red brick building, espresso bar, warm lights, no people" },
  { key: "spot_bills_akarenga", path: "spots/bills_akarenga.webp", prompt: "Bright glass box terrace dining space attached to a red brick warehouse, pancakes cafe table setting, harbor view through glass, morning light" },
  { key: "spot_omo7_yokohama",  path: "spots/omo7_yokohama.webp",  prompt: "Modern city hotel room with playful colorful interior and a small pet bed by the window, Yokohama city night view outside, cozy lighting" },
  // ── Phase A 第5マス: 高尾・奥多摩 (東京西) 2026/7/7 ──
  { key: "takao_okutama",       path: "takao_okutama.webp",        prompt: "Mount Takao forest trail in soft morning mist, sunbeams through tall cedar trees, mountain path with wooden steps, serene green mountains of west Tokyo" },
  { key: "spot_takao_trail",    path: "spots/takao_trail.webp",    prompt: "Gentle mountain hiking trail through cedar forest with stone lanterns and a temple gate glimpse, dappled light, Mount Takao Japan" },
  { key: "spot_takao_cable",    path: "spots/takao_cable.webp",    prompt: "Historic funicular cable car climbing a steep forested mountain slope, green canopy tunnel, small mountain station, bright day" },
  { key: "spot_showakinen",     path: "spots/showakinen.webp",     prompt: "Vast national park lawn with giant zelkova tree in the center, flower fields in distance, wide open sky, families absent, morning" },
  { key: "spot_mitake_cable",   path: "spots/mitake_cable.webp",   prompt: "Red cable car ascending a lush green mountain with valley view behind, forest ropeway in Okutama Tokyo, summer" },
  { key: "spot_mitake_shrine",  path: "spots/mitake_shrine.webp",  prompt: "Ancient mountain shrine with vermilion gate and stone wolf guardian statues, tall cedar trees, mist, sacred quiet atmosphere, Japan" },
  { key: "spot_rock_garden",    path: "spots/rock_garden.webp",    prompt: "Moss covered rocks along a clear mountain stream with small waterfalls, wooden footbridge, deep green forest gorge, cool summer light" },
  { key: "spot_kamenoi_ome",    path: "spots/kamenoi_ome.webp",    prompt: "Riverside onsen resort hotel terrace overlooking a clear river valley with green mountains, private lawn dog run beside the room, dusk" },
  // ── Phase A 第6マス: 奈良・生駒 (奈良北) 2026/7/7 ──
  { key: "nara_ikoma",          path: "nara_ikoma.webp",           prompt: "Nara Park meadow with wild deer resting under autumn trees, historic pagoda in the misty distance, golden afternoon light, ancient capital atmosphere" },
  { key: "spot_nara_park",      path: "spots/nara_park.webp",      prompt: "Wide grassy park with tame deer and tall trees, stone lanterns along a path, soft morning light, Nara Japan" },
  { key: "spot_todaiji",        path: "spots/todaiji.webp",        prompt: "Grand wooden Buddhist temple hall with sweeping tiled roof behind a stone plaza, tall trees, clear sky, Todaiji Nara" },
  { key: "spot_umami",          path: "spots/umami_park.webp",     prompt: "Expansive flower park with colorful tulip fields and rolling green lawns, walking paths, spring blue sky, Japan" },
  { key: "spot_ikoma_sanroku",  path: "spots/ikoma_sanroku.webp",  prompt: "Mountainside forest park with a nature trail through cedar and broadleaf trees, valley view over the plains, summer greenery" },
  { key: "spot_ikoma_sanjo",    path: "spots/ikoma_sanjo.webp",    prompt: "Retro mountaintop amusement park at dusk overlooking a vast city night view below, ferris wheel silhouette, nostalgic mood" },
  { key: "spot_yamato_minzoku", path: "spots/yamato_minzoku.webp", prompt: "Open-air folk museum park with old thatched-roof farmhouses among trees and a plum grove, quiet grassy grounds, gentle light" },
  { key: "spot_dogbase",        path: "spots/dogbase.webp",        prompt: "Enormous natural grass dog run field under a wide open sky, mountains in the distance, no dogs visible, Kansai countryside, sunny" },
  { key: "spot_naramachi_cafe", path: "spots/naramachi_cafe.webp", prompt: "Cozy cafe terrace in a traditional Japanese townhouse district with wooden lattice facades, small tables outside, warm afternoon, Naramachi" },
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

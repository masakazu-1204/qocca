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
  // ── Phase C 空白県潰し: 鹿児島・桜島 2026/7/7 ──
  { key: "kagoshima_sakurajima", path: "kagoshima_sakurajima.webp", prompt: "Sakurajima active volcano across Kinko Bay at sunset, gentle smoke from the summit, calm sea in foreground, southern Japan, warm sky" },
  { key: "spot_nagisa",          path: "spots/nagisa_park.webp",    prompt: "Coastal lava rock walking trail beside the sea with an active volcano towering behind, black volcanic rocks, footbath steam, bright day" },
  { key: "spot_sakura_ferry",    path: "spots/sakurajima_ferry.webp", prompt: "Ferry boat crossing a calm bay toward a volcanic island, open sea deck, seagulls, sunny maritime scene, southern Japan" },
  { key: "spot_sakura_sa",       path: "spots/sakurajima_sa.webp",  prompt: "Small grassy fenced dog run at a highway service area with a volcano view in the distance, sunny, no dogs visible" },
  { key: "spot_shiroyama",       path: "spots/shiroyama.webp",      prompt: "Hilltop observation deck overlooking a city and a smoking volcano across the bay, lush green foreground, panoramic view, clear day" },
  { key: "spot_jigenji",         path: "spots/jigenji_park.webp",   prompt: "Green valley park with a clear mountain stream and stone bridges, tall trees, dappled light, peaceful Japanese park" },
  { key: "spot_ikeda_lake",      path: "spots/ikeda_lake.webp",     prompt: "Large caldera lake with a conical mountain peak reflected on calm water, yellow rape flowers along the shore, spring, southern Kyushu" },
  { key: "spot_ora_cafe",        path: "spots/ora_cafe.webp",       prompt: "Bright stylish dog-friendly cafe interior with wooden tables and a shelf of dog treats, large windows, no people, cozy" },
  { key: "spot_mother_ibusuki",  path: "spots/mother_ibusuki.webp", prompt: "Cafe terrace with a small grassy dog run beside it, southern seaside town greenery, relaxed sunny afternoon" },
  { key: "spot_shippo",          path: "spots/shippo_cafe.webp",    prompt: "Cute crepe cafe with an outdoor grass dog run, colorful casual exterior, countryside of Kirishima, sunny day" },
  { key: "spot_maruo",           path: "spots/maruo_falls.webp",    prompt: "Wide waterfall of pale turquoise hot spring water cascading down forested rocks, steam rising faintly, lush green gorge" },
  { key: "spot_lavista",         path: "spots/lavista_kirishima.webp", prompt: "Hilltop onsen hotel terrace with open-air bath overlooking green mountains and valley mist at dusk, warm lantern light" },
  { key: "spot_fairfield",       path: "spots/fairfield_tarumizu.webp", prompt: "Modern roadside hotel with a volcano view across the bay, clean minimalist exterior, palm trees, bright southern light" },
  // ── Phase C 空白県潰し: 長崎・ハウステンボス 2026/7/7 ──
  { key: "nagasaki_htb",        path: "nagasaki_htb.webp",         prompt: "European-style canal town with brick buildings, windmill and tulip gardens at dusk, warm lights reflecting on the canal, Dutch townscape in Japan" },
  { key: "spot_htb_park",       path: "spots/htb_park.webp",       prompt: "Wide European boulevard with brick facades and flower beds, canal boats, spring flowers everywhere, no people, theme park townscape" },
  { key: "spot_htb_villa",      path: "spots/htb_villa.webp",      prompt: "Cozy lakeside cottage villas among tall forest trees at evening, warm cabin lights, wooden porches, quiet resort atmosphere" },
  { key: "spot_inasayama",      path: "spots/inasayama_dogrun.webp", prompt: "Hillside park dog run with a panoramic night view city and harbor far below, green lawn and fences, twilight" },
  { key: "spot_iland_bark",     path: "spots/iland_bark.webp",     prompt: "Seaside resort lodge with long natural grass dog run along the ocean, terrace rooms opening to the lawn, island sunset" },
  { key: "spot_aguri",          path: "spots/aguri_dogrun.webp",   prompt: "Farm park dog run on a green hill with wooden fences, countryside scenery and sea in far distance, sunny pastoral day" },
  { key: "spot_omurawan_pa",    path: "spots/omurawan_pa.webp",    prompt: "Small grass dog run at a highway rest area overlooking a calm blue bay, heart-shaped stone monument nearby, gentle afternoon" },
  // ── Phase C 空白県潰し: 会津・裏磐梯 2026/7/7 ──
  { key: "aizu_urabandai",      path: "aizu_urabandai.webp",       prompt: "Cobalt blue and emerald green ponds of Urabandai reflecting autumn forest with Mount Bandai behind, clear crisp highland light, Fukushima" },
  { key: "spot_goshikinuma",    path: "spots/goshikinuma.webp",    prompt: "Vivid turquoise pond surrounded by autumn foliage with a forest walking trail alongside, still water reflection, crisp morning" },
  { key: "spot_michinoeki_ina", path: "spots/michinoeki_inawashiro.webp", prompt: "Roadside station with a grass dog run and Mount Bandai in the background, green lawn, blue sky, rural Fukushima" },
  { key: "spot_tsurugajo",      path: "spots/tsurugajo.webp",      prompt: "Japanese castle with red-tiled roof surrounded by cherry blossom trees and a green park, wide lawn in foreground, spring, Aizu" },
  { key: "spot_ouchijuku",      path: "spots/ouchijuku.webp",      prompt: "Historic post town street lined with traditional thatched-roof houses, unpaved road, mountains behind, nostalgic Edo-era atmosphere" },
  { key: "spot_angelforest",    path: "spots/angelforest.webp",    prompt: "Highland lakeside resort with cottages and a large natural grass dog run, forest and calm lake, summer, no people" },
  { key: "spot_mercure_ub",     path: "spots/mercure_urabandai.webp", prompt: "Modern resort hotel among tall trees near colorful ponds, highland forest setting, warm afternoon light" },
  { key: "spot_akimotoya",      path: "spots/akimotoya.webp",      prompt: "Cozy Japanese lakeside inn with a grassy dog run, mountains and lake view, quiet highland resort, sunny" },
  { key: "spot_akabeko",        path: "spots/akabeko_cottage.webp", prompt: "Wooden forest cottage with a fenced dog run in the yard, tall trees, dappled sunlight, peaceful highland retreat" },
  { key: "spot_kyukamura_ub",   path: "spots/kyukamura_urabandai.webp", prompt: "Forest campsite with tents among tall trees at dusk, campfire glow, starry sky beginning, quiet mountain campground" },
  // ── Phase C 空白県潰し: 越後湯沢・新潟 2026/7/7 ──
  { key: "niigata_yuzawa",      path: "niigata_yuzawa.webp",       prompt: "Snow country highland in green summer with ropeway climbing a lush mountain, valley town below, layered peaks, crisp bright air, Echigo-Yuzawa" },
  { key: "spot_yuzawa_kogen",   path: "spots/yuzawa_kogen.webp",   prompt: "Alpine botanical garden on a mountain plateau with colorful flowers and walking paths, a large ropeway cabin arriving, panoramic valley view" },
  { key: "spot_dragondola",     path: "spots/dragondola.webp",     prompt: "Long gondola cabin gliding high over a vast valley of red and gold autumn foliage, mountains stretching to horizon, aerial view" },
  { key: "spot_yutorelo",       path: "spots/yutorelo_yuzawa.webp", prompt: "Cozy hot spring resort hotel with a small grassy dog run, snow country mountains behind, warm evening light" },
  { key: "spot_kkr_yuzawa",     path: "spots/kkr_yuzawa.webp",     prompt: "Traditional Japanese onsen inn among green mountains with a summer dog run area, calm rural resort scene" },
  { key: "spot_shimami",        path: "spots/shimami_ryokuchi.webp", prompt: "Large seaside green park with a fenced grass dog run, pine trees and coastal dunes nearby, wide open sky, bright day" },
  { key: "spot_ikutopia",       path: "spots/ikutopia.webp",       prompt: "Beautiful themed flower gardens with winding paths and seasonal blooms, greenhouse in distance, families' park, sunny afternoon" },
  { key: "spot_water_shuttle",  path: "spots/shinano_shuttle.webp", prompt: "Small river water bus cruising down a wide river through a modern Japanese city, open deck, bridges and buildings along the banks" },
  { key: "spot_ikeda_orchard",  path: "spots/ikeda_orchard.webp",  prompt: "Strawberry greenhouse orchard with rows of red strawberries and a rest area, bright interior, cheerful farm atmosphere" },
  { key: "spot_hoho_inn",       path: "spots/hoho_inn.webp",       prompt: "Countryside inn overlooking a wide rice plain and a mountain range at dusk, warm room lights, peaceful rural Niigata" },
  { key: "spot_petemo",         path: "spots/petemo_niigata.webp", prompt: "Bright modern indoor dog run facility with rubber flooring and agility toys, large windows, clean pet complex, no dogs visible" },
  // ── Phase C 空白県潰し: 富山・雨晴海岸 2026/7/7 ──
  { key: "toyama_amaharashi",   path: "toyama_amaharashi.webp",    prompt: "Amaharashi coast in Toyama with snow-capped Tateyama mountain range rising across the sea, rocky islet with pine tree, morning light on calm water" },
  { key: "spot_amaharashi",     path: "spots/amaharashi_beach.webp", prompt: "Sandy beach with a small rocky island and pine trees, snow mountains across the bay, gentle waves, early morning walk scene" },
  { key: "spot_kansui_park",    path: "spots/kansui_park.webp",    prompt: "Modern canal-side park with an elegant footbridge and glass tower, landscaped lawns and walking paths, blue sky reflections" },
  { key: "spot_sbux_kansui",    path: "spots/sbux_kansui.webp",    prompt: "Glass-walled cafe by a canal park with an open terrace facing the water, evening illumination reflected on the canal, serene urban scene" },
  { key: "spot_dadada",         path: "spots/dadada_cafe.webp",    prompt: "Small stylish countryside cafe with a wooden terrace facing rice fields, minimal modern design, soft afternoon light" },
  { key: "spot_iox_arosa",      path: "spots/iox_arosa.webp",      prompt: "Mountain resort green slope in summer with a fenced dog run area, gondola line above, forested hills, fresh alpine air" },
  { key: "spot_merhen_oyabe",   path: "spots/merhen_oyabe.webp",   prompt: "Roadside station with a large grass dog run, fairy-tale style clock tower building, parking and green lawns, sunny" },
  { key: "spot_taikouyama",     path: "spots/taikouyama.webp",     prompt: "Large prefectural park with a lake, forest paths and open lawns, observation tower in distance, families' green space, bright day" },
  { key: "spot_niemon",         path: "spots/niemon_ryokan.webp",  prompt: "Small traditional Japanese hot spring inn in a mountain village, wooden facade, steam rising, quiet evening, warm lantern" },
  { key: "spot_suigetsuro",     path: "spots/suigetsuro.webp",     prompt: "Historic Japanese ryokan with elegant tatami rooms and a garden, lantern-lit entrance at dusk, refined traditional atmosphere" },
  { key: "spot_doubletree_tym", path: "spots/doubletree_toyama.webp", prompt: "Modern city hotel room with a small pet bed and bowls near the window, city lights of Toyama outside, warm minimal interior" },
  // ── Phase C 空白県潰し: 奥入瀬・弘前 2026/7/7 ──
  { key: "oirase_hirosaki",     path: "oirase_hirosaki.webp",      prompt: "Oirase mountain stream in early autumn with mossy rocks and small waterfalls among red and gold foliage, forest walking path, soft misty light, Aomori" },
  { key: "spot_hirosaki_park",  path: "spots/hirosaki_park.webp",  prompt: "Japanese castle with a moat full of cherry blossoms and snow-capped Mount Iwaki behind, pink petals everywhere, spring, Hirosaki" },
  { key: "spot_tanesashi",      path: "spots/tanesashi.webp",      prompt: "Coastal natural grassland meeting the sea, green lawn stretching to rocky shore and Pacific Ocean, wide sky, summer, Hachinohe" },
  { key: "spot_ashigezaki",     path: "spots/ashigezaki.webp",     prompt: "Clifftop observation point overlooking the Pacific Ocean with a coastal walking trail and wild grass, bright sea horizon" },
  { key: "spot_oirase_stream",  path: "spots/oirase_stream.webp",  prompt: "Clear mountain stream tumbling over mossy green rocks through a lush forest gorge, small waterfall, sunlight filtering through leaves" },
  { key: "spot_towadako",       path: "spots/towadako.webp",       prompt: "Vast calm caldera lake surrounded by green forested hills, a sightseeing boat on the water, lakeside promenade, clear day" },
  { key: "spot_towada_art",     path: "spots/towada_art.webp",     prompt: "Open-air art plaza in a city with colorful modern sculptures on a paved square, trees and benches, bright sunny day" },
  { key: "spot_hoshino_oirase", path: "spots/hoshino_oirase.webp", prompt: "Riverside resort hotel among autumn forest along a mountain stream, warm terrace with a dog-friendly area, evening glow" },
  { key: "spot_satsuki_asamushi", path: "spots/satsuki_asamushi.webp", prompt: "Traditional Japanese seaside hot spring inn overlooking a calm bay, wooden architecture, quiet evening, warm lights" },
  { key: "spot_chocolat_aomori", path: "spots/chocolat_aomori.webp", prompt: "Cozy cottage-style lodge with warm interior lighting among trees, small yard, peaceful northern town, dusk" },
  { key: "spot_aomori_beach",   path: "spots/aomori_beach.webp",   prompt: "Urban waterfront artificial beach beside a harbor with a triangular glass building and bridge in the background, gentle waves, sunset" },
  // ── Phase C 空白県潰し: 田沢湖・角館 2026/7/7 ──
  { key: "tazawako_kakunodate", path: "tazawako_kakunodate.webp",  prompt: "Deep cobalt-blue caldera lake with a golden statue on the shore, forested mountains around, calm reflective water, clear day, Akita" },
  { key: "spot_tatsuko",        path: "spots/tatsuko.webp",        prompt: "Golden bronze statue of a maiden standing at the edge of a brilliant blue lake, forested shoreline, bright reflective water" },
  { key: "spot_kakunodate",     path: "spots/kakunodate.webp",     prompt: "Historic samurai district street lined with black wooden fences and weeping cherry blossoms, traditional houses, spring, small Kyoto of Tohoku" },
  { key: "spot_enishi",         path: "spots/enishi_inn.webp",     prompt: "Renovated old Japanese folk house inn on a samurai street, wooden facade with dark fence, cozy traditional entrance, afternoon" },
  { key: "spot_orae",           path: "spots/orae_restaurant.webp", prompt: "Lakeside restaurant with a garden terrace facing a white sand beach and blue lake, outdoor tables, summer, craft beer vibe" },
  { key: "spot_akitainu_sato",  path: "spots/akitainu_sato.webp",  prompt: "Retro red-brick station-style building in a town plaza modeled on an old railway station, clock tower, sunny public square" },
  { key: "spot_senshu_park",    path: "spots/senshu_park.webp",    prompt: "Castle ruin park in a city with stone walls, moat and cherry trees, walking paths on a green hill, spring afternoon" },
  { key: "spot_nyudozaki",      path: "spots/nyudozaki.webp",      prompt: "Cape with a black-and-white striped lighthouse on a wide grassy meadow overlooking the sea, open sky, coastal wind, bright day" },
  { key: "spot_godzilla_rock",  path: "spots/godzilla_rock.webp",  prompt: "Rocky coastline with a jagged rock shaped like a dinosaur silhouette against a fiery sunset sky over the sea, dramatic dusk" },
  { key: "spot_michinoeki_oga", path: "spots/michinoeki_oga.webp", prompt: "Seaside roadside station building with a harbor view, outdoor plaza and local produce market, clear coastal day, northern Japan" },
  // ── Phase C 空白県潰し: 唐津・嬉野 2026/7/7 ──
  { key: "karatsu_ureshino",    path: "karatsu_ureshino.webp",     prompt: "Long coastal black pine forest along a curved white sandy bay under a bright sky, dense green pines meeting the sea, Kyushu coast" },
  { key: "spot_nijinomatsubara", path: "spots/nijinomatsubara.webp", prompt: "Dense black pine grove with a sandy path winding through, sunlight filtering through the pines toward the sea, coastal breeze" },
  { key: "spot_karatsu_castle", path: "spots/karatsu_castle.webp",  prompt: "White Japanese castle on a green hilltop overlooking a bay, stone walls and a park with trees below, clear blue sky" },
  { key: "spot_hadomisaki",     path: "spots/hadomisaki.webp",     prompt: "Rugged cape jutting into a blue sea with grassy clifftop and rocky shore, wide ocean horizon, bright windy day, Kyushu" },
  { key: "spot_kagamiyama",     path: "spots/kagamiyama.webp",     prompt: "Mountaintop observation deck overlooking a bay and a long pine forest coastline far below, panoramic view, sunny" },
  { key: "spot_yumekaido",      path: "spots/hizen_yumekaido.webp", prompt: "Edo-era themed village street with traditional wooden buildings and ninja-era atmosphere, lantern signs, nostalgic town, daytime" },
  { key: "spot_ureshino88",     path: "spots/ureshino88.webp",     prompt: "Elegant modern hot spring resort building with a private villa annex and garden, warm evening lighting, refined Japanese design" },
  { key: "spot_suginoya_dog",   path: "spots/suginoya_dog.webp",   prompt: "Traditional inn villa room with a private semi-open-air hot spring bath and a small attached dog run on a wooden deck, cozy evening" },
  { key: "spot_yobuko_onoue",   path: "spots/yobuko_onoue.webp",   prompt: "Hilltop ryokan overlooking a calm sea, terrace with a grassy dog run and ocean panorama, sunset over the water, Kyushu coast" },
  { key: "spot_urari_takeo",    path: "spots/urari_takeo.webp",    prompt: "Modern all-suite spa resort with private hot spring rooms and a garden dog park, sleek architecture, warm dusk lighting" },
  { key: "spot_ohyakusho",      path: "spots/ohyakusho_cafe.webp", prompt: "Rustic farm restaurant with a wide grass dog run and outdoor dining terrace, countryside fields around, sunny pastoral day" },
  // ── Phase C 空白県潰し: 青島・高千穂 2026/7/7 ★47県フルカバー ──
  { key: "aoshima_takachiho",   path: "aoshima_takachiho.webp",    prompt: "Subtropical island shrine surrounded by wave-cut rock formations and palm trees under a bright blue sky, southern sea, Miyazaki Japan" },
  { key: "spot_aoshima",        path: "spots/aoshima.webp",        prompt: "Small subtropical island connected by a bridge, dense palm and betel trees, vermilion shrine gate, turquoise sea, sunny" },
  { key: "spot_oninosentaku",   path: "spots/oninosentakuita.webp", prompt: "Unique wave-shaped rock platform stretching along a shoreline at low tide, ribbed rock pattern, blue sea and sky, natural monument" },
  { key: "spot_takachiho_gorge", path: "spots/takachiho_gorge.webp", prompt: "Dramatic V-shaped gorge with a tall waterfall falling into emerald water between mossy basalt cliffs, forest walking path, mystical light" },
  { key: "spot_takachiho_shrine", path: "spots/takachiho_shrine.webp", prompt: "Ancient Shinto shrine among towering cedar trees, wooden torii and stone lanterns along a mossy approach path, sacred quiet atmosphere" },
  { key: "spot_obi",            path: "spots/obi_castle_town.webp", prompt: "Historic castle town street with a large wooden main gate, samurai residence walls and stone paths, small Kyoto of Kyushu, sunny day" },
  { key: "spot_sunmesse",       path: "spots/sunmesse_nichinan.webp", prompt: "Row of Easter Island moai statues on a green hilltop overlooking a bright blue ocean coastline, clear sky, dramatic seaside" },
  { key: "spot_ldk_aoshima",    path: "spots/ldk_aoshima.webp",    prompt: "Beachside italian cafe with an open terrace facing a palm-lined tropical beach, casual seaside dining, bright sunny day" },
  { key: "spot_shimoaso",       path: "spots/shimoaso_cafe.webp",  prompt: "Seaside cafe with a natural grass dog run and terrace tables overlooking the ocean, palm trees, relaxed coastal vibe" },
  { key: "spot_budou",          path: "spots/budou_guesthouse.webp", prompt: "Cozy mountain town guesthouse with a wooden facade among green hills, warm entrance, quiet rural Takachiho, afternoon" },
  { key: "spot_aoshima_picnic", path: "spots/aoshima_picnic.webp", prompt: "Beachfront glamping site with tents and a grass dog run near a palm-lined tropical shore, sunset over the sea, relaxed resort" },
  { key: "spot_hokedake",       path: "spots/hokedake_glamping.webp", prompt: "Countryside glamping domes with private dog runs on a green lawn, forested hills behind, warm evening lantern light" },
  // ── Phase B 深掘り: 神戸 追加 2026/7/7 ──
  { key: "spot_ffp",            path: "spots/kobe_ffp.webp",       prompt: "Flower and fruit theme park with colorful seasonal flower beds, european-style buildings and green lawns, sunny day, Kobe hills" },
  { key: "spot_hotel_ff",       path: "spots/hotel_fruitflower.webp", prompt: "European-style resort hotel among flower gardens and green hills, elegant facade at dusk, warm lighting, countryside Kobe" },
  { key: "spot_maiko",          path: "spots/maiko_park.webp",     prompt: "Seaside park beneath a massive white suspension bridge spanning the strait, walking promenade along the water, bright blue sky" },
  { key: "spot_agripark",       path: "spots/kobe_agripark.webp",  prompt: "Green agricultural park with vineyards and open lawns on rolling hills, distant sea and a bridge on the horizon, sunny afternoon" },
  { key: "spot_umie_mosaic",    path: "spots/umie_mosaic.webp",    prompt: "Waterfront shopping complex with a giant ferris wheel beside a harbor, wooden boardwalk and boats, evening city lights reflecting on water, Kobe" },
  { key: "spot_hopstand",       path: "spots/hopstand_kobe.webp",  prompt: "Casual harborside beer stand with an open terrace facing the port and ferris wheel, string lights, relaxed evening atmosphere" },
  // ── Phase B 深掘り: 軽井沢 追加 2026/7/7 ──
  { key: "spot_taliesin",       path: "spots/taliesin.webp",       prompt: "Cultural resort around a calm lake with lakeside promenade and green lawns, small rowboats, autumn trees reflected in the water, Karuizawa" },
  { key: "spot_lakegarden",     path: "spots/karuizawa_lakegarden.webp", prompt: "Natural english garden around a small pond with roses and perennials in bloom, winding paths and a wooden bridge, soft summer light" },
  { key: "spot_muse",           path: "spots/muse_no_mori.webp",   prompt: "Storybook museum building in a forest with tall larch trees, european cottage architecture, quiet woodland path, dappled sunlight" },
  { key: "spot_yukawa_dogrun",  path: "spots/yukawa_dogrun.webp",  prompt: "Riverside free dog run with grass and low fences along a clear mountain stream, forested highland, sunny day, no dogs visible" },
  { key: "spot_prince_cottage", path: "spots/karuizawa_prince_cottage.webp", prompt: "Resort cottages among larch forest with a private lawn dog run, warm cabin lights at dusk, upscale highland resort, Karuizawa" },
  { key: "spot_la_tegola",      path: "spots/la_tegola.webp",      prompt: "Cozy italian restaurant with a summer garden terrace among trees, elegant table setting outdoors, warm afternoon light, Karuizawa" },
  { key: "spot_soyokaze",       path: "spots/hotel_soyokaze.webp", prompt: "Small dog-friendly forest hotel with a wooden facade among larch trees, warm entrance lighting, quiet highland evening" },
  // ── Phase B 深掘り: 箱根 追加 2026/7/7 ──
  { key: "spot_odakyu_highland", path: "spots/odakyu_highland.webp", prompt: "Elegant resort hotel among pampas grass fields and forest at the foot of a volcano, warm evening lights, upscale highland retreat, Hakone" },
  { key: "spot_hyatt_hakone",   path: "spots/hyatt_hakone.webp",   prompt: "Modern luxury mountain resort hotel with wood and stone architecture among tall trees, soft dusk lighting, refined Hakone hillside" },
  { key: "spot_fujimi_cafe",    path: "spots/fujimi_cafe.webp",    prompt: "Cafe with a wooden terrace overlooking Mount Fuji across a valley, casual outdoor seating, clear sunny day" },
  { key: "spot_ashiyu",         path: "spots/hakone_ashiyu.webp",  prompt: "Outdoor hot spring footbath area in a forest with wooden benches and steam rising, autumn leaves, peaceful mountain setting" },
  { key: "spot_gorapark",       path: "spots/gora_park.webp",      prompt: "French formal garden on a hillside with symmetrical flower beds, a fountain and a glass greenhouse, mountains behind, sunny" },
  { key: "spot_hakone_aqua",    path: "spots/hakone_aquarium.webp", prompt: "Lakeside aquarium building beside a calm mountain lake, green hills around, bright day, family leisure spot, Hakone" },
  { key: "spot_pola_trail",     path: "spots/pola_forest_trail.webp", prompt: "Forest walking trail with wooden boardwalk winding through tall trees near a modern museum building, dappled sunlight, serene" },
  { key: "spot_taikanzan",      path: "spots/taikanzan_dogrun.webp", prompt: "Mountaintop observation deck dog run overlooking a caldera lake and Mount Fuji in the distance, panoramic view, grass, clear sky" },
  { key: "spot_hakone_ropeway", path: "spots/hakone_ropeway.webp", prompt: "Gondola cable car crossing over a volcanic valley with steam vents and a lake beyond, aerial mountain view, bright day" },
  { key: "spot_box_burger",     path: "spots/box_burger.webp",     prompt: "Casual burger stand with a tent-style covered terrace and wood stove, string lights and leash hooks, cozy outdoor dining" },
  { key: "spot_karatto",        path: "spots/hakone_karatto.webp", prompt: "Small casual eatery near a lake with wooden interior and outdoor seats, relaxed lakeside dining atmosphere, sunny" },
  { key: "spot_tenku_terrace",  path: "spots/tenku_terrace.webp",  prompt: "Open cafe terrace on a hillside overlooking mountains with many outdoor tables, bright airy atmosphere, pancakes and drinks, sunny" },
  // ── Phase B 深掘り: 鎌倉 追加 2026/7/7 ──
  { key: "spot_yuigahama",      path: "spots/yuigahama.webp",      prompt: "Wide sandy beach at sunset with gentle waves, sky and sea glowing in orange gradient, distant headland, romantic coastal evening, Kamakura" },
  { key: "spot_zaimokuza",      path: "spots/zaimokuza.webp",      prompt: "Quiet sandy beach in the off-season with calm waves and few people, soft daylight, peaceful shoreline walk, Kamakura" },
  { key: "spot_kaihin_park",    path: "spots/kamakura_kaihin.webp", prompt: "Seaside park with a promenade along a sandy beach, palm trees and benches, ocean view, bright sunny day" },
  { key: "spot_awkitchen",      path: "spots/awkitchen_kamakura.webp", prompt: "Italian garden cafe with a terrace beside a small local train line, greenery and outdoor tables, sunny relaxed afternoon" },
  { key: "spot_cafe75th",       path: "spots/zaimokuza_cafe.webp", prompt: "Beachfront cafe with an open terrace facing the ocean, casual seaside seating with leash hooks, bright coastal day" },
  { key: "spot_calistoga",      path: "spots/calistoga.webp",      prompt: "Stylish restaurant terrace overlooking the sea from a coastal hillside, fusion dining atmosphere, sunset light, Shichirigahama" },
  { key: "spot_the_table",      path: "spots/the_table_kamakura.webp", prompt: "Covered terrace cafe near a sandy beach with wooden tables and plants, ocean breeze, relaxed sunny setting" },
  { key: "spot_seedless",       path: "spots/seedless_bar.webp",   prompt: "California-style beach bar interior with large windows facing the ocean, casual bright decor, coastal vibe, daytime" },
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

-- ============================================
-- X 投稿 B型 テンプレ 全置換 (依頼書 #140 Phase B Step 2 / 2026/6/9)
-- 設計: docs/x-post-style-guide-b-type.md v1.0 準拠
--
-- 適用順序:
--   1. 既存 46本 → is_active=false (論理削除 / ロールバック可)
--   2. 新 B型 30本 INSERT
--   3. x_post_settings.morning_use_image = true (画像必須化)
--
-- ロールバック: 本ファイル末尾の ROLLBACK 用 SQL を参照
-- ============================================

-- 1. 既存 46本を論理削除 (DB に残置 / is_active=false)
UPDATE x_post_templates
SET is_active = false
WHERE is_active = true
  AND theme NOT IN ('tip_practical','question_engage','showcase_pet','featured_creator','behind_scene');

-- ===========================================
-- 2. 新 B型 30本 INSERT
-- 配分: tip 8 / question 7 / showcase 6 / featured 5 / behind 4
-- 朝 15 + 夜 15 = 30 (各曜日 朝夕 ≥ 1本)
-- ===========================================

INSERT INTO x_post_templates (theme, day_of_week, time_slot, template, image_prompt, use_image, weight, is_active) VALUES

-- ============ tip_practical (8本) ============

-- 朝 (4本: 月水金日)
('tip_practical', 1, 'morning',
E'🌞 犬の暑さサインを5つ覚えておこう\n\n① ハァハァが普段より速い\n② 床にお腹をペタッと付ける\n③ 散歩を渋る・歩みが遅い\n④ よだれが多い・ベタつく\n⑤ 鼻が乾いてる\n\n外気32℃を超えたら 朝7時前 or 夕方19時以降のお散歩を。\n気になる症状は獣医師にご相談を。\n\n#Qocca #犬のいる暮らし',
'Cute dog drinking water from a ceramic bowl, soft summer morning light, warm pastel illustration style, no text in image. Square format.', true, 1.0, true),

('tip_practical', 3, 'morning',
E'☔ 梅雨のおうちペットケア 3つ\n\n✓ 散歩後の足拭き → 指の間まで丁寧に\n✓ 耳の中の湿気チェック (週2回)\n✓ ベッドのカバーは週1で乾燥機\n\n蒸れは皮膚トラブルの入り口。\n匂いが変わったり 痒がる仕草が増えたら 獣医師にご相談を。\n\n#Qocca #梅雨対策',
'Dog paw being gently dried with a soft towel by human hands, warm cozy indoor light, pastel illustration, no text. Square format.', true, 1.0, true),

('tip_practical', 5, 'morning',
E'🦴 犬の食事で 覚えておきたい NG食材 5つ\n\n× チョコレート\n× ぶどう・レーズン\n× 玉ねぎ・ニラ\n× アボカド\n× キシリトール入りガム\n\n少量でも危険なものがあります。\n誤食した場合は すぐに獣医師へ。\n\n#Qocca #犬の食事',
'Dog looking at a small bowl of safe dog food on wooden floor, warm morning kitchen light, pastel illustration, no text. Square format.', true, 1.0, true),

('tip_practical', 0, 'morning',
E'🐾 散歩のあと 確認したい 3か所\n\n① 肉球の傷・アスファルトのヤケド\n② 指の間に小石・トゲ\n③ 腹側に ダニ・植物の種\n\n5月〜10月は 特にダニ要注意。\n見つけたら 無理に取らず 獣医師相談が安心。\n\n#Qocca #犬のいる暮らし',
'Hand checking dog paw pad for safety, warm afternoon outdoor light, pastel illustration, no text. Square format.', true, 1.0, true),

-- 夜 (4本: 月火木日)
('tip_practical', 1, 'evening',
E'🐈 猫の毛玉を減らす3つのコツ\n\n✓ 換毛期(春・秋)は1日1回ブラッシング\n✓ ブラッシング後の濡れタオル拭きで抜け毛回収率UP\n✓ 食物繊維入りのフードを少しずつ混ぜる\n\n吐き戻しの回数が増えたら 獣医師相談を。\n\n#Qocca #猫のいる暮らし',
'Calm cat being brushed by hand, evening warm interior light, gentle pastel watercolor style, no text. Square format.', true, 1.0, true),

('tip_practical', 2, 'evening',
E'🌙 夜のお散歩で 持っていきたい 4つ\n\n① 反射バンド (首輪 or リード)\n② LED ライト or 反射ベスト\n③ ウンチ袋 + ティッシュ\n④ 水ボトル (10分以上なら必須)\n\n夏は気温30℃下回ってから が目安。\nアスファルトが まだ熱い時は 短めに。\n\n#Qocca #犬の散歩',
'Dog with reflective collar walking in evening, soft street light, warm pastel illustration, no text. Square format.', true, 1.0, true),

('tip_practical', 4, 'evening',
E'🦷 犬の歯みがき 続けるコツ 4つ\n\n① 最初の1週間は 口元を触る練習だけ\n② 慣れたら 指サックで 歯を触る\n③ ガーゼ → 歯ブラシ の順に道具を変える\n④ 終わったら 必ず ごほうび\n\n1日 30秒でも 効果あり。\n気になる歯石は 獣医師に相談を。\n\n#Qocca #犬の歯みがき',
'Dog opening mouth gently for tooth brushing by human hand, soft evening light, pastel illustration, no text. Square format.', true, 1.0, true),

('tip_practical', 0, 'evening',
E'❄️ 冬の乾燥対策 ペット編 3つ\n\n✓ 加湿器の目標湿度 50〜60%\n✓ 飲み水は ぬるめ (常温〜30℃)\n✓ 暖房直撃は 避けて 床から1m離す\n\n静電気と 皮膚カサつきが 同時に減ります。\nかゆがる頻度が高いと感じたら 獣医師に相談を。\n\n#Qocca #ペットのいる暮らし',
'Cat next to humidifier in cozy winter living room, warm evening light, pastel illustration, no text. Square format.', true, 1.0, true),

-- ============ question_engage (7本) ============

-- 朝 (4本: 月火木金)
('question_engage', 1, 'morning',
E'🌅 朝、うちの子は あなたを どうやって 起こす?\n\n🐕 顔をなめる派\n🐈 おなかの上で「ドスン」派\n🐰 ケージから「カリカリ」派\n🦜 「おはよう!」って 言ってくる派\n\nリプで教えて〜\n\n#うちの子起こし方',
'Dog with paws on bed waking up sleepy human, soft sunrise light through window, warm pastel illustration, no text. Square format.', true, 1.0, true),

('question_engage', 2, 'morning',
E'🏠 うちの子のお気に入りの場所 どこ?\n\n✓ 窓辺の日向ぼっこスポット\n✓ ソファとクッションの隙間\n✓ 飼い主の足元\n✓ 洗濯カゴの中(?)\n\n「そこ?!」って 場所 リプで教えて〜\n\n#うちの子の好きな場所',
'Small dog napping inside a cozy laundry basket with soft blankets, warm afternoon light, pastel illustration, no text. Square format.', true, 1.0, true),

('question_engage', 4, 'morning',
E'🍚 うちの子のごはん、どれ派?\n\n🐕 ドライフード一択\n🐈 ウェット混ぜる派\n🦴 手作り (鶏むね・野菜)\n🥩 半生 / フリーズドライ\n\n月いくらかも 一緒にリプで教えてくれたら 参考になります〜\n\n#うちの子ごはん',
'Pet food bowls of different types on wooden table, warm morning light, pastel illustration, no text. Square format.', true, 1.0, true),

('question_engage', 5, 'morning',
E'🚪 うちの子、お留守番中 何してる?\n\n📺 テレビの前で寝てる\n🪟 窓から外を見張ってる\n🛏 飼い主のベッドで寝てる\n🪑 待機スポットで「お帰り」を待ってる\n\n帰宅した時の様子 リプで教えて〜\n\n#うちの子のお留守番',
'Dog looking out window waiting for owner, soft afternoon light, pastel illustration, no text. Square format.', true, 1.0, true),

-- 夜 (3本: 水土+1=日)
('question_engage', 3, 'evening',
E'✨ うちの子の「決めポーズ」 ある?\n\nうちは毛布の上で 完璧な「腹見せ伸び」を 披露してくれる。\n\n写真と一緒に教えてくれたら みんな励まされると思う。\nリプ・引用RT 大歓迎🐾\n\n#うちの子の決めポーズ',
'Cat in classic "loaf" pose on soft blanket, golden evening light, warm pastel watercolor, no text. Square format.', true, 1.0, true),

('question_engage', 6, 'evening',
E'🛁 お風呂タイム、うちの子の反応は?\n\n🚿 嬉しそうに突入してくる\n😶 諦めて受け入れる\n🏃 全力で逃げる\n💧 タオルで包まれてからが本番\n\nお風呂後の儀式 ある人 リプで教えて〜\n\n#うちの子のお風呂',
'Dog wrapped in soft towel after bath, warm evening bathroom light, pastel illustration, no text. Square format.', true, 1.0, true),

('question_engage', 0, 'evening',
E'😴 うちの子の寝相、どんな感じ?\n\n🦴 アンモニャイト (まんまる)\n🦒 のびのびと足を伸ばす\n🙃 仰向けで爆睡\n💑 飼い主に密着\n\n「これは何ポーズ?」っていう謎の寝相 リプで貼って〜\n\n#うちの子の寝相',
'Cat sleeping in unusual stretched position on bed, soft evening light, pastel illustration, no text. Square format.', true, 1.0, true),

-- ============ showcase_pet (6本) ============

-- 朝 (3本: 火水土)
('showcase_pet', 2, 'morning',
E'🐾 火曜の朝、うちの子の「眠そうな顔」見せて\n\n週半ばの朝に みんなの ねむそうな うちの子で 励まされたいです。\n\n写真と一緒に リプでも 引用RTでも🙌\n\n#うちの子の眠そうな顔',
'Sleepy puppy yawning on a pillow, soft morning light, warm pastel illustration, no text. Square format.', true, 1.0, true),

('showcase_pet', 3, 'morning',
E'✏️ うちの子の名前、由来 ある?\n\nうちは「梅雨に来た子」だから あ め (笑)\n\n名前にまつわる エピソード リプで聞かせてくれたら 嬉しい。\nぜんぶ読みに行きます🐾\n\n#うちの子の名前',
'Adorable kitten with name tag charm, soft morning light, warm pastel illustration, no text. Square format.', true, 1.0, true),

('showcase_pet', 6, 'morning',
E'☀️ 土曜の朝、うちの子と何してる?\n\n✓ 公園に散歩\n✓ ベッドで二度寝\n✓ ブラッシング\n✓ 朝ごはんの催促\n\n週末のうちの子写真 リプで見せて〜\n\n#うちの子の週末',
'Dog and human enjoying weekend morning at home, warm soft light, pastel illustration, no text. Square format.', true, 1.0, true),

-- 夜 (3本: 火木土)
('showcase_pet', 2, 'evening',
E'🌸 梅雨入り、うちの子は どう過ごしてる?\n\n✓ 雨の日のお家での過ごし方\n✓ 雨上がりの散歩の表情\n✓ 蒸し暑い日の昼寝姿\n\n季節の1枚 リプで貼ってくれたら ぜんぶ見ます。\n\n#うちの子の梅雨',
'Cat watching rain through window from a cozy spot, soft rainy day light, warm pastel watercolor, no text. Square format.', true, 1.0, true),

('showcase_pet', 4, 'evening',
E'🍽 うちの子の「おねだり顔」 リプで見せて\n\nおやつ・ごはん・散歩\nどんな時の「お願い顔」も大歓迎。\n\n写真貼ってくれたら ぜんぶ拝見します🐾\n\n#うちの子のおねだり',
'Dog with hopeful eyes looking up, soft evening kitchen light, pastel illustration, no text. Square format.', true, 1.0, true),

('showcase_pet', 6, 'evening',
E'🎁 うちの子のお気に入りのおもちゃ 教えて\n\n🎾 ボール一筋\n🦴 噛むやつ専門\n🪶 羽の付いた猫じゃらし\n🐟 何でもキャッチ\n\n写真と一緒にリプ大歓迎〜\n\n#うちの子のおもちゃ',
'Pet toys collection on floor, warm evening light, pastel illustration, no text. Square format.', true, 1.0, true),

-- ============ featured_creator (5本 / 全て夜) ============
-- B型強化: 制作工程・素材・所要日数・価格レンジ等の具体スペック前面

('featured_creator', 1, 'evening',
E'🎨 出品紹介: 羊毛フェルトのうちの子人形\n\n作家: kuu / 小さな命を、羊毛で。\n素材: 国産羊毛 100% (硬めの繊維)\n所要日数: 約3〜4週間\n価格: ¥15,000〜¥35,000 (サイズ別)\n\n特徴: 1本ずつ針で立てる手刺繍 → 毛流れまで再現。\n\n詳細は Qocca で。\n\n#うちの子グッズ',
'Hands gently crafting a wool felt small pet figurine on wooden table, warm soft studio light, pastel illustration, no text. Square format.', true, 1.0, true),

('featured_creator', 3, 'evening',
E'🖼 出品紹介: 油彩タッチの似顔絵\n\n素材: アクリル+水彩 / キャンバス\nサイズ: A4 / A3 / B2 から選択可\n所要日数: 約2週間\n価格: ¥8,000〜¥25,000\n\n特徴: 写真1〜3枚 + アンケート から「表情」を起こす。リビング掛けサイズが人気。\n\n詳細は Qocca で。\n\n#うちの子の似顔絵',
'Framed pet portrait painting hanging on warm-toned living room wall, soft cozy evening light, pastel illustration, no text. Square format.', true, 1.0, true),

('featured_creator', 5, 'evening',
E'📷 出品紹介: 出張ペットフォト撮影\n\n地域: 関西エリア (応相談)\n所要時間: 約2時間 (野外 / 室内 OK)\n納品: 編集済 30〜50枚 + 全データ\n価格: ¥25,000〜¥45,000\n\n特徴: ペット専門カメラマン。動きが多くても 表情を抑える腕。\n\n詳細は Qocca で。\n\n#うちの子フォト',
'Photographer taking photo of pet outdoors in afternoon, warm soft light, pastel illustration, no text. Square format.', true, 1.0, true),

('featured_creator', 0, 'evening',
E'🍪 出品紹介: 国産無添加おやつ\n\n作家: eighty eight / エゾ鹿ジャーキー\n素材: 北海道産エゾ鹿肉のみ (添加物ゼロ)\n所要日数: 受注後 約1週間\n価格: ¥1,200〜¥3,500\n\n特徴: 低温乾燥で 旨味と栄養を残す。歯石予防にも。\n\n詳細は Qocca で。\n\n#うちの子おやつ',
'Pet treats handmade jerky on wooden board, warm evening kitchen light, pastel illustration, no text. Square format.', true, 1.0, true),

('featured_creator', 5, 'evening',
E'🧵 出品紹介: ハンドメイド犬服\n\n素材: オーガニックコットン100%\nサイズ: 5XS〜3XL + オーダーメイド可\n所要日数: 受注後 2〜3週間\n価格: ¥4,500〜¥12,000\n\n特徴: 採寸シート付き → 体型に合わせて1点ずつ縫う。\n\n詳細は Qocca で。\n\n#うちの子服',
'Handmade pet clothing on wooden hanger, soft evening atelier light, pastel illustration, no text. Square format.', true, 1.0, true),

-- ============ behind_scene (4本 / 全て朝) ============
-- B型強化: 事実+ベネフィットをドライに / 詩的トーン廃止

('behind_scene', 1, 'morning',
E'🛠 Qocca アップデート: 健康記録機能\n\n体重と通院を記録 → 自動でグラフ化。\n直近30件はタイムライン表示。\n\n判定や 警告は しません。\n飼い主だけが見られる プライベート機能です。\n\n#Qocca開発',
'Soft notebook with pet weight chart sketches, morning desk light, warm pastel illustration, no text. Square format.', true, 1.0, true),

('behind_scene', 3, 'morning',
E'🛠 Qocca アップデート: 公開ページ共有ボタン\n\nMyPage から ワンタップで:\n→ 自分の公開ページ URL をコピー\n→ Instagram などに そのまま貼り付け可\n\n出品クリエイターさんの SNS 宣伝負荷を 1秒 で減らす機能。\n\n#Qocca開発',
'Hand using phone with copy link button, morning natural light, pastel illustration, no text. Square format.', true, 1.0, true),

('behind_scene', 4, 'morning',
E'📊 Qocca きょうの数字\n\n住民さん {total_users} 人\nうちの子 {total_pets} 匹\n創業クリエイター {founding_creators} 人\nグランドオープン {grand_open_days} 日後\n\nDday に向けて 着実に。\n\n#Qocca',
'Soft sketch of pet community town with small houses, morning warm light, pastel watercolor illustration, no text. Square format.', true, 1.0, true),

('behind_scene', 0, 'morning',
E'🛠 Qocca アップデート: 配送設定の拡張\n\nlistings に 配送方法を 5タイプから選択可:\n→ データ納品 / 一律送料 / 地域別 / 配送会社別 / 相談\n\n出品時の柔軟性 UP。詳細は /help/fees で。\n\n#Qocca開発',
'Soft sketch of delivery options on desk paper, morning warm light, pastel illustration, no text. Square format.', true, 1.0, true);

-- ===========================================
-- 3. 設定変更: 朝枠も画像必須化
-- ===========================================
UPDATE x_post_settings SET morning_use_image = true WHERE id = 1;

-- ===========================================
-- 検証 (実行直後 期待値)
-- ===========================================
-- SELECT theme, time_slot, COUNT(*) FROM x_post_templates WHERE is_active = true GROUP BY theme, time_slot ORDER BY theme, time_slot;
--   期待: tip_practical morning=4 evening=4 / question_engage morning=4 evening=3 /
--        showcase_pet morning=3 evening=3 / featured_creator evening=5 / behind_scene morning=4
--        計 15 morning + 15 evening = 30
--
-- SELECT morning_use_image, evening_use_image FROM x_post_settings WHERE id = 1;
--   期待: true / true (両方 ON)

-- ===========================================
-- 🚨 ロールバック (緊急時) - 旧 46本 復活
-- ===========================================
-- BEGIN;
--   UPDATE x_post_templates SET is_active = false
--     WHERE theme IN ('tip_practical','question_engage','showcase_pet','featured_creator','behind_scene');
--   UPDATE x_post_templates SET is_active = true
--     WHERE theme IN ('ARK 動物福祉','KPI','Qocca 裏側','うちの子の物語','クリエイター作品紹介',
--                     'クリエイター紹介','ビジョン','ペット業界考察','一週間振り返り',
--                     '動物福祉','哲学','施設・イベント','明日への準備','開発者の声');
--   UPDATE x_post_settings SET morning_use_image = false WHERE id = 1;
-- COMMIT;

-- ===========================================
-- 🚨 さらに緊急 (Kill Switch ON / 5秒安全停止)
-- ===========================================
-- UPDATE x_post_settings SET kill_switch = true WHERE id = 1;
-- → cron は走るが post 直前で 503 返してスキップ

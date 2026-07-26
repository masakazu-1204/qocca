// api/prerender.js — クローラー向けプリレンダリング
//
// vercel.json で「User-Agent がボットのとき だけ」このFunctionに rewrite している。
// 通常のユーザーは今まで通り index.html を直接受け取る = 体験・パフォーマンスは不変。
//
// やっていること:
//   1. デプロイ済みの本物の index.html を取得 (assetsのハッシュ名を自前で持たなくて済む)
//   2. <title> / description / OGP / canonical を、そのURLの実データで差し替え
//   3. ページ固有の JSON-LD を <head> に追加
//   4. <div id="root"> の中に「実際に読める本文HTML」を入れる
//      → React が起動すると createRoot().render() が中身を置き換えるので、
//        ユーザーには一切影響しない。JSを実行しないAIクローラーだけがこれを読む。
//
// ⚠️ 何が起きても 500 を返さない (必ず素の index.html にフォールバック)。
//    クローラーにエラーを見せるのが一番損なので、失敗しても「今まで通り」に落とす。

import {
  sb, sbAll, sbCount, esc, clip, ld, SITE, SITE_NAME, DEFAULT_IMAGE,
  FACILITY_CATEGORIES, CATEGORY_BY_SLUG, catLabel, catSlug,
  prefToSlug, slugToPrefBase,
} from "./_lib.js";

const DEFAULT_DESC =
  "うちの子のための特別なものを。似顔絵・ハンドメイド服・フォト撮影・グッズ制作。ペット専門クリエイターが作る、世界にひとつだけの作品。";

const page = (o = {}) => ({
  title: `${SITE_NAME}(クオッカ)- ペットオーナー専門マーケットプレイス`,
  description: DEFAULT_DESC,
  path: "/",
  image: DEFAULT_IMAGE,
  jsonld: [],
  body: "",
  ...o,
});

const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
const li = (s) => `<li>${s}</li>`;

/** 「大阪」+「大阪市西区」→「大阪市西区」。県名が市区名に含まれるときの二重表示を避ける */
const joinPlace = (pref, city) => {
  const p = String(pref || "").trim();
  const c = String(city || "").trim();
  if (!c) return p;
  if (!p) return c;
  const base = p.replace(/[都道府県]$/, "");
  return c.startsWith(p) || c.startsWith(base) ? c : `${p}${c}`;
};

/** パンくずの JSON-LD */
const breadcrumb = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: `${SITE}${it.path}`,
  })),
});

// ─────────────────────────────────────────────────────────────
// 各ルートの解決
// ─────────────────────────────────────────────────────────────
async function resolve(pathname) {
  const p = pathname.replace(/\/+$/, "") || "/";
  const seg = p.split("/").filter(Boolean);

  // ── 出品詳細 /listing/:id ──
  if (seg[0] === "listing" && seg[1]) {
    const rows = await sb(
      `listings?id=eq.${encodeURIComponent(seg[1])}&status=eq.approved` +
      `&select=id,title,description,price,category,pet_type,image_urls,created_at,creation_story`
    );
    const l = rows[0];
    if (!l) return null;
    const img = Array.isArray(l.image_urls) && l.image_urls[0] ? l.image_urls[0] : DEFAULT_IMAGE;
    const desc = clip(l.description || l.creation_story || DEFAULT_DESC, 120);
    return page({
      title: `${l.title} | ${SITE_NAME}`,
      description: desc,
      path: `/listing/${l.id}`,
      image: img,
      jsonld: [
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: l.title,
          description: clip(l.description || "", 300),
          image: img,
          url: `${SITE}/listing/${l.id}`,
          offers: {
            "@type": "Offer",
            price: l.price,
            priceCurrency: "JPY",
            availability: "https://schema.org/InStock",
            url: `${SITE}/listing/${l.id}`,
            seller: { "@type": "Organization", name: SITE_NAME },
          },
        },
        breadcrumb([
          { name: "ホーム", path: "/" },
          { name: "出品一覧", path: "/marketplace" },
          { name: l.title, path: `/listing/${l.id}` },
        ]),
      ],
      body:
        `<h1>${esc(l.title)}</h1>` +
        `<p>価格: ${Number(l.price).toLocaleString("ja-JP")}円</p>` +
        `<p>${esc(clip(l.description || "", 600))}</p>` +
        (l.creation_story ? `<h2>制作にこめた想い</h2><p>${esc(clip(l.creation_story, 600))}</p>` : "") +
        `<p>${link("/marketplace", "ほかの出品を見る")}</p>`,
    });
  }

  // ── ブログ記事 /blog/:id ──
  if (seg[0] === "blog" && seg[1]) {
    const rows = await sb(
      `blog_posts_public?id=eq.${encodeURIComponent(seg[1])}` +
      `&select=id,title,content,meta_description,cover_image_url,category,tags,created_at,updated_at`
    );
    const b = rows[0];
    if (!b) return null;
    const desc = clip(b.meta_description || String(b.content || "").replace(/[#*`>\-\[\]]/g, ""), 130);
    return page({
      title: `${b.title} | ${SITE_NAME}`,
      description: desc,
      path: `/blog/${b.id}`,
      image: b.cover_image_url || DEFAULT_IMAGE,
      jsonld: [
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: clip(b.title, 110),
          description: desc,
          image: b.cover_image_url || DEFAULT_IMAGE,
          datePublished: b.created_at,
          dateModified: b.updated_at || b.created_at,
          author: { "@type": "Organization", name: SITE_NAME, url: SITE },
          publisher: {
            "@type": "Organization",
            name: SITE_NAME,
            logo: { "@type": "ImageObject", url: DEFAULT_IMAGE },
          },
          mainEntityOfPage: `${SITE}/blog/${b.id}`,
        },
        breadcrumb([
          { name: "ホーム", path: "/" },
          { name: "ブログ", path: "/blog" },
          { name: b.title, path: `/blog/${b.id}` },
        ]),
      ],
      body:
        `<h1>${esc(b.title)}</h1>` +
        `<p>${esc(clip(String(b.content || "").replace(/[#*`>]/g, ""), 1200))}</p>` +
        `<p>${link("/blog", "ブログ一覧へ")}</p>`,
    });
  }

  // ── 散歩スポット詳細 /petwalker/spot/:id ──
  if (seg[0] === "petwalker" && seg[1] === "spot" && seg[2]) {
    const rows = await sb(
      `pet_walker_spots?id=eq.${encodeURIComponent(seg[2])}&approval_status=eq.approved` +
      `&select=id,name,category,pref,city,description,address,pet_types,area_tag,source_note,latitude,longitude,image_urls,avg_rating,review_count`
    );
    const s = rows[0];
    if (!s) return null;
    const where = joinPlace(s.pref, s.city);
    const desc = clip(s.description || `${where}のペットとおでかけできるスポット「${s.name}」の情報。`, 130);
    const img = Array.isArray(s.image_urls) && s.image_urls[0] ? s.image_urls[0] : DEFAULT_IMAGE;
    const jsonld = [
      {
        "@context": "https://schema.org",
        "@type": "TouristAttraction",
        name: s.name,
        description: clip(s.description || "", 300),
        url: `${SITE}/petwalker/spot/${s.id}`,
        image: img,
        ...(s.address || where
          ? {
              address: {
                "@type": "PostalAddress",
                addressCountry: "JP",
                addressRegion: s.pref || undefined,
                addressLocality: s.city || undefined,
                streetAddress: s.address || undefined,
              },
            }
          : {}),
        ...(s.latitude && s.longitude
          ? { geo: { "@type": "GeoCoordinates", latitude: s.latitude, longitude: s.longitude } }
          : {}),
      },
      breadcrumb([
        { name: "ホーム", path: "/" },
        { name: "ペットウォーカー", path: "/petwalker" },
        { name: s.name, path: `/petwalker/spot/${s.id}` },
      ]),
    ];
    return page({
      title: `${s.name}（${where}）ペットとおでかけ | ${SITE_NAME}`,
      description: desc,
      path: `/petwalker/spot/${s.id}`,
      image: img,
      jsonld,
      body:
        `<h1>${esc(s.name)}</h1>` +
        `<p>${esc(where)}${s.address ? ` / ${esc(s.address)}` : ""}</p>` +
        `<p>${esc(clip(s.description || "", 700))}</p>` +
        (s.source_note ? `<p>出典・補足: ${esc(clip(s.source_note, 300))}</p>` : "") +
        `<p>${link("/petwalker", "ほかの散歩スポットを探す")}</p>`,
    });
  }

  // ── 施設詳細 /facility/:id ──
  if (seg[0] === "facility" && seg[1]) {
    const rows = await sb(
      `pet_facilities?id=eq.${encodeURIComponent(seg[1])}&approved=is.true` +
      `&select=id,name,facility_category,category,address,prefecture,city,phone,website,hours,description,image_url,pet_types,features,latitude,longitude,avg_rating,review_count,official_url`
    );
    const f = rows[0];
    if (!f) return null;
    const label = catLabel(f.facility_category);
    const where = joinPlace(f.prefecture, f.city);
    const desc = clip(
      f.description || `${where}の${label}「${f.name}」の基本情報（住所・営業時間・連絡先）。`,
      130
    );
    const pslug = prefToSlug(f.prefecture);
    return page({
      title: `${f.name}（${where}の${label}）| ${SITE_NAME}`,
      description: desc,
      path: `/facility/${f.id}`,
      image: f.image_url || DEFAULT_IMAGE,
      jsonld: [
        {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: f.name,
          description: clip(f.description || "", 300),
          url: `${SITE}/facility/${f.id}`,
          ...(f.image_url ? { image: f.image_url } : {}),
          ...(f.phone ? { telephone: f.phone } : {}),
          ...(f.official_url || f.website ? { sameAs: [f.official_url || f.website] } : {}),
          address: {
            "@type": "PostalAddress",
            addressCountry: "JP",
            addressRegion: f.prefecture || undefined,
            addressLocality: f.city || undefined,
            streetAddress: f.address || undefined,
          },
          ...(f.latitude && f.longitude
            ? { geo: { "@type": "GeoCoordinates", latitude: f.latitude, longitude: f.longitude } }
            : {}),
          ...(f.hours ? { openingHours: String(f.hours) } : {}),
        },
        breadcrumb(
          [
            { name: "ホーム", path: "/" },
            { name: "ペット施設", path: "/facilities" },
            ...(pslug ? [{ name: f.prefecture, path: `/facilities/${pslug}` }] : []),
            { name: f.name, path: `/facility/${f.id}` },
          ]
        ),
      ],
      body:
        `<h1>${esc(f.name)}</h1>` +
        `<p>${esc(where)}の${esc(label)}</p>` +
        (f.address ? `<p>住所: ${esc(f.address)}</p>` : "") +
        (f.phone ? `<p>電話: ${esc(f.phone)}</p>` : "") +
        (f.hours ? `<p>営業時間: ${esc(String(f.hours))}</p>` : "") +
        (f.description ? `<p>${esc(clip(f.description, 600))}</p>` : "") +
        (pslug ? `<p>${link(`/facilities/${pslug}`, `${f.prefecture}のペット施設一覧`)}</p>` : "") +
        `<p>${link("/facilities", "ペット施設マップへ")}</p>`,
    });
  }

  // ── 施設ハブ /facilities/:pref[/:cat] ── (MEOの主戦場)
  if (seg[0] === "facilities" && seg[1]) {
    const prefBase = slugToPrefBase(seg[1]);
    if (!prefBase) return null;
    const catKey = seg[2] ? CATEGORY_BY_SLUG[seg[2]] : null;
    if (seg[2] && !catKey) return null;

    const base =
      `pet_facilities?approved=is.true&is_closed=not.is.true` +
      `&prefecture=like.${encodeURIComponent(prefBase + "*")}` +
      (catKey ? `&facility_category=eq.${encodeURIComponent(catKey)}` : "");
    // 件数は「表示した数」ではなく実際の該当数を出す (大阪811件を300件と書かない)
    const [total, rows] = await Promise.all([
      sbCount(base),
      sb(`${base}&select=id,name,facility_category,city,address,description&order=name.asc&limit=200`),
    ]);
    if (!rows.length) return null;

    const label = catKey ? catLabel(catKey) : "ペット関連施設";
    const heading = `${prefBase}の${label}`;
    const desc = clip(
      `${prefBase}にある${label}を${total}件掲載。住所・営業時間・特徴をまとめています。うちの子とのおでかけ先探しに。`,
      130
    );

    // カテゴリ内訳 (県ページのときは子ハブへの内部リンクを作る = クローラーの回遊経路)
    // ⚠️ 表示用200件からではなく全件から数える (内訳が実態とズレるため)
    let catNav = "";
    if (!catKey) {
      const all = await sbAll(`${base}&select=facility_category&order=id.asc`);
      const counts = {};
      for (const r of all) {
        const k = r.facility_category || "other";
        counts[k] = (counts[k] || 0) + 1;
      }
      const items = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => li(link(`/facilities/${seg[1]}/${catSlug(k)}`, `${prefBase}の${catLabel(k)}（${n}件）`)));
      if (items.length) catNav = `<h2>カテゴリから探す</h2><ul>${items.join("")}</ul>`;
    }

    return page({
      title: `${heading}一覧（${total}件）| ${SITE_NAME}`,
      description: desc,
      path: `/facilities/${seg[1]}${seg[2] ? `/${seg[2]}` : ""}`,
      jsonld: [
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: heading,
          numberOfItems: total,
          itemListElement: rows.slice(0, 100).map((r, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE}/facility/${r.id}`,
            name: r.name,
          })),
        },
        breadcrumb([
          { name: "ホーム", path: "/" },
          { name: "ペット施設", path: "/facilities" },
          { name: prefBase, path: `/facilities/${seg[1]}` },
          ...(catKey ? [{ name: label, path: `/facilities/${seg[1]}/${seg[2]}` }] : []),
        ]),
      ],
      body:
        `<h1>${esc(heading)}（${total}件）</h1>` +
        `<p>${esc(desc)}</p>` +
        catNav +
        `<h2>施設一覧</h2>` +
        (total > rows.length ? `<p>${total}件のうち${rows.length}件を表示しています。</p>` : "") +
        `<ul>` +
        rows
          .slice(0, 200)
          .map((r) =>
            li(
              link(`/facility/${r.id}`, r.name) +
                (r.city ? `（${esc(r.city)}）` : "") +
                (r.address ? ` ${esc(clip(r.address, 60))}` : "")
            )
          )
          .join("") +
        `</ul><p>${link("/facilities", "全国のペット施設マップ")}</p>`,
    });
  }

  // ── 一覧ページ (出品 / ブログ / コミュニティ) ──
  // 静的な説明文だけだと個別ページへのリンクが無く、クローラーが辿れない。
  // ここで実データの一覧を返して内部リンクを作る。
  const LISTS = {
    "/marketplace": {
      q: `listings?status=eq.approved&select=id,title,price,category&order=created_at.desc&limit=100`,
      title: `出品一覧 | ${SITE_NAME}`,
      h1: "出品一覧",
      lead: "ペット専門クリエイターが作る、世界にひとつだけの作品を集めています。",
      href: (r) => `/listing/${r.id}`,
      label: (r) => `${r.title}（${Number(r.price).toLocaleString("ja-JP")}円）`,
      desc: (n) => `ペット専門クリエイターの作品を${n}件掲載。似顔絵・ハンドメイド服・フォト撮影・オリジナルグッズ・おやつなど。`,
    },
    "/blog": {
      q: `blog_posts_public?select=id,title,meta_description,created_at&order=created_at.desc&limit=100`,
      title: `ブログ | ${SITE_NAME}`,
      h1: "ブログ",
      lead: "ペットと暮らす毎日を豊かにする読みもの。おでかけ、健康、しつけ、うちの子との時間について。",
      href: (r) => `/blog/${r.id}`,
      label: (r) => r.title,
      desc: (n) => `ペットと暮らす毎日についての記事を${n}本公開。おでかけ、健康、しつけ、うちの子との時間について。`,
    },
    "/communities": {
      q: `communities?is_archived=not.is.true&select=id,name,description,member_count&order=member_count.desc&limit=100`,
      title: `コミュニティ | ${SITE_NAME}`,
      h1: "コミュニティ",
      lead: "同じ犬種・猫種、同じ地域のオーナー同士でつながれます。",
      href: (r) => `/community/${r.id}`,
      label: (r) => r.name,
      desc: (n) => `犬種・猫種・地域ごとのペットオーナーコミュニティを${n}件公開。うちの子の話をできる場所。`,
    },
  };
  if (LISTS[p]) {
    const cfg = LISTS[p];
    const rows = await sb(cfg.q);
    return page({
      title: cfg.title,
      description: clip(cfg.desc(rows.length), 130),
      path: p,
      jsonld: [
        breadcrumb([{ name: "ホーム", path: "/" }, { name: cfg.h1, path: p }]),
        ...(rows.length
          ? [{
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: cfg.h1,
              numberOfItems: rows.length,
              itemListElement: rows.slice(0, 100).map((r, i) => ({
                "@type": "ListItem", position: i + 1,
                url: `${SITE}${cfg.href(r)}`, name: cfg.label(r),
              })),
            }]
          : []),
      ],
      body:
        `<h1>${esc(cfg.h1)}</h1><p>${esc(cfg.lead)}</p>` +
        (rows.length
          ? `<ul>${rows.map((r) => li(link(cfg.href(r), cfg.label(r)))).join("")}</ul>`
          : "<p>まだ掲載がありません。</p>"),
    });
  }

  // ── 施設トップ /facilities ──
  // 地図ページはJS必須なので、クローラーには「都道府県の入口一覧」を返す。
  // これが無いと 3,500件の施設ページへ辿る経路がサイトマップだけになる。
  if (seg[0] === "facilities" && !seg[1]) {
    const all = await sbAll(
      `pet_facilities?approved=is.true&is_closed=not.is.true&prefecture=not.is.null&select=prefecture&order=id.asc`
    );
    const counts = new Map();
    for (const r of all) {
      const s = prefToSlug(r.prefecture);
      if (!s) continue;
      const cur = counts.get(s) || { n: 0, name: String(r.prefecture) };
      cur.n += 1;
      counts.set(s, cur);
    }
    const list = [...counts.entries()].sort((a, b) => b[1].n - a[1].n);
    const total = list.reduce((s, [, v]) => s + v.n, 0);
    return page({
      title: `ペット同伴可 施設マップ（全国${total}件）| ${SITE_NAME}`,
      description: clip(
        `全国のトリミングサロン・ドッグラン・ペットショップ・動物病院など、ペットと行ける施設を${total}件収録。都道府県から探せます。`,
        130
      ),
      path: "/facilities",
      jsonld: [breadcrumb([{ name: "ホーム", path: "/" }, { name: "ペット施設", path: "/facilities" }])],
      body:
        `<h1>ペット施設マップ（全国${total}件）</h1>` +
        `<p>トリミングサロン、ドッグラン、ペットショップ、動物病院など、ペットと行ける施設を都道府県から探せます。</p>` +
        `<h2>都道府県から探す</h2><ul>` +
        list.map(([s, v]) => li(link(`/facilities/${s}`, `${v.name}のペット施設（${v.n}件）`))).join("") +
        `</ul>`,
    });
  }

  // ── コミュニティ詳細 /community/:id ──
  if (seg[0] === "community" && seg[1]) {
    const rows = await sb(
      `communities?id=eq.${encodeURIComponent(seg[1])}&select=id,name,description,category,cover_image_url,member_count`
    );
    const c = rows[0];
    if (!c) return null;
    return page({
      title: `${c.name} | コミュニティ | ${SITE_NAME}`,
      description: clip(c.description || `${c.name}のコミュニティ。ペットオーナー同士で語り合える場所です。`, 130),
      path: `/community/${c.id}`,
      image: c.cover_image_url || DEFAULT_IMAGE,
      jsonld: [
        breadcrumb([
          { name: "ホーム", path: "/" },
          { name: "コミュニティ", path: "/communities" },
          { name: c.name, path: `/community/${c.id}` },
        ]),
      ],
      body:
        `<h1>${esc(c.name)}</h1>` +
        `<p>${esc(clip(c.description || "", 500))}</p>` +
        `<p>${link("/communities", "ほかのコミュニティを見る")}</p>`,
    });
  }

  // ── 一覧・静的ページ ──
  const STATIC = {
    "/": {
      title: `${SITE_NAME}(クオッカ)- ペットオーナー専門マーケットプレイス`,
      description: DEFAULT_DESC,
      h1: "うちの子を愛してる人が集まる街。",
      lead:
        "Qocca(クオッカ)は、ペットオーナーとクリエイターをつなぐ日本発のペット専門マーケットプレイスです。似顔絵・ハンドメイド服・フォト撮影・オリジナルグッズなどを扱い、売上の3%を特定非営利活動法人アニマルレフュージ関西に寄付しています。ペット同伴可の施設マップや、うちの子と歩ける散歩スポットも収録しています。",
      links: [
        ["/marketplace", "出品一覧（商店街）"],
        ["/facilities", "ペット同伴可 施設マップ"],
        ["/petwalker", "ペットウォーカー（散歩スポット）"],
        ["/events", "ペットイベント情報"],
        ["/blog", "ブログ"],
        ["/communities", "コミュニティ"],
        ["/about", "Qoccaについて"],
      ],
    },
    "/marketplace": {
      title: `出品一覧 | ${SITE_NAME}`,
      description: "ペット専門クリエイターの作品一覧。似顔絵・ハンドメイド服・フォト撮影・オリジナルグッズ・おやつなど。",
      h1: "出品一覧",
      lead: "ペット専門クリエイターが作る、世界にひとつだけの作品を集めています。",
    },
    "/facilities": {
      title: `ペット同伴可 施設マップ | ${SITE_NAME}`,
      description: "全国のペット同伴可の施設・トリミングサロン・ドッグラン・動物病院を検索できる地図つきデータベース。",
      h1: "ペット施設マップ",
      lead: "トリミングサロン、ドッグラン、ペットショップ、動物病院など、ペットと行ける施設を都道府県から探せます。",
    },
    "/petwalker": {
      title: `ペットウォーカー｜うちの子と歩ける散歩スポット | ${SITE_NAME}`,
      description: "全国の「ペットと歩ける」散歩スポットを収録。海沿い、高原、街の水辺、絶景展望など目的から探せます。",
      h1: "ペットウォーカー",
      lead: "うちの子と一緒に歩ける散歩スポットを、エリアと目的から探せます。",
    },
    "/events": {
      title: `ペットイベント情報 | ${SITE_NAME}`,
      description: "全国のペット関連イベント・犬猫の譲渡会・ドッグランイベント情報をまとめています。",
      h1: "ペットイベント",
      lead: "全国のペット関連イベント情報を集めています。",
    },
    "/blog": {
      title: `ブログ | ${SITE_NAME}`,
      description: "ペットと暮らす毎日を豊かにする読みもの。おでかけ、健康、しつけ、うちの子との時間について。",
      h1: "ブログ",
      lead: "ペットと暮らす毎日についての読みものです。",
    },
    "/communities": {
      title: `コミュニティ | ${SITE_NAME}`,
      description: "犬種・猫種・地域ごとのペットオーナーコミュニティ。うちの子の話をできる場所。",
      h1: "コミュニティ",
      lead: "同じ犬種・猫種、同じ地域のオーナー同士でつながれます。",
    },
    "/gallery": {
      title: `ギャラリー | ${SITE_NAME}`,
      description: "うちの子の写真ギャラリー。ペットオーナーが投稿した日々の一枚。",
      h1: "ギャラリー",
      lead: "うちの子の写真が集まる場所です。",
    },
    "/about": {
      title: `Qoccaについて | ${SITE_NAME}`,
      description: "Qocca(クオッカ)は、ペットオーナーとクリエイターをつなぐ日本発のマーケットプレイス。売上の3%をアニマルレフュージ関西へ寄付しています。",
      h1: "Qoccaについて",
      lead:
        "Qocca は「うちの子を愛してる人が集まる街」をコンセプトにした、ペットオーナー向けのマーケットプレイスとコミュニティです。ペットを飼ったすべての人に寄り添い、保護犬・保護猫を減らすことを目指しています。",
    },
    "/sell": {
      title: `出品する（クリエイター募集）| ${SITE_NAME}`,
      description: "ペット専門クリエイターとしてQoccaに出品できます。初回取引の販売手数料は0%。",
      h1: "Qoccaに出品する",
      lead: "ペットのための作品を作る方を募集しています。初回取引の販売手数料は0%です。",
    },
    "/contact": { title: `お問い合わせ | ${SITE_NAME}`, description: "Qoccaへのお問い合わせ窓口。24時間受付、5営業日以内に回答します。", h1: "お問い合わせ" },
    "/terms": { title: `利用規約 | ${SITE_NAME}`, description: "Qoccaの利用規約。", h1: "利用規約" },
    "/privacy": { title: `プライバシーポリシー | ${SITE_NAME}`, description: "Qoccaのプライバシーポリシー。", h1: "プライバシーポリシー" },
    "/tokusho": { title: `特定商取引法に基づく表記 | ${SITE_NAME}`, description: "特定商取引法に基づく表記。", h1: "特定商取引法に基づく表記" },
    "/help": { title: `ヘルプ | ${SITE_NAME}`, description: "Qoccaの使い方・よくある質問。", h1: "ヘルプ" },
    "/faq": { title: `よくある質問 | ${SITE_NAME}`, description: "Qoccaについてよくいただく質問と回答。", h1: "よくある質問" },
    "/sponsors": { title: `法人スポンサー | ${SITE_NAME}`, description: "Qoccaを支えてくださる法人スポンサーの皆さま。", h1: "法人スポンサー" },
    "/founding-creators": { title: `創業クリエイター | ${SITE_NAME}`, description: "Qoccaの創業期を一緒に作るクリエイターの皆さま。", h1: "創業クリエイター" },
  };

  const s = STATIC[p];
  if (s) {
    const links = s.links ? `<ul>${s.links.map(([h, t]) => li(link(h, t))).join("")}</ul>` : "";
    return page({
      title: s.title,
      description: s.description,
      path: p,
      jsonld: p === "/" ? [] : [breadcrumb([{ name: "ホーム", path: "/" }, { name: s.h1, path: p }])],
      body: `<h1>${esc(s.h1)}</h1>` + (s.lead ? `<p>${esc(s.lead)}</p>` : "") + links,
    });
  }

  return null; // 未知のパス → 既定のメタで素通し
}

// ─────────────────────────────────────────────────────────────
// index.html への差し込み
// ─────────────────────────────────────────────────────────────
function inject(html, m) {
  const canonical = `${SITE}${m.path === "/" ? "/" : m.path}`;
  let out = html;

  const setMeta = (attr, key, value) => {
    const re = new RegExp(`(<meta\\s+${attr}=["']${key}["']\\s+content=["'])([^"']*)(["'])`, "i");
    if (re.test(out)) out = out.replace(re, `$1${esc(value)}$3`);
    else out = out.replace("</head>", `  <meta ${attr}="${key}" content="${esc(value)}" />\n</head>`);
  };

  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(m.title)}</title>`);
  setMeta("name", "description", m.description);
  setMeta("property", "og:title", m.title);
  setMeta("property", "og:description", m.description);
  setMeta("property", "og:url", canonical);
  setMeta("property", "og:image", m.image || DEFAULT_IMAGE);
  setMeta("name", "twitter:title", m.title);
  setMeta("name", "twitter:description", m.description);
  setMeta("name", "twitter:image", m.image || DEFAULT_IMAGE);

  const head =
    `<link rel="canonical" href="${esc(canonical)}" />\n` +
    (m.jsonld || []).map(ld).join("\n") +
    "\n</head>";
  out = out.replace("</head>", head);

  if (m.body) {
    // React 起動時に createRoot().render() が中身を置換するため、ユーザー体験は不変。
    out = out.replace(
      /<div id="root">\s*<\/div>/i,
      `<div id="root"><div id="__seo">${m.body}</div></div>`
    );
  }
  return out;
}

export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "qocca.pet";
  const pathname = (req.url || "/").split("?")[0];

  let raw = "";
  try {
    const r = await fetch(`https://${host}/index.html`, { headers: { "user-agent": "qocca-prerender" } });
    raw = await r.text();
  } catch {
    res.status(302).setHeader("Location", "/index.html");
    return res.end();
  }

  let html = raw;
  try {
    const m = await resolve(decodeURI(pathname));
    if (m) html = inject(raw, m);
  } catch (e) {
    console.error("prerender failed:", pathname, e?.message);
    // フォールバック = 素の index.html (クローラーに 500 を見せない)
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("X-Robots-Tag", "index, follow");
  return res.status(200).send(html);
}

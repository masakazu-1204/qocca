// src/pages/facilitySeo.tsx — 施設の個別ページ / 地域ハブページ (2026/7/27 MEO)
//
// 背景: pet_facilities に約3,500件の承認済データがあるのに、URL は /facilities の1本しかなく、
//   「大阪 トリミングサロン」のようなローカル検索で拾われる受け皿が存在しなかった。
//   → 施設ごとの個別URLと、都道府県×カテゴリのハブURLを新設する。
//
// ⚠️ 既存の /facilities (地図つき検索ページ) は一切変更していない。ここは新規ページのみ。
// ⚠️ api/prerender.js が同じURLをクローラー向けにHTMLで返す。URL設計を変えるときは両方直すこと。

import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { C } from "../constants/theme";
import { supabase } from "../supabaseClient";
import { useSEO } from "../hooks/useSEO";
import {
  FACILITY_CATEGORIES, CATEGORY_BY_SLUG, catLabel, catSlug,
  prefToSlug, slugToPrefBase,
} from "../constants/facilitySlugs";

import { SITE_URL as SITE } from "../constants/site";

type Facility = {
  id: string;
  name: string;
  facility_category: string | null;
  address: string | null;
  prefecture: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  official_url: string | null;
  hours: string | null;
  description: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
};

const wrap: React.CSSProperties = {
  maxWidth: 860, margin: "0 auto", padding: "24px 16px 80px",
};
const card: React.CSSProperties = {
  background: C.white, border: `1px solid ${C.border}`, borderRadius: 14,
  padding: "14px 16px", display: "block", textDecoration: "none", color: "inherit",
};

/** 「大阪」+「大阪市西区」→「大阪市西区」。県名が市区名に含まれるときの二重表示を避ける */
export const joinPlace = (pref?: string | null, city?: string | null) => {
  const p = (pref || "").trim();
  const c = (city || "").trim();
  if (!c) return p;
  if (!p) return c;
  const base = p.replace(/[都道府県]$/, "");
  return c.startsWith(p) || c.startsWith(base) ? c : `${p}${c}`;
};

const Crumbs = ({ items }: { items: { label: string; to?: string }[] }) => (
  <nav style={{ fontSize: 12, color: C.warmGray, marginBottom: 14, lineHeight: 1.9 }}>
    {items.map((it, i) => (
      <span key={i}>
        {i > 0 && <span style={{ margin: "0 6px" }}>›</span>}
        {it.to ? (
          <Link to={it.to} style={{ color: C.warmGray, textDecoration: "none" }}>{it.label}</Link>
        ) : (
          <span style={{ color: C.dark }}>{it.label}</span>
        )}
      </span>
    ))}
  </nav>
);

const Loading = () => (
  <div style={{ ...wrap, textAlign: "center", color: C.warmGray, fontSize: 13, paddingTop: 80 }}>
    読み込み中...
  </div>
);

// ── 施設 個別ページ /facility/:id ─────────────────────────────────────
export const FacilityDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [f, setF] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("pet_facilities")
        .select("id,name,facility_category,address,prefecture,city,phone,website,official_url,hours,description,image_url,latitude,longitude")
        .eq("id", id)
        .eq("approved", true)
        .maybeSingle();
      if (!cancelled) { setF((data as Facility) ?? null); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const label = catLabel(f?.facility_category);
  // city が "大阪市西区" のように県名を含むことがあるので二重表示を避ける
  const where = joinPlace(f?.prefecture, f?.city);
  const pslug = prefToSlug(f?.prefecture);

  useSEO({
    title: f ? `${f.name}（${where}の${label}）| Qocca` : "ペット施設 | Qocca",
    description: f
      ? (f.description || `${where}の${label}「${f.name}」の基本情報（住所・営業時間・連絡先）。`).slice(0, 120)
      : undefined,
    path: `/facility/${id}`,
    image: f?.image_url || undefined,
    noindex: !loading && !f,
    jsonLd: f
      ? [{
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: f.name,
          description: (f.description || "").slice(0, 300),
          url: `${SITE}/facility/${f.id}`,
          ...(f.image_url ? { image: f.image_url } : {}),
          ...(f.phone ? { telephone: f.phone } : {}),
          ...(f.official_url || f.website ? { sameAs: [f.official_url || f.website] } : {}),
          address: {
            "@type": "PostalAddress", addressCountry: "JP",
            addressRegion: f.prefecture || undefined,
            addressLocality: f.city || undefined,
            streetAddress: f.address || undefined,
          },
          ...(f.latitude && f.longitude
            ? { geo: { "@type": "GeoCoordinates", latitude: f.latitude, longitude: f.longitude } }
            : {}),
        }]
      : undefined,
  });

  if (loading) return <Loading />;
  if (!f) {
    return (
      <div style={{ ...wrap, textAlign: "center", paddingTop: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🐾</div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.dark, marginBottom: 8 }}>施設が見つかりませんでした</h1>
        <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 20 }}>
          掲載が終了したか、URLが変わった可能性があります。
        </p>
        <button
          onClick={() => navigate("/facilities")}
          style={{ padding: "10px 22px", background: C.orange, border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
        >ペット施設マップへ</button>
      </div>
    );
  }

  const site = f.official_url || f.website;
  const mapQ = encodeURIComponent(f.address ? `${f.address} ${f.name}` : f.name);

  return (
    <div style={wrap}>
      <Crumbs items={[
        { label: "ホーム", to: "/" },
        { label: "ペット施設", to: "/facilities" },
        ...(pslug && f.prefecture ? [{ label: f.prefecture, to: `/facilities/${pslug}` }] : []),
        { label: f.name },
      ]} />

      {f.image_url && (
        <img src={f.image_url} alt={f.name} loading="lazy"
          style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 14, marginBottom: 16 }} />
      )}

      <div style={{ display: "inline-block", background: C.orangePale, color: C.orangeDeep, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999, marginBottom: 10 }}>
        {label}
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.dark, lineHeight: 1.5, marginBottom: 6 }}>{f.name}</h1>
      {where && <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 18 }}>{where}</p>}

      {f.description && (
        <p style={{ fontSize: 14, lineHeight: 1.9, color: C.darkBrown, marginBottom: 20, whiteSpace: "pre-wrap" }}>
          {f.description}
        </p>
      )}

      <div style={{ ...card, marginBottom: 20 }}>
        {[
          ["住所", f.address],
          ["電話", f.phone],
          ["営業時間", f.hours],
        ].filter(([, v]) => !!v).map(([k, v]) => (
          <div key={k as string} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
            <div style={{ width: 72, flexShrink: 0, color: C.warmGray, fontWeight: 700 }}>{k}</div>
            <div style={{ color: C.dark, wordBreak: "break-word" }}>{v as string}</div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 12 }}>
          <a href={`https://www.google.com/maps/search/?api=1&query=${mapQ}`} target="_blank" rel="noopener noreferrer"
            style={{ padding: "9px 16px", background: C.orange, borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 12, textDecoration: "none" }}>
            地図で見る
          </a>
          {site && (
            <a href={site} target="_blank" rel="noopener noreferrer"
              style={{ padding: "9px 16px", background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.dark, fontWeight: 800, fontSize: 12, textDecoration: "none" }}>
              公式サイト
            </a>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {pslug && f.prefecture && (
          <Link to={`/facilities/${pslug}`} style={{ fontSize: 13, color: C.orangeDeep, fontWeight: 700 }}>
            {f.prefecture}のペット施設一覧
          </Link>
        )}
        <Link to="/facilities" style={{ fontSize: 13, color: C.orangeDeep, fontWeight: 700 }}>
          ペット施設マップ
        </Link>
      </div>

      <p style={{ fontSize: 11, color: C.warmGray, marginTop: 24, lineHeight: 1.8 }}>
        掲載情報に誤りがある場合は<Link to="/contact" style={{ color: C.warmGray }}>お問い合わせ</Link>よりお知らせください。
        営業時間・ペット同伴条件は変更される場合があります。おでかけ前に公式情報をご確認ください。
      </p>
    </div>
  );
};

// ── 地域ハブ /facilities/:pref[/:cat] ────────────────────────────────
export const FacilityHubPage = () => {
  const { pref, cat } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Facility[]>([]);
  // total は「表示件数」ではなく該当総数 (大阪は811件あり、表示上限300と食い違うため別で取る)
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const prefBase = slugToPrefBase(pref);
  const catKey = cat ? CATEGORY_BY_SLUG[cat] : null;
  const invalid = !prefBase || (!!cat && !catKey);

  useEffect(() => {
    if (invalid) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      // 一覧(300件まで) / 総数 / カテゴリ内訳 を別々に取る。
      // 内訳や件数を一覧から数えると上限300で頭打ちになり、実態(大阪811件)とズレるため。
      const withFilters = <T,>(q: T): T => {
        let x = (q as any)
          .eq("approved", true)
          .neq("is_closed", true)
          .like("prefecture", `${prefBase}%`);
        if (catKey) x = x.eq("facility_category", catKey);
        return x as T;
      };
      const listQ = withFilters(
        supabase
          .from("pet_facilities")
          .select("id,name,facility_category,address,prefecture,city,description,image_url,phone,website,official_url,hours,latitude,longitude")
      ).order("name", { ascending: true }).limit(300);
      const totalQ = withFilters(
        supabase.from("pet_facilities").select("id", { count: "exact", head: true })
      );
      const catQ = withFilters(
        supabase.from("pet_facilities").select("facility_category")
      ).limit(2000);

      const [{ data }, { count }, { data: catRows }] = await Promise.all([
        listQ,
        totalQ,
        catKey ? Promise.resolve({ data: null }) : catQ,
      ]);
      if (cancelled) return;
      setRows((data as Facility[]) || []);
      setTotal(count ?? (data?.length || 0));
      const c: Record<string, number> = {};
      for (const r of (catRows as { facility_category: string | null }[] | null) || []) {
        const k = r.facility_category || "other";
        c[k] = (c[k] || 0) + 1;
      }
      setCounts(c);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [pref, cat, prefBase, catKey, invalid]);

  const label = catKey ? catLabel(catKey) : "ペット関連施設";
  const heading = `${prefBase ?? ""}の${label}`;

  useSEO({
    title: invalid ? "ペット施設 | Qocca" : `${heading}一覧（${total}件）| Qocca`,
    description: invalid
      ? undefined
      : `${prefBase}にある${label}を${total}件掲載。住所・営業時間・特徴をまとめています。うちの子とのおでかけ先探しに。`,
    path: `/facilities/${pref}${cat ? `/${cat}` : ""}`,
    noindex: invalid || (!loading && rows.length === 0),
    jsonLd: !invalid && rows.length
      ? [{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: heading,
          numberOfItems: total,
          itemListElement: rows.slice(0, 100).map((r, i) => ({
            "@type": "ListItem", position: i + 1,
            url: `${SITE}/facility/${r.id}`, name: r.name,
          })),
        }]
      : undefined,
  });

  if (invalid) {
    return (
      <div style={{ ...wrap, textAlign: "center", paddingTop: 60 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.dark, marginBottom: 10 }}>ページが見つかりませんでした</h1>
        <button onClick={() => navigate("/facilities")}
          style={{ padding: "10px 22px", background: C.orange, border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          ペット施設マップへ
        </button>
      </div>
    );
  }
  if (loading) return <Loading />;

  return (
    <div style={wrap}>
      <Crumbs items={[
        { label: "ホーム", to: "/" },
        { label: "ペット施設", to: "/facilities" },
        ...(catKey ? [{ label: prefBase!, to: `/facilities/${pref}` }] : []),
        { label: catKey ? label : prefBase! },
      ]} />

      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.dark, lineHeight: 1.5, marginBottom: 8 }}>
        {heading}
      </h1>
      <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 22, lineHeight: 1.8 }}>
        {total}件を掲載しています。うちの子とのおでかけ先探しに。
        {total > rows.length && `（うち${rows.length}件を表示中。カテゴリで絞り込めます）`}
      </p>

      {!catKey && Object.keys(counts).length > 1 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 10 }}>カテゴリから探す</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <Link key={k} to={`/facilities/${pref}/${catSlug(k)}`}
                style={{ padding: "7px 14px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 999, fontSize: 12, fontWeight: 700, color: C.dark, textDecoration: "none" }}>
                {catLabel(k)}（{n}）
              </Link>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: C.warmGray }}>まだ掲載がありません。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => (
            <Link key={r.id} to={`/facility/${r.id}`} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{r.name}</span>
                <span style={{ fontSize: 10, color: C.warmGray, flexShrink: 0 }}>{catLabel(r.facility_category)}</span>
              </div>
              {(r.city || r.address) && (
                <div style={{ fontSize: 12, color: C.warmGray, marginTop: 4 }}>
                  {[r.city, r.address].filter(Boolean).join(" ")}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <Link to="/facilities" style={{ fontSize: 13, color: C.orangeDeep, fontWeight: 700 }}>
          全国のペット施設マップへ
        </Link>
      </div>
    </div>
  );
};

/** 施設カテゴリの一覧 (将来 /facilities のリンク追加などで使う) */
export const ALL_FACILITY_CATEGORIES = FACILITY_CATEGORIES;

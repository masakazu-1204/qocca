// src/pages/MarketplacePage.tsx
// ─────────────────────────────────────────────────────────────────
// 依頼書 #110 (2026/6/4): 商店街 v2.0 (ナビ修正 + TOP リッチ化)
//
// 永続記録 #15「街」哲学体現。CAMPFIRE 公開後の集客導線。
// 各セクションは MarketplaceSection コンポーネントで dataSource 注入型。
// 将来 (Phase 4) AI レコメンド導入時は dataSource を AI 版に差し替えるだけ。
//
// 構造:
//   1. 🔥 今週の人気作品 (popularity_score 上位)
//   2. ✨ 新着商品 (直近 7日)
//   3. 🎨 カテゴリ別ランキング (実在カテゴリのみ動的表示)
//   4. 🏠 新しいお店 (直近 30日 stripe_onboarded)
//   5. 🐾 創業期メンバー (founding creator)
// ─────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { QC_FONT_JP, QC_FONT_EN, QC_FONT_DISPLAY } from "../constants/theme";

// 2026/9/26 (King「c でいこう。絵文字ダサい」): 見出しの絵文字を、ホームの「できること」カードと同じ線画に。
//   ACCENT はそのカードの英字・線画のオレンジ (#E8894A)。ボタンの BRAND は従来どおり。
const ACCENT = "#E8894A";
const ICON_PATH: Record<string, React.ReactNode> = {
  shop:     <><path d="M4 10V7l2-3h12l2 3v3" /><path d="M4 10c0 1.4 1.2 2.4 2.7 2.4S9.3 11.4 9.3 10c0 1.4 1.2 2.4 2.7 2.4s2.7-1 2.7-2.4c0 1.4 1.2 2.4 2.7 2.4S20 11.4 20 10" /><path d="M5 12.4V20h14v-7.6M10 20v-5h4v5" /></>,
  heart:    <><path d="M12 20s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.6 12 20 12 20z" /></>,
  sparkle:  <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>,
  house:    <><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></>,
  paw:      <><ellipse cx="12" cy="15.5" rx="4.2" ry="3.4" /><circle cx="6.8" cy="10.5" r="1.7" /><circle cx="17.2" cy="10.5" r="1.7" /><circle cx="9.5" cy="6.8" r="1.7" /><circle cx="14.5" cy="6.8" r="1.7" /></>,
  palette:  <><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.8 2-1.8 0-.9-.7-1.2-.7-2.2 0-1 .8-1.8 1.9-1.8H17a4 4 0 0 0 4-4c0-4.7-4-8.2-9-8.2z" /><circle cx="7.5" cy="12" r="1" /><circle cx="9.5" cy="8" r="1" /><circle cx="14" cy="7.5" r="1" /></>,
  basket:   <><path d="M4 9h16l-1.4 9.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 9z" /><path d="M8 9l3-5M16 9l-3-5" /><path d="M9 13v3M12 13v3M15 13v3" /></>,
  scissors: <><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="6.5" cy="17.5" r="2.5" /><path d="M8.6 8.2L20 19M8.6 15.8L20 5" /></>,
  camera:   <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M8 7l1.5-3h5L16 7" /><circle cx="12" cy="13.5" r="3.4" /></>,
  bone:     <><path d="M7 9.5a2.5 2.5 0 1 1 2.5-2.5v.5h5v-.5A2.5 2.5 0 1 1 17 9.5h-.5v5h.5a2.5 2.5 0 1 1-2.5 2.5v-.5h-5v.5A2.5 2.5 0 1 1 7 14.5h.5v-5z" /></>,
  cap:      <><path d="M3 9l9-4 9 4-9 4z" /><path d="M7 11v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4" /><path d="M21 9v5" /></>,
  feather:  <><path d="M20 4c-6 0-11 4-13 10l-3 6" /><path d="M20 4c0 6-4 11-10 13H8" /><path d="M9 15l6-6" /></>,
  sprout:   <><path d="M12 21v-8" /><path d="M12 13c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6z" /><path d="M12 13c0-3-2-5-5-5 0 3 2 5 5 5z" /></>,
  bag:      <><path d="M6 8h12l-1 12H7z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  search:   <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.3-4.3" /></>,
  box:      <><path d="M3 8l9-4 9 4v9l-9 4-9-4z" /><path d="M3 8l9 4 9-4M12 12v9" /></>,
};
const MarketIcon = ({ name, size = 20, color = ACCENT }: { name: string; size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
    style={{ stroke: color, fill: "none", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round", flexShrink: 0, display: "block" }}>
    {ICON_PATH[name] ?? ICON_PATH.box}
  </svg>
);

const BRAND = "#F5A94A";
const BRAND_DEEP = "#B27820";
const CREAM = "#FFF9F0";
const CREAM_DARK = "#FFF2DF";
const TEXT_DARK = "#2C2C2A";
const TEXT_MUTED = "#888780";
const BORDER = "#F1EFE8";
const BORDER_WARM = "#F5E6D0";
const WHITE = "#FFFFFF";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const SUPABASE_ANON =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou";

// カテゴリ表示マッピング (DB の category 値 → 表示名 + 線画アイコン名)
// 実在カテゴリ (goods/food/illust) + 将来想定カテゴリも準備
const CATEGORY_MAP: { [key: string]: { label: string; icon: string } } = {
  illust: { label: "似顔絵・イラスト", icon: "palette" },
  goods: { label: "ペット用品", icon: "basket" },
  clothes: { label: "ハンドメイド服", icon: "scissors" },
  photo: { label: "写真・データ", icon: "camera" },
  food: { label: "フード・おやつ", icon: "bone" },
  service: { label: "サービス・しつけ", icon: "cap" },
  craft: { label: "ハンドメイド作品", icon: "sparkle" },
  memorial: { label: "メモリアル", icon: "feather" },
};

type Listing = {
  id: string;
  seller_id: string;
  title: string;
  price: number;
  category: string;
  image_urls: string[] | null;
  status: string;
  created_at: string;
  popularity_score?: number;
  sales_count?: number;
  view_count?: number;
  favorite_count?: number;
};

type Creator = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  username?: string | null;
  is_founding_creator?: boolean;
  stripe_onboarded?: boolean;
  created_at: string;
};

// ────────────────────────────────────────────────
// dataSource 関数群 (Phase D: 将来 AI 版に差替可能)
// ────────────────────────────────────────────────
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

async function fetchWeeklyRanking(): Promise<Listing[]> {
  const { data } = await sb
    .from("listings_with_popularity")
    .select("id, seller_id, title, price, category, image_urls, status, created_at, popularity_score, sales_count, view_count, favorite_count")
    .eq("status", "approved")
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .limit(6);
  return (data as Listing[]) || [];
}

async function fetchNewest(): Promise<Listing[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("listings")
    .select("id, seller_id, title, price, category, image_urls, status, created_at")
    .eq("status", "approved")
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data as Listing[]) || [];
}

async function fetchByCategory(category: string): Promise<Listing[]> {
  const { data } = await sb
    .from("listings_with_popularity")
    .select("id, seller_id, title, price, category, image_urls, status, created_at, popularity_score")
    .eq("status", "approved")
    .eq("category", category)
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .limit(6);
  return (data as Listing[]) || [];
}

async function fetchActiveCategories(): Promise<string[]> {
  // listings の実在カテゴリだけ取得 → 空カテゴリは表示しない
  const { data } = await sb
    .from("listings")
    .select("category")
    .eq("status", "approved");
  const set = new Set<string>((data || []).map((r: any) => r.category).filter(Boolean));
  return Array.from(set);
}

async function fetchNewShops(): Promise<Creator[]> {
  // 「直近30日 stripe_onboarded 完了」想定列 stripe_onboarded_at は不在のため、
  // 現状は stripe_onboarded=true & profiles.created_at 直近で代替
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("profiles")
    .select("id, display_name, avatar_url, is_founding_creator, stripe_onboarded, created_at")
    .eq("stripe_onboarded", true)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data as Creator[]) || [];
}

async function fetchFoundingCreators(): Promise<Creator[]> {
  const { data } = await sb
    .from("profiles")
    .select("id, display_name, avatar_url, is_founding_creator, stripe_onboarded, created_at")
    .eq("is_founding_creator", true)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data as Creator[]) || [];
}

// ────────────────────────────────────────────────
// メインページ
// ────────────────────────────────────────────────
export default function MarketplacePage() {
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQ.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <div style={{ minHeight: "100vh", background: CREAM, paddingBottom: 80, fontFamily: QC_FONT_JP, color: TEXT_DARK }}>
      {/* ヘッダ */}
      <header
        style={{
          background: `linear-gradient(180deg, ${CREAM_DARK} 0%, ${CREAM} 100%)`,
          padding: "48px 16px 32px",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><MarketIcon name="shop" size={34} /></div>
        <div style={{ fontFamily: QC_FONT_EN, fontStyle: "italic", fontSize: 13, letterSpacing: "0.08em", color: ACCENT, marginBottom: 8 }}>Market</div>
        <h1 style={{ fontFamily: QC_FONT_DISPLAY, fontSize: 26, fontWeight: 500, letterSpacing: "0.08em", margin: "0 0 10px", color: TEXT_DARK }}>Qocca 商店街</h1>
        <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0, lineHeight: 1.7 }}>
          ペット好きクリエイターの一点物が並ぶ街<br />
          似顔絵・ハンドメイド服・写真撮影・しつけ等
        </p>

        {/* 検索バー */}
        <form
          onSubmit={handleSearch}
          style={{
            maxWidth: 480,
            margin: "20px auto 0",
            display: "flex",
            gap: 8,
            padding: "0 8px",
          }}
        >
          <input
            type="text"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="作品名・クリエイター名で検索"
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 999,
              border: `1.5px solid ${BORDER_WARM}`,
              fontSize: 14,
              fontFamily: "inherit",
              background: WHITE,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              border: "none",
              background: BRAND,
              color: WHITE,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            検索
          </button>
        </form>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 12px" }}>
        {/* ペットウォーカー入口 (ペットと行きたくなる場所: 宿/カフェ/観光) */}
        <Link
          to="/petwalker"
          style={{
            display: "block",
            margin: "24px 0 8px",
            padding: "22px 24px",
            borderRadius: 16,
            background: `linear-gradient(135deg, ${CREAM_DARK} 0%, ${WHITE} 100%)`,
            border: `1.5px solid ${BORDER_WARM}`,
            textDecoration: "none",
            color: TEXT_DARK,
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: BRAND, marginBottom: 6 }}>PET WALKER</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>うちの子と、出かける。</div>
          <div style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.7 }}>
            泊まれる宿、一緒に入れるカフェ、歩きたくなる場所を、エリアごとに。 →
          </div>
        </Link>

        {/* 1. 今週の人気作品 */}
        <MarketplaceSection
          icon="heart"
          title="今週の人気作品"
          subtitle="販売・お気に入り・閲覧から自動算出"
          dataSource={fetchWeeklyRanking}
          renderItem={l => <ListingCard key={l.id} l={l} />}
          moreHref="/search?sort=popular"
          itemKey="ranking"
        />

        {/* 2. 新着商品 */}
        <MarketplaceSection
          icon="sparkle"
          title="新着商品"
          subtitle="直近 7日以内に出品された作品"
          dataSource={fetchNewest}
          renderItem={l => <ListingCard key={l.id} l={l} />}
          moreHref="/search?sort=newest"
          itemKey="newest"
        />

        {/* 3. カテゴリ別ランキング (動的) */}
        <CategoriesSection />

        {/* 4. 新しいお店 */}
        <MarketplaceSection
          icon="house"
          title="新しいお店"
          subtitle="直近 30日以内に活動を始めたクリエイター"
          dataSource={fetchNewShops}
          renderItem={c => <CreatorCard key={c.id} c={c} />}
          moreHref="/founding-creators"
          itemKey="new-shops"
          emptyMessage="まだ新しいお店はありません。出店は、いつでも無料です。"
        />

        {/* 5. 創業期メンバー */}
        <MarketplaceSection
          icon="paw"
          title="創業期メンバー"
          subtitle="クラウドファンディングで Qocca の街を立ち上げた仲間たち"
          dataSource={fetchFoundingCreators}
          renderItem={c => <CreatorCard key={c.id} c={c} founding />}
          moreHref="/founding-creators"
          itemKey="founding"
          emptyMessage="創業期メンバーは、これから増えていきます。"
        />

        {/* CTA */}
        <div style={{ textAlign: "center", padding: "40px 20px 20px" }}>
          <Link
            to="/sell"
            style={{
              display: "inline-block",
              padding: "12px 32px",
              background: BRAND,
              color: WHITE,
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            あなたも商店街に出店する →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// MarketplaceSection: 共通セクションコンポーネント
// dataSource を関数として受け取り、Phase D で AI 版に差替可能
// ────────────────────────────────────────────────
function MarketplaceSection<T>({
  icon,
  title,
  subtitle,
  dataSource,
  renderItem,
  moreHref,
  itemKey,
  emptyMessage,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  dataSource: () => Promise<T[]>;
  renderItem: (item: T) => React.ReactNode;
  moreHref?: string;
  itemKey: string;
  emptyMessage?: string;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dataSource();
      setItems(data);
    } catch (e) {
      console.warn(`MarketplaceSection[${itemKey}] fetch failed`, e);
    } finally {
      setLoading(false);
    }
  }, [dataSource, itemKey]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 8px 12px" }}>
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: QC_FONT_DISPLAY, fontSize: 18, fontWeight: 500, letterSpacing: "0.04em", color: TEXT_DARK, margin: 0 }}>
            {icon && <MarketIcon name={icon} size={20} />}{title}
          </h2>
          {subtitle && <p style={{ fontSize: 11, color: TEXT_MUTED, margin: "5px 0 0", letterSpacing: "0.02em" }}>{subtitle}</p>}
        </div>
        {moreHref && items.length > 0 && (
          <Link to={moreHref} style={{ fontSize: 12, color: BRAND_DEEP, textDecoration: "none", flexShrink: 0 }}>もっと見る →</Link>
        )}
      </div>

      {loading ? (
        <div style={{ background: WHITE, borderRadius: 14, padding: 32, textAlign: "center", fontSize: 12, color: TEXT_MUTED }}>読み込み中…</div>
      ) : items.length === 0 ? (
        <div style={{ background: WHITE, borderRadius: 14, padding: 32, textAlign: "center", fontSize: 13, color: TEXT_MUTED, lineHeight: 1.8, border: `1px dashed ${BORDER_WARM}` }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><MarketIcon name="sprout" size={28} /></div>
          {emptyMessage || "新しい作品は、まだありません。次の入荷を、ゆっくりお待ちください。"}
        </div>
      ) : (
        <HorizontalScroller>
          {items.map(renderItem)}
        </HorizontalScroller>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────
// CategoriesSection: 動的にカテゴリ別ランキング展開
// ────────────────────────────────────────────────
function CategoriesSection() {
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const cats = await fetchActiveCategories();
      setActiveCategories(cats.filter(c => CATEGORY_MAP[c]));
      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  if (activeCategories.length === 0) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: QC_FONT_DISPLAY, fontSize: 18, fontWeight: 500, letterSpacing: "0.04em", margin: "0 8px 12px" }}><MarketIcon name="palette" size={20} />カテゴリ別ランキング</h2>
        <div style={{ background: WHITE, borderRadius: 14, padding: 32, textAlign: "center", fontSize: 13, color: TEXT_MUTED, border: `1px dashed ${BORDER_WARM}` }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><MarketIcon name="sprout" size={28} /></div>
          まだカテゴリ別の作品が揃っていません。出店は、いつでも無料です。
        </div>
      </section>
    );
  }

  return (
    <>
      {activeCategories.map(cat => (
        <MarketplaceSection
          key={cat}
          icon={CATEGORY_MAP[cat].icon}
          title={CATEGORY_MAP[cat].label}
          subtitle={`カテゴリ TOP6`}
          dataSource={() => fetchByCategory(cat)}
          renderItem={l => <ListingCard key={l.id} l={l} />}
          moreHref={`/search?category=${encodeURIComponent(cat)}`}
          itemKey={`cat-${cat}`}
        />
      ))}
    </>
  );
}

// ────────────────────────────────────────────────
// HorizontalScroller: mobile 横スクロール / PC グリッド
// ────────────────────────────────────────────────
function HorizontalScroller({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        overflowX: "auto",
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        padding: "4px 8px 16px",
      }}
    >
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────
// ListingCard: 作品カード
// ────────────────────────────────────────────────
function ListingCard({ l }: { l: Listing }) {
  const img = Array.isArray(l.image_urls) && l.image_urls.length > 0 ? l.image_urls[0] : null;
  const catMeta = CATEGORY_MAP[l.category] || { label: l.category, icon: "box" };

  return (
    <Link
      to={`/listing/${l.id}`}
      style={{
        flexShrink: 0,
        width: 168,
        background: WHITE,
        borderRadius: 14,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        border: `1px solid ${BORDER}`,
        scrollSnapAlign: "start",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          width: "100%",
          height: 168,
          background: img ? `url(${img}) center/cover` : CREAM_DARK,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
        }}
      >
        {!img && <MarketIcon name={catMeta.icon} size={36} color={BRAND_DEEP} />}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 10, color: BRAND_DEEP, marginBottom: 3, letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 4 }}>
          <MarketIcon name={catMeta.icon} size={11} color={BRAND_DEEP} />{catMeta.label}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: TEXT_DARK,
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            lineHeight: 1.4,
            minHeight: 36,
          }}
        >
          {l.title}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: BRAND_DEEP, fontFamily: "Georgia, serif" }}>
          ¥{Number(l.price || 0).toLocaleString()}
        </div>
        {(l.sales_count || l.favorite_count) ? (
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 4, display: "flex", gap: 6 }}>
            {l.sales_count ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MarketIcon name="bag" size={11} color={TEXT_MUTED} />{l.sales_count}</span> : null}
            {l.favorite_count ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MarketIcon name="heart" size={11} color={TEXT_MUTED} />{l.favorite_count}</span> : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

// ────────────────────────────────────────────────
// CreatorCard: クリエイターカード
// ────────────────────────────────────────────────
function CreatorCard({ c, founding }: { c: Creator; founding?: boolean }) {
  return (
    <Link
      to={`/profile/${c.id}`}
      style={{
        flexShrink: 0,
        width: 140,
        background: WHITE,
        borderRadius: 14,
        padding: 14,
        textAlign: "center",
        textDecoration: "none",
        color: "inherit",
        border: `1px solid ${BORDER}`,
        scrollSnapAlign: "start",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto 8px",
          borderRadius: "50%",
          background: c.avatar_url ? `url(${c.avatar_url}) center/cover` : CREAM_DARK,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          border: founding ? `2px solid ${BRAND}` : "none",
        }}
      >
        {!c.avatar_url && <MarketIcon name="paw" size={26} />}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_DARK, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {c.display_name || "(名称未設定)"}
      </div>
      {founding && (
        <div style={{ fontSize: 9, color: BRAND_DEEP, fontWeight: 700, letterSpacing: "0.05em" }}>FOUNDING</div>
      )}
    </Link>
  );
}

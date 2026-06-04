// src/pages/AdminAnalytics.tsx
// ─────────────────────────────────────────────────────────────────
// 依頼書 #111 (2026/6/4): 基礎データ分析ダッシュボード (AI 戦略 Phase 1)
//
// 永続記録 #22「データ = 企業価値」/ #23「Qocca用AI構想」の土台。
// Chart ライブラリ非依存 (純粋 CSS + SVG) で Bundle 圧迫最小化。
//
// 構造:
//   1. 概要サマリ (会員/出品/取引/GMV/平均購入額/リピート率)
//   2. ユーザー分析 (ペット種別/地域/新規登録ペース/創業期 vs 通常)
//   3. 出品・取引分析 (カテゴリ別/価格帯/配送タイプ/売れ筋/月次GMV)
//   4. コミュニティ活性度 (アクティブ率/フォロー数/参加率/コミュニティ別)
//   5. 営業用エクスポート (CSV)
//
// Phase 4 で同じセクション枠を AI 強化 (予測・異常検知等) に差替可能。
// ─────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
// 依頼書 #119 Phase C (2026/6/5): admin RLS 認証問題解消のため共有 supabase client を使用
import { supabase as sb } from "../supabaseClient";

const C = {
  brand: "#F5A94A",
  brandDeep: "#B27820",
  cream: "#FFF9F0",
  creamDark: "#FFF2DF",
  dark: "#2C2C2A",
  warmGray: "#888780",
  border: "#F1EFE8",
  borderWarm: "#F5E6D0",
  white: "#FFFFFF",
  green: "#7FB069",
  blue: "#5B9BD5",
  red: "#E57373",
  purple: "#9C7CB5",
};

// 依頼書 #119 Phase C: 共有 supabaseClient.ts から import で統一 (createClient 重複排除)

// パレット (棒グラフ・円グラフ slice 色)
const PALETTE = [C.brand, C.blue, C.green, C.purple, C.red, C.brandDeep, "#FFB74D", "#81C784", "#7986CB", "#F06292"];

// ────────────────────────────────────────────────
// データ型
// ────────────────────────────────────────────────
type Summary = {
  total_users: number;
  total_listings: number;
  total_orders: number;
  gmv_total: number;
  avg_purchase: number;
  repeat_rate: number;
  current_month_gmv: number;
  prev_month_gmv: number;
};

type CountRow = { label: string; count: number };
type MonthlyRow = { month: string; value: number; count?: number };
type CommunityRow = { name: string; member_count: number; message_count: number };

// ────────────────────────────────────────────────
// dataSource 関数群 (Phase 4 で AI 版に差替可能)
// ────────────────────────────────────────────────

async function fetchSummary(): Promise<Summary> {
  const [{ count: totalUsers }, { count: totalListings }, { count: totalOrders }, gmvRes, repeatRes] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb.from("listings").select("id", { count: "exact", head: true }).eq("status", "approved"),
    sb.from("orders").select("id", { count: "exact", head: true }),
    sb.from("orders").select("amount, status, created_at").in("status", ["completed", "delivered"]),
    sb.from("orders").select("buyer_id"),
  ]);

  const orders = (gmvRes.data || []) as any[];
  const gmvTotal = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const avgPurchase = orders.length > 0 ? Math.round(gmvTotal / orders.length) : 0;

  // 月次 GMV (今月 + 先月)
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  let currentMonthGmv = 0, prevMonthGmv = 0;
  for (const o of orders) {
    const k = (o.created_at || "").slice(0, 7);
    if (k === thisMonthKey) currentMonthGmv += Number(o.amount) || 0;
    else if (k === prevMonthKey) prevMonthGmv += Number(o.amount) || 0;
  }

  // リピート率 (2 回以上注文した buyer / 全 buyer)
  const buyerCounts = new Map<string, number>();
  for (const r of (repeatRes.data || []) as any[]) {
    if (!r.buyer_id) continue;
    buyerCounts.set(r.buyer_id, (buyerCounts.get(r.buyer_id) || 0) + 1);
  }
  const totalBuyers = buyerCounts.size;
  const repeatBuyers = Array.from(buyerCounts.values()).filter(c => c > 1).length;
  const repeatRate = totalBuyers > 0 ? (repeatBuyers * 100) / totalBuyers : 0;

  return {
    total_users: totalUsers || 0,
    total_listings: totalListings || 0,
    total_orders: totalOrders || 0,
    gmv_total: gmvTotal,
    avg_purchase: avgPurchase,
    repeat_rate: Math.round(repeatRate * 10) / 10,
    current_month_gmv: currentMonthGmv,
    prev_month_gmv: prevMonthGmv,
  };
}

async function fetchPetSpecies(): Promise<CountRow[]> {
  const { data } = await sb.from("pets").select("species");
  const map = new Map<string, number>();
  for (const r of (data || []) as any[]) {
    const k = r.species || "(未設定)";
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

async function fetchProfileLocation(): Promise<CountRow[]> {
  const { data } = await sb.from("profiles").select("location").not("location", "is", null);
  const map = new Map<string, number>();
  for (const r of (data || []) as any[]) {
    const k = (r.location || "").trim() || "(未設定)";
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 20);
}

async function fetchNewUserPace(): Promise<MonthlyRow[]> {
  const { data } = await sb.from("profiles").select("created_at");
  const map = new Map<string, number>();
  for (const r of (data || []) as any[]) {
    const k = (r.created_at || "").slice(0, 7);
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12); // 直近 12ヶ月
}

async function fetchMemberRatio(): Promise<{ initial: number; founding_creator: number; founding_mayor: number; normal: number; total: number }> {
  const { data } = await sb.from("profiles").select("is_initial_member, is_founding_creator, is_founding_mayor");
  const rows = (data || []) as any[];
  const initial = rows.filter(r => r.is_initial_member).length;
  const founding_creator = rows.filter(r => r.is_founding_creator).length;
  const founding_mayor = rows.filter(r => r.is_founding_mayor).length;
  const total = rows.length;
  const flagged = rows.filter(r => r.is_initial_member || r.is_founding_creator || r.is_founding_mayor).length;
  return { initial, founding_creator, founding_mayor, normal: total - flagged, total };
}

async function fetchCategoryCount(): Promise<CountRow[]> {
  const { data } = await sb.from("listings").select("category").eq("status", "approved");
  const map = new Map<string, number>();
  for (const r of (data || []) as any[]) {
    const k = r.category || "(未設定)";
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

async function fetchPriceBucket(): Promise<CountRow[]> {
  const { data } = await sb.from("listings").select("price").eq("status", "approved");
  const buckets = [
    { label: "〜¥1,000", max: 1000 },
    { label: "¥1,000〜¥3,000", max: 3000 },
    { label: "¥3,000〜¥5,000", max: 5000 },
    { label: "¥5,000〜¥10,000", max: 10000 },
    { label: "¥10,000〜¥30,000", max: 30000 },
    { label: "¥30,000〜", max: Infinity },
  ];
  const counts = buckets.map(b => ({ label: b.label, count: 0 }));
  for (const r of (data || []) as any[]) {
    const p = Number(r.price) || 0;
    const idx = buckets.findIndex(b => p < b.max);
    if (idx >= 0) counts[idx].count++;
    else counts[counts.length - 1].count++;
  }
  return counts;
}

async function fetchShippingType(): Promise<CountRow[]> {
  const { data } = await sb.from("listings").select("shipping_type").eq("status", "approved");
  const SHIPPING_LABEL: { [k: string]: string } = { included: "✅ 送料込み", flat_rate: "📮 全国一律", regional: "🗾 地域別", consultation: "💬 要相談" };
  const map = new Map<string, number>();
  for (const r of (data || []) as any[]) {
    const raw = r.shipping_type || "included";
    const k = SHIPPING_LABEL[raw] || raw;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

async function fetchSellingCategory(): Promise<CountRow[]> {
  // 直近 30日の orders を listings に JOIN してカテゴリ別販売数を出す
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders } = await sb.from("orders").select("listing_id").gte("created_at", thirtyDaysAgo);
  const ids = Array.from(new Set(((orders || []) as any[]).map(o => o.listing_id).filter(Boolean)));
  if (ids.length === 0) return [];
  const { data: listings } = await sb.from("listings").select("id, category").in("id", ids);
  const catById = new Map<string, string>((listings || []).map((l: any) => [l.id, l.category || "(未設定)"]));
  const map = new Map<string, number>();
  for (const o of (orders || []) as any[]) {
    const c = catById.get(o.listing_id) || "(未設定)";
    map.set(c, (map.get(c) || 0) + 1);
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

async function fetchMonthlyGmv(): Promise<MonthlyRow[]> {
  const { data } = await sb.from("orders").select("amount, status, created_at").in("status", ["completed", "delivered"]);
  const map = new Map<string, { value: number; count: number }>();
  for (const r of (data || []) as any[]) {
    const k = (r.created_at || "").slice(0, 7);
    if (!k) continue;
    const cur = map.get(k) || { value: 0, count: 0 };
    cur.value += Number(r.amount) || 0;
    cur.count += 1;
    map.set(k, cur);
  }
  return Array.from(map.entries())
    .map(([month, { value, count }]) => ({ month, value, count }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);
}

async function fetchCommunityActivity(): Promise<CommunityRow[]> {
  const { data } = await sb
    .from("communities")
    .select("name, member_count, message_count, is_archived")
    .eq("is_archived", false)
    .order("message_count", { ascending: false, nullsFirst: false })
    .limit(15);
  return ((data || []) as any[]).map(r => ({
    name: r.name || "(無題)",
    member_count: r.member_count || 0,
    message_count: r.message_count || 0,
  }));
}

// ────────────────────────────────────────────────
// 依頼書 #118: GMV 予測 + 異常検知アラート (ルールベース・AI不使用)
// ────────────────────────────────────────────────
type Forecast = {
  this_month_gmv: number;
  last_month_gmv: number;
  forecast: number | null; // データ不足時 null
  daily_avg_7d: number | null;
  days_elapsed: number;
  total_days: number;
  mom_change: number | null;
  daily_series: { snapshot_date: string; gmv: number }[];
  has_enough_data: boolean;
};
type Alert = {
  id: string;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string | null;
  detected_at: string;
  is_read: boolean;
};

async function fetchForecast(): Promise<Forecast> {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysElapsed = today.getDate();

  const [{ data: thisM }, { data: lastM }] = await Promise.all([
    sb.from("metrics_daily").select("snapshot_date, gmv, orders_count").gte("snapshot_date", monthStart).lte("snapshot_date", todayStr).order("snapshot_date", { ascending: true }),
    sb.from("metrics_daily").select("gmv").gte("snapshot_date", lastMonthStart).lte("snapshot_date", lastMonthEnd),
  ]);
  const thisRows = (thisM || []) as any[];
  const lastRows = (lastM || []) as any[];
  const thisMonthGmv = thisRows.reduce((s, d) => s + Number(d.gmv || 0), 0);
  const lastMonthGmv = lastRows.reduce((s, d) => s + Number(d.gmv || 0), 0);

  // 直近 7 日分のデータ + 取引あった日が 7 日以上ある場合のみ予測
  const last7Days = thisRows.slice(-7);
  const last7HasOrders = last7Days.filter(d => Number(d.orders_count || 0) > 0).length;
  let forecast: number | null = null;
  let dailyAvg7: number | null = null;
  if (last7Days.length >= 7 && last7HasOrders >= 3) {
    dailyAvg7 = last7Days.reduce((s, d) => s + Number(d.gmv || 0), 0) / 7;
    const daysRemaining = lastDayOfMonth - daysElapsed;
    forecast = Math.round(thisMonthGmv + dailyAvg7 * daysRemaining);
  }

  // 前月比 (按分): 当月 1 日あたり平均 vs 前月 1 日あたり平均
  let momChange: number | null = null;
  if (lastMonthGmv > 0 && daysElapsed > 0 && lastRows.length > 0) {
    const thisDailyAvg = thisMonthGmv / daysElapsed;
    const lastDailyAvg = lastMonthGmv / Math.max(lastRows.length, 1);
    momChange = ((thisDailyAvg - lastDailyAvg) / lastDailyAvg) * 100;
  }

  return {
    this_month_gmv: thisMonthGmv,
    last_month_gmv: lastMonthGmv,
    forecast,
    daily_avg_7d: dailyAvg7,
    days_elapsed: daysElapsed,
    total_days: lastDayOfMonth,
    mom_change: momChange,
    daily_series: thisRows.map(r => ({ snapshot_date: r.snapshot_date, gmv: Number(r.gmv || 0) })),
    has_enough_data: last7Days.length >= 7 && last7HasOrders >= 3,
  };
}

async function fetchUnreadAlerts(): Promise<Alert[]> {
  const { data } = await sb.from("admin_alerts").select("*").eq("is_read", false).order("detected_at", { ascending: false }).limit(20);
  return (data || []) as Alert[];
}

async function fetchActiveRate(): Promise<{ active_30d: number; total: number; active_rate: number; total_follows: number; community_participants: number; participation_rate: number }> {
  const thirty = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [profilesRes, followsRes, cmRes] = await Promise.all([
    sb.from("profiles").select("id, updated_at"),
    sb.from("follows").select("created_at", { count: "exact", head: true }),
    sb.from("community_members").select("user_id"),
  ]);
  const profiles = (profilesRes.data || []) as any[];
  const total = profiles.length;
  const active = profiles.filter(p => p.updated_at && p.updated_at >= thirty).length;
  const totalFollows = followsRes.count || 0;
  const cmUserIds = new Set(((cmRes.data || []) as any[]).map(r => r.user_id).filter(Boolean));
  return {
    active_30d: active,
    total,
    active_rate: total > 0 ? Math.round((active * 1000) / total) / 10 : 0,
    total_follows: totalFollows,
    community_participants: cmUserIds.size,
    participation_rate: total > 0 ? Math.round((cmUserIds.size * 1000) / total) / 10 : 0,
  };
}

// ────────────────────────────────────────────────
// メインページ
// ────────────────────────────────────────────────
export default function AdminAnalytics() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [species, setSpecies] = useState<CountRow[]>([]);
  const [locations, setLocations] = useState<CountRow[]>([]);
  const [newPace, setNewPace] = useState<MonthlyRow[]>([]);
  const [memberRatio, setMemberRatio] = useState<{ initial: number; founding_creator: number; founding_mayor: number; normal: number; total: number } | null>(null);
  const [catCount, setCatCount] = useState<CountRow[]>([]);
  const [priceBucket, setPriceBucket] = useState<CountRow[]>([]);
  const [shippingType, setShippingType] = useState<CountRow[]>([]);
  const [sellingCat, setSellingCat] = useState<CountRow[]>([]);
  const [monthlyGmv, setMonthlyGmv] = useState<MonthlyRow[]>([]);
  const [communityActivity, setCommunityActivity] = useState<CommunityRow[]>([]);
  const [activeRate, setActiveRate] = useState<any>(null);
  // 依頼書 #118: GMV 予測 + 異常検知
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const markAlertRead = async (id: string) => {
    await sb.from("admin_alerts").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [s, sp, lo, np, mr, cc, pb, st, sc, mg, ca, ar, fc, al] = await Promise.all([
          fetchSummary(), fetchPetSpecies(), fetchProfileLocation(), fetchNewUserPace(),
          fetchMemberRatio(), fetchCategoryCount(), fetchPriceBucket(), fetchShippingType(),
          fetchSellingCategory(), fetchMonthlyGmv(), fetchCommunityActivity(), fetchActiveRate(),
          fetchForecast(), fetchUnreadAlerts(),
        ]);
        setSummary(s); setSpecies(sp); setLocations(lo); setNewPace(np);
        setMemberRatio(mr); setCatCount(cc); setPriceBucket(pb); setShippingType(st);
        setSellingCat(sc); setMonthlyGmv(mg); setCommunityActivity(ca); setActiveRate(ar);
        setForecast(fc); setAlerts(al);
      } catch (e) {
        console.warn("AdminAnalytics fetch failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const momChange = useMemo(() => {
    if (!summary) return null;
    if (summary.prev_month_gmv === 0) return summary.current_month_gmv > 0 ? "+∞" : "—";
    const change = ((summary.current_month_gmv - summary.prev_month_gmv) / summary.prev_month_gmv) * 100;
    return (change >= 0 ? "+" : "") + change.toFixed(1) + "%";
  }, [summary]);

  const exportCsv = () => {
    const lines: string[][] = [
      ["セクション", "項目", "値"],
      ["概要", "総会員数", String(summary?.total_users ?? 0)],
      ["概要", "出品数 (approved)", String(summary?.total_listings ?? 0)],
      ["概要", "取引数", String(summary?.total_orders ?? 0)],
      ["概要", "累計GMV", String(summary?.gmv_total ?? 0)],
      ["概要", "平均購入額", String(summary?.avg_purchase ?? 0)],
      ["概要", "リピート率(%)", String(summary?.repeat_rate ?? 0)],
      ["概要", "今月GMV", String(summary?.current_month_gmv ?? 0)],
      ["概要", "先月GMV", String(summary?.prev_month_gmv ?? 0)],
      [],
      ["ユーザー", "ペット種別", "件数"],
      ...species.map(r => ["ユーザー", r.label, String(r.count)]),
      [],
      ["ユーザー", "地域", "件数"],
      ...locations.map(r => ["ユーザー", r.label, String(r.count)]),
      [],
      ["出品", "カテゴリ", "件数"],
      ...catCount.map(r => ["出品", r.label, String(r.count)]),
      [],
      ["出品", "価格帯", "件数"],
      ...priceBucket.map(r => ["出品", r.label, String(r.count)]),
      [],
      ["取引", "月", "GMV"],
      ...monthlyGmv.map(r => ["取引", r.month, String(r.value)]),
      [],
      ["コミュニティ", "コミュニティ名", "メンバー数", "投稿数"],
      ...communityActivity.map(r => ["コミュニティ", r.name, String(r.member_count), String(r.message_count)]),
    ];
    const csv = "﻿" + lines.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date();
    const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    a.download = `qocca_analytics_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPartnerReport = () => {
    const lines: string[] = [];
    lines.push("=== Qocca 提携先用レポート ===");
    lines.push(`生成日: ${new Date().toLocaleDateString("ja-JP")}`);
    lines.push(`データソース: Qocca Production / 集計値のみ (個人情報を含まない)`);
    lines.push("");
    lines.push("■ プラットフォーム概要");
    lines.push(`  登録会員数: ${summary?.total_users ?? 0}名`);
    lines.push(`  累計出品数: ${summary?.total_listings ?? 0}件`);
    lines.push(`  累計取引数: ${summary?.total_orders ?? 0}件`);
    lines.push(`  累計GMV: ¥${(summary?.gmv_total ?? 0).toLocaleString()}`);
    lines.push(`  平均購入額: ¥${(summary?.avg_purchase ?? 0).toLocaleString()}`);
    lines.push(`  リピート率: ${summary?.repeat_rate ?? 0}%`);
    lines.push("");
    lines.push("■ 主要層分析 - ペット種別 (上位5)");
    species.slice(0, 5).forEach(r => lines.push(`  ${r.label}: ${r.count}件`));
    lines.push("");
    lines.push("■ 主要層分析 - 地域 (上位10)");
    locations.slice(0, 10).forEach(r => lines.push(`  ${r.label}: ${r.count}名`));
    lines.push("");
    lines.push("■ 購買傾向 - カテゴリ別出品");
    catCount.forEach(r => lines.push(`  ${r.label}: ${r.count}件`));
    lines.push("");
    lines.push("■ 購買傾向 - 価格帯分布");
    priceBucket.forEach(r => lines.push(`  ${r.label}: ${r.count}件`));
    lines.push("");
    lines.push("■ コミュニティ活性度");
    lines.push(`  アクティブ率(30日): ${activeRate?.active_rate ?? 0}%`);
    lines.push(`  コミュニティ参加率: ${activeRate?.participation_rate ?? 0}%`);
    lines.push(`  フォロー関係総数: ${activeRate?.total_follows ?? 0}件`);
    lines.push("");
    lines.push("=== Qocca - Live with pets. ===");
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date();
    const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    a.download = `qocca_partner_report_${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ background: C.cream, minHeight: "100vh", padding: "24px 12px 60px", fontFamily: "system-ui, -apple-system, sans-serif", color: C.dark }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📊 Qocca Analytics</h1>
            <p style={{ fontSize: 11, color: C.warmGray, margin: "4px 0 0" }}>依頼書 #111 / AI 戦略 Phase 1 / 永続記録 #22 (データ = 企業価値)</p>
          </div>
          <Link to="/admin" style={{ fontSize: 12, color: C.warmGray, textDecoration: "none" }}>← Admin に戻る</Link>
        </div>

        {loading ? (
          <div style={{ background: C.white, borderRadius: 14, padding: 40, textAlign: "center", color: C.warmGray }}>📊 データを集計中…</div>
        ) : (
          <>
            {/* ───── 依頼書 #118: 異常検知アラート (上部・未読のみ) ───── */}
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: C.dark, margin: "0 4px 12px" }}>🚨 アラート ({alerts.length}件)</h2>
              <div style={{ background: C.white, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                {alerts.length === 0 ? (
                  <div style={{ padding: "12px 4px", fontSize: 13, color: C.green, fontWeight: 700 }}>✅ 異常なし</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {alerts.map(a => {
                      const sevColor = a.severity === "critical" ? C.red : a.severity === "warning" ? C.brand : C.blue;
                      const sevBg = a.severity === "critical" ? "#FFEBEE" : a.severity === "warning" ? "#FFF3E0" : "#E3F2FD";
                      const sevIcon = a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟠" : "🔵";
                      return (
                        <div key={a.id} style={{ background: sevBg, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10, borderLeft: `4px solid ${sevColor}` }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>{sevIcon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: sevColor, marginBottom: 2 }}>{a.title}</div>
                            <div style={{ fontSize: 11, color: C.dark, lineHeight: 1.6 }}>{a.description}</div>
                            <div style={{ fontSize: 10, color: C.warmGray, marginTop: 3 }}>{new Date(a.detected_at).toLocaleString("ja-JP")}</div>
                          </div>
                          <button onClick={() => markAlertRead(a.id)} style={{ padding: "4px 8px", background: C.white, color: C.warmGray, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>既読</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* ───── 依頼書 #118: GMV 予測 (ルールベース移動平均) ───── */}
            <Section title="📈 GMV 予測 (今月)" emoji="🔮">
              {!forecast || !forecast.has_enough_data ? (
                <div style={{ padding: "20px 4px", fontSize: 13, color: C.warmGray, lineHeight: 1.8 }}>
                  📈 データ蓄積中 (取引が増えると予測が表示されます)
                  <br />
                  <span style={{ fontSize: 11 }}>※ 直近7日に取引3件以上で予測開始</span>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
                    <Stat label={`当月 GMV 実績 (${forecast.days_elapsed}/${forecast.total_days}日)`} value={`¥${forecast.this_month_gmv.toLocaleString()}`}/>
                    <Stat label="月末着地予測" value={`¥${(forecast.forecast || 0).toLocaleString()}`} hint={`日次平均 ¥${Math.round(forecast.daily_avg_7d || 0).toLocaleString()} × 残${forecast.total_days - forecast.days_elapsed}日`} highlight/>
                    <Stat label="前月日次平均比" value={forecast.mom_change !== null ? `${forecast.mom_change >= 0 ? "+" : ""}${forecast.mom_change.toFixed(1)}%` : "—"} hint={`前月計 ¥${forecast.last_month_gmv.toLocaleString()}`}/>
                  </div>
                  <Block title="日次 GMV 推移 (当月)">
                    <Sparkline items={forecast.daily_series.map(d => ({ month: d.snapshot_date.slice(5), value: d.gmv }))} unit="¥"/>
                  </Block>
                </>
              )}
            </Section>

            {/* 1. 概要サマリ */}
            <Section title="1. 概要サマリ" emoji="🌅">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                <Stat label="総会員数" value={summary?.total_users ?? 0} unit="名"/>
                <Stat label="出品数 (approved)" value={summary?.total_listings ?? 0} unit="件"/>
                <Stat label="取引数" value={summary?.total_orders ?? 0} unit="件"/>
                <Stat label="累計 GMV" value={`¥${(summary?.gmv_total ?? 0).toLocaleString()}`} highlight/>
                <Stat label="平均購入額" value={`¥${(summary?.avg_purchase ?? 0).toLocaleString()}`}/>
                <Stat label="リピート率" value={`${summary?.repeat_rate ?? 0}%`}/>
                <Stat label="今月 GMV" value={`¥${(summary?.current_month_gmv ?? 0).toLocaleString()}`}/>
                <Stat label="先月比" value={momChange ?? "—"} hint={`先月 ¥${(summary?.prev_month_gmv ?? 0).toLocaleString()}`}/>
              </div>
            </Section>

            {/* 2. ユーザー分析 */}
            <Section title="2. ユーザー分析" emoji="🐾">
              <Grid2>
                <Block title="ペット種別">
                  <DonutChart items={species} />
                </Block>
                <Block title="地域分布 (上位 20)">
                  <BarList items={locations} suffix="名"/>
                </Block>
                <Block title="新規登録ペース (月次)">
                  <Sparkline items={newPace}/>
                </Block>
                <Block title="メンバー構成">
                  {memberRatio && (
                    <BarList items={[
                      { label: "創業期住民 (initial)", count: memberRatio.initial },
                      { label: "創業クリエイター", count: memberRatio.founding_creator },
                      { label: "創業期街の首長", count: memberRatio.founding_mayor },
                      { label: "通常会員", count: memberRatio.normal },
                    ]} suffix="名"/>
                  )}
                </Block>
              </Grid2>
            </Section>

            {/* 3. 出品・取引分析 */}
            <Section title="3. 出品・取引分析" emoji="🛍️">
              <Grid2>
                <Block title="カテゴリ別出品数">
                  <BarList items={catCount} suffix="件"/>
                </Block>
                <Block title="価格帯分布">
                  <BarList items={priceBucket} suffix="件"/>
                </Block>
                <Block title="配送タイプ別">
                  <BarList items={shippingType} suffix="件"/>
                </Block>
                <Block title="売れ筋カテゴリ (直近 30日)">
                  {sellingCat.length === 0 ? (
                    <div style={{ fontSize: 12, color: C.warmGray, padding: 12 }}>直近 30日の取引はまだありません。</div>
                  ) : (
                    <BarList items={sellingCat} suffix="件"/>
                  )}
                </Block>
                <Block title="月次 GMV 推移" wide>
                  <Sparkline items={monthlyGmv} unit="¥"/>
                  <table style={{ width: "100%", marginTop: 12, fontSize: 11, borderCollapse: "collapse" }}>
                    <thead><tr><th style={th}>月</th><th style={th}>GMV</th><th style={th}>取引数</th></tr></thead>
                    <tbody>
                      {monthlyGmv.slice().reverse().map(r => (
                        <tr key={r.month}><td style={td}>{r.month}</td><td style={td}>¥{r.value.toLocaleString()}</td><td style={td}>{r.count ?? 0}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </Block>
              </Grid2>
            </Section>

            {/* 4. コミュニティ活性度 */}
            <Section title="4. コミュニティ活性度" emoji="💬">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
                <Stat label="アクティブ率 (30日)" value={`${activeRate?.active_rate ?? 0}%`} hint={`${activeRate?.active_30d ?? 0}/${activeRate?.total ?? 0}`}/>
                <Stat label="フォロー関係総数" value={activeRate?.total_follows ?? 0} unit="件"/>
                <Stat label="コミュニティ参加率" value={`${activeRate?.participation_rate ?? 0}%`} hint={`${activeRate?.community_participants ?? 0}名参加`}/>
              </div>
              <Block title="コミュニティ別アクティブ度 (投稿数 上位 15)">
                {communityActivity.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.warmGray, padding: 12 }}>アクティブなコミュニティがまだありません。</div>
                ) : (
                  <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                    <thead><tr><th style={th}>コミュニティ</th><th style={th}>メンバー</th><th style={th}>投稿数</th></tr></thead>
                    <tbody>
                      {communityActivity.map((r, i) => (
                        <tr key={i}><td style={td}>{r.name}</td><td style={td}>{r.member_count}</td><td style={td}>{r.message_count}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Block>
            </Section>

            {/* 5. 営業用エクスポート */}
            <Section title="5. 営業用エクスポート" emoji="📤">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={exportCsv} style={btnStyle}>
                  📄 全データ CSV ダウンロード
                </button>
                <button onClick={exportPartnerReport} style={{ ...btnStyle, background: C.blue }}>
                  📊 提携先用レポート (TXT)
                </button>
              </div>
              <p style={{ fontSize: 11, color: C.warmGray, marginTop: 12, lineHeight: 1.7 }}>
                ⚠️ 個人情報は含まず、集計値のみです。<br />
                提携営業時にそのまま使える形式 (ペット業界統計・主要層分析・購買傾向)。
              </p>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// プレゼンテーション コンポーネント
// ────────────────────────────────────────────────
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${C.border}`, color: C.warmGray, fontWeight: 700, fontSize: 10 };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: `1px solid ${C.border}` };
const btnStyle: React.CSSProperties = { padding: "10px 18px", background: C.brand, color: C.white, border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 };

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: C.dark, margin: "0 4px 12px" }}>{emoji} {title}</h2>
      <div style={{ background: C.white, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
        {children}
      </div>
    </section>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>{children}</div>;
}

function Block({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ background: C.cream, borderRadius: 10, padding: 14, gridColumn: wide ? "1 / -1" : "auto" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.brandDeep, marginBottom: 10, letterSpacing: "0.04em" }}>{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, unit, highlight, hint }: { label: string; value: string | number; unit?: string; highlight?: boolean; hint?: string }) {
  return (
    <div style={{ background: highlight ? C.brand : C.cream, padding: 12, borderRadius: 10, color: highlight ? C.white : C.dark }}>
      <div style={{ fontSize: 10, color: highlight ? "rgba(255,255,255,0.85)" : C.warmGray, marginBottom: 4, lineHeight: 1.4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "Georgia, serif" }}>
        {value}{unit && <span style={{ fontSize: 11, marginLeft: 3, opacity: 0.7 }}>{unit}</span>}
      </div>
      {hint && <div style={{ fontSize: 10, color: highlight ? "rgba(255,255,255,0.75)" : C.warmGray, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

// 横棒グラフ (max を 100% として塗りつぶす)
function BarList({ items, suffix = "" }: { items: CountRow[]; suffix?: string }) {
  if (items.length === 0) return <div style={{ fontSize: 12, color: C.warmGray, padding: 12 }}>データなし</div>;
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((r, i) => {
        const pct = (r.count / max) * 100;
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: C.dark, fontWeight: 600 }}>{r.label}</span>
              <span style={{ color: C.warmGray }}>{r.count.toLocaleString()}{suffix}</span>
            </div>
            <div style={{ height: 6, background: C.border, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: PALETTE[i % PALETTE.length], borderRadius: 999 }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// SVG ドーナツチャート
function DonutChart({ items }: { items: CountRow[] }) {
  if (items.length === 0) return <div style={{ fontSize: 12, color: C.warmGray, padding: 12 }}>データなし</div>;
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <div style={{ fontSize: 12, color: C.warmGray, padding: 12 }}>データなし</div>;
  const r = 50, cx = 60, cy = 60, sw = 14;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const slices = items.map((it, i) => {
    const frac = it.count / total;
    const len = circumference * frac;
    const slice = (
      <circle
        key={i}
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={PALETTE[i % PALETTE.length]}
        strokeWidth={sw}
        strokeDasharray={`${len} ${circumference - len}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    );
    offset += len;
    return slice;
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        {slices}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontWeight: 700, fill: C.dark }}>{total}</text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
        {items.slice(0, 8).map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: PALETTE[i % PALETTE.length], borderRadius: 2, flexShrink: 0 }}/>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
            <span style={{ color: C.warmGray, fontFamily: "Georgia, serif" }}>{it.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// SVG 折れ線 (スパークライン)
function Sparkline({ items, unit }: { items: MonthlyRow[]; unit?: string }) {
  if (items.length === 0) return <div style={{ fontSize: 12, color: C.warmGray, padding: 12 }}>データなし</div>;
  const W = 280, H = 80, P = 8;
  const max = Math.max(...items.map(i => i.value), 1);
  const pts = items.map((it, i) => {
    const x = P + ((W - 2 * P) * i) / Math.max(items.length - 1, 1);
    const y = H - P - ((H - 2 * P) * it.value) / max;
    return `${x},${y}`;
  });
  const path = "M " + pts.join(" L ");

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <path d={path} stroke={C.brand} strokeWidth={2} fill="none"/>
        {items.map((it, i) => {
          const x = P + ((W - 2 * P) * i) / Math.max(items.length - 1, 1);
          const y = H - P - ((H - 2 * P) * it.value) / max;
          return <circle key={i} cx={x} cy={y} r={2.5} fill={C.brand}/>;
        })}
        <text x={P} y={H - 2} style={{ fontSize: 8, fill: C.warmGray }}>{items[0]?.month}</text>
        <text x={W - P} y={H - 2} textAnchor="end" style={{ fontSize: 8, fill: C.warmGray }}>{items[items.length - 1]?.month}</text>
        <text x={W - P} y={10} textAnchor="end" style={{ fontSize: 8, fill: C.warmGray }}>{unit || ""}{max.toLocaleString()}</text>
      </svg>
    </div>
  );
}

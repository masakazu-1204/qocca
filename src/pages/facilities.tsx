// 施設マップ ページ群 (App.tsx 分割 Phase5 ④facilities)
// facilityDisplayDesc / FacilityMapView(Leaflet) / FacilitiesPage / FacilityDetailView / FacilityVisitForm / FacilityReportModal / FacilityCorrectionForm
// ⚠️ ロジック・参照名は App.tsx 時点から1文字も改変なし (切り取って移動)。地図トグル/もっと見る/safe-area/markercluster/RPCページング 全て無改変。
// ⚠️ Leaflet (L本体+CSS+markercluster) は本モジュール専用のため App.tsx から移設。checkFacilityNGWords(SNS安全) は utils/moderation 参照のみ。

import { useState, useEffect, useRef } from "react";
// 依頼書 U2 (2026/6/13): 施設マップ Leaflet 地図表示 (OSM タイル / 出典表記必須 / react-leaflet 不使用)
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { C } from "../constants/theme";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { FACILITY_CATS, MOOD_TAGS, FACILITY_REPORT_REASONS, PREFS } from "../constants/data";
import { checkFacilityNGWords } from "../utils/moderation";
import { CrowdfundingBanner } from "../components/CrowdfundingBanner";

// 依頼書 #146 Step1 (2026/6/13): 登録番号・出典を画面非表示にする表示用フィルタ
// ⚠️ DB の description は CC-BY の出典保持義務のため削除しない (画面表示のみフィルタ)
// open_data 617件 = 「登録番号: ｜ 出典:」のみ / admin_manual 80件 = 営業情報のみ (混在ゼロを確認済)
const facilityDisplayDesc = (desc) => {
  if (!desc) return "";
  return String(desc)
    .split("\n")
    .filter(line => !/^\s*(登録番号|出典)\s*[:：]/.test(line))
    .join("\n")
    .trim();
};

// 依頼書 U2 (2026/6/13): Leaflet 地図ビュー (OSMタイル + markercluster)
// - 出典表記「© OpenStreetMap contributors」必須 (ライセンス)
// - ピンは divIcon (デフォルト画像のバンドラパス問題回避 + カテゴリ絵文字でデザイン統一)
// - chunkedLoading で 1000 ピンでも描画が固まらない
// - ポップアップは DOM 組み立て (textContent = 施設名/住所の XSS 安全)
const FacilityMapView = ({ facilities, isPC, onSelect, catIcon }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const clusterRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [36.2, 138.25], zoom: 5 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    const cluster = (L as any).markerClusterGroup({ chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 60 });
    map.addLayer(cluster);
    mapRef.current = map;
    clusterRef.current = cluster;
    requestAnimationFrame(() => map.invalidateSize());
    return () => { map.remove(); mapRef.current = null; clusterRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current, cluster = clusterRef.current;
    if (!map || !cluster) return;
    cluster.clearLayers();
    const pts: any[] = [];
    (facilities || []).forEach((f: any) => {
      const lat = Number(f.latitude), lng = Number(f.longitude);
      if (!isFinite(lat) || !isFinite(lng) || f.latitude == null || f.longitude == null || (lat === 0 && lng === 0)) return;
      // 依頼書 #146 Step3 (2026/6/13): 閉店施設はグレーピン + 🚧
      const closed = !!f.is_closed;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 4px;background:${closed ? "#9E9E9E" : "#F5A94A"};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:16px;opacity:${closed ? "0.85" : "1"}">${closed ? "🚧" : catIcon(f.category)}</div>`,
        iconSize: [34, 34], iconAnchor: [17, 32], popupAnchor: [0, -30],
      });
      const m = L.marker([lat, lng], { icon });
      // ポップアップ (DOM 直組み = textContent で安全)
      const pop = document.createElement("div");
      pop.style.cssText = "min-width:170px;font-family:inherit";
      const title = document.createElement("div");
      title.style.cssText = "font-weight:800;font-size:13px;color:#3E2E1E;margin-bottom:3px";
      title.textContent = `${closed ? "🚧" : catIcon(f.category)} ${f.name}${closed ? "（閉店）" : ""}`;
      const addr = document.createElement("div");
      addr.style.cssText = "font-size:11px;color:#8C7B6B;margin-bottom:8px";
      addr.textContent = `📍 ${f.address || f.prefecture || ""}`;
      const btn = document.createElement("button");
      btn.textContent = "詳細を見る →";
      btn.style.cssText = "padding:6px 14px;background:#F5A94A;color:#fff;border:none;border-radius:8px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit";
      btn.onclick = () => onSelect(f);
      pop.appendChild(title); pop.appendChild(addr); pop.appendChild(btn);
      m.bindPopup(pop);
      cluster.addLayer(m);
      pts.push([lat, lng]);
    });
    if (pts.length > 0) {
      map.fitBounds(L.latLngBounds(pts).pad(0.1), { maxZoom: 14 });
    }
  }, [facilities, onSelect, catIcon]);

  return (
    <div ref={containerRef} style={{
      height: isPC ? 560 : "60vh", borderRadius: 16, overflow: "hidden",
      border: `1px solid ${C.border}`, position: "relative", zIndex: 0, isolation: "isolate"
    }}/>
  );
};

export const FacilitiesPage = ({ setPage, isPC }) => {
  const { user } = useAuth();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");
  const [pref, setPref] = useState("");
  // 依頼書 #143 U1 (2026/6/12): 市区町村フィルタ + RPC 50件ページング (1万件対応)
  const [city, setCity] = useState("");
  const [cityOptions, setCityOptions] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name:"", category:"dogrun", address:"", prefecture:"大阪", phone:"", website:"", hours:"", description:"" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);

  // 2026/6/28 軽傷UX: 施設詳細→戻るで /facilities トップ全飛ばしせず1段戻る (petwalker PR#60 と同パターン)。
  //   pushState で履歴に印を積み、popstate で印を見て selectedFacility=null。React Router 設定不変・本ファイル内に閉じる。
  const FAC_DETAIL_MARK = "facility_detail";
  const openFacility = (f: any) => {
    setSelectedFacility(f);
    window.history.pushState({ [FAC_DETAIL_MARK]: f?.id || true }, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const closeFacility = () => {
    const marker = (window.history.state as { [k: string]: unknown } | null)?.[FAC_DETAIL_MARK];
    if (marker) {
      window.history.back(); // popstate ハンドラで selectedFacility=null
    } else {
      setSelectedFacility(null);
    }
    loadFacilities(true);
  };
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const marker = (e.state as { [k: string]: unknown } | null)?.[FAC_DETAIL_MARK];
      if (!marker) setSelectedFacility(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // 依頼書 U2 (2026/6/13): 地図↔リスト切替 + 地図用データ (リストの50件ページングとは独立)
  const [viewMode, setViewMode] = useState("list");
  const [mapFacilities, setMapFacilities] = useState<any[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const MAP_LIMIT = 1000; // 1万件対応: 上限1000ピン + クラスタ (超過時は絞り込み誘導)

  // 依頼書 #28 Phase 1 UI: 検索バー state
  const [searchInput, setSearchInput] = useState("");          // ユーザー入力中
  const [searchQuery, setSearchQuery] = useState("");          // デバウンス後の実行クエリ
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [searchInProgress, setSearchInProgress] = useState(false);

  // localStorage から検索履歴ロード
  useEffect(() => {
    try {
      const raw = localStorage.getItem("qocca_facility_search_history");
      if (raw) setSearchHistory(JSON.parse(raw).slice(0, 8));
    } catch (_) {}
  }, []);

  // デバウンス 300ms
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // 履歴に追加 (実行時)
  const pushHistory = (q: string) => {
    if (!q || q.length < 1) return;
    setSearchHistory(prev => {
      const next = [q, ...prev.filter(x => x !== q)].slice(0, 8);
      try { localStorage.setItem("qocca_facility_search_history", JSON.stringify(next)); } catch (_) {}
      return next;
    });
  };

  // 依頼書 #143 U1 (2026/6/12): 取得を search_facilities RPC に一本化 + 50件ページング
  // (旧 fetchFacilities の全件ロードを廃止 = 1万件でも落ちない / カテゴリ絞込も RPC 側へ)
  const PAGE_SIZE = 50;
  const loadFacilities = async (reset: boolean, baseList: any[] = []) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    if (searchQuery) setSearchInProgress(true);
    const { data, error } = await supabase.rpc("search_facilities", {
      query_text: searchQuery || null,
      filter_category: cat !== "all" ? [cat] : null,
      filter_prefecture: pref || null,
      filter_city: city || null,
      filter_pet_type: null,
      filter_pet_size: null,
      filter_region: null,
      sort_mode: "relevance",
      result_limit: PAGE_SIZE,
      result_offset: reset ? 0 : baseList.length,
    });
    if (!error) {
      const rows = data || [];
      setFacilities(reset ? rows : [...baseList, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      if (reset && searchQuery) pushHistory(searchQuery);
    }
    setLoading(false); setLoadingMore(false); setSearchInProgress(false);
  };

  // 検索・絞り込み変更で先頭から再取得
  useEffect(() => {
    loadFacilities(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, pref, city, cat]);

  // 依頼書 U2 (2026/6/13): 地図モード時のみ地図用データ取得 (同フィルタ / 上限1000 / last-wins ガード)
  useEffect(() => {
    if (viewMode !== "map") return;
    let cancelled = false;
    (async () => {
      setMapLoading(true);
      const { data, error } = await supabase.rpc("search_facilities", {
        query_text: searchQuery || null,
        filter_category: cat !== "all" ? [cat] : null,
        filter_prefecture: pref || null,
        filter_city: city || null,
        filter_pet_type: null,
        filter_pet_size: null,
        filter_region: null,
        sort_mode: "relevance",
        result_limit: MAP_LIMIT,
        result_offset: 0,
      });
      if (!cancelled) {
        if (!error) setMapFacilities(data || []);
        setMapLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, searchQuery, pref, city, cat]);

  // 都道府県変更 → 市区町村リセット + 選択肢取得 (DB側 distinct / 全件ロードしない)
  useEffect(() => {
    setCity("");
    if (!pref) { setCityOptions([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("facility_city_options", { p_prefecture: pref });
      if (!cancelled) setCityOptions(data || []);
    })();
    return () => { cancelled = true; };
  }, [pref]);

  const filtered = facilities; // カテゴリ絞込は RPC 側に移管 (client filter 廃止)
  const hasActiveFilter = !!(searchQuery || pref || city || cat !== "all");

  const handleSubmitFacility = async () => {
    if (!user || !addForm.name || !addForm.address) return;
    setSubmitting(true);
    await supabase.from("pet_facilities").insert({
      ...addForm,
      submitted_by: user.id,
      approved: false,
    });
    setSubmitting(false);
    setSubmitted(true);
    setShowAdd(false);
    setAddForm({ name:"", category:"dogrun", address:"", prefecture:"大阪", phone:"", website:"", hours:"", description:"" });
  };

  const catIcon = (c) => FACILITY_CATS.find(fc => fc.id === c)?.icon || "🐾";
  const catLabel = (c) => FACILITY_CATS.find(fc => fc.id === c)?.label || c;

  if (selectedFacility) {
    return <FacilityDetailView facility={selectedFacility} onBack={closeFacility} isPC={isPC} setPage={setPage} catIcon={catIcon} catLabel={catLabel}/>;
  }

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, paddingBottom: isPC ? 0 : "calc(80px + env(safe-area-inset-bottom, 0px))", minHeight:"100vh", background:C.cream }}>
      <div style={{ padding:"20px 16px 12px", background:C.white, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:4 }}>🐕 ペット施設マップ</h1>
            <p style={{ fontSize:12, color:C.warmGray }}>みんなのリアルな訪問レポートをチェック</p>
          </div>
          {user && (
            <button onClick={()=>setShowAdd(true)} style={{
              padding:"10px 14px", background:C.orange, border:"none", borderRadius:12,
              color:"#fff", fontWeight:800, fontSize:12, cursor:"pointer"
            }}>＋ 施設を追加</button>
          )}
        </div>

        {/* 依頼書 #28 Phase 1 UI: 検索バー (TSVECTOR + pg_trgm 連動) */}
        <div style={{ marginTop:12, position:"relative" }}>
          <div style={{
            display:"flex", alignItems:"center", gap:8,
            padding:"10px 14px", background:C.cream, borderRadius:14,
            border:`1.5px solid ${searchInput ? C.orange : C.border}`,
            transition:"border-color 0.2s"
          }}>
            <span style={{ fontSize:16, color:C.warmGray, flexShrink:0 }}>🔍</span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              placeholder={'「梅田 カフェ」「東京 ドッグラン」で検索...'}
              style={{
                flex:1, border:"none", outline:"none", background:"transparent",
                fontSize:14, fontFamily:"inherit", color:C.dark, minWidth:0
              }}
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(""); setSearchQuery(""); }}
                style={{
                  background:"none", border:"none", cursor:"pointer", color:C.warmGray,
                  fontSize:16, padding:"0 4px", lineHeight:1, fontFamily:"inherit"
                }}
                aria-label="クリア"
              >✕</button>
            )}
            {searchInProgress && (
              <span style={{ fontSize:11, color:C.warmGray }}>検索中…</span>
            )}
          </div>

          {/* 検索履歴ドロップダウン */}
          {showHistory && !searchInput && searchHistory.length > 0 && (
            <div style={{
              position:"absolute", top:"100%", left:0, right:0, marginTop:6,
              background:C.white, borderRadius:12, border:`1px solid ${C.border}`,
              boxShadow:"0 4px 16px rgba(0,0,0,0.08)", zIndex:50,
              padding:"6px 0", maxHeight:240, overflowY:"auto"
            }}>
              <div style={{ padding:"4px 14px", fontSize:11, color:C.warmGray, fontWeight:700 }}>
                最近の検索
              </div>
              {searchHistory.map((h) => (
                <button
                  key={h}
                  onMouseDown={(e) => { e.preventDefault(); setSearchInput(h); }}
                  style={{
                    width:"100%", padding:"8px 14px", background:"transparent", border:"none",
                    textAlign:"left", cursor:"pointer", fontSize:13, color:C.dark,
                    fontFamily:"inherit", display:"flex", alignItems:"center", gap:8
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.cream)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ color:C.warmGray, fontSize:12 }}>🕐</span>
                  <span>{h}</span>
                </button>
              ))}
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSearchHistory([]);
                  try { localStorage.removeItem("qocca_facility_search_history"); } catch (_) {}
                }}
                style={{
                  width:"100%", padding:"8px 14px", background:"transparent", border:"none",
                  textAlign:"left", cursor:"pointer", fontSize:11, color:C.warmGray,
                  fontFamily:"inherit", borderTop:`1px solid ${C.border}`, marginTop:4
                }}
              >履歴をクリア</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding:"10px 16px", background:C.white, borderBottom:`1px solid ${C.border}`, display:"flex", gap:8, overflowX:"auto" }}>
        {FACILITY_CATS.map(c => (
          <button key={c.id} onClick={()=>setCat(c.id)} style={{
            flexShrink:0, padding:"6px 12px", display:"flex", alignItems:"center", gap:4,
            background:cat===c.id?C.orange:C.white, color:cat===c.id?"#fff":C.warmGray,
            border:`1.5px solid ${cat===c.id?C.orange:C.border}`, borderRadius:20,
            fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
          }}><span>{c.icon}</span><span style={{ whiteSpace:"nowrap" }}>{c.label}</span></button>
        ))}
      </div>
      <div style={{ padding:"8px 16px", background:C.white, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", flexWrap:"wrap", rowGap:6 }}>
        <select value={pref} onChange={e=>setPref(e.target.value)} style={{
          padding:"8px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13,
          fontFamily:"inherit", outline:"none", background:C.white, color:C.dark
        }}>
          <option value="">📍 全国</option>
          {PREFS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {/* 依頼書 #143 U1: 市区町村ドロップダウン (都道府県選択時のみ / 食べログ式の2段階エリア) */}
        {pref && cityOptions.length > 0 && (
          <select value={city} onChange={e=>setCity(e.target.value)} style={{
            marginLeft:8, padding:"8px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13,
            fontFamily:"inherit", outline:"none", background:C.white, color:C.dark, maxWidth:180
          }}>
            <option value="">🏘 市区町村: すべて</option>
            {cityOptions.map((c:any) => <option key={c.city} value={c.city}>{c.city} ({c.cnt})</option>)}
          </select>
        )}
        <span style={{ marginLeft:12, fontSize:12, color:C.warmGray }}>
          {searchQuery
            ? <>🔎 「{searchQuery}」: <b style={{ color:C.dark }}>{filtered.length}{hasMore ? "+" : ""}</b>件</>
            : <>{filtered.length}{hasMore ? "+" : ""}件の施設</>}
        </span>
        {/* 依頼書 U2 (2026/6/13): 地図↔リスト切替トグル */}
        <div style={{ marginLeft:"auto", flexShrink:0, display:"flex", border:`1.5px solid ${C.border}`, borderRadius:10, overflow:"hidden" }}>
          {[["list","📋 リスト"],["map","🗺️ 地図"]].map(([mode, label]) => (
            <button key={mode} onClick={()=>setViewMode(mode)} style={{
              padding:"6px 12px", background:viewMode===mode?C.orange:C.white,
              color:viewMode===mode?"#fff":C.warmGray, border:"none",
              fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit"
            }}>{label}</button>
          ))}
        </div>
      </div>

      {showAdd && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:440, width:"100%", maxHeight:"88vh", overflow:"auto", WebkitOverflowScrolling:"touch" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>🐕 施設を追加</h2>
              <button onClick={()=>setShowAdd(false)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
            </div>
            <p style={{ fontSize:11, color:C.warmGray, marginBottom:16 }}>投稿後、運営の審査を経て公開されます</p>
            {[
              ["施設名", "name", "text", "例：わんわんパーク大阪"],
              ["住所", "address", "text", "例：大阪市北区..."],
              ["電話番号", "phone", "tel", "06-1234-5678"],
              ["公式サイト", "website", "url", "https://..."],
              ["営業時間", "hours", "text", "10:00〜18:00"],
            ].map(([label, key, type, ph]) => (
              <div key={key} style={{ marginBottom:12 }}>
                <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:4 }}>{label}</label>
                <input type={type} value={addForm[key]} onChange={e=>setAddForm({...addForm, [key]: e.target.value})} placeholder={ph} style={{
                  width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
                  fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box"
                }}/>
              </div>
            ))}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:4 }}>カテゴリ</label>
              <select value={addForm.category} onChange={e=>setAddForm({...addForm, category: e.target.value})} style={{
                width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
                fontSize:13, fontFamily:"inherit", outline:"none", background:C.white, boxSizing:"border-box"
              }}>
                {FACILITY_CATS.filter(c=>c.id!=="all").map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:4 }}>都道府県</label>
              <select value={addForm.prefecture} onChange={e=>setAddForm({...addForm, prefecture: e.target.value})} style={{
                width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
                fontSize:13, fontFamily:"inherit", outline:"none", background:C.white, boxSizing:"border-box"
              }}>
                {PREFS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:4 }}>説明</label>
              <textarea value={addForm.description} onChange={e=>setAddForm({...addForm, description: e.target.value})} rows={3} placeholder="施設の特徴や魅力を教えてください" style={{
                width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
                fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box"
              }}/>
            </div>
            <button disabled={!user || !addForm.name || !addForm.address || submitting} onClick={handleSubmitFacility} style={{
              width:"100%", padding:"13px", background:(!user || !addForm.name || !addForm.address || submitting)?C.warmGray:C.orange,
              border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14,
              cursor:(!user || !addForm.name || !addForm.address || submitting)?"not-allowed":"pointer", fontFamily:"inherit"
            }}>{submitting ? "送信中..." : "🐕 投稿する"}</button>
          </div>
        </div>
      )}

      {submitted && (
        <div style={{ position:"fixed", top:80, left:"50%", transform:"translateX(-50%)", background:C.green, color:"#fff", padding:"12px 24px", borderRadius:12, zIndex:400, fontWeight:800, fontSize:13 }}>
          ✅ 投稿ありがとうございます！審査後に公開されます
        </div>
      )}

      {/* 依頼書 #11 #2 (5/25): CrowdfundingBanner 再利用 (FacilitiesPage 版) */}
      <CrowdfundingBanner />

      {/* 依頼書 U2 (2026/6/13): 地図表示 (リスト側 JSX は無変更でラップのみ) */}
      {viewMode === "map" ? (
        <div style={{ padding:16 }}>
          {mapLoading && (
            <div style={{ textAlign:"center", padding:"8px 0", color:C.warmGray, fontSize:12 }}>🗺️ 地図データ読み込み中...</div>
          )}
          <FacilityMapView facilities={mapFacilities} isPC={isPC} onSelect={openFacility} catIcon={catIcon}/>
          {!mapLoading && (() => {
            const noCoords = mapFacilities.filter((f) => f.latitude == null || f.longitude == null).length;
            return (
              <div style={{ marginTop:8, fontSize:11, color:C.warmGray, lineHeight:1.7 }}>
                <div>🗺️ 地図上のピン: {mapFacilities.length - noCoords}件{mapFacilities.length >= MAP_LIMIT ? `（表示上限${MAP_LIMIT}件に達しています。エリアやカテゴリで絞り込むと全件表示されます）` : ""}</div>
                {noCoords > 0 && <div>📍 座標未登録の施設 {noCoords}件 は地図に表示されません。リスト表示でご確認ください。</div>}
              </div>
            );
          })()}
        </div>
      ) : (
      <div style={{ padding:"16px" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:40, color:C.warmGray }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          /* 依頼書 #11 #5 (5/25): 空状態 温度感UP - 「住民が見つけた場所」温度 */
          <div style={{ textAlign:"center", padding:"60px 24px" }}>
            <div style={{ fontSize:56, marginBottom:14, opacity:0.85 }}>🐕</div>
            <div style={{ fontSize:17, fontWeight:700, color:C.dark, marginBottom:10, letterSpacing:0.2 }}>
              {!hasActiveFilter
                ? "街の住民が見つけた場所が、ここに集まります"
                : "該当する施設がまだ見つかりません"}
            </div>
            <p style={{ fontSize:12.5, color:C.warmGray, lineHeight:1.9, marginBottom:24, maxWidth:400, margin:"0 auto 24px" }}>
              {!hasActiveFilter ? (
                <>
                  ドッグラン、動物病院、ペット同伴カフェ、トリミング——<br/>
                  あなたが「ここよかったよ」と思った場所を、そっと共有してや🌅
                </>
              ) : (
                <>
                  フィルターを変えてみるか、<br/>
                  別の場所も覗いてみてくださいね。
                </>
              )}
            </p>
            {user && !hasActiveFilter && (
              <button
                onClick={()=>setShowAdd(true)}
                style={{ padding:"11px 26px", background:"transparent", border:`1.5px solid ${C.orange}`, borderRadius:22, color:C.orange, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}
                onMouseEnter={(e)=>{(e.target as HTMLButtonElement).style.background = C.orangePale;}}
                onMouseLeave={(e)=>{(e.target as HTMLButtonElement).style.background = "transparent";}}
              >
                ＋ 場所をそっと置く →
              </button>
            )}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns: isPC ? "repeat(2, 1fr)" : "1fr", gap:12 }}>
            {filtered.map(f => (
              <div key={f.id} onClick={()=>openFacility(f)} style={{
                background:C.white, borderRadius:16, padding:"16px", border:`1px solid ${C.border}`,
                boxShadow:"0 2px 8px rgba(0,0,0,0.04)", cursor:"pointer", transition:"transform 0.15s"
              }} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                    {catIcon(f.category)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:800, color:C.dark, marginBottom:4 }}>{f.name}</div>
                    <div style={{ fontSize:11, color:C.warmGray, marginBottom:2 }}>📍 {f.address}</div>
                    {f.hours && <div style={{ fontSize:11, color:C.warmGray, marginBottom:2 }}>🕐 {f.hours}</div>}
                    <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
                      {/* 依頼書 #146 Step3 (2026/6/13): 閉店バッジ (承認済の閉店報告) */}
                      {f.is_closed && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:"#FFEBEE", color:"#C62828", fontWeight:800 }}>🚧 閉店</span>}
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.orangePale, color:C.orange, fontWeight:700 }}>{catLabel(f.category)}</span>
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.lightGray, color:C.warmGray, fontWeight:700 }}>{f.prefecture}</span>
                      {(f.review_count > 0) && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:"#E8F5E9", color:C.green, fontWeight:700 }}>📝 {f.review_count}件のレポート</span>}
                    </div>
                  </div>
                </div>
                {/* 依頼書 #146 Step1 (2026/6/13): 一覧カードも登録番号・出典を非表示 (詳細と同フィルタ) */}
                {(() => { const d = facilityDisplayDesc(f.description); return d ? <div style={{ fontSize:12, color:"#666", lineHeight:1.6, marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>{d.length > 80 ? d.slice(0,80)+"..." : d}</div> : null; })()}
                <div style={{ marginTop:10, fontSize:11, color:C.orange, fontWeight:700 }}>タップして詳細を見る →</div>
              </div>
            ))}
          </div>
        )}
        {/* 依頼書 #143 U1: 50件ページング「もっと見る」 (直近フェッチが PAGE_SIZE 件 = 続きあり) */}
        {!loading && hasMore && filtered.length > 0 && (
          <div style={{ textAlign:"center", marginTop:16 }}>
            <button onClick={()=>loadFacilities(false, facilities)} disabled={loadingMore} style={{
              padding:"11px 28px", background:C.white, border:`1.5px solid ${C.orange}`, borderRadius:22,
              color:C.orange, fontWeight:800, fontSize:13, cursor: loadingMore ? "wait" : "pointer", fontFamily:"inherit"
            }}>{loadingMore ? "読み込み中..." : "もっと見る ▼"}</button>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

const FacilityDetailView = ({ facility, onBack, isPC, setPage, catIcon, catLabel }) => {
  const { user } = useAuth();
  const [visits, setVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);

  const fetchVisits = async () => {
    setLoadingVisits(true);
    const { data, error } = await supabase
      .from("facility_visits")
      .select("*")
      .eq("facility_id", facility.id)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      const userIds = [...new Set(data.map(v => v.user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds);
        const profMap = {};
        (profs || []).forEach(p => { profMap[p.id] = p; });
        const enriched = data.map(v => ({
          ...v,
          authorName: profMap[v.user_id]?.display_name || "匿名",
          authorAvatar: profMap[v.user_id]?.avatar_url || "",
        }));
        setVisits(enriched);
      } else {
        setVisits(data);
      }
    }
    setLoadingVisits(false);
  };

  useEffect(() => { fetchVisits(); }, [facility.id]);

  const moodLabel = (id) => MOOD_TAGS.find(m => m.id === id)?.label || id;
  const moodIcon = (id) => MOOD_TAGS.find(m => m.id === id)?.icon || "🐾";

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      <div style={{ padding:"16px", background:C.white, borderBottom:`1px solid ${C.border}`, position:"sticky", top:isPC?0:60, zIndex:50 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:8, padding:0, fontFamily:"inherit" }}>← 一覧に戻る</button>
        <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
          <div style={{ width:56, height:56, borderRadius:14, background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>
            {catIcon(facility.category)}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <h1 style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:4 }}>{facility.name}</h1>
            <div style={{ fontSize:11, color:C.warmGray, marginBottom:2 }}>📍 {facility.address}</div>
            {facility.hours && <div style={{ fontSize:11, color:C.warmGray, marginBottom:2 }}>🕐 {facility.hours}</div>}
            {facility.phone && <div style={{ fontSize:11, color:C.warmGray, marginBottom:2 }}>📞 {facility.phone}</div>}
            <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
              {/* 依頼書 #146 Step3 (2026/6/13): 閉店バッジ (承認済の閉店報告) */}
              {facility.is_closed && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:"#FFEBEE", color:"#C62828", fontWeight:800 }}>🚧 閉店</span>}
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.orangePale, color:C.orange, fontWeight:700 }}>{catLabel(facility.category)}</span>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.lightGray, color:C.warmGray, fontWeight:700 }}>{facility.prefecture}</span>
              {(facility.review_count > 0) && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:"#E8F5E9", color:C.green, fontWeight:700 }}>📝 {facility.review_count}件のレポート</span>}
            </div>
          </div>
        </div>
        {/* 依頼書 #146 Step1 (2026/6/13): 登録番号・出典は非表示 (DB保持・表示のみフィルタ) */}
        {facilityDisplayDesc(facility.description) && <div style={{ fontSize:12, color:"#666", lineHeight:1.7, marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}`, whiteSpace:"pre-wrap" }}>{facilityDisplayDesc(facility.description)}</div>}
        {facility.website && <a href={facility.website} target="_blank" rel="noopener noreferrer" style={{ display:"inline-block", marginTop:8, fontSize:12, color:C.blue, fontWeight:700 }}>🔗 ウェブサイトを見る</a>}
        <button onClick={()=>setShowCorrectionForm(true)} style={{ display:"block", marginTop:8, fontSize:11, color:C.warmGray, background:"none", border:"none", cursor:"pointer", padding:0, textDecoration:"underline", fontFamily:"inherit" }}>この情報を訂正する</button>
      </div>

      <div style={{ padding:"16px" }}>
        {user ? (
          <button onClick={()=>setShowVisitForm(true)} style={{
            width:"100%", padding:"14px", background:C.orange, border:"none", borderRadius:12,
            color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit",
            boxShadow:"0 4px 12px rgba(245, 169, 74, 0.3)"
          }}>📝 訪問レポートを投稿する</button>
        ) : (
          <button onClick={()=>setPage("login")} style={{
            width:"100%", padding:"14px", background:C.white, border:`1.5px solid ${C.orange}`, borderRadius:12,
            color:C.orange, fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit"
          }}>🔒 ログインしてレポートを投稿</button>
        )}
      </div>

      <div style={{ padding:"0 16px 80px" }}>
        <h2 style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:12 }}>🐾 みんなの訪問レポート</h2>
        {loadingVisits ? (
          <div style={{ textAlign:"center", padding:40, color:C.warmGray }}>読み込み中...</div>
        ) : visits.length === 0 ? (
          <div style={{ background:C.white, borderRadius:16, padding:"40px 20px", border:`1px dashed ${C.border}`, textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🐾</div>
            <div style={{ fontSize:13, color:C.warmGray, lineHeight:1.7 }}>まだレポートがありません<br/>最初のレポート投稿者になりませんか？</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {visits.map(v => (
              <div key={v.id} style={{ background:C.white, borderRadius:16, padding:"14px 16px", border:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <div style={{ width:32, height:32, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", fontSize:14 }}>
                    {v.authorAvatar ? <img src={v.authorAvatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : "🐾"}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.dark }}>{v.authorName}</div>
                    <div style={{ fontSize:10, color:C.warmGray }}>
                      {v.visited_at ? `${new Date(v.visited_at).toLocaleDateString("ja-JP")}に訪問` : new Date(v.created_at).toLocaleDateString("ja-JP")}
                    </div>
                  </div>
                  {user && user.id !== v.user_id && (
                    <button onClick={()=>setReportTarget(v)} style={{ background:"none", border:"none", color:C.warmGray, fontSize:11, cursor:"pointer", fontFamily:"inherit", padding:"4px 8px" }}>⚠ 通報</button>
                  )}
                </div>
                {Array.isArray(v.mood_tags) && v.mood_tags.length > 0 && (
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:v.comment?8:0 }}>
                    {v.mood_tags.map(t => (
                      <span key={t} style={{ fontSize:11, padding:"4px 10px", borderRadius:12, background:C.cream, color:C.dark, fontWeight:700 }}>
                        {moodIcon(t)} {moodLabel(t)}
                      </span>
                    ))}
                  </div>
                )}
                {v.comment && (
                  <div style={{ fontSize:13, color:C.dark, lineHeight:1.7, whiteSpace:"pre-wrap" }}>{v.comment}</div>
                )}
                {Array.isArray(v.photo_urls) && v.photo_urls.length > 0 && (
                  <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(v.photo_urls.length, 3)}, 1fr)`, gap:6, marginTop:10 }}>
                    {v.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" style={{ width:"100%", aspectRatio:"1/1", objectFit:"cover", borderRadius:10 }}/>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showVisitForm && (
        <FacilityVisitForm
          facility={facility}
          user={user}
          onClose={()=>setShowVisitForm(false)}
          onSubmitted={()=>{ setShowVisitForm(false); fetchVisits(); }}
        />
      )}

      {reportTarget && (
        <FacilityReportModal
          visit={reportTarget}
          user={user}
          onClose={()=>setReportTarget(null)}
          onSubmitted={()=>{ setReportTarget(null); fetchVisits(); }}
        />
      )}

      {showCorrectionForm && (
        <FacilityCorrectionForm
          facility={facility}
          user={user}
          onClose={()=>setShowCorrectionForm(false)}
        />
      )}
    </div>
  );
};

const FacilityVisitForm = ({ facility, user, onClose, onSubmitted }) => {
  const [selectedMoods, setSelectedMoods] = useState([]);
  const [comment, setComment] = useState("");
  const [visitedAt, setVisitedAt] = useState("");
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef(null);

  const toggleMood = (id) => {
    setSelectedMoods(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - photoFiles.length);
    if (files.length === 0) return;
    const newFiles = [...photoFiles, ...files].slice(0, 3);
    setPhotoFiles(newFiles);
    const previews = newFiles.map(f => URL.createObjectURL(f));
    setPhotoPreviews(previews);
  };

  const removePhoto = (idx) => {
    const newFiles = photoFiles.filter((_, i) => i !== idx);
    const newPreviews = photoPreviews.filter((_, i) => i !== idx);
    setPhotoFiles(newFiles);
    setPhotoPreviews(newPreviews);
  };

  const handleSubmitClick = () => {
    setError("");
    if (selectedMoods.length === 0 && !comment.trim() && photoFiles.length === 0) {
      setError("気分タグ・コメント・写真のいずれかを入力してください");
      return;
    }
    const ngWord = checkFacilityNGWords(comment);
    if (ngWord) {
      setError(`不適切な表現が含まれています: 「${ngWord}」\n他の方を傷つけない表現でお願いします`);
      return;
    }
    if (comment.length > 1000) {
      setError("コメントは1000文字以内でお願いします");
      return;
    }
    setConfirming(true);
  };

  const handleConfirmSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    setError("");

    let photoUrls = [];
    for (let i = 0; i < photoFiles.length; i++) {
      const f = photoFiles[i];
      const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${facility.id}_${Date.now()}_${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from("facility-photos").upload(path, f);
      if (upErr) {
        setError(`写真のアップロードに失敗しました: ${upErr.message}`);
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("facility-photos").getPublicUrl(path);
      photoUrls.push(urlData.publicUrl);
    }

    const { error: insErr } = await supabase.from("facility_visits").insert({
      facility_id: facility.id,
      user_id: user.id,
      mood_tags: selectedMoods,
      comment: comment.trim() || null,
      visited_at: visitedAt || null,
      photo_urls: photoUrls,
    });

    if (insErr) {
      setError(`投稿に失敗しました: ${insErr.message}`);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSubmitted();
  };

  if (confirming) {
    return (
      <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
        <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:400, width:"100%" }}>
          <div style={{ fontSize:40, textAlign:"center", marginBottom:12 }}>🐾</div>
          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, textAlign:"center", marginBottom:12 }}>投稿前に最終確認</h2>
          <div style={{ background:C.cream, borderRadius:12, padding:"14px", fontSize:12, color:C.dark, lineHeight:1.7, marginBottom:16 }}>
            ✅ 他の人を傷つけない内容ですか？<br/>
            ✅ 個人を特定できる情報は含まれていませんか？<br/>
            ✅ 事実に基づいた内容ですか？<br/>
            <br/>
            <span style={{ color:C.warmGray, fontSize:11 }}>※ 通報が3件以上集まると自動的に非表示になります</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setConfirming(false)} disabled={submitting} style={{ flex:1, padding:"12px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:submitting?"not-allowed":"pointer", fontFamily:"inherit" }}>戻って修正</button>
            <button onClick={handleConfirmSubmit} disabled={submitting} style={{ flex:2, padding:"12px", background:submitting?C.warmGray:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:submitting?"not-allowed":"pointer", fontFamily:"inherit" }}>{submitting ? "投稿中..." : "🐾 投稿する"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:480, width:"100%", maxHeight:"88vh", overflow:"auto", WebkitOverflowScrolling:"touch" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>📝 訪問レポート</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
        </div>
        <p style={{ fontSize:11, color:C.warmGray, marginBottom:14 }}>{facility.name} のレポート</p>

        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:8 }}>あなたの体験は？(複数選択可)</label>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {MOOD_TAGS.map(t => (
              <button key={t.id} onClick={()=>toggleMood(t.id)} style={{
                padding:"6px 12px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                background: selectedMoods.includes(t.id) ? C.orange : C.white,
                color: selectedMoods.includes(t.id) ? "#fff" : C.dark,
                border:`1.5px solid ${selectedMoods.includes(t.id) ? C.orange : C.border}`,
              }}>{t.icon} {t.label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>訪問日(任意)</label>
          <input type="date" value={visitedAt} onChange={e=>setVisitedAt(e.target.value)} max={new Date().toISOString().split("T")[0]} style={{
            padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
            fontSize:13, fontFamily:"inherit", outline:"none"
          }}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>コメント(任意・1000文字以内)</label>
          <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={4} placeholder="うちの子の様子、おすすめポイントを教えてね 🐾" maxLength={1000} style={{
            width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
            fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box"
          }}/>
          <div style={{ fontSize:10, color:C.warmGray, textAlign:"right", marginTop:4 }}>{comment.length}/1000</div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>写真(任意・最大3枚)</label>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotoSelect} style={{ display:"none" }}/>
          {photoPreviews.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:6, marginBottom:8 }}>
              {photoPreviews.map((src, i) => (
                <div key={i} style={{ position:"relative" }}>
                  <img src={src} alt="" style={{ width:"100%", aspectRatio:"1/1", objectFit:"cover", borderRadius:10 }}/>
                  <button onClick={()=>removePhoto(i)} style={{ position:"absolute", top:4, right:4, width:24, height:24, borderRadius:"50%", background:"rgba(0,0,0,0.6)", color:"#fff", border:"none", cursor:"pointer", fontSize:12 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          {photoFiles.length < 3 && (
            <button onClick={()=>fileRef.current?.click()} style={{
              width:"100%", padding:"20px", border:`2px dashed ${C.border}`, borderRadius:12,
              background:C.lightGray, cursor:"pointer", color:C.warmGray, fontSize:13, fontFamily:"inherit"
            }}>📷 写真を追加(残り{3 - photoFiles.length}枚)</button>
          )}
        </div>

        {error && <div style={{ background:"#FFEBEE", color:C.red, padding:"10px 12px", borderRadius:10, fontSize:12, marginBottom:12, whiteSpace:"pre-wrap" }}>{error}</div>}

        <div style={{ background:"#FFF8E1", borderRadius:10, padding:"10px 12px", fontSize:11, color:"#5D4037", lineHeight:1.7, marginBottom:14 }}>
          📜 投稿は<a href="https://qocca.pet/terms" target="_blank" rel="noopener noreferrer" style={{ color:C.orange, fontWeight:700 }}>利用規約</a>に従い、誹謗中傷や個人を特定できる情報は禁止です
        </div>

        <button onClick={handleSubmitClick} style={{
          width:"100%", padding:"14px", background:C.orange, border:"none", borderRadius:12,
          color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit"
        }}>確認画面へ →</button>
      </div>
    </div>
  );
};

const FacilityReportModal = ({ visit, user, onClose, onSubmitted }) => {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!user || !reason) return;
    setSubmitting(true);
    setError("");
    const { error: insErr } = await supabase.from("facility_visit_reports").insert({
      visit_id: visit.id,
      reporter_id: user.id,
      reason,
      detail: detail.trim() || null,
    });
    if (insErr) {
      if (insErr.message.includes("duplicate") || insErr.code === "23505") {
        setError("この投稿は既に通報済みです");
      } else {
        setError(`通報に失敗しました: ${insErr.message}`);
      }
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    alert("通報を受け付けました。確認後、運営が対応します。");
    onSubmitted();
  };

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:400, width:"100%" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark }}>⚠ 通報する</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:8 }}>通報理由</label>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {FACILITY_REPORT_REASONS.map(r => (
              <label key={r.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", border:`1.5px solid ${reason===r.id?C.orange:C.border}`, borderRadius:10, cursor:"pointer", background:reason===r.id?C.orangePale:C.white }}>
                <input type="radio" name="reason" value={r.id} checked={reason===r.id} onChange={e=>setReason(e.target.value)}/>
                <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{r.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>詳細(任意)</label>
          <textarea value={detail} onChange={e=>setDetail(e.target.value)} rows={3} maxLength={500} placeholder="補足情報があれば記入してください" style={{
            width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
            fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box"
          }}/>
        </div>
        {error && <div style={{ background:"#FFEBEE", color:C.red, padding:"10px 12px", borderRadius:10, fontSize:12, marginBottom:12 }}>{error}</div>}
        <button onClick={handleSubmit} disabled={!reason || submitting} style={{
          width:"100%", padding:"12px", background:(!reason||submitting)?C.warmGray:C.red, border:"none", borderRadius:12,
          color:"#fff", fontWeight:800, fontSize:14, cursor:(!reason||submitting)?"not-allowed":"pointer", fontFamily:"inherit"
        }}>{submitting ? "送信中..." : "通報する"}</button>
      </div>
    </div>
  );
};

const FacilityCorrectionForm = ({ facility, user, onClose }) => {
  const [fieldName, setFieldName] = useState("");
  const [proposedValue, setProposedValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const FIELDS = [
    { id:"address", label:"住所" },
    { id:"phone", label:"電話番号" },
    { id:"hours", label:"営業時間" },
    { id:"website", label:"公式サイト" },
    { id:"closed", label:"閉店・移転している" },
    { id:"other", label:"その他" },
  ];

  const handleSubmit = async () => {
    if (!fieldName) return;
    setSubmitting(true);
    setError("");
    const { error: insErr } = await supabase.from("facility_corrections").insert({
      facility_id: facility.id,
      user_id: user?.id || null,
      field_name: fieldName,
      current_value: facility[fieldName] || null,
      proposed_value: proposedValue.trim() || null,
    });
    if (insErr) {
      setError(`送信に失敗しました: ${insErr.message}`);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setDone(true);
    setTimeout(()=>onClose(), 2000);
  };

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:400, width:"100%" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark }}>📝 情報を訂正</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
        </div>
        {done ? (
          <div style={{ textAlign:"center", padding:"30px 10px" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:6 }}>送信ありがとうございます</div>
            <div style={{ fontSize:12, color:C.warmGray }}>運営が確認後、情報を更新します</div>
          </div>
        ) : (
          <>
            <p style={{ fontSize:11, color:C.warmGray, marginBottom:14, lineHeight:1.6 }}>※ この内容は公開されません。運営のみが確認します</p>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:8 }}>訂正する項目</label>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {FIELDS.map(f => (
                  <label key={f.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", border:`1.5px solid ${fieldName===f.id?C.orange:C.border}`, borderRadius:10, cursor:"pointer", background:fieldName===f.id?C.orangePale:C.white }}>
                    <input type="radio" name="field" value={f.id} checked={fieldName===f.id} onChange={e=>setFieldName(e.target.value)}/>
                    <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>正しい情報・詳細</label>
              <textarea value={proposedValue} onChange={e=>setProposedValue(e.target.value)} rows={3} maxLength={500} placeholder="正しい情報を教えてください" style={{
                width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
                fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box"
              }}/>
            </div>
            {error && <div style={{ background:"#FFEBEE", color:C.red, padding:"10px 12px", borderRadius:10, fontSize:12, marginBottom:12 }}>{error}</div>}
            <button onClick={handleSubmit} disabled={!fieldName || submitting} style={{
              width:"100%", padding:"12px", background:(!fieldName||submitting)?C.warmGray:C.orange, border:"none", borderRadius:12,
              color:"#fff", fontWeight:800, fontSize:14, cursor:(!fieldName||submitting)?"not-allowed":"pointer", fontFamily:"inherit"
            }}>{submitting ? "送信中..." : "送信する"}</button>
          </>
        )}
      </div>
    </div>
  );
};

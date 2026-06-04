// src/pages/AdminEventSources.tsx
// ─────────────────────────────────────────────────────────────────
// 依頼書 #113 (2026/6/4): 全国小規模動物イベント自動収集 v2 - Admin UI
//
// 既存 Edge Function 群 (event-scrape-orchestrator / event-scraper /
// event-source-discovery / event-verifier / event-deduplicator) と
// pg_cron event-scrape-weekly は v1 で完全稼働中 (依頼書 #48 v2 完了済)。
//
// 現状: 既存 5 source は AI 生成 URL の hallucination で全 404 失敗 → is_active=false
// 本 UI の役割: 信頼できる URL の event_sources を King が手動投入 → 再活性化。
//
// 機能:
//   - event_sources 一覧 (URL / 都道府県 / アクティブ / 最終実行 / 収集数 / 成功率)
//   - 追加・編集・削除
//   - is_active トグル
//   - 手動 scrape トリガー (orchestrator を呼出)
//   - 直近 scrape logs 表示 (errors 列で URL hallucination 即発見)
// ─────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
// 依頼書 #119 Phase C (2026/6/5): RLS 認証問題解消のため共有 supabase client を使用
import { supabase as sb } from "../supabaseClient";

const C = {
  brand: "#F5A94A",
  brandDeep: "#B27820",
  cream: "#FFF9F0",
  dark: "#2C2C2A",
  warmGray: "#888780",
  border: "#F1EFE8",
  borderWarm: "#F5E6D0",
  red: "#E57373",
  green: "#7FB069",
  blue: "#5B9BD5",
  white: "#FFFFFF",
};

// 依頼書 #119 Phase C: SUPABASE_URL / sb は supabaseClient.ts から import 化
const SUPABASE_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const SUPABASE_ANON = "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou"; // 手動 fetch (orchestrator 呼出) で使用

type Source = {
  id: string;
  name: string;
  url: string;
  source_type: string | null;
  prefecture: string | null;
  city: string | null;
  last_scraped_at: string | null;
  scrape_frequency: string | null;
  is_active: boolean;
  success_rate: number | null;
  events_collected: number | null;
  notes: string | null;
  created_at: string;
};

type Log = {
  id: string;
  source_id: string | null;
  scraped_at: string;
  events_found: number | null;
  events_new: number | null;
  events_duplicate: number | null;
  errors: string | null;
  ai_cost_usd: number | string | null;
};

const SOURCE_TYPES = [
  { v: "", label: "選択してください" },
  { v: "rss", label: "📡 RSS フィード" },
  { v: "html", label: "📄 HTML スクレイピング" },
  { v: "api", label: "🔌 API" },
  { v: "manual", label: "✍️ 手動入力" },
];

const FREQ = [
  { v: "weekly", label: "週次" },
  { v: "daily", label: "日次" },
  { v: "monthly", label: "月次" },
];

const emptyForm: Partial<Source> = {
  name: "",
  url: "",
  source_type: "html",
  prefecture: "",
  city: "",
  scrape_frequency: "weekly",
  is_active: false,
  notes: "",
};

export default function AdminEventSources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Source> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError("");
    const [{ data: srcs, error: sErr }, { data: logRows }] = await Promise.all([
      sb.from("event_sources").select("*").order("created_at", { ascending: false }),
      sb.from("event_scrape_logs").select("*").order("scraped_at", { ascending: false }).limit(20),
    ]);
    if (sErr) {
      setError("source 取得失敗: " + sErr.message);
    } else {
      setSources((srcs || []) as Source[]);
      setLogs((logRows || []) as Log[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setError("");
    setEditing({ ...emptyForm });
  };

  const startEdit = (s: Source) => {
    setError("");
    setEditing({ ...s });
  };

  const cancel = () => {
    setEditing(null);
    setError("");
  };

  const save = async () => {
    if (!editing) return;
    setError("");
    if (!editing.name?.trim()) {
      setError("source 名を入力してください");
      return;
    }
    if (!editing.url?.trim()) {
      setError("URL を入力してください");
      return;
    }
    setSaving(true);
    const payload: any = {
      name: editing.name.trim(),
      url: editing.url.trim(),
      source_type: editing.source_type || null,
      prefecture: editing.prefecture?.trim() || null,
      city: editing.city?.trim() || null,
      scrape_frequency: editing.scrape_frequency || "weekly",
      is_active: editing.is_active === true,
      notes: editing.notes?.trim() || null,
    };

    let res;
    if (editing.id) {
      res = await sb.from("event_sources").update(payload).eq("id", editing.id);
    } else {
      res = await sb.from("event_sources").insert(payload);
    }
    setSaving(false);
    if (res.error) {
      setError("保存失敗: " + res.error.message);
      return;
    }
    setEditing(null);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("⚠️ この source を削除しますか?\n関連する scrape ログは残ります。")) return;
    const { error: e } = await sb.from("event_sources").delete().eq("id", id);
    if (e) {
      alert("削除失敗: " + e.message);
      return;
    }
    await load();
  };

  const toggleActive = async (s: Source) => {
    const { error: e } = await sb.from("event_sources").update({ is_active: !s.is_active }).eq("id", s.id);
    if (e) {
      alert("切替失敗: " + e.message);
      return;
    }
    await load();
  };

  const triggerScrape = async () => {
    if (!confirm("🤖 event-scrape-orchestrator を手動実行しますか?\n\nis_active=true の全 source を巡回します。\n月予算 ¥500-800 / 1回あたり ≈ $0.001 想定。")) return;
    setTriggering(true);
    setTriggerResult("");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/event-scrape-orchestrator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON}`,
          "apikey": SUPABASE_ANON,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setTriggerResult(`✅ 実行成功 (HTTP ${res.status}): ${JSON.stringify(data)}`);
      } else {
        setTriggerResult(`⚠️ HTTP ${res.status}: ${JSON.stringify(data)}`);
      }
      await load();
    } catch (e: any) {
      setTriggerResult(`❌ エラー: ${e.message}`);
    } finally {
      setTriggering(false);
    }
  };

  const activeCount = sources.filter(s => s.is_active).length;
  const totalCollected = sources.reduce((s, x) => s + (x.events_collected || 0), 0);

  return (
    <div style={{ background: C.cream, minHeight: "100vh", padding: "24px 12px 60px", fontFamily: "system-ui, -apple-system, sans-serif", color: C.dark }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>🤖 イベント自動収集 source 管理 (依頼書 #113)</h1>
            <p style={{ fontSize: 11, color: C.warmGray, margin: "4px 0 0" }}>
              既存 Edge Function 5本 + pg_cron event-scrape-weekly 稼働中 / 信頼できる URL を投入で再活性化
            </p>
          </div>
          <Link to="/admin" style={{ fontSize: 12, color: C.warmGray, textDecoration: "none" }}>← Admin に戻る</Link>
        </div>

        {/* サマリ + 手動実行 */}
        <div style={{ background: C.white, borderRadius: 14, padding: "16px 20px", border: `1px solid ${C.borderWarm}`, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, color: C.warmGray, marginBottom: 2 }}>登録 source 数</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "Georgia, serif" }}>{sources.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.warmGray, marginBottom: 2 }}>アクティブ</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "Georgia, serif", color: activeCount > 0 ? C.green : C.warmGray }}>{activeCount}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.warmGray, marginBottom: 2 }}>累計収集数</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "Georgia, serif", color: C.brandDeep }}>{totalCollected}</div>
            </div>
          </div>
          <button onClick={triggerScrape} disabled={triggering || activeCount === 0} style={{ padding: "10px 18px", background: triggering || activeCount === 0 ? C.warmGray : C.brand, color: C.white, border: "none", borderRadius: 10, fontWeight: 800, cursor: triggering || activeCount === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 13 }}>
            {triggering ? "実行中…" : "🤖 手動 scrape 実行"}
          </button>
        </div>

        {triggerResult && (
          <div style={{ background: triggerResult.startsWith("✅") ? "#E8F5E9" : triggerResult.startsWith("⚠️") ? "#FFF3E0" : "#FFEBEE", padding: "10px 14px", borderRadius: 10, fontSize: 11, marginBottom: 14, fontFamily: "ui-monospace, monospace" }}>
            {triggerResult}
          </div>
        )}

        {!editing && (
          <button onClick={startNew} style={{ padding: "10px 18px", background: C.brand, color: C.white, border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}>
            ＋ 新規 source を追加
          </button>
        )}

        {editing && (
          <div style={{ background: C.white, borderRadius: 14, padding: 20, border: `1px solid ${C.borderWarm}`, marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px" }}>{editing.id ? "✏️ source 編集" : "➕ 新規 source"}</h2>

            <Row label="source 名 *">
              <input type="text" value={editing.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="例: 大阪府 動物イベント情報" style={inputStyle}/>
            </Row>
            <Row label="URL *">
              <input type="url" value={editing.url || ""} onChange={e => setEditing({ ...editing, url: e.target.value })} placeholder="https://example.com/events" style={inputStyle}/>
              <div style={{ fontSize: 10, color: C.red, marginTop: 4 }}>
                ⚠️ 信頼できる実在 URL を入力してください (AI 生成 URL は 404 になります)
              </div>
            </Row>
            <Row label="source タイプ">
              <select value={editing.source_type || ""} onChange={e => setEditing({ ...editing, source_type: e.target.value })} style={inputStyle}>
                {SOURCE_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </Row>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Row label="都道府県">
                <input type="text" value={editing.prefecture || ""} onChange={e => setEditing({ ...editing, prefecture: e.target.value })} placeholder="例: 大阪府" style={inputStyle}/>
              </Row>
              <Row label="市区町村">
                <input type="text" value={editing.city || ""} onChange={e => setEditing({ ...editing, city: e.target.value })} placeholder="例: 大阪市" style={inputStyle}/>
              </Row>
            </div>
            <Row label="実行頻度">
              <select value={editing.scrape_frequency || "weekly"} onChange={e => setEditing({ ...editing, scrape_frequency: e.target.value })} style={inputStyle}>
                {FREQ.map(f => <option key={f.v} value={f.v}>{f.label}</option>)}
              </select>
            </Row>
            <Row label="アクティブ">
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={editing.is_active === true} onChange={e => setEditing({ ...editing, is_active: e.target.checked })}/>
                pg_cron で自動巡回する (新規追加時は OFF 推奨 → 手動 scrape で動作確認後に ON)
              </label>
            </Row>
            <Row label="メモ">
              <textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} rows={2} placeholder="運営者・確認頻度・特記事項..." style={{ ...inputStyle, resize: "vertical" }}/>
            </Row>

            {error && <div style={{ background: "#FFEBEE", color: C.red, padding: "10px 12px", borderRadius: 10, fontSize: 12, marginTop: 12 }}>{error}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={cancel} disabled={saving} style={{ flex: 1, padding: "10px", background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.warmGray, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>キャンセル</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: "10px", background: saving ? C.warmGray : C.brand, color: C.white, border: "none", borderRadius: 10, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{saving ? "保存中..." : "💾 保存"}</button>
            </div>
          </div>
        )}

        {/* sources 一覧 */}
        <h2 style={{ fontSize: 14, fontWeight: 800, margin: "20px 0 10px" }}>登録 source 一覧 ({sources.length}件)</h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.warmGray, fontSize: 13 }}>読み込み中…</div>
        ) : sources.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: C.warmGray, fontSize: 13, background: C.white, borderRadius: 12, border: `1px dashed ${C.borderWarm}` }}>
            🌱 まだ source が登録されていません。「新規 source を追加」から信頼できる URL を投入してください。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sources.map(s => (
              <div key={s.id} style={{ background: C.white, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{s.name}</span>
                      {s.is_active ? (
                        <span style={{ fontSize: 10, color: C.green, fontWeight: 700, padding: "2px 6px", background: "#E8F5E9", borderRadius: 4 }}>● ACTIVE</span>
                      ) : (
                        <span style={{ fontSize: 10, color: C.warmGray, fontWeight: 700, padding: "2px 6px", background: C.cream, borderRadius: 4 }}>○ INACTIVE</span>
                      )}
                    </div>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.blue, wordBreak: "break-all", textDecoration: "none" }}>{s.url}</a>
                    <div style={{ fontSize: 10, color: C.warmGray, marginTop: 4 }}>
                      {[s.prefecture, s.city].filter(Boolean).join(" / ") || "(地域未設定)"}
                      {s.source_type && <> · {SOURCE_TYPES.find(t => t.v === s.source_type)?.label || s.source_type}</>}
                      {s.scrape_frequency && <> · {FREQ.find(f => f.v === s.scrape_frequency)?.label || s.scrape_frequency}</>}
                    </div>
                    <div style={{ fontSize: 10, color: C.warmGray, marginTop: 2 }}>
                      最終実行: {s.last_scraped_at ? new Date(s.last_scraped_at).toLocaleString("ja-JP") : "—"}
                      · 収集 {s.events_collected || 0}件
                      {s.success_rate != null && <> · 成功率 {Math.round(Number(s.success_rate) * 100)}%</>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => toggleActive(s)} style={{ padding: "6px 10px", background: s.is_active ? C.green : C.warmGray, color: C.white, border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{s.is_active ? "ON" : "OFF"}</button>
                    <button onClick={() => startEdit(s)} style={{ padding: "6px 10px", background: C.white, color: C.dark, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>編集</button>
                    <button onClick={() => remove(s.id)} style={{ padding: "6px 10px", background: C.white, color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>削除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 直近 scrape ログ */}
        <h2 style={{ fontSize: 14, fontWeight: 800, margin: "24px 0 10px" }}>直近 scrape ログ ({logs.length}件)</h2>
        {logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 16px", color: C.warmGray, fontSize: 12, background: C.white, borderRadius: 12, border: `1px solid ${C.border}` }}>ログがありません</div>
        ) : (
          <div style={{ background: C.white, borderRadius: 12, padding: 12, border: `1px solid ${C.border}`, overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", minWidth: 600 }}>
              <thead><tr>
                <th style={th}>実行日時</th>
                <th style={th}>found</th>
                <th style={th}>new</th>
                <th style={th}>dup</th>
                <th style={th}>cost USD</th>
                <th style={th}>errors</th>
              </tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={td}>{new Date(l.scraped_at).toLocaleString("ja-JP")}</td>
                    <td style={td}>{l.events_found ?? 0}</td>
                    <td style={{ ...td, color: (l.events_new ?? 0) > 0 ? C.green : C.warmGray, fontWeight: 700 }}>{l.events_new ?? 0}</td>
                    <td style={td}>{l.events_duplicate ?? 0}</td>
                    <td style={td}>${Number(l.ai_cost_usd || 0).toFixed(4)}</td>
                    <td style={{ ...td, color: l.errors ? C.red : C.green, fontFamily: "ui-monospace, monospace", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.errors || "OK"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 補足情報 */}
        <div style={{ background: C.white, borderRadius: 12, padding: 14, border: `1px solid ${C.border}`, marginTop: 16, fontSize: 11, color: C.warmGray, lineHeight: 1.8 }}>
          <strong style={{ color: C.dark }}>📅 自動実行スケジュール</strong>: pg_cron <code>event-scrape-weekly</code> が active=true で稼働中。
          <br />
          毎週土曜 UTC 18:00 (= 日曜 JST 3:00) に <code>event-scrape-orchestrator</code> が呼ばれます。
          <br />
          <br />
          <strong style={{ color: C.dark }}>💰 想定コスト</strong>: gpt-4o-mini 採用で 1 source 1回 ≈ $0.001 / 月予算 ¥500-800。
          <br />
          <br />
          <strong style={{ color: C.dark }}>⚙️ 既存 Edge Function</strong>:<br />
          - <code>event-scrape-orchestrator</code> (全 source 巡回)<br />
          - <code>event-scraper</code> (個別 source 処理)<br />
          - <code>event-source-discovery</code> (AI 自走 source 発見)<br />
          - <code>event-verifier</code> (AI 構造化抽出)<br />
          - <code>event-deduplicator</code> (重複排除)
          <br />
          <br />
          <strong style={{ color: C.dark }}>🚨 注意</strong>: 全 INSERT は <code>approval_status='pending'</code>。承認は Admin の「イベント管理」タブから実施。
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: `1.5px solid ${C.border}`,
  fontSize: 13,
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
};
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${C.border}`, color: C.warmGray, fontWeight: 700, fontSize: 10 };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: `1px solid ${C.border}`, fontSize: 11 };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: C.warmGray, display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

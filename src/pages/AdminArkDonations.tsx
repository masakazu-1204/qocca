// src/pages/AdminArkDonations.tsx
// ─────────────────────────────────────────────────────────────────
// 依頼書 #108 (2026/6/4) Phase C: ARK 寄付 Admin 管理画面
//
// 寄付記録の追加・編集・削除・公開切替を管理。
// /admin/ark-donations で直接アクセス可能 (将来 Admin sidebar に統合予定)。
//
// RLS: profiles.role IN ('admin', 'super_admin') のみ INSERT/UPDATE/DELETE 可
// ─────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
// 依頼書 #119 Phase C (2026/6/5): admin RLS 認証問題解消のため共有 supabase client を使用
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
  white: "#FFFFFF",
};

// 依頼書 #119 Phase C: 共有 supabaseClient.ts から import で統一

type Donation = {
  id: string;
  donation_date: string;
  amount_jpy: number;
  source_period_start: string | null;
  source_period_end: string | null;
  source_sales_total_jpy: number | null;
  source_fee_total_jpy: number | null;
  source_rate_percent: number | null;
  source_ark_donation_sales_jpy: number | null;
  transfer_method: string | null;
  transfer_reference: string | null;
  receipt_url: string | null;
  notes: string;
  is_published: boolean;
  created_at: string;
};

const TRANSFER_METHODS = [
  { v: "", label: "選択してください" },
  { v: "bank_transfer", label: "🏦 銀行振込" },
  { v: "paypay", label: "📱 PayPay" },
  { v: "stripe_donation", label: "💳 Stripe 寄付" },
  { v: "other", label: "🔖 その他" },
];

const emptyForm: Partial<Donation> = {
  donation_date: "",
  amount_jpy: 0,
  source_period_start: null,
  source_period_end: null,
  source_sales_total_jpy: null,
  source_fee_total_jpy: null,
  source_rate_percent: 3.0,
  source_ark_donation_sales_jpy: null,
  transfer_method: "",
  transfer_reference: "",
  receipt_url: "",
  notes: "",
  is_published: true,
};

export default function AdminArkDonations() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Donation> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [summary, setSummary] = useState<{ total_donated_jpy: number; donation_count: number } | null>(null);

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

  const load = async () => {
    setLoading(true);
    const { data: dat, error: e } = await sb
      .from("ark_donations")
      .select("*")
      .order("donation_date", { ascending: false });
    if (e) {
      setError("一覧取得に失敗: " + e.message);
    } else {
      setDonations(dat || []);
    }
    const { data: sum } = await sb.from("ark_donations_summary").select("*").single();
    if (sum) setSummary(sum as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setError("");
    setEditing({ ...emptyForm, donation_date: new Date().toISOString().slice(0, 10) });
  };

  const startEdit = (d: Donation) => {
    setError("");
    setEditing({ ...d });
  };

  const cancel = () => {
    setEditing(null);
    setError("");
  };

  const save = async () => {
    if (!editing) return;
    setError("");
    if (!editing.donation_date) {
      setError("送金日を入力してください");
      return;
    }
    const amt = Number(editing.amount_jpy);
    if (!amt || amt <= 0) {
      setError("送金額は 1円以上の数字を入力してください");
      return;
    }
    setSaving(true);
    const payload: any = {
      donation_date: editing.donation_date,
      amount_jpy: amt,
      source_period_start: editing.source_period_start || null,
      source_period_end: editing.source_period_end || null,
      source_sales_total_jpy: editing.source_sales_total_jpy ? Number(editing.source_sales_total_jpy) : null,
      source_fee_total_jpy: editing.source_fee_total_jpy ? Number(editing.source_fee_total_jpy) : null,
      source_rate_percent: editing.source_rate_percent ? Number(editing.source_rate_percent) : null,
      source_ark_donation_sales_jpy: editing.source_ark_donation_sales_jpy ? Number(editing.source_ark_donation_sales_jpy) : null,
      transfer_method: editing.transfer_method || null,
      transfer_reference: editing.transfer_reference || null,
      receipt_url: editing.receipt_url || null,
      notes: editing.notes || "",
      is_published: editing.is_published !== false,
    };

    let res;
    if (editing.id) {
      res = await sb.from("ark_donations").update(payload).eq("id", editing.id);
    } else {
      res = await sb.from("ark_donations").insert(payload);
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
    if (!confirm("⚠️ この寄付記録を削除しますか?\n削除すると公開ページの累計表示も更新されます。")) return;
    const { error: e } = await sb.from("ark_donations").delete().eq("id", id);
    if (e) {
      alert("削除失敗: " + e.message);
      return;
    }
    await load();
  };

  const togglePublish = async (d: Donation) => {
    const { error: e } = await sb
      .from("ark_donations")
      .update({ is_published: !d.is_published })
      .eq("id", d.id);
    if (e) {
      alert("公開切替失敗: " + e.message);
      return;
    }
    await load();
  };

  return (
    <div style={{ background: C.cream, minHeight: "100vh", padding: "32px 16px", fontFamily: "system-ui, -apple-system, sans-serif", color: C.dark }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>🐾 ARK 寄付管理 (依頼書 #108)</h1>
          <Link to="/admin" style={{ fontSize: 12, color: C.warmGray, textDecoration: "none" }}>← Admin に戻る</Link>
        </div>

        {/* サマリ */}
        {summary && (
          <div style={{ background: C.white, borderRadius: 14, padding: "16px 20px", border: `1px solid ${C.borderWarm}`, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: C.warmGray, letterSpacing: "0.1em", marginBottom: 4 }}>累計寄付額 (公開分のみ)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.brandDeep, fontFamily: "Georgia, serif" }}>¥{Number(summary.total_donated_jpy).toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: C.warmGray }}>送金回数</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.dark }}>{summary.donation_count}回</div>
            </div>
          </div>
        )}

        {!editing && (
          <button onClick={startNew} style={{ padding: "10px 18px", background: C.brand, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>＋ 新規寄付記録を追加</button>
        )}

        {editing && (
          <div style={{ background: C.white, borderRadius: 14, padding: 20, border: `1px solid ${C.borderWarm}`, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px" }}>{editing.id ? "✏️ 寄付記録を編集" : "➕ 新規寄付記録"}</h2>

            <Row label="送金日 *">
              <input type="date" value={editing.donation_date || ""} onChange={e => setEditing({ ...editing, donation_date: e.target.value })} style={inputStyle}/>
            </Row>
            <Row label="送金額 (円) *">
              <input type="number" min="1" value={editing.amount_jpy || ""} onChange={e => setEditing({ ...editing, amount_jpy: parseInt(e.target.value) || 0 })} placeholder="3000" style={inputStyle}/>
            </Row>

            <div style={{ borderTop: `1px dashed ${C.border}`, marginTop: 14, paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.warmGray, marginBottom: 8 }}>算出根拠 (任意 / 透明性)</div>
              <Row label="集計期間 開始">
                <input type="date" value={editing.source_period_start || ""} onChange={e => setEditing({ ...editing, source_period_start: e.target.value || null })} style={inputStyle}/>
              </Row>
              <Row label="集計期間 終了">
                <input type="date" value={editing.source_period_end || ""} onChange={e => setEditing({ ...editing, source_period_end: e.target.value || null })} style={inputStyle}/>
              </Row>
              <Row label="当期売上総額 (円)">
                <input type="number" min="0" value={editing.source_sales_total_jpy ?? ""} onChange={e => setEditing({ ...editing, source_sales_total_jpy: e.target.value ? parseInt(e.target.value) : null })} placeholder="100000" style={inputStyle}/>
              </Row>
              <Row label="当期手数料総額 (円)">
                <input type="number" min="0" value={editing.source_fee_total_jpy ?? ""} onChange={e => setEditing({ ...editing, source_fee_total_jpy: e.target.value ? parseInt(e.target.value) : null })} placeholder="10000" style={inputStyle}/>
              </Row>
              <Row label="寄付率 (%)">
                <input type="number" step="0.01" min="0" max="100" value={editing.source_rate_percent ?? ""} onChange={e => setEditing({ ...editing, source_rate_percent: e.target.value ? parseFloat(e.target.value) : null })} placeholder="3.00" style={inputStyle}/>
              </Row>
              <Row label="ARK 募金商品売上 (円)">
                <input type="number" min="0" value={editing.source_ark_donation_sales_jpy ?? ""} onChange={e => setEditing({ ...editing, source_ark_donation_sales_jpy: e.target.value ? parseInt(e.target.value) : null })} placeholder="0" style={inputStyle}/>
              </Row>
            </div>

            <div style={{ borderTop: `1px dashed ${C.border}`, marginTop: 14, paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.warmGray, marginBottom: 8 }}>送金情報</div>
              <Row label="送金方法">
                <select value={editing.transfer_method || ""} onChange={e => setEditing({ ...editing, transfer_method: e.target.value })} style={inputStyle}>
                  {TRANSFER_METHODS.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
              </Row>
              <Row label="振込参照番号">
                <input type="text" value={editing.transfer_reference || ""} onChange={e => setEditing({ ...editing, transfer_reference: e.target.value })} placeholder="例: PayPay 12345..." style={inputStyle}/>
              </Row>
              <Row label="領収書 URL">
                <input type="url" value={editing.receipt_url || ""} onChange={e => setEditing({ ...editing, receipt_url: e.target.value })} placeholder="https://..." style={inputStyle}/>
              </Row>
              <Row label="補足メモ">
                <textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} rows={3} placeholder="鈴木さんへの送付メッセージ等..." style={{ ...inputStyle, resize: "vertical" }}/>
              </Row>
              <Row label="公開">
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={editing.is_published !== false} onChange={e => setEditing({ ...editing, is_published: e.target.checked })}/>
                  サイトに公開する (累計表示に含める)
                </label>
              </Row>
            </div>

            {error && <div style={{ background: "#FFEBEE", color: C.red, padding: "10px 12px", borderRadius: 10, fontSize: 12, marginTop: 12 }}>{error}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={cancel} disabled={saving} style={{ flex: 1, padding: "10px", background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.warmGray, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>キャンセル</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: "10px", background: saving ? C.warmGray : C.brand, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{saving ? "保存中..." : "💾 保存する"}</button>
            </div>
          </div>
        )}

        {/* 一覧 */}
        <h2 style={{ fontSize: 14, fontWeight: 800, margin: "20px 0 10px" }}>過去の寄付記録 ({donations.length}件)</h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.warmGray, fontSize: 13 }}>読み込み中…</div>
        ) : donations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.warmGray, fontSize: 13 }}>まだ寄付記録はありません。「新規寄付記録を追加」から最初の記録を入力してください。</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {donations.map(d => (
              <div key={d.id} style={{ background: C.white, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 2 }}>
                    {d.donation_date}
                    {!d.is_published && <span style={{ marginLeft: 8, fontSize: 10, color: C.red, fontWeight: 700 }}>● 非公開</span>}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.brandDeep, fontFamily: "Georgia, serif" }}>¥{Number(d.amount_jpy).toLocaleString()}</div>
                  {d.transfer_method && <div style={{ fontSize: 11, color: C.warmGray, marginTop: 2 }}>{TRANSFER_METHODS.find(t => t.v === d.transfer_method)?.label || d.transfer_method}{d.transfer_reference && ` · ${d.transfer_reference}`}</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => togglePublish(d)} style={{ padding: "6px 10px", background: d.is_published ? C.green : C.warmGray, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{d.is_published ? "公開中" : "非公開"}</button>
                  <button onClick={() => startEdit(d)} style={{ padding: "6px 10px", background: C.white, color: C.dark, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>編集</button>
                  <button onClick={() => remove(d.id)} style={{ padding: "6px 10px", background: C.white, color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>削除</button>
                </div>
              </div>
            ))}
          </div>
        )}
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: C.warmGray, display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

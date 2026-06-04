// src/pages/AdminCorporateSponsors.tsx
// ─────────────────────────────────────────────────────────────────
// 依頼書 #109 (2026/6/4) Phase B: 法人スポンサー (¥300,000) Admin 管理画面
//
// crowdfunding_backers (tier='corporate_300000') と profiles (sponsor_* / founding_*)
// を JOIN して法人スポンサー候補一覧を表示・編集する。
//
// 公開先: /sponsors ページ (crowdfunding_public_sponsors VIEW 経由)
// 規約整合: v2.0 第29条 (クラウドファンディング支援者特典)
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

type SponsorRow = {
  // crowdfunding_backers
  backer_id: string;
  user_id: string | null;
  backer_email: string | null;
  backer_display_name: string | null;
  backer_amount: number;
  campfire_order_id: string | null;
  backer_status: string | null;
  redeemed_at: string | null;
  public_display: boolean;
  notes: string;
  created_at: string;
  // profiles (joined)
  profile_display_name: string | null;
  sponsor_logo_url: string | null;
  sponsor_company_name: string | null;
  sponsor_website_url: string | null;
  founding_display_name: string | null;
  founding_display_consent: boolean | null;
};

type EditForm = {
  backer_id: string;
  user_id: string | null;
  public_display: boolean;
  notes: string;
  // profile fields
  sponsor_company_name: string;
  sponsor_logo_url: string;
  sponsor_website_url: string;
  founding_display_name: string;
  founding_display_consent: boolean;
};

export default function AdminCorporateSponsors() {
  const [rows, setRows] = useState<SponsorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  // 依頼書 #122 (2026/6/5): #119 で createClient/SUPABASE_URL/SUPABASE_ANON を削除した際の置換漏れを修正。
  //   旧: const sb = createClient(SUPABASE_URL, SUPABASE_ANON);  ← createClient 未定義参照 → ReferenceError → 白画面
  //   新: import 文の `import { supabase as sb } from "../supabaseClient"` で `sb` は既に scope 内 (この行不要)
  //   → これで認証セッション共有 + RLS authenticated 通過維持

  const load = async () => {
    setLoading(true);
    setError("");
    // backers 取得 (tier='corporate_300000')
    const { data: backers, error: bErr } = await sb
      .from("crowdfunding_backers")
      .select("id, user_id, email, display_name, amount, campfire_order_id, status, redeemed_at, public_display, notes, created_at")
      .eq("tier", "corporate_300000")
      .order("created_at", { ascending: false });

    if (bErr) {
      setError("backers 取得失敗: " + bErr.message);
      setLoading(false);
      return;
    }

    // user_id 解決 → profiles から sponsor_* / founding_* を取得
    const userIds = Array.from(new Set((backers || []).map(b => b.user_id).filter(Boolean))) as string[];
    let profileMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, display_name, sponsor_logo_url, sponsor_company_name, sponsor_website_url, founding_display_name, founding_display_consent")
        .in("id", userIds);
      profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    }

    const merged: SponsorRow[] = (backers || []).map(b => {
      const p = b.user_id ? profileMap.get(b.user_id) : null;
      return {
        backer_id: b.id,
        user_id: b.user_id,
        backer_email: b.email,
        backer_display_name: b.display_name,
        backer_amount: b.amount,
        campfire_order_id: b.campfire_order_id,
        backer_status: b.status,
        redeemed_at: b.redeemed_at,
        public_display: b.public_display ?? false,
        notes: b.notes || "",
        created_at: b.created_at,
        profile_display_name: p?.display_name || null,
        sponsor_logo_url: p?.sponsor_logo_url || null,
        sponsor_company_name: p?.sponsor_company_name || null,
        sponsor_website_url: p?.sponsor_website_url || null,
        founding_display_name: p?.founding_display_name || null,
        founding_display_consent: p?.founding_display_consent ?? null,
      };
    });
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (r: SponsorRow) => {
    setError("");
    setEditing({
      backer_id: r.backer_id,
      user_id: r.user_id,
      public_display: r.public_display,
      notes: r.notes,
      sponsor_company_name: r.sponsor_company_name || "",
      sponsor_logo_url: r.sponsor_logo_url || "",
      sponsor_website_url: r.sponsor_website_url || "",
      founding_display_name: r.founding_display_name || "",
      founding_display_consent: r.founding_display_consent ?? false,
    });
  };

  const cancel = () => {
    setEditing(null);
    setError("");
  };

  const save = async () => {
    if (!editing) return;
    setError("");
    setSaving(true);

    // 1. backers: public_display + notes 更新
    const { error: bErr } = await sb
      .from("crowdfunding_backers")
      .update({
        public_display: editing.public_display,
        notes: editing.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editing.backer_id);

    if (bErr) {
      setError("backers 更新失敗: " + bErr.message);
      setSaving(false);
      return;
    }

    // 2. profiles: sponsor_* / founding_* 更新 (user_id ある場合のみ)
    if (editing.user_id) {
      const { error: pErr } = await sb
        .from("profiles")
        .update({
          sponsor_company_name: editing.sponsor_company_name || null,
          sponsor_logo_url: editing.sponsor_logo_url || null,
          sponsor_website_url: editing.sponsor_website_url || null,
          founding_display_name: editing.founding_display_name || null,
          founding_display_consent: editing.founding_display_consent,
        })
        .eq("id", editing.user_id);
      if (pErr) {
        setError("profiles 更新失敗 (backers は更新済): " + pErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setEditing(null);
    await load();
  };

  const togglePublish = async (r: SponsorRow) => {
    const { error: e } = await sb
      .from("crowdfunding_backers")
      .update({ public_display: !r.public_display, updated_at: new Date().toISOString() })
      .eq("id", r.backer_id);
    if (e) {
      alert("公開切替失敗: " + e.message);
      return;
    }
    await load();
  };

  return (
    <div style={{ background: C.cream, minHeight: "100vh", padding: "32px 16px", fontFamily: "system-ui, -apple-system, sans-serif", color: C.dark }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>🏢 法人スポンサー管理 (依頼書 #109 / 規約 v2.0 第29条)</h1>
          <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
            <Link to="/sponsors" style={{ color: C.brandDeep, textDecoration: "none" }}>→ /sponsors 公開ページ</Link>
            <Link to="/admin" style={{ color: C.warmGray, textDecoration: "none" }}>← Admin に戻る</Link>
          </div>
        </div>

        <div style={{ background: C.white, borderRadius: 14, padding: "16px 20px", border: `1px solid ${C.borderWarm}`, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.warmGray, lineHeight: 1.8 }}>
            <strong style={{ color: C.dark }}>対象</strong>: ¥300,000 リターン「法人スポンサー｜街の協力者」(<code>tier='corporate_300000'</code>) の購入者一覧。
            <br />
            <strong style={{ color: C.dark }}>公開条件</strong>: <code>public_display=true</code> かつ <code>founding_display_consent=true</code> の場合のみ <code>/sponsors</code> に表示されます (規約 v2.0 第29条第6項)。
            <br />
            <strong style={{ color: C.dark }}>編集対象</strong>: backers の <code>public_display</code> / <code>notes</code> + profiles の <code>sponsor_company_name</code> / <code>sponsor_logo_url</code> / <code>sponsor_website_url</code> / <code>founding_display_name</code> / <code>founding_display_consent</code>
          </div>
        </div>

        {error && <div style={{ background: "#FFEBEE", color: C.red, padding: "10px 12px", borderRadius: 10, fontSize: 12, marginBottom: 12 }}>{error}</div>}

        {editing && (
          <div style={{ background: C.white, borderRadius: 14, padding: 20, border: `1px solid ${C.borderWarm}`, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px" }}>✏️ 法人スポンサー編集</h2>

            <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 14 }}>backer_id: {editing.backer_id} / user_id: {editing.user_id || "(未紐付け)"}</div>

            {!editing.user_id && (
              <div style={{ background: "#FFF3E0", color: C.brandDeep, padding: "10px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                ⚠️ user_id 未紐付けのため profiles 更新はスキップされます。public_display / notes のみ反映されます。
              </div>
            )}

            <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 14, marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.warmGray, marginBottom: 8 }}>profiles 法人情報</div>
              <Row label="社名 (sponsor_company_name)">
                <input type="text" value={editing.sponsor_company_name} onChange={e => setEditing({ ...editing, sponsor_company_name: e.target.value })} placeholder="例: 株式会社○○" style={inputStyle}/>
              </Row>
              <Row label="ロゴ URL (sponsor_logo_url)">
                <input type="url" value={editing.sponsor_logo_url} onChange={e => setEditing({ ...editing, sponsor_logo_url: e.target.value })} placeholder="https://example.com/logo.png" style={inputStyle}/>
                {editing.sponsor_logo_url && <div style={{ marginTop: 6 }}><img src={editing.sponsor_logo_url} alt="preview" style={{ maxHeight: 60, maxWidth: 200, objectFit: "contain", border: `1px solid ${C.border}`, borderRadius: 6, padding: 4 }} onError={e => (e.currentTarget.style.display = "none")}/></div>}
              </Row>
              <Row label="Web サイト URL (sponsor_website_url)">
                <input type="url" value={editing.sponsor_website_url} onChange={e => setEditing({ ...editing, sponsor_website_url: e.target.value })} placeholder="https://example.com" style={inputStyle}/>
              </Row>
              <Row label="掲載名 (founding_display_name)">
                <input type="text" value={editing.founding_display_name} onChange={e => setEditing({ ...editing, founding_display_name: e.target.value })} placeholder="HomePage 創業パートナーセクション用 (空欄時は社名を使用)" style={inputStyle}/>
              </Row>
              <Row label="公開同意 (founding_display_consent)">
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={editing.founding_display_consent} onChange={e => setEditing({ ...editing, founding_display_consent: e.target.checked })}/>
                  支援者本人から /sponsors / HomePage への公開表示の同意を得ている (規約 v2.0 第29条第6項)
                </label>
              </Row>
            </div>

            <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 14, marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.warmGray, marginBottom: 8 }}>backers 公開設定</div>
              <Row label="public_display フラグ">
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={editing.public_display} onChange={e => setEditing({ ...editing, public_display: e.target.checked })}/>
                  /sponsors ページに表示する (※ founding_display_consent=true の場合のみ実際に表示)
                </label>
              </Row>
              <Row label="社内メモ (notes)">
                <textarea value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} rows={3} placeholder="例: ロゴ受領済 / 掲載確認メール送付済 / 担当 ○○様..." style={{ ...inputStyle, resize: "vertical" }}/>
              </Row>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={cancel} disabled={saving} style={{ flex: 1, padding: "10px", background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.warmGray, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>キャンセル</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: "10px", background: saving ? C.warmGray : C.brand, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{saving ? "保存中..." : "💾 保存する"}</button>
            </div>
          </div>
        )}

        {/* 一覧 */}
        <h2 style={{ fontSize: 14, fontWeight: 800, margin: "20px 0 10px" }}>法人スポンサー候補 ({rows.length}件)</h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.warmGray, fontSize: 13 }}>読み込み中…</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: C.warmGray, fontSize: 13, background: C.white, borderRadius: 12, border: `1px solid ${C.border}` }}>
            🌱 まだ法人スポンサー (¥300,000 / corporate_300000) の購入者はいません。
            <br />
            <span style={{ fontSize: 11, opacity: 0.8 }}>CAMPFIRE 公開後、King が <code>/admin/codes</code> でコード発行 → 支援者が <code>/redeem</code> で交換すると <code>crowdfunding_backers</code> に登録されます。</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map(r => {
              const willShow = r.public_display && r.founding_display_consent;
              return (
                <div key={r.backer_id} style={{ background: C.white, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 240 }}>
                    {r.sponsor_logo_url ? (
                      <img src={r.sponsor_logo_url} alt="logo" style={{ width: 44, height: 44, objectFit: "contain", border: `1px solid ${C.border}`, borderRadius: 6, padding: 3 }}/>
                    ) : (
                      <div style={{ width: 44, height: 44, background: C.cream, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏢</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 2 }}>
                        {r.sponsor_company_name || r.founding_display_name || r.profile_display_name || r.backer_display_name || r.backer_email || "(未設定)"}
                      </div>
                      <div style={{ fontSize: 11, color: C.warmGray }}>
                        ¥{Number(r.backer_amount).toLocaleString()} · {r.created_at?.slice(0, 10)}
                        {r.campfire_order_id && <span> · CF#{r.campfire_order_id}</span>}
                      </div>
                      <div style={{ fontSize: 10, marginTop: 3 }}>
                        {willShow ? (
                          <span style={{ color: C.green, fontWeight: 700 }}>● 公開中 (/sponsors 表示対象)</span>
                        ) : r.public_display && !r.founding_display_consent ? (
                          <span style={{ color: C.red, fontWeight: 700 }}>⚠ public_display=ON だが consent=OFF (規約第29条第6項により非表示)</span>
                        ) : (
                          <span style={{ color: C.warmGray, fontWeight: 700 }}>○ 非公開</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => togglePublish(r)} style={{ padding: "6px 10px", background: r.public_display ? C.green : C.warmGray, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{r.public_display ? "公開ON" : "公開OFF"}</button>
                    <button onClick={() => startEdit(r)} style={{ padding: "6px 10px", background: C.white, color: C.dark, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>編集</button>
                  </div>
                </div>
              );
            })}
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

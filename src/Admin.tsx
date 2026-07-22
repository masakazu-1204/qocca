import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qufrqkuipzuqeqkvuhkx.supabase.co",
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou"
);

const C = {
  orange: "#F5A94A", orangeLight: "#FAC97A", orangePale: "#FFF3E0",
  dark: "#1A1208", darkBrown: "#2D1F0A", warmGray: "#9E9B95",
  border: "#EDE9E3", white: "#FFFFFF", cream: "#FAFAF7",
  green: "#4CAF50", greenPale: "#E8F5E9",
  red: "#EF5350", redPale: "#FFEBEE",
  blue: "#2196F3", bluePale: "#E3F2FD",
};

const Badge = ({ text, color, bg }: { text: string; color: string; bg: string }) => (
  <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{text}</span>
);

const statusBadge = (status: string) => {
  const map: Record<string, { color: string; bg: string }> = {
    approved: { color: C.green, bg: C.greenPale },
    pending: { color: "#F57C00", bg: "#FFF3E0" },
    rejected: { color: C.red, bg: C.redPale },
    completed: { color: C.green, bg: C.greenPale },
    working: { color: C.blue, bg: C.bluePale },
    cancelled: { color: C.red, bg: C.redPale },
    disputed: { color: C.red, bg: C.redPale },
    refunded: { color: C.warmGray, bg: C.cream },
  };
  const label: Record<string, string> = {
    approved: "公開中", pending: "審査中", rejected: "却下",
    completed: "完了", working: "作業中", cancelled: "キャンセル", disputed: "異議申立", refunded: "返金済",
  };
  const s = map[status] || { color: C.warmGray, bg: C.cream };
  return <Badge text={label[status] || status} color={s.color} bg={s.bg} />;
};

// ── ダッシュボード ──────────────────────────────────────────────────────────
const DashboardPage = () => {
  const [stats, setStats] = useState({ users: 0, listings: 0, orders: 0, events_pending: 0, listings_pending: 0, reports: 0 });

  useEffect(() => {
    (async () => {
      const [
        { count: users },
        { count: listings },
        { count: orders },
        { count: events_pending },
        { count: listings_pending },
        { count: reports },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("listings").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("events").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("listings").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("community_message_reports").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        users: users || 0,
        listings: listings || 0,
        orders: orders || 0,
        events_pending: events_pending || 0,
        listings_pending: listings_pending || 0,
        reports: reports || 0,
      });
    })();
  }, []);

  const StatCard = ({ icon, label, value, color = C.orange }: { icon: string; label: string; value: string | number; color?: string }) => (
    <div style={{ background: C.white, borderRadius: 16, padding: "20px", border: `1px solid ${C.border}`, flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
        </div>
        <div style={{ fontSize: 28 }}>{icon}</div>
      </div>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 20 }}>📊 ダッシュボード</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 14 }}>
        <StatCard icon="👥" label="総ユーザー数" value={stats.users} color={C.blue} />
        <StatCard icon="📦" label="出品サービス" value={stats.listings} color={C.orange} />
        <StatCard icon="🛒" label="総取引数" value={stats.orders} color={C.green} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        <StatCard icon="📦" label="出品審査待ち" value={stats.listings_pending} color="#F57C00" />
        <StatCard icon="🎪" label="イベント審査待ち" value={stats.events_pending} color="#F57C00" />
        <StatCard icon="🚨" label="通報件数" value={stats.reports} color={C.red} />
      </div>
      <div style={{ background: C.orangePale, borderRadius: 16, padding: "20px", border: `1px solid ${C.orange}40` }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.dark, marginBottom: 8 }}>🐾 Qocca 管理者画面へようこそ</div>
        <div style={{ fontSize: 13, color: C.warmGray }}>左メニューからイベント・出品・会員・通報を管理できます。</div>
      </div>
    </div>
  );
};

// ── イベント管理 ──────────────────────────────────────────────────────────
const EventsPage = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    let q = supabase.from("events").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [filter]);

  const approve = async (id: string) => {
    await supabase.from("events").update({ status: "approved" }).eq("id", id);
    fetch();
  };

  const reject = async (id: string) => {
    await supabase.from("events").update({ status: "rejected" }).eq("id", id);
    fetch();
  };

  const remove = async (id: string) => {
    if (!confirm("このイベントを削除しますか？")) return;
    await supabase.from("events").delete().eq("id", id);
    fetch();
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 20 }}>🎪 イベント管理</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["all", "すべて"], ["pending", "審査待ち"], ["approved", "公開中"], ["rejected", "却下"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: "8px 16px", border: `1.5px solid ${filter === v ? C.orange : C.border}`,
            borderRadius: 10, background: filter === v ? C.orangePale : C.white,
            color: filter === v ? C.orange : C.warmGray, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
          }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>読み込み中...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {events.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>イベントがありません</div>}
          {events.map(ev => (
            <div key={ev.id} style={{ background: C.white, borderRadius: 16, border: `1px solid ${ev.status === "pending" ? C.orange : C.border}`, padding: "16px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
              {ev.image_url && (
                <img src={ev.image_url} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
              )}
              {!ev.image_url && (
                <div style={{ width: 80, height: 80, background: C.cream, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🎪</div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: C.dark }}>{ev.title}</span>
                  {statusBadge(ev.status)}
                </div>
                <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 4 }}>
                  📅 {ev.event_date} {ev.event_time} &nbsp;|&nbsp; 📍 {ev.prefecture} {ev.place} &nbsp;|&nbsp; 💴 {ev.fee}
                </div>
                <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 8 }}>🐾 {ev.pet_type} &nbsp;|&nbsp; 🏷️ {ev.category}</div>
                {ev.description && (
                  <div style={{ fontSize: 12, color: C.dark, lineHeight: 1.6, maxHeight: 48, overflow: "hidden" }}>{ev.description}</div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                {ev.status === "pending" && (
                  <button onClick={() => approve(ev.id)} style={{ padding: "6px 14px", background: C.greenPale, border: `1px solid ${C.green}40`, borderRadius: 8, color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✅ 承認</button>
                )}
                {ev.status === "approved" && (
                  <button onClick={() => reject(ev.id)} style={{ padding: "6px 14px", background: "#FFF3E0", border: "1px solid #F57C0040", borderRadius: 8, color: "#F57C00", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>⏸ 非公開</button>
                )}
                {ev.status === "rejected" && (
                  <button onClick={() => approve(ev.id)} style={{ padding: "6px 14px", background: C.greenPale, border: `1px solid ${C.green}40`, borderRadius: 8, color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✅ 承認</button>
                )}
                <button onClick={() => remove(ev.id)} style={{ padding: "6px 14px", background: C.redPale, border: `1px solid ${C.red}40`, borderRadius: 8, color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🗑 削除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── 出品管理（強化版：承認/却下/再公開） ──────────────────────────────────
const ListingsPage = () => {
  const [listings, setListings] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    let q = supabase
      .from("listings")
      .select("id, title, price, category, created_at, seller_id, image_urls, status")
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setListings(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [filter]);

  const approve = async (id: string) => {
    await supabase.from("listings").update({ status: "approved" }).eq("id", id);
    fetch();
  };

  const reject = async (id: string) => {
    if (!confirm("この出品を却下しますか？\n※サイトに表示されなくなります")) return;
    await supabase.from("listings").update({ status: "rejected" }).eq("id", id);
    fetch();
  };

  const remove = async (id: string) => {
    if (!confirm("この出品を完全に削除しますか？\n※この操作は取り消せません")) return;
    await supabase.from("listings").delete().eq("id", id);
    fetch();
  };

  const filtered = listings.filter(l =>
    !search || l.title?.includes(search) || l.category?.includes(search)
  );

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 20 }}>📦 出品管理</h2>

      {/* ステータスフィルタ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["all", "すべて"], ["pending", "審査待ち"], ["approved", "公開中"], ["rejected", "却下"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: "8px 16px", border: `1.5px solid ${filter === v ? C.orange : C.border}`,
            borderRadius: 10, background: filter === v ? C.orangePale : C.white,
            color: filter === v ? C.orange : C.warmGray, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
          }}>{l}</button>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="サービス名・カテゴリで検索..."
        style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, outline: "none", fontFamily: "inherit", marginBottom: 16, boxSizing: "border-box" }} />

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>読み込み中...</div>
      ) : (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.cream, borderBottom: `2px solid ${C.border}` }}>
                {["画像", "サービス名", "カテゴリ", "価格", "状態", "登録日", "操作"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: C.warmGray }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} style={{ borderBottom: `1px solid ${C.border}`, background: l.status === "pending" ? "#FFFBF5" : l.status === "rejected" ? "#FFF8F8" : "transparent" }}>
                  <td style={{ padding: "10px 14px" }}>
                    {l.image_urls?.[0] ? (
                      <img src={l.image_urls[0]} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
                    ) : (
                      <div style={{ width: 48, height: 48, background: C.cream, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>📦</div>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: C.dark }}>{l.title}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: C.warmGray }}>{l.category}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: C.orange }}>¥{l.price?.toLocaleString()}</td>
                  <td style={{ padding: "10px 14px" }}>{statusBadge(l.status || "approved")}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: C.warmGray }}>{l.created_at?.slice(0, 10)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {l.status === "pending" && (
                        <>
                          <button onClick={() => approve(l.id)} style={{ padding: "5px 12px", background: C.greenPale, border: `1px solid ${C.green}40`, borderRadius: 6, color: C.green, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✅ 承認</button>
                          <button onClick={() => reject(l.id)} style={{ padding: "5px 12px", background: "#FFF3E0", border: "1px solid #F57C0040", borderRadius: 6, color: "#F57C00", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>⏸ 却下</button>
                        </>
                      )}
                      {l.status === "approved" && (
                        <button onClick={() => reject(l.id)} style={{ padding: "5px 12px", background: "#FFF3E0", border: "1px solid #F57C0040", borderRadius: 6, color: "#F57C00", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>⏸ 非公開</button>
                      )}
                      {l.status === "rejected" && (
                        <button onClick={() => approve(l.id)} style={{ padding: "5px 12px", background: C.greenPale, border: `1px solid ${C.green}40`, borderRadius: 6, color: C.green, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✅ 再公開</button>
                      )}
                      <button onClick={() => remove(l.id)} style={{ padding: "5px 12px", background: C.redPale, border: `1px solid ${C.red}40`, borderRadius: 6, color: C.red, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🗑 削除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>出品がありません</div>}
        </div>
      )}
    </div>
  );
};

// ── 会員管理 ──────────────────────────────────────────────────────────────
const MembersPage = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, bio, created_at, is_suspended, warning_count")
        .order("created_at", { ascending: false });
      setMembers(data || []);
      setLoading(false);
    })();
  }, []);

  const toggleSuspend = async (id: string, current: boolean) => {
    await supabase.from("profiles").update({ is_suspended: !current }).eq("id", id);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, is_suspended: !current } : m));
  };

  const filtered = members.filter(m =>
    !search || m.display_name?.includes(search) || m.id?.includes(search)
  );

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 20 }}>👥 会員管理</h2>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="名前・IDで検索..."
        style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, outline: "none", fontFamily: "inherit", marginBottom: 16, boxSizing: "border-box" }} />

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>読み込み中...</div>
      ) : (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.cream, borderBottom: `2px solid ${C.border}` }}>
                {["アバター", "名前", "登録日", "警告", "ステータス", "操作"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: C.warmGray }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}`, background: m.is_suspended ? "#FFF8F8" : "transparent" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: m.avatar_url ? "transparent" : C.orange, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {m.avatar_url ? <img src={m.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>{(m.display_name || "?")[0]}</span>}
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: C.dark }}>{m.display_name || "未設定"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: C.warmGray }}>{m.created_at?.slice(0, 10)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: (m.warning_count || 0) > 0 ? C.red : C.warmGray }}>
                    {m.warning_count || 0}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge text={m.is_suspended ? "停止中" : "正常"} color={m.is_suspended ? C.red : C.green} bg={m.is_suspended ? C.redPale : C.greenPale} />
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <button onClick={() => toggleSuspend(m.id, m.is_suspended)} style={{
                      padding: "5px 12px", background: m.is_suspended ? C.greenPale : C.redPale,
                      border: `1px solid ${m.is_suspended ? C.green : C.red}40`, borderRadius: 6,
                      color: m.is_suspended ? C.green : C.red, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
                    }}>{m.is_suspended ? "✅ 解除" : "⛔ 停止"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>会員がいません</div>}
        </div>
      )}
    </div>
  );
};

// ── お知らせ配信 (運営専用 一斉DM・2026/7/22 King承認指示書) ──────────────────
// 🛡️ 真のゲートはサーバー側 RPC admin_broadcast_dm() の is_admin() (UI非表示に依存しない)。
//    ここは admin しか到達できない AdminDashboard 内のUI。宛先は手動チェックのみ(条件絞込・全員は作らない)。
const BroadcastPage = () => {
  const MAX_LEN = 2000;
  const MAX_RECIPIENTS = 200;
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [content, setContent] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: m }, { data: h }] = await Promise.all([
      supabase.from("profiles")
        .select("id, display_name, avatar_url, created_at, is_suspended")
        .order("created_at", { ascending: false }),
      supabase.from("dm_broadcasts")
        .select("id, content, recipient_count, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setMembers(m || []);
    setHistory(h || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = members.filter(m => !search || m.display_name?.includes(search) || m.id?.includes(search));
  const selectedIds = Object.keys(checked).filter(id => checked[id]);
  const selectedNames = members.filter(m => checked[m.id]).map(m => m.display_name || "未設定");
  const remain = MAX_LEN - content.length;
  const canSend = selectedIds.length > 0 && selectedIds.length <= MAX_RECIPIENTS && content.trim().length > 0 && remain >= 0 && !sending;

  const toggleAllFiltered = (on: boolean) => {
    setChecked(prev => {
      const next = { ...prev };
      filtered.forEach(m => { next[m.id] = on; });
      return next;
    });
  };

  const send = async () => {
    setSending(true);
    setResult(null);
    // 🛡️ サーバー側 RPC (SECURITY DEFINER + is_admin ゲート)。非adminはここで forbidden。
    const { data, error } = await supabase.rpc("admin_broadcast_dm", {
      p_recipient_ids: selectedIds, p_content: content.trim(),
    });
    setSending(false);
    setConfirming(false);
    if (error) {
      setResult({ ok: false, msg: `送信できませんでした: ${error.message}` });
      return;
    }
    setResult({ ok: true, msg: `${data}人に送信しました。` });
    setChecked({});
    setContent("");
    load(); // 履歴を更新
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 6 }}>📣 お知らせ配信</h2>
      <p style={{ fontSize: 12, color: C.warmGray, marginBottom: 20 }}>
        選択したユーザーへ「運営事務局」から個別DMとして一斉送信します（最大{MAX_RECIPIENTS}人・{MAX_LEN}字・1時間5回まで）。受信者は通常のDMとして返信できます。
      </p>

      {result && (
        <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 700,
          background: result.ok ? C.greenPale : C.redPale, color: result.ok ? C.green : C.red }}>
          {result.msg}
        </div>
      )}

      {/* 本文 */}
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 16, marginBottom: 16 }}>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={5}
          placeholder="お知らせの本文を入力..."
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
        <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: remain < 0 ? C.red : C.warmGray, marginTop: 6 }}>
          残り {remain} 字
        </div>
      </div>

      {/* 宛先選択 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="名前・IDで検索..."
          style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        <button onClick={() => toggleAllFiltered(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: C.dark }}>表示中を全選択</button>
        <button onClick={() => setChecked({})} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: C.warmGray }}>全解除</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>読み込み中...</div>
      ) : (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", maxHeight: 380, overflowY: "auto", marginBottom: 16 }}>
          {filtered.map(m => (
            <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: checked[m.id] ? C.cream : "transparent" }}>
              <input type="checkbox" checked={!!checked[m.id]} onChange={e => setChecked(prev => ({ ...prev, [m.id]: e.target.checked }))} />
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.avatar_url ? "transparent" : C.orange, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {m.avatar_url ? <img src={m.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>{(m.display_name || "?")[0]}</span>}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{m.display_name || "未設定"}</span>
              {m.is_suspended && <Badge text="停止中" color={C.red} bg={C.redPale} />}
              <span style={{ marginLeft: "auto", fontSize: 11, color: C.warmGray }}>{m.created_at?.slice(0, 10)}</span>
            </label>
          ))}
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: 30, color: C.warmGray }}>該当する会員がいません</div>}
        </div>
      )}

      {/* 送信 (確認モーダルを開くだけ。実送信はモーダル内) */}
      <button disabled={!canSend} onClick={() => setConfirming(true)}
        style={{ padding: "12px 28px", borderRadius: 10, border: "none", fontFamily: "inherit",
          background: canSend ? C.orange : C.border, color: "#fff", fontSize: 14, fontWeight: 800, cursor: canSend ? "pointer" : "default" }}>
        {selectedIds.length > 0 ? `${selectedIds.length}人に送信内容を確認` : "宛先を選択してください"}
      </button>
      {selectedIds.length > MAX_RECIPIENTS && (
        <span style={{ marginLeft: 12, fontSize: 12, color: C.red, fontWeight: 700 }}>宛先は最大{MAX_RECIPIENTS}人までです</span>
      )}

      {/* ★誤送信防止: 送信前確認モーダル (人数+本文プレビュー) */}
      {confirming && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => !sending && setConfirming(false)}>
          <div style={{ background: C.white, borderRadius: 16, padding: 24, maxWidth: 520, width: "100%", maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 900, color: C.dark, marginBottom: 8 }}>
              {selectedIds.length}人に送信します。よろしいですか？
            </div>
            <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 12, lineHeight: 1.7 }}>
              宛先: {selectedNames.slice(0, 8).join("、")}{selectedNames.length > 8 ? ` ほか${selectedNames.length - 8}人` : ""}
            </div>
            <div style={{ background: C.cream, borderRadius: 10, padding: 14, fontSize: 13, color: C.dark, whiteSpace: "pre-wrap", lineHeight: 1.8, marginBottom: 18 }}>
              {content.trim()}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button disabled={sending} onClick={() => setConfirming(false)}
                style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: C.warmGray }}>
                やめる
              </button>
              <button disabled={sending} onClick={send}
                style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: C.orange, color: "#fff", fontSize: 13, fontWeight: 800, cursor: sending ? "default" : "pointer", fontFamily: "inherit" }}>
                {sending ? "送信中..." : "送信する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 送信履歴 */}
      <h3 style={{ fontSize: 15, fontWeight: 900, color: C.dark, margin: "28px 0 10px" }}>送信履歴</h3>
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {history.map(h => (
          <div key={h.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: C.warmGray, marginBottom: 4 }}>
              <span>{h.created_at?.replace("T", " ").slice(0, 16)}</span>
              <span style={{ fontWeight: 800, color: C.dark }}>{h.recipient_count}人</span>
            </div>
            <div style={{ fontSize: 12.5, color: C.dark, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {h.content.length > 120 ? h.content.slice(0, 120) + "…" : h.content}
            </div>
          </div>
        ))}
        {history.length === 0 && <div style={{ textAlign: "center", padding: 24, color: C.warmGray, fontSize: 12 }}>まだ送信履歴がありません</div>}
      </div>
    </div>
  );
};

// ── 通報管理 ──────────────────────────────────────────────────────────────
const ReportsPage = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("community_message_reports")
      .select("*")
      .order("created_at", { ascending: false });
    setReports(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 20 }}>🚨 通報管理</h2>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>読み込み中...</div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: C.warmGray }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>通報はありません</div>
        </div>
      ) : (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.cream, borderBottom: `2px solid ${C.border}` }}>
                {["対象メッセージID", "通報者", "理由", "日付"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: C.warmGray }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}`, background: "#FFF8F8" }}>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: C.dark, fontFamily: "monospace" }}>{r.message_id?.slice(0, 8) || "-"}...</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: C.warmGray, fontFamily: "monospace" }}>{r.reporter_id?.slice(0, 8) || "-"}...</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: C.dark }}>{r.reason || "-"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: C.warmGray }}>{r.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── 売上管理 ──────────────────────────────────────────────────────────────
const SalesPage = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, revenue: 0, fee: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("orders")
        .select("id, status, created_at, listing_id, listings(title, price)")
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = data || [];
      setOrders(rows);
      const completed = rows.filter((o: any) => o.status === "completed");
      const revenue = completed.reduce((s: number, o: any) => s + (o.listings?.price || 0), 0);
      setStats({ total: rows.length, revenue, fee: Math.round(revenue * 0.1) });
      setLoading(false);
    })();
  }, []);

  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    completed: { label: "完了", color: C.green, bg: C.greenPale },
    working: { label: "作業中", color: C.blue, bg: C.bluePale },
    pending: { label: "保留中", color: "#F57C00", bg: "#FFF3E0" },
    cancelled: { label: "キャンセル", color: C.red, bg: C.redPale },
    disputed: { label: "異議申立", color: C.red, bg: C.redPale },
    delivered: { label: "納品済", color: C.blue, bg: C.bluePale },
    refunded: { label: "返金済", color: C.warmGray, bg: C.cream },
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 20 }}>💰 売上管理</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        <div style={{ background: C.white, borderRadius: 16, padding: "20px", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 6 }}>総取引数</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.blue }}>{stats.total}件</div>
        </div>
        <div style={{ background: C.white, borderRadius: 16, padding: "20px", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 6 }}>完了取引の総売上</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.green }}>¥{stats.revenue.toLocaleString()}</div>
        </div>
        <div style={{ background: C.white, borderRadius: 16, padding: "20px", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 6 }}>プラットフォーム手数料（10%）</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.orange }}>¥{stats.fee.toLocaleString()}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>読み込み中...</div>
      ) : (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.cream, borderBottom: `2px solid ${C.border}` }}>
                {["日付", "商品名", "金額", "手数料", "ステータス"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: C.warmGray }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => {
                const s = statusMap[o.status] || { label: o.status, color: C.warmGray, bg: C.cream };
                const price = o.listings?.price || 0;
                return (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: C.warmGray }}>{o.created_at?.slice(0, 10)}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: C.dark }}>{o.listings?.title || "-"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: C.orange }}>¥{price.toLocaleString()}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: C.warmGray }}>¥{Math.round(price * 0.1).toLocaleString()}</td>
                    <td style={{ padding: "12px 14px" }}><Badge text={s.label} color={s.color} bg={s.bg} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {orders.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>取引がありません</div>}
        </div>
      )}
    </div>
  );
};

// ── クラファン管理ページ (依頼書 #6, 2026/5/26) ──────────────────────────────
// crowdfunding_backers / crowdfunding_codes / crowdfunding_rewards 連携
type Backer = {
  id: string;
  user_id: string | null;
  email: string;
  display_name: string | null;
  tier: string;
  amount: number;
  campfire_order_id: string | null;
  status: "pending" | "fulfilled" | "cancelled";
  redeemed_at: string | null;
  notes: string | null;
  created_at: string;
};

type Reward = {
  id: string;
  name: string;
  price_jpy: number;
  total_slots: number | null;
  is_active: boolean;
};

const CROWDFUNDING_GOAL = 500000;

// CSV ヘッダの柔軟マッピング (CAMPFIRE 標準 + 汎用)
const CSV_HEADER_MAP: Record<string, keyof Backer> = {
  email: "email", mail: "email", backer_email: "email",
  name: "display_name", display_name: "display_name", backer_name: "display_name", supporter_name: "display_name",
  tier: "tier", reward: "tier", reward_id: "tier",
  amount: "amount", total: "amount", total_amount: "amount", price: "amount",
  order_id: "campfire_order_id", campfire_order_id: "campfire_order_id", id: "campfire_order_id",
};

const TIER_OPTIONS = [
  { id: "supporter_1000", label: "応援サポーター", limit: null },
  { id: "resident_3000", label: "創業メンバー", limit: 300 },
  { id: "creator_8000", label: "創業クリエイター", limit: 100 },
  { id: "family_15000", label: "創業ファミリー", limit: 50 },
  { id: "mayor_30000", label: "街の首長", limit: 20 },
  { id: "ark_patron_50000", label: "動物福祉パトロン", limit: 10 },
  { id: "corporate_300000", label: "法人スポンサー", limit: 5 },
];

const STATUS_OPTIONS = [
  { id: "pending", label: "未履行", color: "#FF9800", bg: "#FFF3E0" },
  { id: "fulfilled", label: "履行済", color: "#4CAF50", bg: "#E8F5E9" },
  { id: "cancelled", label: "キャンセル", color: "#9E9E9E", bg: "#F5F5F5" },
];

// 16桁ランダムコード生成 (QOCCA-XXXX-XXXX-XXXX)
function generateRedemptionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字除外
  let s = "QOCCA";
  for (let g = 0; g < 3; g++) {
    s += "-";
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

// CSV パーサ (簡易・カンマ区切り想定、ダブルクォート対応)
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === "," && !inQuote) {
      result.push(cur); cur = "";
    } else cur += c;
  }
  result.push(cur);
  return result.map(s => s.trim());
}

function parseCsvToBackers(text: string): { rows: Partial<Backer>[]; errors: string[] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter(l => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], errors: ["CSV が空、またはヘッダのみ"] };
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, "_"));
  const fieldIdx: Partial<Record<keyof Backer, number>> = {};
  headers.forEach((h, idx) => {
    const mapped = CSV_HEADER_MAP[h];
    if (mapped) fieldIdx[mapped] = idx;
  });
  if (fieldIdx.email === undefined || fieldIdx.tier === undefined || fieldIdx.amount === undefined) {
    return { rows: [], errors: ["必須カラム不足 (email / tier / amount のいずれか)"] };
  }
  const rows: Partial<Backer>[] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const email = cols[fieldIdx.email!]?.trim();
    const tier = cols[fieldIdx.tier!]?.trim();
    const amountStr = cols[fieldIdx.amount!]?.replace(/[^\d-]/g, "");
    const amount = parseInt(amountStr || "0", 10);
    if (!email || !tier || !Number.isFinite(amount) || amount < 0) {
      errors.push(`L${i + 1}: 無効データ (email/tier/amount)`); continue;
    }
    if (!TIER_OPTIONS.some(t => t.id === tier)) {
      errors.push(`L${i + 1}: 不明な tier "${tier}"`); continue;
    }
    rows.push({
      email, tier, amount,
      display_name: fieldIdx.display_name !== undefined ? cols[fieldIdx.display_name]?.trim() || null : null,
      campfire_order_id: fieldIdx.campfire_order_id !== undefined ? cols[fieldIdx.campfire_order_id]?.trim() || null : null,
    });
  }
  return { rows, errors };
}

const CrowdfundingPage = () => {
  const [backers, setBackers] = useState<Backer[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTier, setFilterTier] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [csvText, setCsvText] = useState<string>("");
  const [csvResult, setCsvResult] = useState<{ inserted: number; duplicated: number; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [codeStats, setCodeStats] = useState<Record<string, { issued: number; redeemed: number }>>({});
  // 依頼書 #34 Phase 1 (2026/5/31): 事前コードプール発行 UI
  const [poolRewardId, setPoolRewardId] = useState<string>("");
  const [poolCount, setPoolCount] = useState<number>(10);
  const [poolBusy, setPoolBusy] = useState(false);
  const [poolResult, setPoolResult] = useState<{ generated: number; errors: string[] } | null>(null);
  const [poolCodes, setPoolCodes] = useState<Array<{ id: number; code: string; reward_id: string; issued_at: string; redeemed_at: string | null; redeemed_by_user_id: string | null; notes: string | null }>>([]);
  const [poolListOpen, setPoolListOpen] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const [b, r, c, pc] = await Promise.all([
      supabase.from("crowdfunding_backers").select("*").order("created_at", { ascending: false }),
      supabase.from("crowdfunding_rewards").select("id, name, price_jpy, total_slots, is_active").eq("is_active", true).order("price_jpy"),
      supabase.from("crowdfunding_codes").select("backer_id, redeemed_at"),
      supabase.from("crowdfunding_codes")
        .select("id, code, reward_id, issued_at, redeemed_at, redeemed_by_user_id, notes")
        .is("backer_id", null)
        .order("issued_at", { ascending: false })
        .limit(500),
    ]);
    setBackers((b.data as Backer[]) || []);
    setRewards((r.data as Reward[]) || []);
    setPoolCodes((pc.data as any[]) || []);
    // tier 別 code 統計
    const cs: Record<string, { issued: number; redeemed: number }> = {};
    if (c.data && b.data) {
      const backerTierById: Record<string, string> = {};
      (b.data as Backer[]).forEach(bk => { backerTierById[bk.id] = bk.tier; });
      c.data.forEach((row: any) => {
        const tier = row.backer_id ? backerTierById[row.backer_id] : null;
        if (!tier) return;
        if (!cs[tier]) cs[tier] = { issued: 0, redeemed: 0 };
        cs[tier].issued++;
        if (row.redeemed_at) cs[tier].redeemed++;
      });
    }
    setCodeStats(cs);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  // CSV ファイル選択
  const handleCsvFile = (file: File) => {
    setCsvResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(String(ev.target?.result || ""));
    reader.readAsText(file, "UTF-8");
  };

  // CSV 取込実行
  const handleImport = async () => {
    if (!csvText.trim()) { alert("CSV ファイルを選択してください"); return; }
    setBusy(true);
    const { rows, errors } = parseCsvToBackers(csvText);
    if (rows.length === 0) {
      setCsvResult({ inserted: 0, duplicated: 0, errors: errors.length ? errors : ["有効な行なし"] });
      setBusy(false);
      return;
    }
    let inserted = 0, duplicated = 0;
    const insertErrors: string[] = [...errors];
    for (const row of rows) {
      const { error } = await supabase.from("crowdfunding_backers").insert(row);
      if (error) {
        if (error.code === "23505") duplicated++;
        else insertErrors.push(`${row.email}: ${error.message}`);
      } else inserted++;
    }
    setCsvResult({ inserted, duplicated, errors: insertErrors });
    setBusy(false);
    await loadAll();
  };

  // status 個別更新
  const updateStatus = async (backerId: string, newStatus: "pending" | "fulfilled" | "cancelled") => {
    const patch: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "fulfilled") patch.redeemed_at = new Date().toISOString();
    const { error } = await supabase.from("crowdfunding_backers").update(patch).eq("id", backerId);
    if (error) { alert("更新失敗: " + error.message); return; }
    await loadAll();
  };

  // user_id 紐付け
  const linkUser = async (backerId: string, email: string) => {
    const userIdInput = prompt(`バッカー ${email} に紐付ける user_id を入力 (空でメール自動マッチ):`);
    if (userIdInput === null) return;
    let userId = userIdInput.trim();
    if (!userId) {
      const { data: p } = await supabase.from("profiles").select("id").eq("email", email).limit(1).maybeSingle();
      if (!p) { alert(`email "${email}" に該当する profile が見つかりません`); return; }
      userId = (p as any).id;
    }
    const { error } = await supabase.from("crowdfunding_backers").update({ user_id: userId, updated_at: new Date().toISOString() }).eq("id", backerId);
    if (error) { alert("紐付け失敗: " + error.message); return; }
    await loadAll();
  };

  // 一括 fulfilled
  const bulkFulfill = async () => {
    const targets = filtered.filter(b => b.status === "pending");
    if (targets.length === 0) { alert("pending のバッカーがいません"); return; }
    if (!confirm(`${targets.length}件を fulfilled に更新します。よろしいですか?`)) return;
    setBusy(true);
    const now = new Date().toISOString();
    const ids = targets.map(t => t.id);
    const { error } = await supabase.from("crowdfunding_backers").update({ status: "fulfilled", redeemed_at: now, updated_at: now }).in("id", ids);
    setBusy(false);
    if (error) { alert("一括更新失敗: " + error.message); return; }
    alert(`${targets.length}件を fulfilled に更新しました`);
    await loadAll();
  };

  // Code 一括生成 (フィルター結果のバッカーに、まだ持ってない人だけ発行)
  const bulkGenerateCodes = async () => {
    if (filtered.length === 0) { alert("対象なし"); return; }
    if (!confirm(`${filtered.length}名のバッカーに対し、未発行者にコードを生成します。続行?`)) return;
    setBusy(true);
    // 既存コードあるか確認 (backer_id IN ...)
    const ids = filtered.map(b => b.id);
    const { data: existing } = await supabase.from("crowdfunding_codes").select("backer_id").in("backer_id", ids);
    const have = new Set((existing || []).map((e: any) => e.backer_id));
    const tierToRewardId: Record<string, string> = {};
    rewards.forEach(r => { tierToRewardId[r.id] = r.id; });
    let issued = 0, errors: string[] = [];
    for (const b of filtered) {
      if (have.has(b.id)) continue;
      const code = generateRedemptionCode();
      const { error } = await supabase.from("crowdfunding_codes").insert({
        code, reward_id: tierToRewardId[b.tier] || b.tier,
        campfire_order_id: b.campfire_order_id, backer_id: b.id,
      });
      if (error) errors.push(`${b.email}: ${error.message}`);
      else issued++;
    }
    setBusy(false);
    alert(`新規発行: ${issued}件\n既存スキップ: ${have.size}件\nエラー: ${errors.length}件${errors.length ? "\n" + errors.slice(0, 5).join("\n") : ""}`);
    await loadAll();
  };

  // 依頼書 #34 Phase 1 (2026/5/31): 事前コードプール発行
  // backer_id=NULL で コードを大量発行 → CAMPFIRE 支援者リスト届く前に King がストックしておく用
  const bulkGeneratePoolCodes = async () => {
    if (!poolRewardId) { alert("リターンを選択してください"); return; }
    if (poolCount < 1 || poolCount > 500) { alert("枚数は 1〜500 で指定してください"); return; }
    if (!confirm(`${poolRewardId} のコードを ${poolCount} 枚 事前発行します。続行?`)) return;
    setPoolBusy(true);
    setPoolResult(null);
    let generated = 0;
    const errors: string[] = [];
    const batchNote = `pool batch ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
    for (let i = 0; i < poolCount; i++) {
      const code = generateRedemptionCode();
      const { error } = await supabase.from("crowdfunding_codes").insert({
        code, reward_id: poolRewardId, backer_id: null, notes: batchNote,
      });
      if (error) {
        if (error.code === "23505") errors.push(`重複(自動再試行未実装): ${code}`);
        else errors.push(`${code}: ${error.message}`);
      } else generated++;
    }
    setPoolBusy(false);
    setPoolResult({ generated, errors });
    await loadAll();
  };

  // プールコード CSV エクスポート (CAMPFIRE メッセージで支援者に配布する用)
  const exportPoolCodesCSV = () => {
    if (poolCodes.length === 0) { alert("発行済みプールコードがありません"); return; }
    const header = ["code", "reward_id", "issued_at", "redeemed_at", "redeemed_by_user_id", "notes"].join(",");
    const body = poolCodes.map(c => [
      c.code, c.reward_id, c.issued_at, c.redeemed_at || "", c.redeemed_by_user_id || "", c.notes || "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const csv = "﻿" + header + "\n" + body; // BOM 付き UTF-8 (Excel 対応)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qocca-codes-pool-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ──── 集計 ────
  const filtered = backers.filter(b =>
    (!filterTier || b.tier === filterTier) &&
    (!filterStatus || b.status === filterStatus) &&
    (!search || (b.email + " " + (b.display_name || "")).toLowerCase().includes(search.toLowerCase()))
  );

  const totalAmount = backers.filter(b => b.status !== "cancelled").reduce((s, b) => s + b.amount, 0);
  const goalPercent = Math.min(100, Math.round((totalAmount / CROWDFUNDING_GOAL) * 100));

  const tierStats = TIER_OPTIONS.map(t => {
    const arr = backers.filter(b => b.tier === t.id && b.status !== "cancelled");
    const sum = arr.reduce((s, b) => s + b.amount, 0);
    const fulfilled = arr.filter(b => b.status === "fulfilled").length;
    const rate = arr.length === 0 ? 0 : Math.round((fulfilled / arr.length) * 100);
    return { ...t, count: arr.length, sum, fulfilled, rate };
  });

  const statusCounts = STATUS_OPTIONS.map(s => ({
    ...s, count: backers.filter(b => b.status === s.id).length,
  }));

  if (loading) return <div style={{ color: C.warmGray, padding: 40 }}>読み込み中...</div>;

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 4 }}>🎁 クラファン管理</div>
      <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 20 }}>CAMPFIRE バッカー取込・履行・コード発行を一画面で完結</div>

      {/* ── 統計ダッシュボード ── */}
      <div style={{ background: C.white, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>📈 統計</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: C.warmGray }}>全体達成</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: C.orange }}>¥{totalAmount.toLocaleString()} / ¥{CROWDFUNDING_GOAL.toLocaleString()} ({goalPercent}%)</span>
          </div>
          <div style={{ background: C.cream, borderRadius: 8, height: 10, overflow: "hidden" }}>
            <div style={{ background: C.orange, height: "100%", width: `${goalPercent}%`, transition: "width 0.3s" }} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {tierStats.map(t => (
            <div key={t.id} style={{ background: C.cream, padding: "10px 12px", borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 2 }}>{t.label}{t.limit ? ` (上限 ${t.limit})` : ""}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{t.count}{t.limit ? `/${t.limit}` : ""}名 ¥{t.sum.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: C.warmGray }}>履行率 {t.rate}% ({t.fulfilled}/{t.count}) · Code {codeStats[t.id]?.issued || 0}発行</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          {statusCounts.map(s => (
            <div key={s.id} style={{ background: s.bg, color: s.color, padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              {s.label}: {s.count}
            </div>
          ))}
        </div>
      </div>

      {/* ── CSV インポート ── */}
      <div style={{ background: C.white, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>📥 CAMPFIRE CSV インポート</div>
        <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 10 }}>
          想定カラム: email(必須) / display_name / tier(必須・例: supporter_1000) / amount(必須) / campfire_order_id
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])} style={{ fontSize: 12 }} />
          <button onClick={handleImport} disabled={busy || !csvText} style={{ padding: "8px 16px", background: csvText ? C.orange : C.warmGray, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: csvText ? "pointer" : "not-allowed", fontSize: 13, fontFamily: "inherit" }}>
            {busy ? "取込中..." : "🚀 取込実行"}
          </button>
        </div>
        {csvResult && (
          <div style={{ marginTop: 12, padding: 12, background: C.cream, borderRadius: 10, fontSize: 12 }}>
            <div style={{ color: C.dark, fontWeight: 700, marginBottom: 4 }}>
              ✅ 新規 {csvResult.inserted}件 / 🔁 重複 {csvResult.duplicated}件 / ⚠️ エラー {csvResult.errors.length}件
            </div>
            {csvResult.errors.length > 0 && (
              <div style={{ color: "#E57373", fontSize: 11, whiteSpace: "pre-line" }}>{csvResult.errors.slice(0, 8).join("\n")}{csvResult.errors.length > 8 ? `\n... 他 ${csvResult.errors.length - 8}件` : ""}</div>
            )}
          </div>
        )}
      </div>

      {/* ── 依頼書 #34 Phase 1: 事前コードプール発行 (backer 紐付け無しで大量発行) ── */}
      <div style={{ background: C.white, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 4 }}>📦 事前コードプール発行</div>
        <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 12, lineHeight: 1.6 }}>
          CAMPFIRE 支援者リストが届く前に、リターン別にコードをまとめて発行できます。<br />
          発行したコードは <strong>CSV ダウンロード</strong> で書き出し、King が CAMPFIRE のメッセージ機能経由で支援者に配布します。
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <select value={poolRewardId} onChange={(e) => setPoolRewardId(e.target.value)} style={{ padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "inherit", minWidth: 240 }}>
            <option value="">リターンを選択...</option>
            {rewards.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} (¥{r.price_jpy.toLocaleString()})
              </option>
            ))}
          </select>
          <input
            type="number" min={1} max={500} value={poolCount}
            onChange={(e) => setPoolCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
            style={{ width: 100, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "inherit" }}
          />
          <span style={{ fontSize: 12, color: C.warmGray }}>枚 (1〜500)</span>
          <button onClick={bulkGeneratePoolCodes} disabled={poolBusy || !poolRewardId} style={{ padding: "8px 16px", background: poolRewardId && !poolBusy ? C.orange : C.warmGray, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: poolRewardId && !poolBusy ? "pointer" : "not-allowed", fontSize: 13, fontFamily: "inherit" }}>
            {poolBusy ? "発行中..." : "🎟️ 発行する"}
          </button>
          <button onClick={exportPoolCodesCSV} disabled={poolCodes.length === 0} style={{ padding: "8px 14px", background: poolCodes.length > 0 ? "#4CAF50" : C.warmGray, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: poolCodes.length > 0 ? "pointer" : "not-allowed", fontSize: 12, fontFamily: "inherit" }}>
            📥 CSV ダウンロード ({poolCodes.length}件)
          </button>
        </div>
        {poolResult && (
          <div style={{ padding: 12, background: C.cream, borderRadius: 10, fontSize: 12, marginBottom: 10 }}>
            <div style={{ color: C.dark, fontWeight: 700, marginBottom: 4 }}>
              ✅ 新規発行 {poolResult.generated}件 / ⚠️ エラー {poolResult.errors.length}件
            </div>
            {poolResult.errors.length > 0 && (
              <div style={{ color: "#E57373", fontSize: 11, whiteSpace: "pre-line" }}>{poolResult.errors.slice(0, 5).join("\n")}{poolResult.errors.length > 5 ? `\n... 他 ${poolResult.errors.length - 5}件` : ""}</div>
            )}
          </div>
        )}
        <button onClick={() => setPoolListOpen(!poolListOpen)} style={{ background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 11, color: C.warmGray, cursor: "pointer", fontFamily: "inherit" }}>
          {poolListOpen ? "▲ 発行済プールコード一覧を閉じる" : `▼ 発行済プールコード一覧を表示 (${poolCodes.length}件)`}
        </button>
        {poolListOpen && (
          <div style={{ marginTop: 12, maxHeight: 360, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead style={{ background: C.cream, position: "sticky", top: 0 }}>
                <tr>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: C.warmGray, fontWeight: 700 }}>code</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: C.warmGray, fontWeight: 700 }}>reward</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: C.warmGray, fontWeight: 700 }}>発行日時</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", color: C.warmGray, fontWeight: 700 }}>状態</th>
                </tr>
              </thead>
              <tbody>
                {poolCodes.map(pc => {
                  const rewardName = rewards.find(r => r.id === pc.reward_id)?.name || pc.reward_id;
                  const redeemed = !!pc.redeemed_at;
                  return (
                    <tr key={pc.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", color: C.dark, fontWeight: 700 }}>{pc.code}</td>
                      <td style={{ padding: "6px 10px", color: C.warmGray }}>{rewardName}</td>
                      <td style={{ padding: "6px 10px", color: C.warmGray }}>{new Date(pc.issued_at).toLocaleString("ja-JP")}</td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        {redeemed
                          ? <span style={{ background: "#E8F5E9", color: "#4CAF50", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>✅ 引換済</span>
                          : <span style={{ background: "#FFF3E0", color: "#FF9800", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>⏳ 未引換</span>}
                      </td>
                    </tr>
                  );
                })}
                {poolCodes.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: C.warmGray, fontSize: 11 }}>まだプールコードは発行されていません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── フィルター + 一括操作 ── */}
      <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} style={{ padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "inherit" }}>
          <option value="">全 tier</option>
          {TIER_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "inherit" }}>
          <option value="">全 status</option>
          {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <input type="text" placeholder="email / 名前 検索..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "inherit" }} />
        <button onClick={bulkFulfill} disabled={busy} style={{ padding: "8px 14px", background: "#4CAF50", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: busy ? "wait" : "pointer", fontSize: 12, fontFamily: "inherit" }}>✅ 一括 fulfilled</button>
        <button onClick={bulkGenerateCodes} disabled={busy} style={{ padding: "8px 14px", background: C.orange, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: busy ? "wait" : "pointer", fontSize: 12, fontFamily: "inherit" }}>🎟️ Code 一括生成</button>
        <div style={{ fontSize: 11, color: C.warmGray }}>表示中 {filtered.length}件</div>
      </div>

      {/* ── バッカー一覧 ── */}
      <div style={{ background: C.white, borderRadius: 16, padding: 0, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: C.cream }}>
              <tr>
                <th style={{ padding: "10px 12px", textAlign: "left", color: C.warmGray, fontWeight: 700, fontSize: 11 }}>email</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: C.warmGray, fontWeight: 700, fontSize: 11 }}>名前</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: C.warmGray, fontWeight: 700, fontSize: 11 }}>tier</th>
                <th style={{ padding: "10px 12px", textAlign: "right", color: C.warmGray, fontWeight: 700, fontSize: 11 }}>金額</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: C.warmGray, fontWeight: 700, fontSize: 11 }}>order_id</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: C.warmGray, fontWeight: 700, fontSize: 11 }}>user</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: C.warmGray, fontWeight: 700, fontSize: 11 }}>status</th>
                <th style={{ padding: "10px 12px", textAlign: "center", color: C.warmGray, fontWeight: 700, fontSize: 11 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const tierLabel = TIER_OPTIONS.find(t => t.id === b.tier)?.label || b.tier;
                const st = STATUS_OPTIONS.find(s => s.id === b.status)!;
                return (
                  <tr key={b.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: C.dark, wordBreak: "break-all" }}>{b.email}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: C.dark }}>{b.display_name || "-"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: C.warmGray }}>{tierLabel}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: C.orange, textAlign: "right" }}>¥{b.amount.toLocaleString()}</td>
                    <td style={{ padding: "10px 12px", fontSize: 10, color: C.warmGray, fontFamily: "monospace" }}>{b.campfire_order_id || "-"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 11 }}>
                      {b.user_id ? <span style={{ color: "#4CAF50" }}>🔗 紐付済</span> : <button onClick={() => linkUser(b.id, b.email)} style={{ padding: "4px 8px", background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 6, fontSize: 10, cursor: "pointer", color: C.warmGray, fontFamily: "inherit" }}>紐付け</button>}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ background: st.bg, color: st.color, padding: "3px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700 }}>{st.label}</span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <select value={b.status} onChange={(e) => updateStatus(b.id, e.target.value as any)} style={{ padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, fontFamily: "inherit" }}>
                        {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.warmGray, fontSize: 13 }}>該当するバッカーがいません</div>}
        </div>
      </div>
    </div>
  );
};

// ── Meta 広告 AI 完全自動運用 (依頼書 #26 v2) ────────────────────────────────
// 8 tables: meta_campaigns / ad_sets / creatives / ab_tests / budget_adjustments
//           / landing_pages / monthly_budgets / daily_reports
// RLS: admin_only + service_role 超厳格 / 一般ユーザー完全禁止
// 目標 ROAS: 5x〜10x / 3段階予算ガード (5万/10万)
// ────────────────────────────────────────────────────────────────────────────
const META_TABS = [
  { id: 0, icon: "📊", label: "ダッシュボード" },
  { id: 1, icon: "🎯", label: "キャンペーン" },
  { id: 2, icon: "🎨", label: "クリエイティブ" },
  { id: 3, icon: "🧪", label: "A/Bテスト" },
  { id: 4, icon: "🤖", label: "AI生成" },
  { id: 5, icon: "💴", label: "予算管理 v2.0" },
  { id: 6, icon: "🌐", label: "LP A/B" },
  { id: 7, icon: "📅", label: "日次レポート" },
  { id: 8, icon: "💡", label: "AI 戦略提案" },
  { id: 9, icon: "🛑", label: "Kill Switch" },
];

const fmtJPY = (n: number | null | undefined) =>
  n == null ? "—" : "¥" + Math.round(Number(n)).toLocaleString("ja-JP");
const fmtNum = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("ja-JP");
const fmtPct = (n: number | null | undefined, digits = 2) =>
  n == null ? "—" : (Number(n) * 100).toFixed(digits) + "%";
const fmtRoas = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toFixed(2) + "x";

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const MetaAdsPage = () => {
  const [tab, setTab] = useState(0);
  const [budget, setBudget] = useState<any | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [creatives, setCreatives] = useState<any[]>([]);
  const [abTests, setAbTests] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [landings, setLandings] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [killBusy, setKillBusy] = useState(false);

  const monthKey = currentMonthKey();

  const loadAll = async () => {
    setLoading(true);
    const [b, c, cr, ab, adj, lp, rp] = await Promise.all([
      supabase.from("meta_monthly_budgets").select("*").eq("month", monthKey).maybeSingle(),
      supabase.from("meta_campaigns").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("meta_creatives").select("*").order("roas", { ascending: false, nullsFirst: false }).limit(50),
      supabase.from("meta_ab_tests").select("*").order("start_date", { ascending: false }).limit(20),
      supabase.from("meta_budget_adjustments").select("*").order("applied_at", { ascending: false }).limit(20),
      supabase.from("meta_landing_pages").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("meta_daily_reports").select("*").order("date", { ascending: false }).limit(14),
    ]);
    setBudget(b.data);
    setCampaigns(c.data || []);
    setCreatives(cr.data || []);
    setAbTests(ab.data || []);
    setAdjustments(adj.data || []);
    setLandings(lp.data || []);
    setReports(rp.data || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  // ── 予算 mode の色 ─────────────────────────────────────────────
  const modeColor = (m: string | null | undefined) => {
    switch (m) {
      case "normal":    return { color: C.green,  bg: C.greenPale, label: "通常" };
      case "expansion": return { color: C.blue,   bg: C.bluePale,  label: "拡大" };
      case "careful":   return { color: "#F57C00", bg: "#FFF3E0",  label: "慎重" };
      case "paused":    return { color: C.red,    bg: C.redPale,   label: "停止中" };
      default:          return { color: C.warmGray, bg: C.cream,   label: m || "—" };
    }
  };

  // ── Kill Switch ──────────────────────────────────────────────
  const handleKillSwitch = async () => {
    if (!confirm("⚠️ 緊急 Kill Switch を実行しますか?\n\n全広告が即座に pause され、当月の mode が 'paused' になります。\nこの操作は AI による自動再開を阻止します。")) return;
    setKillBusy(true);
    try {
      // 1. 当月予算を paused に
      await supabase.from("meta_monthly_budgets")
        .update({ mode: "paused", notes: `緊急 Kill Switch 実行: ${new Date().toISOString()}`, updated_at: new Date().toISOString() })
        .eq("month", monthKey);
      // 2. 全 ad_sets を inactive に
      await supabase.from("meta_ad_sets").update({ is_active: false }).eq("is_active", true);
      // 3. 全 creatives を inactive に
      await supabase.from("meta_creatives").update({ is_active: false }).eq("is_active", true);
      alert("✅ Kill Switch 実行完了\n\n全広告を pause しました。\nMeta 広告 API への反映は Phase 3 Edge Function 完成後に同期されます。");
      await loadAll();
    } catch (e: any) {
      alert("❌ エラー: " + (e?.message || e));
    } finally {
      setKillBusy(false);
    }
  };

  // ── 共通スタイル ─────────────────────────────────────────────
  const card: React.CSSProperties = { background: C.white, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` };
  const empty = (text: string) => (
    <div style={{ ...card, textAlign: "center", color: C.warmGray, fontSize: 13, padding: 32 }}>
      {text}
      <div style={{ fontSize: 11, marginTop: 8, color: C.warmGray }}>※ Edge Function (Phase 3 / 6月着手) 稼働後にデータが入ります</div>
    </div>
  );
  const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 11, color: C.warmGray, fontWeight: 700, borderBottom: `1px solid ${C.border}`, background: C.cream };
  const td: React.CSSProperties = { padding: "10px", fontSize: 12, color: C.dark, borderBottom: `1px solid ${C.border}` };

  // ── 0. ダッシュボード ────────────────────────────────────────
  const renderDashboard = () => {
    const spend  = Number(budget?.current_spend || 0);
    const base   = Number(budget?.base_budget || 50000);
    const max    = Number(budget?.max_budget || 100000);
    const remain = max - spend;
    const m = modeColor(budget?.mode);
    const todayReport = reports[0];
    const totalRevenue = reports.reduce((s, r) => s + Number(r.total_revenue || 0), 0);
    const totalSpend = reports.reduce((s, r) => s + Number(r.total_spend || 0), 0);
    const cumRoas = totalSpend > 0 ? totalRevenue / totalSpend : null;

    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
          <div style={card}>
            <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>当月 spend</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.dark }}>{fmtJPY(spend)}</div>
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 4 }}>/ {fmtJPY(max)} (上限)</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>当月 revenue (集計)</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.green }}>{fmtJPY(totalRevenue)}</div>
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 4 }}>直近14日合算</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>累計 ROAS</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: (cumRoas || 0) >= 5 ? C.green : C.dark }}>{fmtRoas(cumRoas)}</div>
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 4 }}>目標 5x〜10x</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>現在の mode</div>
            <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: m.bg, color: m.color, fontWeight: 800, fontSize: 14 }}>{m.label}</div>
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 8 }}>残額 {fmtJPY(remain)}</div>
          </div>
        </div>

        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>📊 3段階予算ガード</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200, background: C.bluePale, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: C.blue, fontWeight: 700, marginBottom: 4 }}>🎚️ Lv1: Meta 側絶対上限</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.dark }}>{fmtJPY(max)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 200, background: C.greenPale, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 4 }}>🎚️ Lv2: AI 通常運用</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.dark }}>{fmtJPY(base)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 200, background: C.orangePale, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, marginBottom: 4 }}>🎚️ Lv3: 柔軟調整レンジ</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.dark }}>{fmtJPY(base)} 〜 {fmtJPY(max)}</div>
            </div>
          </div>
        </div>

        {todayReport ? (
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 10 }}>📅 直近の日次レポート ({todayReport.date})</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, fontSize: 13 }}>
              <div><span style={{ color: C.warmGray }}>Spend: </span><b>{fmtJPY(todayReport.total_spend)}</b></div>
              <div><span style={{ color: C.warmGray }}>Revenue: </span><b>{fmtJPY(todayReport.total_revenue)}</b></div>
              <div><span style={{ color: C.warmGray }}>ROAS: </span><b>{fmtRoas(todayReport.total_roas)}</b></div>
            </div>
            {todayReport.ai_recommendations && (
              <div style={{ marginTop: 12, padding: 10, background: C.cream, borderRadius: 8, fontSize: 12, color: C.dark }}>
                💡 {todayReport.ai_recommendations}
              </div>
            )}
          </div>
        ) : empty("日次レポートはまだありません。")}
      </div>
    );
  };

  // ── 1. キャンペーン管理 ───────────────────────────────────────
  const renderCampaigns = () => {
    if (campaigns.length === 0) return empty("キャンペーン未登録。");
    return (
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>名前</th><th style={th}>目的</th><th style={th}>Status</th><th style={th}>日予算</th><th style={th}>累計</th><th style={th}>作成</th>
          </tr></thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.name}</td>
                <td style={td}>{c.objective || "—"}</td>
                <td style={td}>{c.status || "—"}</td>
                <td style={td}>{fmtJPY(c.daily_budget)}</td>
                <td style={td}>{fmtJPY(c.total_spend)}</td>
                <td style={td}>{c.created_at ? new Date(c.created_at).toLocaleDateString("ja-JP") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ── 2. クリエイティブ一覧 (ROAS 順) ─────────────────────────
  const renderCreatives = () => {
    if (creatives.length === 0) return empty("クリエイティブ未登録。");
    return (
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Headline</th><th style={th}>Type</th><th style={th}>生成元</th>
            <th style={th}>Impr</th><th style={th}>CTR</th><th style={th}>CPC</th><th style={th}>ROAS</th><th style={th}>Active</th>
          </tr></thead>
          <tbody>
            {creatives.map((c) => (
              <tr key={c.id}>
                <td style={{ ...td, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.headline || "—"}</td>
                <td style={td}>{c.type || "—"}</td>
                <td style={td}>{c.generated_by || "—"}</td>
                <td style={td}>{fmtNum(c.impressions)}</td>
                <td style={td}>{fmtPct(c.ctr)}</td>
                <td style={td}>{fmtJPY(c.cpc)}</td>
                <td style={{ ...td, fontWeight: 800, color: (Number(c.roas) || 0) >= 5 ? C.green : C.dark }}>{fmtRoas(c.roas)}</td>
                <td style={td}>{c.is_active ? "✅" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ── 3. A/B テスト履歴 ───────────────────────────────────────
  const renderAbTests = () => {
    if (abTests.length === 0) return empty("A/B テスト履歴なし。");
    return (
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>テスト名</th><th style={th}>期間</th><th style={th}>勝者</th><th style={th}>信頼度</th><th style={th}>サマリ</th>
          </tr></thead>
          <tbody>
            {abTests.map((t) => (
              <tr key={t.id}>
                <td style={td}>{t.test_name || "—"}</td>
                <td style={td}>{t.start_date ? new Date(t.start_date).toLocaleDateString("ja-JP") : "—"} 〜 {t.end_date ? new Date(t.end_date).toLocaleDateString("ja-JP") : "進行中"}</td>
                <td style={td}>{t.winner_id ? "✅" : "—"}</td>
                <td style={td}>{t.confidence != null ? fmtPct(t.confidence, 1) : "—"}</td>
                <td style={td}>{t.test_summary || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ── 4. AI クリエイティブ生成 ──────────────────────────────
  const renderAiGen = () => (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>🤖 AI クリエイティブ生成 (Phase 3 で稼働予定)</div>
      <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 16, lineHeight: 1.7 }}>
        Phase 3 Edge Function <code>generate-ad-creative</code> 完成後に稼働。<br />
        gpt-4o でコピー (Headline / Body / CTA) を生成し、gpt-image-1 で画像を生成。<br />
        生成されたクリエイティブは <code>meta_creatives</code> テーブルに登録され、A/B テスト枠に投入される。
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ fontSize: 12, color: C.warmGray, fontWeight: 700 }}>ターゲット (例: 30代女性 / 犬オーナー)</label>
        <input disabled placeholder="Phase 3 で有効化" style={{ padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", background: C.cream }} />
        <label style={{ fontSize: 12, color: C.warmGray, fontWeight: 700, marginTop: 4 }}>訴求軸 (例: 似顔絵 / クラファン)</label>
        <input disabled placeholder="Phase 3 で有効化" style={{ padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", background: C.cream }} />
        <button disabled style={{ marginTop: 10, padding: 12, background: C.warmGray, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "not-allowed", fontFamily: "inherit", opacity: 0.6 }}>
          🚧 生成する (Phase 3 で有効化)
        </button>
      </div>
    </div>
  );

  // ── 5. 予算管理 v2.0 ──────────────────────────────────────
  const renderBudget = () => (
    <div>
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>💴 当月 ({monthKey}) 予算</div>
        {budget ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, fontSize: 13 }}>
            <div><div style={{ color: C.warmGray, fontSize: 11 }}>base_budget</div><b>{fmtJPY(budget.base_budget)}</b></div>
            <div><div style={{ color: C.warmGray, fontSize: 11 }}>max_budget</div><b>{fmtJPY(budget.max_budget)}</b></div>
            <div><div style={{ color: C.warmGray, fontSize: 11 }}>current_spend</div><b>{fmtJPY(budget.current_spend)}</b></div>
            <div><div style={{ color: C.warmGray, fontSize: 11 }}>mode</div><b style={{ color: modeColor(budget.mode).color }}>{modeColor(budget.mode).label}</b></div>
          </div>
        ) : (
          <div style={{ color: C.warmGray, fontSize: 13 }}>当月の budget レコード未登録。</div>
        )}
      </div>
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 10 }}>🤖 AI 予算調整履歴</div>
        {adjustments.length === 0 ? (
          <div style={{ color: C.warmGray, fontSize: 13, textAlign: "center", padding: 20 }}>調整履歴なし</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>適用日時</th><th style={th}>Before</th><th style={th}>After</th><th style={th}>変化</th><th style={th}>理由</th><th style={th}>AI 信頼度</th>
            </tr></thead>
            <tbody>
              {adjustments.map((a) => {
                const delta = Number(a.after_budget) - Number(a.before_budget);
                return (
                  <tr key={a.id}>
                    <td style={td}>{a.applied_at ? new Date(a.applied_at).toLocaleString("ja-JP") : "—"}</td>
                    <td style={td}>{fmtJPY(a.before_budget)}</td>
                    <td style={td}>{fmtJPY(a.after_budget)}</td>
                    <td style={{ ...td, color: delta >= 0 ? C.green : C.red, fontWeight: 800 }}>{delta >= 0 ? "+" : ""}{fmtJPY(delta)}</td>
                    <td style={td}>{a.reason || "—"}</td>
                    <td style={td}>{a.ai_confidence != null ? fmtPct(a.ai_confidence, 1) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ── 6. LP A/B テスト ────────────────────────────────────
  const renderLandings = () => {
    if (landings.length === 0) return empty("LP 未登録。");
    return (
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Variant</th><th style={th}>URL</th><th style={th}>Visits</th><th style={th}>Conversions</th><th style={th}>CVR</th><th style={th}>Active</th>
          </tr></thead>
          <tbody>
            {landings.map((l) => (
              <tr key={l.id}>
                <td style={td}>{l.variant_name || "—"}</td>
                <td style={{ ...td, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.url}</td>
                <td style={td}>{fmtNum(l.visits)}</td>
                <td style={td}>{fmtNum(l.conversions)}</td>
                <td style={td}>{fmtPct(l.conversion_rate)}</td>
                <td style={td}>{l.is_active ? "✅" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ── 7. 日次レポート ─────────────────────────────────────
  const renderReports = () => {
    if (reports.length === 0) return empty("日次レポートなし。");
    return (
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>日付</th><th style={th}>Spend</th><th style={th}>Revenue</th><th style={th}>ROAS</th><th style={th}>Mode</th><th style={th}>AI 推奨</th>
          </tr></thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.date}</td>
                <td style={td}>{fmtJPY(r.total_spend)}</td>
                <td style={td}>{fmtJPY(r.total_revenue)}</td>
                <td style={{ ...td, fontWeight: 800 }}>{fmtRoas(r.total_roas)}</td>
                <td style={td}>{r.current_mode || "—"}</td>
                <td style={{ ...td, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.ai_recommendations || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ── 8. AI 戦略提案 ──────────────────────────────────────
  const renderAiStrategy = () => {
    const withRecs = reports.filter((r) => r.ai_recommendations);
    if (withRecs.length === 0) return empty("AI 戦略提案はまだありません。");
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {withRecs.map((r) => (
          <div key={r.id} style={card}>
            <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 6 }}>{r.date} / mode: <b>{r.current_mode}</b> / ROAS: <b>{fmtRoas(r.total_roas)}</b></div>
            <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.7 }}>💡 {r.ai_recommendations}</div>
          </div>
        ))}
      </div>
    );
  };

  // ── 9. 緊急 Kill Switch ─────────────────────────────────
  const renderKillSwitch = () => {
    const m = modeColor(budget?.mode);
    const isPaused = budget?.mode === "paused";
    return (
      <div>
        <div style={{ ...card, marginBottom: 14, background: isPaused ? C.redPale : C.white, border: `2px solid ${isPaused ? C.red : C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>🛑 緊急 Kill Switch</div>
          <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 16, lineHeight: 1.7 }}>
            異常検知時・規約違反疑い時・King 判断で全広告を即座に pause します。<br />
            実行内容:<br />
            ① <code>meta_monthly_budgets.mode = 'paused'</code> (当月)<br />
            ② <code>meta_ad_sets.is_active = false</code> (全件)<br />
            ③ <code>meta_creatives.is_active = false</code> (全件)<br />
            <br />
            ※ Meta 広告 API への反映は Phase 3 Edge Function 完成後に同期されます。
          </div>
          <div style={{ marginBottom: 16, padding: 12, background: m.bg, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 4 }}>現在の mode</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: m.color }}>{m.label}</div>
          </div>
          <button
            onClick={handleKillSwitch}
            disabled={killBusy || isPaused}
            style={{
              width: "100%", padding: 14, background: isPaused ? C.warmGray : C.red, color: "#fff",
              border: "none", borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: (killBusy || isPaused) ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: (killBusy || isPaused) ? 0.6 : 1,
            }}
          >
            {killBusy ? "実行中..." : isPaused ? "既に停止中" : "🛑 緊急 Kill Switch 実行"}
          </button>
        </div>
      </div>
    );
  };

  // ── タブ切替 ─────────────────────────────────────────────
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 6 }}>💰 Meta 広告 AI 完全自動運用</h2>
      <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 16 }}>
        Phase 1 DDL 8テーブル 完了 ✅ / Phase 3 Edge Function 10本 (6月着手予定) / 目標 ROAS 5x〜10x
      </div>

      {/* タブナビ */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16, borderBottom: `2px solid ${C.border}` }}>
        {META_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 14px", background: tab === t.id ? C.orange : "transparent",
              color: tab === t.id ? "#fff" : C.warmGray, border: "none",
              borderRadius: "10px 10px 0 0", cursor: "pointer",
              fontWeight: 700, fontSize: 12, fontFamily: "inherit",
              borderBottom: tab === t.id ? `3px solid ${C.orange}` : "none",
              marginBottom: -2,
            }}
          >
            <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: "center", color: C.warmGray, padding: 32 }}>読み込み中…</div>
      ) : (
        <>
          {tab === 0 && renderDashboard()}
          {tab === 1 && renderCampaigns()}
          {tab === 2 && renderCreatives()}
          {tab === 3 && renderAbTests()}
          {tab === 4 && renderAiGen()}
          {tab === 5 && renderBudget()}
          {tab === 6 && renderLandings()}
          {tab === 7 && renderReports()}
          {tab === 8 && renderAiStrategy()}
          {tab === 9 && renderKillSwitch()}
        </>
      )}
    </div>
  );
};

// ── AI イベント収集 管理 (依頼書 #27 v2 Phase 3) ────────────────────────────
// 8 tables: events 拡張 + event_sources / event_scrape_logs / event_dedup_hashes
// Edge Function は 6/5 までに別 commit 予定 (Phase 2)
// 著作権安全運用: official_url 必須 / AI 要約 100字以内 / 公式画像 collection しない
// ────────────────────────────────────────────────────────────────────────────
const EVENTS_AI_TABS = [
  { id: 0, icon: "📊", label: "ダッシュボード" },
  { id: 1, icon: "⏳", label: "承認待ち" },
  { id: 2, icon: "🤖", label: "自動承認済" },
  { id: 3, icon: "📅", label: "公開中" },
  { id: 4, icon: "✍️", label: "手動追加" },
  { id: 5, icon: "🌐", label: "情報源" },
  { id: 6, icon: "📜", label: "収集ログ" },
  { id: 7, icon: "🎚️", label: "AI 信頼度" },
  { id: 8, icon: "🛑", label: "Kill Switch" },
];

// AI 信頼度の閾値 (LocalStorage 保存 / Phase 2 Edge Function でも参照)
const DEFAULT_AI_THRESHOLDS = {
  auto_approve: 0.70,   // ≧0.70 で auto_approved
  pending: 0.50,        // 0.50-0.70 は pending (admin 確認)
  reject: 0.50,         // <0.50 は rejected
};

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  adoption: "🐶 譲渡会",
  expo: "🏛 展示会",
  market: "🛍 マルシェ",
  seminar: "🎓 セミナー",
  training: "🐕‍🦺 しつけ",
  cafe_event: "☕ カフェイベント",
  shopping_dog_ok: "🛒 犬連れ商店街",
  medical_check: "🩺 健康診断",
  photo_session: "📷 撮影会",
  fundraising: "🤝 チャリティ",
  welfare: "🌱 福祉啓発",
  other: "✨ その他",
};

const REGION_LABELS: Record<string, string> = {
  hokkaido: "北海道", tohoku: "東北", kanto: "関東", chubu: "中部",
  kinki: "近畿", chugoku: "中国", shikoku: "四国", kyushu: "九州", okinawa: "沖縄",
  nationwide: "全国", online: "オンライン",
};

const EventsAiManagementPage = () => {
  const [tab, setTab] = useState(0);
  const [events, setEvents] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // AI 信頼度閾値 (LocalStorage)
  const [thresholds, setThresholds] = useState(() => {
    try {
      const raw = localStorage.getItem("qocca_events_ai_thresholds");
      return raw ? JSON.parse(raw) : DEFAULT_AI_THRESHOLDS;
    } catch {
      return DEFAULT_AI_THRESHOLDS;
    }
  });

  // 手動追加フォーム
  const [addForm, setAddForm] = useState({
    title: "", description: "", event_date: "", event_time: "",
    place: "", prefecture: "大阪府", city: "",
    event_category: "adoption", region: "kinki",
    official_url: "", fee: "無料",
  });

  // 新規 source フォーム
  const [sourceForm, setSourceForm] = useState({
    name: "", url: "", source_type: "aggregator",
    prefecture: "", city: "", scrape_frequency: "weekly",
  });

  const loadAll = async () => {
    setLoading(true);
    const [evRes, srcRes, logRes] = await Promise.all([
      supabase.from("events").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("event_sources").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("event_scrape_logs").select("*, event_sources(name, url)").order("scraped_at", { ascending: false }).limit(50),
    ]);
    setEvents(evRes.data || []);
    setSources(srcRes.data || []);
    setLogs(logRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  // === 分析データ ===
  const counts = {
    total:       events.length,
    pending:     events.filter(e => e.approval_status === "pending").length,
    auto:        events.filter(e => e.approval_status === "auto_approved").length,
    manual:      events.filter(e => e.approval_status === "manual_approved").length,
    rejected:    events.filter(e => e.approval_status === "rejected").length,
    expired:     events.filter(e => e.approval_status === "expired").length,
  };
  const published = events.filter(e =>
    e.approval_status === "auto_approved" || e.approval_status === "manual_approved"
  );

  // カテゴリ別 / 都道府県別分布
  const byCategory = published.reduce((acc, e) => {
    const k = e.event_category || "other";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const byPrefecture = published.reduce((acc, e) => {
    const k = e.prefecture || "未指定";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // === Actions ===
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkApprove = async () => {
    if (selectedIds.size === 0) return alert("対象を選択してください");
    if (!confirm(`${selectedIds.size}件を一括承認 (manual_approved) しますか?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("events")
      .update({ approval_status: "manual_approved", status: "approved" })
      .in("id", Array.from(selectedIds));
    setBusy(false);
    if (error) return alert("エラー: " + error.message);
    setSelectedIds(new Set());
    loadAll();
  };

  const bulkReject = async () => {
    if (selectedIds.size === 0) return alert("対象を選択してください");
    if (!confirm(`${selectedIds.size}件を一括却下 (rejected) しますか?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("events")
      .update({ approval_status: "rejected", status: "rejected" })
      .in("id", Array.from(selectedIds));
    setBusy(false);
    if (error) return alert("エラー: " + error.message);
    setSelectedIds(new Set());
    loadAll();
  };

  const individualUpdate = async (id: string, newStatus: string) => {
    setBusy(true);
    await supabase
      .from("events")
      .update({ approval_status: newStatus, status: newStatus === "rejected" ? "rejected" : newStatus === "expired" ? "ended" : "approved" })
      .eq("id", id);
    setBusy(false);
    loadAll();
  };

  const handleManualAdd = async () => {
    if (!addForm.title || !addForm.event_date || !addForm.place) {
      return alert("タイトル / 日時 / 場所は必須です");
    }
    setBusy(true);
    const { error } = await supabase.from("events").insert({
      title: addForm.title,
      description: addForm.description || "",
      event_date: addForm.event_date,
      event_time: addForm.event_time,
      place: addForm.place,
      prefecture: addForm.prefecture,
      city: addForm.city,
      event_category: addForm.event_category,
      region: addForm.region,
      official_url: addForm.official_url,
      fee: addForm.fee,
      status: "approved",
      approval_status: "manual_approved",
      source_type: "admin_manual",
    });
    setBusy(false);
    if (error) return alert("エラー: " + error.message);
    alert("✅ イベント追加完了");
    setAddForm({ ...addForm, title: "", description: "", event_date: "", event_time: "", place: "", official_url: "" });
    loadAll();
  };

  const handleAddSource = async () => {
    if (!sourceForm.name || !sourceForm.url) return alert("名前と URL は必須です");
    setBusy(true);
    const { error } = await supabase.from("event_sources").insert(sourceForm);
    setBusy(false);
    if (error) return alert("エラー: " + error.message);
    setSourceForm({ name: "", url: "", source_type: "aggregator", prefecture: "", city: "", scrape_frequency: "weekly" });
    loadAll();
  };

  const toggleSourceActive = async (id: string, isActive: boolean) => {
    setBusy(true);
    await supabase.from("event_sources").update({ is_active: !isActive }).eq("id", id);
    setBusy(false);
    loadAll();
  };

  const saveThresholds = () => {
    try {
      localStorage.setItem("qocca_events_ai_thresholds", JSON.stringify(thresholds));
      alert("✅ AI 信頼度閾値を保存しました\n(Phase 2 Edge Function で参照されます)");
    } catch (e: any) {
      alert("エラー: " + e?.message);
    }
  };

  const handleKillSwitch = async () => {
    if (!confirm("⚠️ AI イベント収集の Kill Switch を実行しますか?\n\n全 event_sources を is_active=false にして、AI 自動収集を停止します。\n再開は「情報源管理」タブで個別に is_active=true に戻してください。")) return;
    setBusy(true);
    const { error } = await supabase.from("event_sources").update({ is_active: false }).eq("is_active", true);
    setBusy(false);
    if (error) return alert("エラー: " + error.message);
    alert("✅ Kill Switch 実行完了\n全 event_sources を停止しました。");
    loadAll();
  };

  // === 共通スタイル ===
  const card: React.CSSProperties = { background: C.white, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` };
  const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 11, color: C.warmGray, fontWeight: 700, borderBottom: `1px solid ${C.border}`, background: C.cream };
  const td: React.CSSProperties = { padding: "10px", fontSize: 12, color: C.dark, borderBottom: `1px solid ${C.border}`, verticalAlign: "top" };
  const empty = (text: string) => (
    <div style={{ ...card, textAlign: "center", color: C.warmGray, fontSize: 13, padding: 32 }}>
      {text}
      <div style={{ fontSize: 11, marginTop: 8, color: C.warmGray }}>※ Phase 2 Edge Function (6/5 予定) 稼働後にデータが入ります</div>
    </div>
  );

  const statusBadgeFor = (s: string) => {
    const map: Record<string, { color: string; bg: string; label: string }> = {
      pending:         { color: "#F57C00", bg: "#FFF3E0", label: "承認待ち" },
      auto_approved:   { color: C.blue,    bg: C.bluePale, label: "自動承認" },
      manual_approved: { color: C.green,   bg: C.greenPale, label: "手動承認" },
      rejected:        { color: C.red,     bg: C.redPale, label: "却下" },
      expired:         { color: C.warmGray, bg: C.cream, label: "終了" },
    };
    const sm = map[s] || { color: C.warmGray, bg: C.cream, label: s };
    return <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: sm.bg, color: sm.color, fontWeight: 700 }}>{sm.label}</span>;
  };

  // === 0. ダッシュボード ===
  const renderDashboard = () => (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>📅 全イベント</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.dark }}>{counts.total}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>⏳ 承認待ち</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#F57C00" }}>{counts.pending}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>🤖 自動承認</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.blue }}>{counts.auto}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>✅ 手動承認</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.green }}>{counts.manual}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.dark, marginBottom: 10 }}>🏷 カテゴリ別分布 (公開中)</div>
          {Object.keys(byCategory).length === 0 ? (
            <div style={{ fontSize: 12, color: C.warmGray, textAlign: "center", padding: 20 }}>データなし</div>
          ) : (
            Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.dark }}>{EVENT_CATEGORY_LABELS[k] || k}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.orange }}>{v}</span>
              </div>
            ))
          )}
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.dark, marginBottom: 10 }}>🗾 都道府県別分布 (公開中)</div>
          {Object.keys(byPrefecture).length === 0 ? (
            <div style={{ fontSize: 12, color: C.warmGray, textAlign: "center", padding: 20 }}>データなし</div>
          ) : (
            Object.entries(byPrefecture).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.dark }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.orange }}>{v}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.dark, marginBottom: 10 }}>📈 状態サマリ</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, fontSize: 12 }}>
          <div><div style={{ color: C.warmGray, fontSize: 10 }}>承認待ち</div><b>{counts.pending}</b></div>
          <div><div style={{ color: C.warmGray, fontSize: 10 }}>自動承認</div><b>{counts.auto}</b></div>
          <div><div style={{ color: C.warmGray, fontSize: 10 }}>手動承認</div><b>{counts.manual}</b></div>
          <div><div style={{ color: C.warmGray, fontSize: 10 }}>却下</div><b>{counts.rejected}</b></div>
          <div><div style={{ color: C.warmGray, fontSize: 10 }}>終了</div><b>{counts.expired}</b></div>
        </div>
      </div>
    </div>
  );

  // === Events テーブル汎用レンダー (承認待ち/自動承認/公開中 共通) ===
  const renderEventsTable = (rows: any[], showCheckbox: boolean, actions: (e: any) => React.ReactNode) => {
    if (rows.length === 0) return empty("該当イベントなし");
    return (
      <div style={card}>
        {showCheckbox && (
          <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.warmGray }}>{selectedIds.size}件選択中</span>
            <button onClick={bulkApprove} disabled={busy || selectedIds.size === 0} style={{ padding: "8px 14px", background: selectedIds.size === 0 ? C.warmGray : C.green, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: selectedIds.size === 0 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              一括承認
            </button>
            <button onClick={bulkReject} disabled={busy || selectedIds.size === 0} style={{ padding: "8px 14px", background: selectedIds.size === 0 ? C.warmGray : C.red, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: selectedIds.size === 0 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              一括却下
            </button>
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            {showCheckbox && <th style={th}></th>}
            <th style={th}>タイトル</th>
            <th style={th}>日付</th>
            <th style={th}>場所</th>
            <th style={th}>カテゴリ</th>
            <th style={th}>状態</th>
            <th style={th}>AI</th>
            <th style={th}>操作</th>
          </tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                {showCheckbox && (
                  <td style={td}>
                    <input type="checkbox" checked={selectedIds.has(e.id)} onChange={() => toggleSelect(e.id)} />
                  </td>
                )}
                <td style={{ ...td, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <div style={{ fontWeight: 700 }}>{e.title}</div>
                  {e.official_url && (
                    <a href={e.official_url} target="_blank" rel="noopener" style={{ fontSize: 10, color: C.blue, textDecoration: "underline" }}>公式 →</a>
                  )}
                </td>
                <td style={td}>{e.event_date}{e.event_time && <div style={{ fontSize: 10, color: C.warmGray }}>{e.event_time}</div>}</td>
                <td style={{ ...td, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.prefecture}{e.city ? ` ${e.city}` : ""}<div style={{ fontSize: 10, color: C.warmGray }}>{e.place}</div></td>
                <td style={td}>{EVENT_CATEGORY_LABELS[e.event_category] || e.event_category || "—"}</td>
                <td style={td}>{statusBadgeFor(e.approval_status)}</td>
                <td style={td}>{e.ai_confidence != null ? `${(Number(e.ai_confidence) * 100).toFixed(0)}%` : "—"}</td>
                <td style={td}>{actions(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // === 1. 承認待ち ===
  const renderPending = () => {
    const rows = events.filter(e => e.approval_status === "pending");
    return renderEventsTable(rows, true, (e) => (
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => individualUpdate(e.id, "manual_approved")} disabled={busy} style={{ padding: "4px 8px", background: C.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>承認</button>
        <button onClick={() => individualUpdate(e.id, "rejected")} disabled={busy} style={{ padding: "4px 8px", background: C.red, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>却下</button>
      </div>
    ));
  };

  // === 2. 自動承認済み (監視) ===
  const renderAuto = () => {
    const rows = events.filter(e => e.approval_status === "auto_approved");
    return renderEventsTable(rows, false, (e) => (
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => individualUpdate(e.id, "manual_approved")} disabled={busy} style={{ padding: "4px 8px", background: C.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>確認OK</button>
        <button onClick={() => individualUpdate(e.id, "rejected")} disabled={busy} style={{ padding: "4px 8px", background: C.red, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>取り下げ</button>
      </div>
    ));
  };

  // === 3. 公開中 ===
  const renderPublished = () => {
    return renderEventsTable(published, false, (e) => (
      <button onClick={() => individualUpdate(e.id, "expired")} disabled={busy} style={{ padding: "4px 8px", background: C.warmGray, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>終了化</button>
    ));
  };

  // === 4. 手動追加 ===
  const renderManualAdd = () => {
    const field = (label: string, key: keyof typeof addForm, type: string = "text", placeholder = "") => (
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: C.warmGray, fontWeight: 700, display: "block", marginBottom: 4 }}>{label}</label>
        <input
          type={type}
          value={addForm[key] as string}
          onChange={(e) => setAddForm({ ...addForm, [key]: e.target.value })}
          placeholder={placeholder}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
        />
      </div>
    );
    return (
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.dark, marginBottom: 12 }}>✍️ 新規イベント手動追加 (即時 manual_approved 公開)</div>
        {field("タイトル*", "title", "text", "例: 春の保護犬譲渡会 in 大阪")}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: C.warmGray, fontWeight: 700, display: "block", marginBottom: 4 }}>説明 (任意 / 100字以内推奨)</label>
          <textarea value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} rows={3} maxLength={300}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }}/>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {field("開催日*", "event_date", "date")}
          {field("時刻 (任意)", "event_time", "text", "例: 10:00-15:00")}
        </div>
        {field("場所*", "place", "text", "例: 大阪城公園")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {field("都道府県", "prefecture", "text")}
          {field("市区町村 (任意)", "city", "text")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: C.warmGray, fontWeight: 700, display: "block", marginBottom: 4 }}>カテゴリ</label>
            <select value={addForm.event_category} onChange={(e) => setAddForm({ ...addForm, event_category: e.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", background: C.white, boxSizing: "border-box" }}>
              {Object.entries(EVENT_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: C.warmGray, fontWeight: 700, display: "block", marginBottom: 4 }}>地方</label>
            <select value={addForm.region} onChange={(e) => setAddForm({ ...addForm, region: e.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", background: C.white, boxSizing: "border-box" }}>
              {Object.entries(REGION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        {field("公式 URL (詳細へ誘導)", "official_url", "url", "https://...")}
        {field("料金", "fee", "text", "例: 無料 / 1,000円")}
        <button onClick={handleManualAdd} disabled={busy} style={{ marginTop: 10, padding: 12, width: "100%", background: busy ? C.warmGray : C.orange, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>
          {busy ? "追加中…" : "✅ 追加 (即時公開)"}
        </button>
      </div>
    );
  };

  // === 5. 情報源管理 ===
  const renderSources = () => (
    <div>
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.dark, marginBottom: 12 }}>🌐 新規 情報源 登録</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input value={sourceForm.name} onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })} placeholder="名前 (例: 大阪府公式観光協会)"
            style={{ padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit" }}/>
          <input value={sourceForm.url} onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })} placeholder="URL"
            style={{ padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit" }}/>
          <select value={sourceForm.source_type} onChange={(e) => setSourceForm({ ...sourceForm, source_type: e.target.value })}
            style={{ padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", background: C.white }}>
            <option value="prefecture_official">都道府県公式</option>
            <option value="city_official">市町村公式</option>
            <option value="npo">NPO</option>
            <option value="pet_shop">ペットショップ</option>
            <option value="cafe">動物カフェ</option>
            <option value="vet">動物病院</option>
            <option value="aggregator">アグリゲータ</option>
            <option value="social">SNS</option>
            <option value="rss">RSS</option>
          </select>
          <select value={sourceForm.scrape_frequency} onChange={(e) => setSourceForm({ ...sourceForm, scrape_frequency: e.target.value })}
            style={{ padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", background: C.white }}>
            <option value="daily">毎日</option>
            <option value="weekly">毎週</option>
            <option value="monthly">毎月</option>
          </select>
          <input value={sourceForm.prefecture} onChange={(e) => setSourceForm({ ...sourceForm, prefecture: e.target.value })} placeholder="都道府県 (任意)"
            style={{ padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit" }}/>
          <input value={sourceForm.city} onChange={(e) => setSourceForm({ ...sourceForm, city: e.target.value })} placeholder="市区町村 (任意)"
            style={{ padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit" }}/>
        </div>
        <button onClick={handleAddSource} disabled={busy} style={{ marginTop: 10, padding: 10, width: "100%", background: busy ? C.warmGray : C.orange, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>
          ＋ 情報源を追加
        </button>
      </div>

      {sources.length === 0 ? empty("情報源 未登録 (Phase 2 で AI 自動発見予定)") : (
        <div style={card}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>名前</th><th style={th}>種類</th><th style={th}>地域</th>
              <th style={th}>頻度</th><th style={th}>収集</th><th style={th}>成功率</th><th style={th}>状態</th>
            </tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td style={{ ...td, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <a href={s.url} target="_blank" rel="noopener" style={{ color: C.dark, fontWeight: 700, textDecoration: "none" }}>{s.name}</a>
                  </td>
                  <td style={td}>{s.source_type}</td>
                  <td style={td}>{s.prefecture || "—"}{s.city ? ` / ${s.city}` : ""}</td>
                  <td style={td}>{s.scrape_frequency}</td>
                  <td style={td}>{s.events_collected || 0}件</td>
                  <td style={td}>{s.success_rate != null ? `${(Number(s.success_rate) * 100).toFixed(0)}%` : "—"}</td>
                  <td style={td}>
                    <button onClick={() => toggleSourceActive(s.id, s.is_active)} style={{ padding: "4px 10px", background: s.is_active ? C.green : C.warmGray, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {s.is_active ? "✅ 稼働中" : "⏸ 停止中"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // === 6. 収集ログ ===
  const renderLogs = () => {
    if (logs.length === 0) return empty("収集ログなし");
    return (
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>日時</th><th style={th}>情報源</th>
            <th style={th}>発見</th><th style={th}>新規</th><th style={th}>重複</th>
            <th style={th}>コスト</th><th style={th}>エラー</th>
          </tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td style={td}>{l.scraped_at ? new Date(l.scraped_at).toLocaleString("ja-JP") : "—"}</td>
                <td style={{ ...td, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.event_sources?.name || "—"}</td>
                <td style={td}>{l.events_found ?? 0}</td>
                <td style={{ ...td, color: C.green, fontWeight: 700 }}>{l.events_new ?? 0}</td>
                <td style={td}>{l.events_duplicate ?? 0}</td>
                <td style={td}>${Number(l.ai_cost_usd || 0).toFixed(4)}</td>
                <td style={{ ...td, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: l.errors ? C.red : C.warmGray }}>{l.errors || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // === 7. AI 信頼度調整 ===
  const renderThresholds = () => (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.dark, marginBottom: 12 }}>🎚️ AI 信頼度 閾値調整</div>
      <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 16, lineHeight: 1.7 }}>
        Phase 2 Edge Function (event-scraper) で参照される閾値。<br />
        AI が出した信頼度 (ai_confidence 0.00-1.00) に応じて自動分岐:
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, color: C.dark, fontWeight: 700, display: "block", marginBottom: 6 }}>
            🟢 auto_approved 閾値: <b>{(thresholds.auto_approve * 100).toFixed(0)}%</b> 以上で自動公開
          </label>
          <input type="range" min="0.50" max="1.00" step="0.05"
            value={thresholds.auto_approve}
            onChange={(e) => setThresholds({ ...thresholds, auto_approve: Number(e.target.value) })}
            style={{ width: "100%" }}/>
        </div>
        <div>
          <label style={{ fontSize: 12, color: C.dark, fontWeight: 700, display: "block", marginBottom: 6 }}>
            🟡 pending 閾値: <b>{(thresholds.pending * 100).toFixed(0)}%</b> 以上で admin 確認待ち (それ未満は rejected)
          </label>
          <input type="range" min="0.30" max="0.80" step="0.05"
            value={thresholds.pending}
            onChange={(e) => setThresholds({ ...thresholds, pending: Number(e.target.value) })}
            style={{ width: "100%" }}/>
        </div>
        <div style={{ padding: 12, background: C.cream, borderRadius: 10, fontSize: 12, color: C.dark, lineHeight: 1.7 }}>
          <b>動作イメージ:</b><br />
          • AI 信頼度 ≥ {(thresholds.auto_approve * 100).toFixed(0)}% → 🟢 auto_approved (即公開)<br />
          • {(thresholds.pending * 100).toFixed(0)}% ≤ AI 信頼度 &lt; {(thresholds.auto_approve * 100).toFixed(0)}% → 🟡 pending (admin 確認)<br />
          • AI 信頼度 &lt; {(thresholds.pending * 100).toFixed(0)}% → 🔴 rejected
        </div>
        <button onClick={saveThresholds} style={{ padding: 12, background: C.orange, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          💾 閾値を保存 (LocalStorage / Phase 2 で同期予定)
        </button>
      </div>
    </div>
  );

  // === 8. Kill Switch ===
  const renderKill = () => {
    const activeSources = sources.filter(s => s.is_active).length;
    return (
      <div style={{ ...card, border: `2px solid ${C.red}` }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>🛑 緊急 Kill Switch — AI イベント収集</div>
        <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 16, lineHeight: 1.7 }}>
          実行内容:<br />
          ① <code>event_sources.is_active = false</code> (全件 / 現在 {activeSources}件稼働中)<br />
          ② AI 自動収集 cron は次回起動時に空振り (no source = no scrape)<br />
          <br />
          ※ Phase 2 Edge Function 未deploy の現状では実害なし (preventive control)
        </div>
        <button
          onClick={handleKillSwitch}
          disabled={busy || activeSources === 0}
          style={{
            width: "100%", padding: 14, background: activeSources === 0 ? C.warmGray : C.red, color: "#fff",
            border: "none", borderRadius: 12, fontWeight: 900, fontSize: 14,
            cursor: (busy || activeSources === 0) ? "not-allowed" : "pointer", fontFamily: "inherit",
            opacity: (busy || activeSources === 0) ? 0.6 : 1,
          }}
        >
          {busy ? "実行中..." : activeSources === 0 ? "既に全停止中" : `🛑 Kill Switch (${activeSources}件停止)`}
        </button>
      </div>
    );
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 6 }}>📅 AI イベント収集 管理</h2>
      <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 16 }}>
        全国小規模動物イベント自動収集 (依頼書 #27 v2) / Phase 1 DDL ✅ / Phase 2 Edge Function 6/5 予定
      </div>

      {/* タブナビ */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16, borderBottom: `2px solid ${C.border}` }}>
        {EVENTS_AI_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 14px", background: tab === t.id ? C.orange : "transparent",
              color: tab === t.id ? "#fff" : C.warmGray, border: "none",
              borderRadius: "10px 10px 0 0", cursor: "pointer",
              fontWeight: 700, fontSize: 12, fontFamily: "inherit",
              borderBottom: tab === t.id ? `3px solid ${C.orange}` : "none",
              marginBottom: -2,
            }}
          >
            <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: "center", color: C.warmGray, padding: 32 }}>読み込み中…</div>
      ) : (
        <>
          {tab === 0 && renderDashboard()}
          {tab === 1 && renderPending()}
          {tab === 2 && renderAuto()}
          {tab === 3 && renderPublished()}
          {tab === 4 && renderManualAdd()}
          {tab === 5 && renderSources()}
          {tab === 6 && renderLogs()}
          {tab === 7 && renderThresholds()}
          {tab === 8 && renderKill()}
        </>
      )}
    </div>
  );
};

// ── 🌌 Qocca メタエージェント 管理 (依頼書 #31 / 憲法 v1.0) ─────────────────
// 7専門 Agent + meta_agent 自身 = 8体制を一元管理
// Phase 1 DDL ✅ / Phase 3 UI ✅ / Phase 2 Edge Function = 8月稼働予定
// ────────────────────────────────────────────────────────────────────────────
const META_AGENT_TABS = [
  { id: 0, icon: "📊", label: "ダッシュボード" },
  { id: 1, icon: "🤖", label: "個別 Agent" },
  { id: 2, icon: "✉️", label: "メッセージ" },
  { id: 3, icon: "🔔", label: "通知" },
  { id: 4, icon: "💴", label: "コスト管理" },
  { id: 5, icon: "🛑", label: "Kill Switch" },
];

const AGENT_LABELS: Record<string, { icon: string; jp: string }> = {
  events_collection: { icon: "📅", jp: "イベント収集" },
  facility_info:     { icon: "🏢", jp: "施設情報" },
  x_post:            { icon: "🐦", jp: "X 投稿" },
  threads_post:      { icon: "🧵", jp: "Threads 投稿" },
  instagram_post:    { icon: "📷", jp: "Instagram 投稿" },
  blog_seo:          { icon: "📰", jp: "ブログ SEO" },
  meta_ads:          { icon: "💰", jp: "Meta 広告" },
  meta_agent:        { icon: "🌌", jp: "メタエージェント" },
};

const SEVERITY_STYLE = (s: string) => {
  switch (s) {
    case "critical": return { color: C.red, bg: C.redPale, label: "🚨 緊急" };
    case "error":    return { color: C.red, bg: C.redPale, label: "❌ エラー" };
    case "warning":  return { color: "#F57C00", bg: "#FFF3E0", label: "⚠️ 警告" };
    case "info":     return { color: C.blue, bg: C.bluePale, label: "ℹ️ 情報" };
    default:         return { color: C.warmGray, bg: C.cream, label: s };
  }
};

const STATUS_STYLE = (s: string) => {
  switch (s) {
    case "healthy": return { color: C.green, bg: C.greenPale, label: "✅ 正常" };
    case "warning": return { color: "#F57C00", bg: "#FFF3E0", label: "⚠️ 警告" };
    case "error":   return { color: C.red, bg: C.redPale, label: "❌ エラー" };
    case "paused":  return { color: C.warmGray, bg: C.cream, label: "⏸ 停止" };
    default:        return { color: C.warmGray, bg: C.cream, label: s };
  }
};

const MetaAgentManagementPage = () => {
  const [tab, setTab] = useState(0);
  const [agents, setAgents] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const [agRes, msgRes, ntRes] = await Promise.all([
      supabase.from("meta_agent_state").select("*").order("agent_name", { ascending: true }),
      supabase.from("meta_agent_messages").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("meta_agent_notifications").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setAgents(agRes.data || []);
    setMessages(msgRes.data || []);
    setNotifications(ntRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  // === Actions ===
  const markNotificationRead = async (id: string) => {
    setBusy(true);
    await supabase.from("meta_agent_notifications").update({ read: true, read_at: new Date().toISOString() }).eq("id", id);
    setBusy(false);
    loadAll();
  };

  const pauseAgent = async (agentName: string, newStatus: string) => {
    if (!confirm(`${AGENT_LABELS[agentName]?.jp || agentName} を ${newStatus === "paused" ? "停止" : "再開"} しますか?`)) return;
    setBusy(true);
    await supabase.from("meta_agent_state").update({
      agent_status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq("agent_name", agentName);
    setBusy(false);
    loadAll();
  };

  const killAllAgents = async () => {
    if (!confirm("⚠️ 🛑 Kill Switch — 全 Agent を一斉停止します。\n\nmeta_agent_state.agent_status を全件 'paused' に更新します。\n各 Agent の固有 kill_switch (x_post_settings 等) は別途必要です。\n\n本当に実行しますか?")) return;
    setBusy(true);
    const { error } = await supabase.from("meta_agent_state")
      .update({ agent_status: "paused", updated_at: new Date().toISOString() })
      .neq("agent_status", "paused");
    setBusy(false);
    if (error) return alert("エラー: " + error.message);
    alert("✅ 全 Agent 停止完了 (meta_agent_state レベル)");
    loadAll();
  };

  // === スタイル ===
  const card: React.CSSProperties = { background: C.white, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` };
  const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 11, color: C.warmGray, fontWeight: 700, borderBottom: `1px solid ${C.border}`, background: C.cream };
  const td: React.CSSProperties = { padding: "10px", fontSize: 12, color: C.dark, borderBottom: `1px solid ${C.border}` };

  // === 0. ダッシュボード ===
  const renderDashboard = () => {
    const healthyCount = agents.filter(a => a.agent_status === "healthy").length;
    const warningCount = agents.filter(a => a.agent_status === "warning").length;
    const errorCount = agents.filter(a => a.agent_status === "error").length;
    const pausedCount = agents.filter(a => a.agent_status === "paused").length;
    const totalCostToday = agents.reduce((s, a) => s + Number(a.cost_today || 0), 0);
    const totalCostMonth = agents.reduce((s, a) => s + Number(a.cost_month || 0), 0);
    const unreadCount = notifications.filter(n => !n.read).length;
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
          <div style={card}>
            <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>✅ 正常稼働</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.green }}>{healthyCount}<span style={{ fontSize: 12, color: C.warmGray, fontWeight: 500 }}> / {agents.length}</span></div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>⚠️ 警告</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#F57C00" }}>{warningCount}</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>❌ エラー</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.red }}>{errorCount}</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>⏸ 停止中</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.warmGray }}>{pausedCount}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div style={card}>
            <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>💴 AI コスト (今日)</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.dark }}>${totalCostToday.toFixed(4)}</div>
            <div style={{ fontSize: 10, color: C.warmGray, marginTop: 4 }}>≈ ¥{Math.round(totalCostToday * 150)}</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>📅 AI コスト (月)</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.dark }}>${totalCostMonth.toFixed(4)}</div>
            <div style={{ fontSize: 10, color: C.warmGray, marginTop: 4 }}>≈ ¥{Math.round(totalCostMonth * 150)} / 上限 ¥1,000</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>🔔 未読通知</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: unreadCount > 0 ? C.orange : C.warmGray }}>{unreadCount}</div>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>🤖 8 Agent 稼働状態サマリ</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
            {agents.map((a) => {
              const meta = AGENT_LABELS[a.agent_name] || { icon: "🤖", jp: a.agent_name };
              const st = STATUS_STYLE(a.agent_status);
              return (
                <div key={a.id} style={{ padding: 12, border: `1px solid ${C.border}`, borderRadius: 12, background: C.cream }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.dark }}>{meta.icon} {meta.jp}</div>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: st.bg, color: st.color, fontWeight: 700 }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.warmGray, lineHeight: 1.6 }}>
                    {a.metrics?.description || "(説明なし)"}
                    {a.last_run_at && <><br/>最終稼働: {new Date(a.last_run_at).toLocaleString("ja-JP")}</>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // === 1. 個別 Agent ===
  const renderAgents = () => (
    <div style={card}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={th}>Agent</th><th style={th}>状態</th><th style={th}>最終稼働</th>
          <th style={th}>最終成功</th><th style={th}>今日 $</th><th style={th}>今月 $</th>
          <th style={th}>最終エラー</th><th style={th}>操作</th>
        </tr></thead>
        <tbody>
          {agents.map((a) => {
            const meta = AGENT_LABELS[a.agent_name] || { icon: "🤖", jp: a.agent_name };
            const st = STATUS_STYLE(a.agent_status);
            return (
              <tr key={a.id}>
                <td style={td}><b>{meta.icon} {meta.jp}</b><div style={{ fontSize: 10, color: C.warmGray }}>{a.agent_name}</div></td>
                <td style={td}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: st.bg, color: st.color, fontWeight: 700 }}>{st.label}</span></td>
                <td style={td}>{a.last_run_at ? new Date(a.last_run_at).toLocaleString("ja-JP") : "—"}</td>
                <td style={td}>{a.last_success_at ? new Date(a.last_success_at).toLocaleString("ja-JP") : "—"}</td>
                <td style={td}>${Number(a.cost_today || 0).toFixed(4)}</td>
                <td style={td}>${Number(a.cost_month || 0).toFixed(4)}</td>
                <td style={{ ...td, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: a.last_error ? C.red : C.warmGray }}>
                  {a.last_error || "—"}
                </td>
                <td style={td}>
                  {a.agent_status === "paused" ? (
                    <button onClick={() => pauseAgent(a.agent_name, "healthy")} disabled={busy} style={{ padding: "4px 8px", background: C.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>▶ 再開</button>
                  ) : (
                    <button onClick={() => pauseAgent(a.agent_name, "paused")} disabled={busy} style={{ padding: "4px 8px", background: C.warmGray, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>⏸ 停止</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // === 2. メッセージング ===
  const renderMessages = () => {
    if (messages.length === 0) return (
      <div style={{ ...card, textAlign: "center", color: C.warmGray, fontSize: 13, padding: 32 }}>
        メッセージなし
        <div style={{ fontSize: 11, marginTop: 8 }}>※ Phase 2 Edge Function (meta-agent-dispatcher / 8月稼働) で生成されます</div>
      </div>
    );
    return (
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>日時</th><th style={th}>from</th><th style={th}>to</th>
            <th style={th}>種別</th><th style={th}>優先度</th><th style={th}>処理</th>
          </tr></thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id}>
                <td style={td}>{m.created_at ? new Date(m.created_at).toLocaleString("ja-JP") : "—"}</td>
                <td style={td}>{AGENT_LABELS[m.from_agent]?.icon || ""}{m.from_agent || "—"}</td>
                <td style={td}>{AGENT_LABELS[m.to_agent]?.icon || ""}{m.to_agent || "—"}</td>
                <td style={td}>{m.message_type || "—"}</td>
                <td style={td}>{m.priority || "—"}</td>
                <td style={td}>{m.processed ? "✅" : "⏳"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // === 3. 通知 ===
  const renderNotifications = () => {
    if (notifications.length === 0) return (
      <div style={{ ...card, textAlign: "center", color: C.warmGray, fontSize: 13, padding: 32 }}>
        通知なし
        <div style={{ fontSize: 11, marginTop: 8 }}>※ Phase 2 Edge Function (meta-agent-monitor / 8月稼働) で生成されます</div>
      </div>
    );
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {notifications.map((n) => {
          const sev = SEVERITY_STYLE(n.severity);
          return (
            <div key={n.id} style={{ ...card, padding: 14, opacity: n.read ? 0.6 : 1, borderLeft: `4px solid ${sev.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: sev.color }}>{sev.label} · {AGENT_LABELS[n.agent_name]?.icon}{AGENT_LABELS[n.agent_name]?.jp || n.agent_name}</span>
                <span style={{ fontSize: 10, color: C.warmGray }}>{n.created_at ? new Date(n.created_at).toLocaleString("ja-JP") : ""}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.dark, marginBottom: 4 }}>{n.title || "(タイトルなし)"}</div>
              {n.body && <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 6 }}>{n.body}</div>}
              {!n.read && (
                <button onClick={() => markNotificationRead(n.id)} disabled={busy} style={{ padding: "4px 10px", background: C.cream, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, fontWeight: 700, color: C.dark, cursor: "pointer", fontFamily: "inherit" }}>既読にする</button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // === 4. コスト管理 ===
  const renderCost = () => (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>💴 AI コスト 一元管理</div>
      <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 16, lineHeight: 1.7 }}>
        メタエージェント月予算上限: <b>¥1,000</b> (依頼書 #31 規定)<br />
        各 Agent の AI コストを集計表示。Phase 2 Edge Function 稼働後に更新。
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={th}>Agent</th><th style={th}>今日 $</th><th style={th}>今日 ¥</th>
          <th style={th}>今月 $</th><th style={th}>今月 ¥</th>
        </tr></thead>
        <tbody>
          {agents.map((a) => {
            const meta = AGENT_LABELS[a.agent_name] || { icon: "🤖", jp: a.agent_name };
            return (
              <tr key={a.id}>
                <td style={td}>{meta.icon} {meta.jp}</td>
                <td style={td}>${Number(a.cost_today || 0).toFixed(4)}</td>
                <td style={td}>¥{Math.round(Number(a.cost_today || 0) * 150)}</td>
                <td style={td}>${Number(a.cost_month || 0).toFixed(4)}</td>
                <td style={td}>¥{Math.round(Number(a.cost_month || 0) * 150)}</td>
              </tr>
            );
          })}
          <tr style={{ background: C.cream }}>
            <td style={{ ...td, fontWeight: 800 }}>合計</td>
            <td style={{ ...td, fontWeight: 800 }}>${agents.reduce((s, a) => s + Number(a.cost_today || 0), 0).toFixed(4)}</td>
            <td style={{ ...td, fontWeight: 800 }}>¥{Math.round(agents.reduce((s, a) => s + Number(a.cost_today || 0), 0) * 150)}</td>
            <td style={{ ...td, fontWeight: 800 }}>${agents.reduce((s, a) => s + Number(a.cost_month || 0), 0).toFixed(4)}</td>
            <td style={{ ...td, fontWeight: 800 }}>¥{Math.round(agents.reduce((s, a) => s + Number(a.cost_month || 0), 0) * 150)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  // === 5. Kill Switch ===
  const renderKillSwitch = () => {
    const nonPausedCount = agents.filter(a => a.agent_status !== "paused").length;
    return (
      <div style={{ ...card, border: `2px solid ${C.red}` }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 12 }}>🛑 緊急 Kill Switch — 全 Agent 一斉停止</div>
        <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 16, lineHeight: 1.7 }}>
          実行内容:<br />
          ① <code>meta_agent_state.agent_status = 'paused'</code> (全件 / 現在 {nonPausedCount}件 稼働中)<br />
          ② Phase 2 Edge Function (meta-agent-dispatcher) が status='paused' を見て一斉停止<br />
          <br />
          ※ 各 Agent の固有 Kill Switch (x_post_settings / threads_post_settings 等) は別途必要。<br />
          ※ Phase 2 Edge Function 未deploy のため preventive control (8月以降本格動作)。
        </div>
        <button
          onClick={killAllAgents}
          disabled={busy || nonPausedCount === 0}
          style={{
            width: "100%", padding: 14, background: nonPausedCount === 0 ? C.warmGray : C.red, color: "#fff",
            border: "none", borderRadius: 12, fontWeight: 900, fontSize: 14,
            cursor: (busy || nonPausedCount === 0) ? "not-allowed" : "pointer", fontFamily: "inherit",
            opacity: (busy || nonPausedCount === 0) ? 0.6 : 1,
          }}
        >
          {busy ? "実行中..." : nonPausedCount === 0 ? "既に全停止中" : `🛑 全 Agent 停止 (${nonPausedCount}件 → paused)`}
        </button>
      </div>
    );
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 6 }}>🌌 Qocca メタエージェント 管理</h2>
      <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 16 }}>
        AI エージェントチーム憲法 v1.0 準拠 / 8 Agent 一元監視 / Phase 1 DDL ✅ + Phase 3 UI ✅ / Phase 2 Edge Function = 8月稼働
      </div>

      {/* タブナビ */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16, borderBottom: `2px solid ${C.border}` }}>
        {META_AGENT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 14px", background: tab === t.id ? C.orange : "transparent",
              color: tab === t.id ? "#fff" : C.warmGray, border: "none",
              borderRadius: "10px 10px 0 0", cursor: "pointer",
              fontWeight: 700, fontSize: 12, fontFamily: "inherit",
              borderBottom: tab === t.id ? `3px solid ${C.orange}` : "none",
              marginBottom: -2,
            }}
          >
            <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: "center", color: C.warmGray, padding: 32 }}>読み込み中…</div>
      ) : (
        <>
          {tab === 0 && renderDashboard()}
          {tab === 1 && renderAgents()}
          {tab === 2 && renderMessages()}
          {tab === 3 && renderNotifications()}
          {tab === 4 && renderCost()}
          {tab === 5 && renderKillSwitch()}
        </>
      )}
    </div>
  );
};

// ── 施設モデレーション (依頼書 #143, 2026/6/12) ─────────────────────────────
// pet_facilities の pending 承認/却下 UI (events パターン流用)
// ⚠️ pet_facilities に UPDATE RLS が無いため承認は SECURITY DEFINER RPC 経由 (admin_moderate_facilities)
// ⚠️ 既存 admin_manual 80件は対象外 (RPC側で source_type<>'admin_manual' 保護)
const FAC_MOD_CATS = [
  { id: "", label: "全カテゴリ" },
  { id: "shop", label: "🛍 ショップ" },
  { id: "salon", label: "✂️ トリミング" },
  { id: "hotel", label: "🏨 ホテル" },
  { id: "cafe", label: "☕ カフェ" },
  { id: "dogrun", label: "🐕 ドッグラン" },
  { id: "park", label: "🌳 公園" },
  { id: "hospital", label: "🏥 動物病院" },
  { id: "other", label: "✨ ふれあい/その他" },
];
const FAC_MOD_STATUS = [
  { id: "pending", icon: "⏳", label: "承認待ち" },
  { id: "manual_approved", icon: "✅", label: "公開中" },
  { id: "rejected", icon: "🚫", label: "却下" },
];
const FAC_MOD_PAGE = 50;

const FacilityModerationPage = () => {
  const [status, setStatus] = useState("pending");
  const [pref, setPref] = useState("");
  const [cat, setCat] = useState("");
  const [prefOptions, setPrefOptions] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const loadStats = async () => {
    const { data } = await supabase.rpc("admin_facility_stats");
    const m: Record<string, number> = {};
    (data || []).forEach((r: any) => { m[r.approval_status] = Number(r.cnt); });
    setStats(m);
  };
  const loadPrefs = async () => {
    // 都道府県の選択肢 (admin_manual 以外 / SELECT は RLS USING(true) で許可)
    const { data } = await supabase.from("pet_facilities").select("prefecture").neq("source_type", "admin_manual").order("prefecture");
    setPrefOptions(Array.from(new Set((data || []).map((r: any) => r.prefecture).filter(Boolean))) as string[]);
  };
  const loadRows = async (reset: boolean, base: any[] = []) => {
    setLoading(true);
    let q = supabase.from("pet_facilities").select("*").neq("source_type", "admin_manual").eq("approval_status", status).order("prefecture").order("name");
    if (pref) q = q.eq("prefecture", pref);
    if (cat) q = q.eq("category", cat);
    const offset = reset ? 0 : base.length;
    const { data, error } = await q.range(offset, offset + FAC_MOD_PAGE - 1);
    if (!error) {
      const list = data || [];
      setRows(reset ? list : [...base, ...list]);
      setHasMore(list.length === FAC_MOD_PAGE);
    }
    if (reset) setSelected(new Set());
    setLoading(false);
  };
  useEffect(() => { loadStats(); loadPrefs(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { loadRows(true); /* eslint-disable-next-line */ }, [status, pref, cat]);

  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const moderate = async (ids: string[], newStatus: string, label: string) => {
    if (ids.length === 0) return;
    // ⚠️ 一括は confirm 必須 (件数明示) / 「絞り込んだ表示分」に限定 (全pending一発はUI上不可能)
    if (ids.length > 1 && !confirm(`${ids.length}件を「${label}」します。よろしいですか？`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_moderate_facilities", { p_ids: ids, p_status: newStatus });
    setBusy(false);
    if (error) return alert("エラー: " + error.message);
    await loadStats();
    await loadRows(true);
  };

  const cardBtn = (bg: string): any => ({ padding: "5px 10px", background: bg, color: "#fff", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" });
  const selStyle: any = { padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.white, color: C.dark };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 4 }}>🗺️ 施設モデレーション</h1>
        <p style={{ fontSize: 12, color: C.warmGray }}>オープンデータ・住民投稿の施設を承認/却下 (既存 admin_manual は対象外)</p>
      </div>

      {/* ステータスタブ (件数つき) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {FAC_MOD_STATUS.map(s => (
          <button key={s.id} onClick={() => setStatus(s.id)} style={{
            padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${status === s.id ? C.orange : C.border}`,
            background: status === s.id ? C.orange : C.white, color: status === s.id ? "#fff" : C.warmGray,
            fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit"
          }}>{s.icon} {s.label} ({stats[s.id] ?? 0})</button>
        ))}
      </div>

      {/* 絞り込み */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select value={pref} onChange={e => setPref(e.target.value)} style={selStyle}>
          <option value="">📍 全都道府県</option>
          {prefOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={cat} onChange={e => setCat(e.target.value)} style={selStyle}>
          {FAC_MOD_CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: C.warmGray }}>{rows.length}{hasMore ? "+" : ""}件 表示中</span>
      </div>

      {/* 一括操作バー (表示分のみ / confirm付き) */}
      {status === "pending" && rows.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", background: C.cream, borderRadius: 10 }}>
          <button onClick={() => setSelected(new Set(rows.map(r => r.id)))} style={{ ...cardBtn(C.warmGray) }}>表示分を全選択</button>
          <button onClick={() => setSelected(new Set())} style={{ ...cardBtn("#BBB") }}>選択解除</button>
          <span style={{ fontSize: 12, color: C.dark, fontWeight: 700 }}>選択 {selected.size}件</span>
          <div style={{ flex: 1 }} />
          <button disabled={busy || selected.size === 0} onClick={() => moderate([...selected], "manual_approved", "公開 (承認)")} style={{ ...cardBtn(selected.size ? C.green : "#CCC"), padding: "8px 14px", fontSize: 12 }}>✅ 選択を公開</button>
          <button disabled={busy || selected.size === 0} onClick={() => moderate([...selected], "rejected", "却下")} style={{ ...cardBtn(selected.size ? "#E57373" : "#CCC"), padding: "8px 14px", fontSize: 12 }}>🚫 選択を却下</button>
        </div>
      )}

      {/* 一覧 */}
      {loading && rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>読み込み中...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>該当する施設はありません</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map(f => (
            <div key={f.id} style={{ display: "flex", gap: 10, padding: "12px 14px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, alignItems: "flex-start" }}>
              {status === "pending" && (
                <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} style={{ marginTop: 3, width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{f.name}</div>
                <div style={{ fontSize: 11, color: C.warmGray, marginTop: 2 }}>
                  {(FAC_MOD_CATS.find(c => c.id === f.category)?.label || f.category)} ｜ 📍 {f.prefecture} {f.city} {f.address}
                  {f.latitude == null && <span style={{ color: "#E57373" }}> ｜ ⚠️座標なし</span>}
                </div>
                {f.description && <div style={{ fontSize: 10.5, color: "#999", marginTop: 3 }}>{f.description.length > 70 ? f.description.slice(0, 70) + "…" : f.description}</div>}
                {/* 依頼書 #146 段階2 (2026/6/13): 存在確認用 Google検索リンク (URL生成のみ・Places API/スクレイピング不使用) */}
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent([f.name, f.prefecture, f.city, f.address].filter(Boolean).join(" "))}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-block", marginTop: 4, fontSize: 11, color: C.blue, fontWeight: 700, textDecoration: "none" }}
                >🔍 Googleで存在確認</a>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {status !== "manual_approved" && <button disabled={busy} onClick={() => moderate([f.id], "manual_approved", "公開")} style={cardBtn(C.green)}>公開</button>}
                {status !== "rejected" && <button disabled={busy} onClick={() => moderate([f.id], "rejected", "却下")} style={cardBtn("#E57373")}>却下</button>}
                {status !== "pending" && <button disabled={busy} onClick={() => moderate([f.id], "pending", "保留に戻す")} style={cardBtn(C.warmGray)}>保留</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && hasMore && (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button disabled={busy} onClick={() => loadRows(false, rows)} style={{ padding: "10px 24px", background: C.white, border: `1.5px solid ${C.orange}`, borderRadius: 20, color: C.orange, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>もっと見る ▼</button>
        </div>
      )}
    </div>
  );
};

// 依頼書 #146 Step3 (2026/6/13): 承認型 施設訂正提案 (まず「閉店報告」のみ)
// ⚠️ facility_corrections は select_own RLS → 閲覧/承認は SECURITY DEFINER RPC 経由 (is_admin ゲート)
// ⚠️ closed 承認時に pet_facilities.is_closed=true (RPC内で反映) / 却下・保留で false に戻る
const CORR_STATUS = [
  { id: "pending",  icon: "⏳", label: "承認待ち" },
  { id: "approved", icon: "✅", label: "承認済 (閉店)" },
  { id: "rejected", icon: "🚫", label: "却下" },
];
const CORR_PAGE = 50;

const CorrectionModerationPage = () => {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const loadStats = async () => {
    const { data } = await supabase.rpc("admin_corrections_stats", { p_field: "closed" });
    const m: Record<string, number> = {};
    (data || []).forEach((r: any) => { m[r.status] = Number(r.cnt); });
    setStats(m);
  };
  const loadRows = async (reset: boolean, base: any[] = []) => {
    setLoading(true);
    const offset = reset ? 0 : base.length;
    const { data, error } = await supabase.rpc("admin_list_corrections", {
      p_status: status, p_field: "closed", p_limit: CORR_PAGE, p_offset: offset,
    });
    if (!error) {
      const list = data || [];
      setRows(reset ? list : [...base, ...list]);
      setHasMore(list.length === CORR_PAGE);
    }
    if (reset) setSelected(new Set());
    setLoading(false);
  };
  useEffect(() => { loadStats(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { loadRows(true); /* eslint-disable-next-line */ }, [status]);

  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const moderate = async (ids: string[], newStatus: string, label: string) => {
    if (ids.length === 0) return;
    // ⚠️ confirm 必須 (件数明示) / 「表示分」に限定 (広すぎる一括なし)
    if (!confirm(`${ids.length}件の閉店報告を「${label}」します。よろしいですか？`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_moderate_corrections", { p_ids: ids, p_status: newStatus });
    setBusy(false);
    if (error) return alert("エラー: " + error.message);
    await loadStats();
    await loadRows(true);
  };

  const cardBtn = (bg: string): any => ({ padding: "5px 10px", background: bg, color: "#fff", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 4 }}>🚧 施設訂正提案 (閉店報告)</h1>
        <p style={{ fontSize: 12, color: C.warmGray }}>住民からの「閉店・移転している」報告を承認/却下。承認で施設に「閉店」バッジが付きます (住所/電話/営業時間は次フェーズ)</p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {CORR_STATUS.map(s => (
          <button key={s.id} onClick={() => setStatus(s.id)} style={{
            padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${status === s.id ? C.orange : C.border}`,
            background: status === s.id ? C.orange : C.white, color: status === s.id ? "#fff" : C.warmGray,
            fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit"
          }}>{s.icon} {s.label} ({stats[s.id] ?? 0})</button>
        ))}
      </div>

      {status === "pending" && rows.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", background: C.cream, borderRadius: 10 }}>
          <button onClick={() => setSelected(new Set(rows.map(r => r.id)))} style={{ ...cardBtn(C.warmGray) }}>表示分を全選択</button>
          <button onClick={() => setSelected(new Set())} style={{ ...cardBtn("#BBB") }}>選択解除</button>
          <span style={{ fontSize: 12, color: C.dark, fontWeight: 700 }}>選択 {selected.size}件</span>
          <div style={{ flex: 1 }} />
          <button disabled={busy || selected.size === 0} onClick={() => moderate([...selected], "approved", "承認 (閉店にする)")} style={{ ...cardBtn(selected.size ? C.green : "#CCC"), padding: "8px 14px", fontSize: 12 }}>✅ 選択を承認</button>
          <button disabled={busy || selected.size === 0} onClick={() => moderate([...selected], "rejected", "却下")} style={{ ...cardBtn(selected.size ? "#E57373" : "#CCC"), padding: "8px 14px", fontSize: 12 }}>🚫 選択を却下</button>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>読み込み中...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>該当する閉店報告はありません</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10, padding: "12px 14px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, alignItems: "flex-start" }}>
              {status === "pending" && (
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} style={{ marginTop: 3, width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>
                  {c.facility_name}
                  {c.is_closed && <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "#FFEBEE", color: "#C62828", fontWeight: 800 }}>🚧 閉店中</span>}
                </div>
                <div style={{ fontSize: 11, color: C.warmGray, marginTop: 2 }}>📍 {c.prefecture} {c.address}</div>
                <div style={{ fontSize: 11, color: "#C62828", marginTop: 4, fontWeight: 700 }}>🚧 報告: 閉店・移転している{c.proposed_value ? ` (${c.proposed_value})` : ""}</div>
                <div style={{ fontSize: 10, color: C.warmGray, marginTop: 2 }}>{new Date(c.created_at).toLocaleString("ja-JP")}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {status !== "approved" && <button disabled={busy} onClick={() => moderate([c.id], "approved", "承認 (閉店にする)")} style={cardBtn(C.green)}>承認</button>}
                {status !== "rejected" && <button disabled={busy} onClick={() => moderate([c.id], "rejected", "却下")} style={cardBtn("#E57373")}>却下</button>}
                {status !== "pending" && <button disabled={busy} onClick={() => moderate([c.id], "pending", "保留に戻す")} style={cardBtn(C.warmGray)}>保留</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && hasMore && (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button disabled={busy} onClick={() => loadRows(false, rows)} style={{ padding: "10px 24px", background: C.white, border: `1.5px solid ${C.orange}`, borderRadius: 20, color: C.orange, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>もっと見る ▼</button>
        </div>
      )}
    </div>
  );
};

// ── メインアプリ ────────────────────────────────────────────────────────────
// 依頼書 #112 (2026/6/4): Admin Sidebar 統合 - 新規 4ページ + 商店街リンク追加
// href 付き entry は外部 Route (別ページ) に navigate / 無印 entry は内部 page state 切替
const MENU: Array<{ id: string; icon: string; label: string; href?: string; group?: string }> = [
  { id: "dashboard", icon: "📊", label: "ダッシュボード" },
  // ── 新規ページ (依頼書 #108-#111 / 別 Route) ──────
  { id: "analytics", icon: "📈", label: "Analytics", href: "/admin/analytics" },
  { id: "ark-donations", icon: "🐾", label: "ARK 寄付管理", href: "/admin/ark-donations" },
  { id: "corporate-sponsors", icon: "🏛️", label: "法人スポンサー", href: "/admin/corporate-sponsors" },
  { id: "marketplace-view", icon: "🏪", label: "商店街 (公開)", href: "/marketplace" },
  { id: "event-sources", icon: "🤖", label: "イベント source 管理", href: "/admin/event-sources" },
  // ── 既存 (内部 page state 切替) ──────────────────
  { id: "events", icon: "🎪", label: "イベント管理" },
  { id: "listings", icon: "📦", label: "出品管理" },
  { id: "members", icon: "👥", label: "会員管理" },
  { id: "broadcast", icon: "📣", label: "お知らせ配信" },
  { id: "reports", icon: "🚨", label: "通報管理" },
  { id: "sales", icon: "💰", label: "売上管理" },
  { id: "crowdfunding", icon: "🎁", label: "クラファン管理" },
  { id: "meta-ads", icon: "💰", label: "Meta 広告" },
  { id: "events-ai", icon: "📅", label: "AI イベント収集" },
  { id: "facilities-mod", icon: "🗺️", label: "施設モデレーション" },
  { id: "facility-corrections", icon: "🚧", label: "施設訂正提案" },
  { id: "meta-agent", icon: "🌌", label: "エージェントチーム" },
];

export default function AdminDashboard() {
  const [page, setPage] = useState("dashboard");
  const [authState, setAuthState] = useState<"loading" | "no_login" | "no_admin" | "ok">("loading");
  const [adminInfo, setAdminInfo] = useState<{ display_name: string; role: string } | null>(null);

  useEffect(() => {
    (async () => {
      // 1. 現在のセッションを取得
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setAuthState("no_login");
        return;
      }

      // 2. adminsテーブルで管理者かチェック
      const { data: admin } = await supabase
        .from("admins")
        .select("role, user_id")
        .eq("user_id", session.user.id)
        .single();

      if (!admin) {
        setAuthState("no_admin");
        return;
      }

      // 3. プロフィール取得して名前を表示
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", session.user.id)
        .single();

      setAdminInfo({
        display_name: profile?.display_name || "管理者",
        role: admin.role,
      });
      setAuthState("ok");
    })();
  }, []);

  const handleLogout = async () => {
    if (!confirm("ログアウトしますか？")) return;
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  // ロード中
  if (authState === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${C.dark}, ${C.darkBrown})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans JP',sans-serif" }}>
        <div style={{ color: "#fff", fontSize: 14 }}>認証中...</div>
      </div>
    );
  }

  // 未ログイン
  if (authState === "no_login") {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${C.dark}, ${C.darkBrown})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans JP',sans-serif" }}>
        <div style={{ background: C.white, borderRadius: 24, padding: "40px 32px", width: 360, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 4 }}>Qocca 管理者画面</div>
          <div style={{ fontSize: 13, color: C.warmGray, marginBottom: 28 }}>ログインが必要です</div>
          <button onClick={() => window.location.href = "/login"} style={{ width: "100%", padding: "13px", background: C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
            ログインページへ
          </button>
        </div>
      </div>
    );
  }

  // 管理者権限なし
  if (authState === "no_admin") {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${C.dark}, ${C.darkBrown})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans JP',sans-serif" }}>
        <div style={{ background: C.white, borderRadius: 24, padding: "40px 32px", width: 400, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 8 }}>アクセス権限がありません</div>
          <div style={{ fontSize: 13, color: C.warmGray, marginBottom: 28, lineHeight: 1.6 }}>
            このページは管理者専用です。<br />
            管理者にお問い合わせください。
          </div>
          <button onClick={() => window.location.href = "/"} style={{ width: "100%", padding: "13px", background: C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
            ホームに戻る
          </button>
          <button onClick={handleLogout} style={{ width: "100%", padding: "13px", background: "transparent", border: `1.5px solid ${C.border}`, borderRadius: 12, color: C.warmGray, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            ログアウト
          </button>
        </div>
      </div>
    );
  }

  // 管理者として認証OK → ダッシュボード表示
  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Noto Sans JP',sans-serif", background: C.cream }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: `linear-gradient(180deg, ${C.dark}, ${C.darkBrown})`, padding: "24px 0", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.orange }}>🐾 Qocca</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>管理者パネル</div>
        </div>

        {/* 管理者情報 */}
        {adminInfo && (
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>ログイン中</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{adminInfo.display_name}</div>
            <div style={{ fontSize: 10, color: C.orange, fontWeight: 700 }}>
              {adminInfo.role === "super_admin" ? "👑 SUPER ADMIN" : adminInfo.role === "admin" ? "🛡 ADMIN" : "👁 MODERATOR"}
            </div>
          </div>
        )}

        <div style={{ flex: 1, padding: "16px 0" }}>
          {MENU.map(m => {
            // 依頼書 #112: href 付きは外部 Route (別ページ) に遷移 / 無印は内部 page state 切替
            const isExternal = !!m.href;
            const isActive = !isExternal && page === m.id;
            return (
              <button key={m.id} onClick={() => isExternal ? (window.location.href = m.href!) : setPage(m.id)} style={{
                width: "100%", padding: "12px 20px", border: "none", cursor: "pointer",
                background: isActive ? "rgba(245,169,74,0.15)" : "transparent",
                borderLeft: isActive ? `3px solid ${C.orange}` : "3px solid transparent",
                display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit"
              }}>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? C.orange : "rgba(255,255,255,0.7)" }}>{m.label}</span>
                {isExternal && <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>↗</span>}
              </button>
            );
          })}
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <button onClick={handleLogout} style={{ width: "100%", padding: "10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ログアウト
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
        {page === "dashboard" && <DashboardPage />}
        {page === "events" && <EventsPage />}
        {page === "listings" && <ListingsPage />}
        {page === "members" && <MembersPage />}
        {page === "broadcast" && <BroadcastPage />}
        {page === "reports" && <ReportsPage />}
        {page === "sales" && <SalesPage />}
        {page === "crowdfunding" && <CrowdfundingPage />}
        {page === "meta-ads" && <MetaAdsPage />}
        {page === "events-ai" && <EventsAiManagementPage />}
        {page === "facilities-mod" && <FacilityModerationPage />}
        {page === "facility-corrections" && <CorrectionModerationPage />}
        {page === "meta-agent" && <MetaAgentManagementPage />}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.orangeLight}; border-radius: 2px; }
        input::placeholder { color: ${C.warmGray}; }
        button:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}

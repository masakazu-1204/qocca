import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qufrqkuipzuqeqkvuhkx.supabase.co",
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou"
);

const ADMIN_PASSWORD = "qocca2026";

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
  };
  const label: Record<string, string> = {
    approved: "公開中", pending: "審査中", rejected: "却下",
    completed: "完了", working: "作業中", cancelled: "キャンセル", disputed: "異議申立",
  };
  const s = map[status] || { color: C.warmGray, bg: C.cream };
  return <Badge text={label[status] || status} color={s.color} bg={s.bg} />;
};

// ── ダッシュボード ──────────────────────────────────────────────────────────
const DashboardPage = () => {
  const [stats, setStats] = useState({ users: 0, listings: 0, orders: 0, events_pending: 0, reports: 0 });

  useEffect(() => {
    (async () => {
      const [
        { count: users },
        { count: listings },
        { count: orders },
        { count: events_pending },
        { count: reports },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("listings").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("events").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("reports").select("*", { count: "exact", head: true }),
      ]);
      setStats({ users: users || 0, listings: listings || 0, orders: orders || 0, events_pending: events_pending || 0, reports: reports || 0 });
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 24 }}>
        <StatCard icon="👥" label="総ユーザー数" value={stats.users} color={C.blue} />
        <StatCard icon="📦" label="出品サービス" value={stats.listings} color={C.orange} />
        <StatCard icon="🛒" label="総取引数" value={stats.orders} color={C.green} />
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

// ── 出品管理 ──────────────────────────────────────────────────────────────
const ListingsPage = () => {
  const [listings, setListings] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("listings")
      .select("id, title, price, category, created_at, seller_id, image_urls")
      .order("created_at", { ascending: false });
    setListings(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const remove = async (id: string) => {
    if (!confirm("この出品を削除しますか？")) return;
    await supabase.from("listings").delete().eq("id", id);
    fetch();
  };

  const filtered = listings.filter(l =>
    !search || l.title?.includes(search) || l.category?.includes(search)
  );

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 20 }}>📦 出品管理</h2>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="サービス名・カテゴリで検索..."
        style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, outline: "none", fontFamily: "inherit", marginBottom: 16, boxSizing: "border-box" }} />

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>読み込み中...</div>
      ) : (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.cream, borderBottom: `2px solid ${C.border}` }}>
                {["画像", "サービス名", "カテゴリ", "価格", "登録日", "操作"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: C.warmGray }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} style={{ borderBottom: `1px solid ${C.border}` }}>
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
                  <td style={{ padding: "10px 14px", fontSize: 12, color: C.warmGray }}>{l.created_at?.slice(0, 10)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <button onClick={() => remove(l.id)} style={{ padding: "5px 12px", background: C.redPale, border: `1px solid ${C.red}40`, borderRadius: 6, color: C.red, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🗑 削除</button>
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
        .select("id, display_name, avatar_url, bio, created_at, is_suspended")
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
                {["アバター", "名前", "登録日", "ステータス", "操作"].map(h => (
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

// ── 通報管理 ──────────────────────────────────────────────────────────────
const ReportsPage = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("reports")
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
                {["対象", "通報者", "理由", "日付"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: C.warmGray }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}`, background: "#FFF8F8" }}>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: C.dark }}>{r.reported_id || "-"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: C.warmGray }}>{r.reporter_id || "-"}</td>
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

// ── メインアプリ ────────────────────────────────────────────────────────────
const MENU = [
  { id: "dashboard", icon: "📊", label: "ダッシュボード" },
  { id: "events", icon: "🎪", label: "イベント管理" },
  { id: "listings", icon: "📦", label: "出品管理" },
  { id: "members", icon: "👥", label: "会員管理" },
  { id: "reports", icon: "🚨", label: "通報管理" },
];

export default function AdminDashboard() {
  const [page, setPage] = useState("dashboard");
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setLoggedIn(true);
      setError("");
    } else {
      setError("パスワードが違います");
    }
  };

  if (!loggedIn) return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${C.dark}, ${C.darkBrown})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans JP',sans-serif" }}>
      <div style={{ background: C.white, borderRadius: 24, padding: "40px 32px", width: 360, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 4 }}>Qocca 管理者画面</div>
        <div style={{ fontSize: 13, color: C.warmGray, marginBottom: 28 }}>管理者のみアクセス可能</div>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          placeholder="パスワードを入力"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${error ? C.red : C.border}`, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 }} />
        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{error}</div>}
        <button onClick={handleLogin} style={{ width: "100%", padding: "13px", background: C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
          ログイン
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Noto Sans JP',sans-serif", background: C.cream }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: `linear-gradient(180deg, ${C.dark}, ${C.darkBrown})`, padding: "24px 0", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.orange }}>🐾 Qocca</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>管理者パネル</div>
        </div>
        <div style={{ flex: 1, padding: "16px 0" }}>
          {MENU.map(m => (
            <button key={m.id} onClick={() => setPage(m.id)} style={{
              width: "100%", padding: "12px 20px", border: "none", cursor: "pointer",
              background: page === m.id ? "rgba(245,169,74,0.15)" : "transparent",
              borderLeft: page === m.id ? `3px solid ${C.orange}` : "3px solid transparent",
              display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit"
            }}>
              <span style={{ fontSize: 18 }}>{m.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: page === m.id ? C.orange : "rgba(255,255,255,0.7)" }}>{m.label}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <button onClick={() => setLoggedIn(false)} style={{ width: "100%", padding: "10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
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
        {page === "reports" && <ReportsPage />}
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

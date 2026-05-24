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
  { id: "mayor_30000", label: "永久首長", limit: 20 },
  { id: "ark_patron_50000", label: "ARK パトロン", limit: 10 },
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

  const loadAll = async () => {
    setLoading(true);
    const [b, r, c] = await Promise.all([
      supabase.from("crowdfunding_backers").select("*").order("created_at", { ascending: false }),
      supabase.from("crowdfunding_rewards").select("id, name, price_jpy, total_slots, is_active").eq("is_active", true).order("price_jpy"),
      supabase.from("crowdfunding_codes").select("backer_id, redeemed_at"),
    ]);
    setBackers((b.data as Backer[]) || []);
    setRewards((r.data as Reward[]) || []);
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

// ── メインアプリ ────────────────────────────────────────────────────────────
const MENU = [
  { id: "dashboard", icon: "📊", label: "ダッシュボード" },
  { id: "events", icon: "🎪", label: "イベント管理" },
  { id: "listings", icon: "📦", label: "出品管理" },
  { id: "members", icon: "👥", label: "会員管理" },
  { id: "reports", icon: "🚨", label: "通報管理" },
  { id: "sales", icon: "💰", label: "売上管理" },
  { id: "crowdfunding", icon: "🎁", label: "クラファン管理" },
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
        {page === "reports" && <ReportsPage />}
        {page === "sales" && <SalesPage />}
        {page === "crowdfunding" && <CrowdfundingPage />}
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

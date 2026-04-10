import { useState } from "react";

const C = {
  orange: "#F5A94A", orangeLight: "#FAC97A", orangePale: "#FFF3E0",
  dark: "#1A1208", darkBrown: "#2D1F0A", warmGray: "#9E9B95",
  border: "#EDE9E3", white: "#FFFFFF", cream: "#FAFAF7",
  green: "#4CAF50", greenPale: "#E8F5E9",
  red: "#EF5350", redPale: "#FFEBEE",
  blue: "#2196F3", bluePale: "#E3F2FD",
  purple: "#9C27B0", purplePale: "#F3E5F5",
};

// ── ダミーデータ ────────────────────────────────────────────────────────────
const MEMBERS = [
  { id:1, name:"田中 花子", email:"hanako@example.com", type:"購入者", joined:"2026.01.15", orders:5, status:"正常" },
  { id:2, name:"みかん工房", email:"mikan@example.com", type:"出品者", joined:"2026.01.20", orders:128, status:"正常" },
  { id:3, name:"佐藤 太郎", email:"sato@example.com", type:"購入者", joined:"2026.02.01", orders:2, status:"正常" },
  { id:4, name:"ぽちフォト", email:"pochi@example.com", type:"出品者", joined:"2026.02.10", orders:42, status:"審査中" },
  { id:5, name:"山田 美穂", email:"miho@example.com", type:"購入者", joined:"2026.02.15", orders:8, status:"正常" },
  { id:6, name:"てづくり屋さん", email:"tedzukuri@example.com", type:"出品者", joined:"2026.02.20", orders:64, status:"正常" },
  { id:7, name:"鈴木 健二", email:"kenji@example.com", type:"購入者", joined:"2026.03.01", orders:0, status:"停止中" },
  { id:8, name:"わんこベーカリー", email:"wanko@example.com", type:"出品者", joined:"2026.03.05", orders:55, status:"正常" },
];

const LISTINGS = [
  { id:1, title:"愛犬の水彩似顔絵", seller:"みかん工房", price:3800, category:"似顔絵", status:"公開中", orders:128, reported:false },
  { id:2, title:"猫ちゃん専用ニット服", seller:"てづくり屋さん", price:5200, category:"お洋服", status:"公開中", orders:64, reported:false },
  { id:3, title:"ペットの記念日フォト", seller:"ぽちフォト", price:12000, category:"フォト", status:"審査中", orders:0, reported:false },
  { id:4, title:"怪しいサービス", seller:"unknown", price:100, category:"その他", status:"公開中", orders:3, reported:true },
  { id:5, title:"デジタル似顔絵（即日）", seller:"イラスト工房ハル", price:1500, category:"似顔絵", status:"公開中", orders:211, reported:false },
  { id:6, title:"犬用バースデーケーキ", seller:"わんこベーカリー", price:4800, category:"フード", status:"公開中", orders:55, reported:false },
];

const ORDERS = [
  { id:"#001", buyer:"田中 花子", seller:"みかん工房", item:"愛犬の水彩似顔絵", amount:3800, status:"完了", date:"2026.03.10" },
  { id:"#002", buyer:"山田 美穂", seller:"ぽちフォト", item:"ペットの記念日フォト", amount:12000, status:"進行中", date:"2026.03.12" },
  { id:"#003", buyer:"佐藤 太郎", seller:"てづくり屋さん", item:"猫ちゃん専用ニット服", amount:5200, status:"完了", date:"2026.03.13" },
  { id:"#004", buyer:"鈴木 健二", seller:"わんこベーカリー", item:"犬用バースデーケーキ", amount:4800, status:"キャンセル", date:"2026.03.14" },
  { id:"#005", buyer:"田中 花子", seller:"イラスト工房ハル", item:"デジタル似顔絵（即日）", amount:1500, status:"完了", date:"2026.03.15" },
];

const REPORTS = [
  { id:1, type:"サービス通報", target:"怪しいサービス", reporter:"田中 花子", reason:"詐欺の疑い", date:"2026.03.14", status:"未対応" },
  { id:2, type:"ユーザー通報", target:"unknown", reporter:"みかん工房", reason:"スパムメッセージ", date:"2026.03.15", status:"未対応" },
  { id:3, type:"サービス通報", target:"コピー商品", reporter:"佐藤 太郎", reason:"著作権侵害", date:"2026.03.15", status:"対応済" },
];

// ── コンポーネント ──────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color = C.orange }) => (
  <div style={{ background:C.white, borderRadius:16, padding:"20px", border:`1px solid ${C.border}`, flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
      <div>
        <div style={{ fontSize:12, color:C.warmGray, marginBottom:6 }}>{label}</div>
        <div style={{ fontSize:28, fontWeight:900, color }}>{value}</div>
        {sub && <div style={{ fontSize:11, color:C.warmGray, marginTop:4 }}>{sub}</div>}
      </div>
      <div style={{ fontSize:28 }}>{icon}</div>
    </div>
  </div>
);

const Badge = ({ text, color, bg }) => (
  <span style={{ background:bg, color, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, whiteSpace:"nowrap" }}>{text}</span>
);

const statusBadge = (status) => {
  const map = {
    "正常": { color:C.green, bg:C.greenPale },
    "審査中": { color:"#F57C00", bg:"#FFF3E0" },
    "停止中": { color:C.red, bg:C.redPale },
    "公開中": { color:C.green, bg:C.greenPale },
    "完了": { color:C.green, bg:C.greenPale },
    "進行中": { color:C.blue, bg:C.bluePale },
    "キャンセル": { color:C.red, bg:C.redPale },
    "未対応": { color:C.red, bg:C.redPale },
    "対応済": { color:C.green, bg:C.greenPale },
  };
  const s = map[status] || { color:C.warmGray, bg:C.cream };
  return <Badge text={status} color={s.color} bg={s.bg}/>;
};

// ── 各ページ ────────────────────────────────────────────────────────────────
const DashboardPage = () => (
  <div>
    <h2 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:20 }}>📊 ダッシュボード</h2>

    {/* Stats */}
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
      <StatCard icon="👥" label="総会員数" value="1,247" sub="今月 +83名" color={C.blue}/>
      <StatCard icon="📦" label="出品サービス" value="342" sub="審査待ち 3件" color={C.orange}/>
      <StatCard icon="💰" label="今月の取引額" value="¥2.4M" sub="手数料 ¥240K" color={C.green}/>
      <StatCard icon="🚨" label="未対応通報" value="2件" sub="要確認" color={C.red}/>
    </div>

    {/* 最近の取引 */}
    <div style={{ background:C.white, borderRadius:16, padding:"20px", border:`1px solid ${C.border}`, marginBottom:20 }}>
      <div style={{ fontSize:15, fontWeight:800, color:C.dark, marginBottom:14 }}>📋 最近の取引</div>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr style={{ borderBottom:`2px solid ${C.border}` }}>
            {["ID","購入者","出品者","金額","ステータス","日付"].map(h=>(
              <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:12, fontWeight:700, color:C.warmGray }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ORDERS.map(o=>(
            <tr key={o.id} style={{ borderBottom:`1px solid ${C.border}` }}>
              <td style={{ padding:"10px", fontSize:13, fontWeight:700, color:C.orange }}>{o.id}</td>
              <td style={{ padding:"10px", fontSize:13, color:C.dark }}>{o.buyer}</td>
              <td style={{ padding:"10px", fontSize:13, color:C.dark }}>{o.seller}</td>
              <td style={{ padding:"10px", fontSize:13, fontWeight:700, color:C.dark }}>¥{o.amount.toLocaleString()}</td>
              <td style={{ padding:"10px" }}>{statusBadge(o.status)}</td>
              <td style={{ padding:"10px", fontSize:12, color:C.warmGray }}>{o.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* 通報アラート */}
    <div style={{ background:C.redPale, borderRadius:16, padding:"16px 20px", border:`1px solid ${C.red}30` }}>
      <div style={{ fontSize:14, fontWeight:800, color:C.red, marginBottom:10 }}>🚨 未対応の通報 2件</div>
      {REPORTS.filter(r=>r.status==="未対応").map(r=>(
        <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.red}20` }}>
          <div>
            <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{r.type}：{r.target}</span>
            <span style={{ fontSize:12, color:C.warmGray, marginLeft:10 }}>{r.reason}</span>
          </div>
          <span style={{ fontSize:11, color:C.warmGray }}>{r.date}</span>
        </div>
      ))}
    </div>
  </div>
);

const MembersPage = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const filtered = MEMBERS.filter(m => {
    if (filter !== "all" && m.type !== filter) return false;
    if (search && !m.name.includes(search) && !m.email.includes(search)) return false;
    return true;
  });

  return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:20 }}>👥 会員管理</h2>

      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="名前・メールで検索..."
          style={{ flex:1, minWidth:200, padding:"9px 14px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, outline:"none", fontFamily:"inherit" }}/>
        {["all","購入者","出品者"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:"9px 16px", border:`1.5px solid ${filter===f?C.orange:C.border}`,
            borderRadius:10, background:filter===f?C.orangePale:C.white,
            color:filter===f?C.orange:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
          }}>{f==="all"?"すべて":f}</button>
        ))}
      </div>

      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:C.cream, borderBottom:`2px solid ${C.border}` }}>
              {["名前","メール","タイプ","登録日","取引数","ステータス","操作"].map(h=>(
                <th key={h} style={{ padding:"12px 14px", textAlign:"left", fontSize:12, fontWeight:700, color:C.warmGray }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(m=>(
              <tr key={m.id} style={{ borderBottom:`1px solid ${C.border}`, cursor:"pointer" }} onClick={()=>setSelected(m)}>
                <td style={{ padding:"12px 14px", fontSize:13, fontWeight:700, color:C.dark }}>{m.name}</td>
                <td style={{ padding:"12px 14px", fontSize:12, color:C.warmGray }}>{m.email}</td>
                <td style={{ padding:"12px 14px" }}>
                  <Badge text={m.type} color={m.type==="出品者"?C.orange:C.blue} bg={m.type==="出品者"?C.orangePale:C.bluePale}/>
                </td>
                <td style={{ padding:"12px 14px", fontSize:12, color:C.warmGray }}>{m.joined}</td>
                <td style={{ padding:"12px 14px", fontSize:13, fontWeight:700, color:C.dark }}>{m.orders}</td>
                <td style={{ padding:"12px 14px" }}>{statusBadge(m.status)}</td>
                <td style={{ padding:"12px 14px" }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={e=>{e.stopPropagation();}} style={{ padding:"4px 10px", background:C.orangePale, border:`1px solid ${C.orange}30`, borderRadius:6, color:C.orange, fontSize:11, fontWeight:700, cursor:"pointer" }}>詳細</button>
                    {m.status!=="停止中" ? (
                      <button onClick={e=>{e.stopPropagation();}} style={{ padding:"4px 10px", background:C.redPale, border:`1px solid ${C.red}30`, borderRadius:6, color:C.red, fontSize:11, fontWeight:700, cursor:"pointer" }}>停止</button>
                    ) : (
                      <button onClick={e=>{e.stopPropagation();}} style={{ padding:"4px 10px", background:C.greenPale, border:`1px solid ${C.green}30`, borderRadius:6, color:C.green, fontSize:11, fontWeight:700, cursor:"pointer" }}>解除</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 詳細モーダル */}
      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={()=>setSelected(null)}>
          <div style={{ background:C.white, borderRadius:20, padding:28, width:400, maxWidth:"90vw" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontSize:18, fontWeight:900, color:C.dark }}>{selected.name}</div>
              <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
            </div>
            {[["メール",selected.email],["タイプ",selected.type],["登録日",selected.joined],["取引数",`${selected.orders}件`],["ステータス",selected.status]].map(([k,v])=>(
              <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontSize:13, color:C.warmGray }}>{k}</span>
                <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{v}</span>
              </div>
            ))}
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button style={{ flex:1, padding:"11px", background:C.redPale, border:`1px solid ${C.red}30`, borderRadius:10, color:C.red, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>アカウント停止</button>
              <button style={{ flex:1, padding:"11px", background:C.orange, border:"none", borderRadius:10, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>メール送信</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ListingsPage = () => {
  const [search, setSearch] = useState("");
  const filtered = LISTINGS.filter(l => !search || l.title.includes(search) || l.seller.includes(search));

  return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:20 }}>📦 出品管理</h2>

      <div style={{ display:"flex", gap:10, marginBottom:16 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="サービス名・出品者で検索..."
          style={{ flex:1, padding:"9px 14px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, outline:"none", fontFamily:"inherit" }}/>
        <div style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", background:C.redPale, border:`1px solid ${C.red}30`, borderRadius:10 }}>
          <span style={{ fontSize:13, fontWeight:700, color:C.red }}>🚨 通報あり：{LISTINGS.filter(l=>l.reported).length}件</span>
        </div>
      </div>

      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:C.cream, borderBottom:`2px solid ${C.border}` }}>
              {["サービス名","出品者","カテゴリ","価格","取引数","ステータス","操作"].map(h=>(
                <th key={h} style={{ padding:"12px 14px", textAlign:"left", fontSize:12, fontWeight:700, color:C.warmGray }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(l=>(
              <tr key={l.id} style={{ borderBottom:`1px solid ${C.border}`, background:l.reported?"#FFF8F8":"transparent" }}>
                <td style={{ padding:"12px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    {l.reported && <span style={{ fontSize:14 }}>🚨</span>}
                    <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{l.title}</span>
                  </div>
                </td>
                <td style={{ padding:"12px 14px", fontSize:13, color:C.warmGray }}>{l.seller}</td>
                <td style={{ padding:"12px 14px", fontSize:12, color:C.warmGray }}>{l.category}</td>
                <td style={{ padding:"12px 14px", fontSize:13, fontWeight:700, color:C.orange }}>¥{l.price.toLocaleString()}</td>
                <td style={{ padding:"12px 14px", fontSize:13, color:C.dark }}>{l.orders}</td>
                <td style={{ padding:"12px 14px" }}>{statusBadge(l.status)}</td>
                <td style={{ padding:"12px 14px" }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <button style={{ padding:"4px 10px", background:C.greenPale, border:`1px solid ${C.green}30`, borderRadius:6, color:C.green, fontSize:11, fontWeight:700, cursor:"pointer" }}>承認</button>
                    <button style={{ padding:"4px 10px", background:C.redPale, border:`1px solid ${C.red}30`, borderRadius:6, color:C.red, fontSize:11, fontWeight:700, cursor:"pointer" }}>削除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ReportsPage = () => (
  <div>
    <h2 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:20 }}>🚨 通報管理</h2>
    <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr style={{ background:C.cream, borderBottom:`2px solid ${C.border}` }}>
            {["種類","対象","通報者","理由","日付","ステータス","操作"].map(h=>(
              <th key={h} style={{ padding:"12px 14px", textAlign:"left", fontSize:12, fontWeight:700, color:C.warmGray }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {REPORTS.map(r=>(
            <tr key={r.id} style={{ borderBottom:`1px solid ${C.border}`, background:r.status==="未対応"?"#FFF8F8":"transparent" }}>
              <td style={{ padding:"12px 14px" }}><Badge text={r.type} color={C.red} bg={C.redPale}/></td>
              <td style={{ padding:"12px 14px", fontSize:13, fontWeight:700, color:C.dark }}>{r.target}</td>
              <td style={{ padding:"12px 14px", fontSize:13, color:C.warmGray }}>{r.reporter}</td>
              <td style={{ padding:"12px 14px", fontSize:13, color:C.dark }}>{r.reason}</td>
              <td style={{ padding:"12px 14px", fontSize:12, color:C.warmGray }}>{r.date}</td>
              <td style={{ padding:"12px 14px" }}>{statusBadge(r.status)}</td>
              <td style={{ padding:"12px 14px" }}>
                <div style={{ display:"flex", gap:6 }}>
                  <button style={{ padding:"4px 10px", background:C.redPale, border:`1px solid ${C.red}30`, borderRadius:6, color:C.red, fontSize:11, fontWeight:700, cursor:"pointer" }}>対処する</button>
                  <button style={{ padding:"4px 10px", background:C.greenPale, border:`1px solid ${C.green}30`, borderRadius:6, color:C.green, fontSize:11, fontWeight:700, cursor:"pointer" }}>却下</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const SalesPage = () => (
  <div>
    <h2 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:20 }}>💰 売上管理</h2>

    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
      <StatCard icon="💰" label="今月の総売上" value="¥2,412,000" sub="取引 189件" color={C.green}/>
      <StatCard icon="🏦" label="プラットフォーム手数料" value="¥241,200" sub="手数料率 10%" color={C.orange}/>
      <StatCard icon="📈" label="先月比" value="+23%" sub="成長中" color={C.blue}/>
    </div>

    <div style={{ background:C.white, borderRadius:16, padding:"20px", border:`1px solid ${C.border}` }}>
      <div style={{ fontSize:15, fontWeight:800, color:C.dark, marginBottom:14 }}>📋 取引一覧</div>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr style={{ borderBottom:`2px solid ${C.border}` }}>
            {["ID","購入者","出品者","商品","金額","手数料","ステータス","日付"].map(h=>(
              <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:12, fontWeight:700, color:C.warmGray }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ORDERS.map(o=>(
            <tr key={o.id} style={{ borderBottom:`1px solid ${C.border}` }}>
              <td style={{ padding:"10px", fontSize:13, fontWeight:700, color:C.orange }}>{o.id}</td>
              <td style={{ padding:"10px", fontSize:13 }}>{o.buyer}</td>
              <td style={{ padding:"10px", fontSize:13 }}>{o.seller}</td>
              <td style={{ padding:"10px", fontSize:12, color:C.warmGray }}>{o.item}</td>
              <td style={{ padding:"10px", fontSize:13, fontWeight:700 }}>¥{o.amount.toLocaleString()}</td>
              <td style={{ padding:"10px", fontSize:13, color:C.orange }}>¥{Math.round(o.amount*0.1).toLocaleString()}</td>
              <td style={{ padding:"10px" }}>{statusBadge(o.status)}</td>
              <td style={{ padding:"10px", fontSize:12, color:C.warmGray }}>{o.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ── メインアプリ ────────────────────────────────────────────────────────────
const MENU = [
  { id:"dashboard", icon:"📊", label:"ダッシュボード" },
  { id:"members", icon:"👥", label:"会員管理" },
  { id:"listings", icon:"📦", label:"出品管理" },
  { id:"reports", icon:"🚨", label:"通報管理", badge:2 },
  { id:"sales", icon:"💰", label:"売上管理" },
];

export default function AdminDashboard() {
  const [page, setPage] = useState("dashboard");
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");

  if (!loggedIn) return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg, ${C.dark}, ${C.darkBrown})`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Noto Sans JP',sans-serif" }}>
      <div style={{ background:C.white, borderRadius:24, padding:"40px 32px", width:360, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔐</div>
        <div style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:4 }}>Qocca 管理者画面</div>
        <div style={{ fontSize:13, color:C.warmGray, marginBottom:28 }}>管理者のみアクセス可能</div>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&setLoggedIn(true)}
          placeholder="パスワードを入力"
          style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:`1.5px solid ${C.border}`, fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box", marginBottom:14 }}/>
        <button onClick={()=>setLoggedIn(true)} style={{ width:"100%", padding:"13px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer" }}>
          ログイン
        </button>
        <div style={{ fontSize:11, color:C.warmGray, marginTop:12 }}>※ デモ版のため任意のパスワードでログインできます</div>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:"'Noto Sans JP',sans-serif", background:C.cream }}>
      {/* Sidebar */}
      <div style={{ width:220, background:`linear-gradient(180deg, ${C.dark}, ${C.darkBrown})`, padding:"24px 0", flexShrink:0, display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"0 20px 24px", borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize:20, fontWeight:900, color:C.orange }}>Qocca</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 }}>管理者パネル</div>
        </div>
        <div style={{ flex:1, padding:"16px 0" }}>
          {MENU.map(m=>(
            <button key={m.id} onClick={()=>setPage(m.id)} style={{
              width:"100%", padding:"12px 20px", border:"none", cursor:"pointer",
              background: page===m.id ? "rgba(245,169,74,0.15)" : "transparent",
              borderLeft: page===m.id ? `3px solid ${C.orange}` : "3px solid transparent",
              display:"flex", alignItems:"center", gap:10, fontFamily:"inherit"
            }}>
              <span style={{ fontSize:18 }}>{m.icon}</span>
              <span style={{ fontSize:13, fontWeight:700, color: page===m.id ? C.orange : "rgba(255,255,255,0.7)" }}>{m.label}</span>
              {m.badge && <span style={{ marginLeft:"auto", background:C.red, color:"#fff", fontSize:10, fontWeight:800, padding:"2px 7px", borderRadius:10 }}>{m.badge}</span>}
            </button>
          ))}
        </div>
        <div style={{ padding:"16px 20px", borderTop:"1px solid rgba(255,255,255,0.1)" }}>
          <button onClick={()=>setLoggedIn(false)} style={{ width:"100%", padding:"10px", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:10, color:"rgba(255,255,255,0.6)", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            ログアウト
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, padding:"28px 32px", overflowY:"auto" }}>
        {page==="dashboard" && <DashboardPage/>}
        {page==="members" && <MembersPage/>}
        {page==="listings" && <ListingsPage/>}
        {page==="reports" && <ReportsPage/>}
        {page==="sales" && <SalesPage/>}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.orangeLight}; border-radius: 2px; }
        input::placeholder { color: ${C.warmGray}; }
      `}</style>
    </div>
  );
}

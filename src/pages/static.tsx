// 静的ページ群 (App.tsx 分割 Phase5 ①static)
// Tokusho / Terms / Privacy / Contact / QoccaTownGuide / FirstStepGuide /
// FoundingCreators / Sponsors / Legal / FAQ
// ⚠️ ロジック・参照名は App.tsx 時点から1文字も改変なし (切り取って移動)。
// ⚠️ InitialMembersSection は Home セクションのため App.tsx に残留 (FoundingCreator 型は types.ts 経由で共有)。

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../constants/theme";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { CAMPFIRE_PROJECT_URL_WITH_UTM } from "../constants/data";
import { TERMS_V2 } from "../legal/terms_v2";
import type { FoundingCreator } from "../types";

// ============================================================================
// 法律系ページ（バグ#1-4 修正）
// ============================================================================

// ── 特定商取引法に基づく表記（法的義務）─────────────────────────────
export const TokushoPage = ({ setPage, isPC }) => {
  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      <div style={{ maxWidth:780, margin:"0 auto", padding:"40px 20px 60px" }}>
        <button onClick={()=>setPage("home")} style={{ background:"none", border:"none", color:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:16, padding:0, fontFamily:"inherit" }}>← ホームに戻る</button>
        <h1 style={{ fontSize:24, fontWeight:900, color:C.dark, marginBottom:8, lineHeight:1.4 }}>📜 特定商取引法に基づく表記</h1>
        <p style={{ fontSize:11, color:C.warmGray, marginBottom:24 }}>最終更新日: 2026年5月11日</p>

        <div style={{ background:C.white, borderRadius:16, padding:"24px", border:`1px solid ${C.border}`, lineHeight:1.8 }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <tbody>
              {[
                ["販売事業者", "Qocca運営事務局"],
                ["運営責任者", "正和"],
                ["所在地", "ご請求があれば遅滞なく開示いたします"],
                ["連絡先", "support@qocca.pet（お問い合わせフォームよりご連絡ください）"],
                ["販売価格", "各商品ページに表示の価格"],
                ["商品代金以外の必要料金", "決済手数料（購入者負担・購入時に明示）／配送料（出品者の定めによる）"],
                ["お支払い方法", "クレジットカード決済（Stripe）"],
                ["お支払い時期", "ご注文時に決済"],
                ["商品引渡し時期", "各商品ページに記載の納期に準ずる"],
                ["返品・交換について", "オーダーメイド作品の性質上、原則として返品・交換は受け付けておりません。商品に明らかな瑕疵がある場合は、商品到着後7日以内にお問い合わせフォームよりご連絡ください。"],
                ["事業者の検査済証", "特定商取引法第11条第6号に基づく表記"],
              ].map(([k,v]) => (
                <tr key={k} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"12px 12px 12px 0", fontWeight:800, color:C.dark, verticalAlign:"top", width:"30%", minWidth:120 }}>{k}</td>
                  <td style={{ padding:"12px 0", color:"#444" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize:11, color:C.warmGray, marginTop:24, lineHeight:1.7 }}>
            ※ 本表記は特定商取引法第11条に基づくものです。<br/>
            ※ Qoccaはペットオーナー向けクリエイターマーケットプレイスとして運営されており、各取引はQoccaを通じて出品者と購入者の間で成立します。
          </p>
        </div>
      </div>
    </div>
  );
};

// ── 利用規約 (依頼書 #105: 弁護士確認版 v2.0 / LegalPage に統一) ─────
export const TermsPage = ({ setPage, isPC: _isPC }) => {
  // 旧 TermsPage の JSX は v2.0 と互換性なし → LegalPage(type=terms) に転送
  return <LegalPage type="terms" setPage={setPage}/>;
};


// ── プライバシーポリシー ────────────────────────────────────────────
export const PrivacyPage = ({ setPage, isPC }) => {
  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      <div style={{ maxWidth:780, margin:"0 auto", padding:"40px 20px 60px" }}>
        <button onClick={()=>setPage("home")} style={{ background:"none", border:"none", color:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:16, padding:0, fontFamily:"inherit" }}>← ホームに戻る</button>
        <h1 style={{ fontSize:24, fontWeight:900, color:C.dark, marginBottom:8, lineHeight:1.4 }}>🔒 プライバシーポリシー</h1>
        <p style={{ fontSize:11, color:C.warmGray, marginBottom:24 }}>最終更新日: 2026年5月11日</p>

        <div style={{ background:C.white, borderRadius:16, padding:"24px 28px", border:`1px solid ${C.border}`, lineHeight:1.9, fontSize:13, color:"#333" }}>
          <p style={{ marginBottom:20 }}>
            Qocca運営事務局（以下「当社」）は、ユーザーの個人情報の保護を重要な責務と認識し、個人情報保護法および関連法令を遵守して、適切に取り扱います🐾
          </p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>1. 取得する情報</h2>
          <ul style={{ paddingLeft:20 }}>
            <li>氏名、ニックネーム、メールアドレス、プロフィール画像</li>
            <li>取引履歴（出品・購入・決済情報）</li>
            <li>配送先住所（購入時のみ）</li>
            <li>口座情報（出品者のみ・Stripe Connect経由）</li>
            <li>サービス利用ログ（IPアドレス、Cookie、デバイス情報）</li>
          </ul>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>2. 利用目的</h2>
          <ul style={{ paddingLeft:20 }}>
            <li>本サービスの提供・運営</li>
            <li>本人確認、決済処理</li>
            <li>サポート対応、不正利用の防止</li>
            <li>サービスの改善、新機能開発</li>
            <li>マーケティング（同意のある場合のみ）</li>
          </ul>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>3. 第三者への提供</h2>
          <p>当社は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません：</p>
          <ul style={{ paddingLeft:20, marginTop:6 }}>
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>取引相手への必要最小限の情報提供（出品者から購入者への配送など）</li>
            <li>決済代行業者（Stripe）への取引情報の提供</li>
          </ul>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>4. 情報の管理</h2>
          <p>当社は、取得した個人情報を安全に管理し、不正アクセス・紛失・改ざん・漏洩等が起きないよう適切な措置を講じます。データはSupabase（PostgreSQL）で暗号化保存され、Row Level Security（RLS）により厳格にアクセス制御しています。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>5. Cookieの利用</h2>
          <p>本サービスは、利便性向上のためCookieを利用します。Cookieの受け入れはブラウザ設定で拒否することができますが、その場合一部機能が利用できない可能性があります。</p>
          {/* 依頼書 #121 (2026/6/5): Meta Pixel 利用追記 */}
          {/* 依頼書 #135 Phase B (2026/6/8): Cookie 拒否ガイド + Meta opt-out URL 補強 */}
          <p style={{ marginTop:8 }}>また、広告効果測定およびサービス改善のため、Meta Pixel（Meta Platforms, Inc.）を利用し、Cookie 等を通じて閲覧情報（閲覧ページ・参照元・行動イベント等）を取得する場合があります。氏名・メールアドレス・電話番号・住所等の個人を特定する情報は計測タグに含めない設計としています。</p>
          <p style={{ marginTop:8 }}>Cookie の利用を希望されない場合、ブラウザ設定（Chrome / Safari / Firefox の「設定」→「プライバシーとセキュリティ」→「Cookie」）から無効化または個別サイト単位での拒否が可能です。また Meta 社の広告計測のオプトアウトは <span style={{ color:C.orange, fontWeight:600 }}>https://www.facebook.com/settings?tab=ads</span> から行えます（Meta アカウントへのログインが必要）。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>6. 開示・訂正・削除請求</h2>
          <p>ユーザーは、自己の個人情報について、開示・訂正・削除を請求できます。お問い合わせフォームよりご連絡ください。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>7. アカウント削除</h2>
          <p>退会希望のユーザーは、お問い合わせフォームより削除請求していただけます。一定期間経過後、技術的に可能な範囲で個人情報を削除いたします。なお、取引履歴・法令で保管が義務付けられた情報は、法定期間保管します。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>8. プライバシーポリシーの変更</h2>
          <p>当社は、本ポリシーを必要に応じて変更できるものとします。重要な変更がある場合は、本サービス上で通知します。</p>

          <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, marginTop:24, marginBottom:10 }}>9. お問い合わせ</h2>
          <p>本ポリシーに関するお問い合わせは、お問い合わせフォームよりご連絡ください。</p>

          <p style={{ marginTop:32, padding:"16px", background:C.cream, borderRadius:10, fontSize:12, color:C.warmGray }}>
            🐾 Qoccaは、ペットオーナー様の大切な個人情報を、ペットへの愛情と同じ気持ちで、大切に守ります。
          </p>
        </div>
      </div>
    </div>
  );
};

// ── お問い合わせ ─────────────────────────────────────────────────
export const ContactPage = ({ setPage, isPC }) => {
  const { user } = useAuth();
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !subject.trim() || !message.trim()) {
      setError("すべての項目を入力してください");
      return;
    }
    setSubmitting(true);
    
    // 1. support_tickets にチケット本体を作成
    const ticketNumber = "QC-" + Date.now().toString().slice(-8);
    const { data: ticketData, error: ticketErr } = await supabase
      .from("support_tickets")
      .insert({
        ticket_number: ticketNumber,
        user_id: user?.id || null,
        category,
        subject: subject.trim(),
        priority: "normal",
        status: "open",
      })
      .select()
      .single();
    
    if (ticketErr || !ticketData) {
      setSubmitting(false);
      setError("送信に失敗しました: " + (ticketErr?.message || "ticket creation failed"));
      return;
    }
    
    // 2. support_messages に初回メッセージ（本文 + email 情報）を保存
    const bodyText = `【返信先メールアドレス】\n${email.trim()}\n\n【お問い合わせ内容】\n${message.trim()}`;
    const { error: msgErr } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketData.id,
        sender_type: "user",
        sender_id: user?.id || null,
        body: bodyText,
      });
    
    setSubmitting(false);
    if (msgErr) {
      setError("メッセージ保存に失敗しました: " + msgErr.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center", padding:32, maxWidth:400 }}>
          <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
          <h2 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:10 }}>送信ありがとうございます！</h2>
          <p style={{ color:C.warmGray, fontSize:13, lineHeight:1.7, marginBottom:24 }}>
            お問い合わせを受け付けました🐾<br/>
            運営事務局より、3営業日以内にご返信いたします。
          </p>
          <button onClick={()=>setPage("home")} style={{ padding:"12px 28px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>ホームに戻る</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      <div style={{ maxWidth:640, margin:"0 auto", padding:"40px 20px 60px" }}>
        <button onClick={()=>setPage("home")} style={{ background:"none", border:"none", color:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:16, padding:0, fontFamily:"inherit" }}>← ホームに戻る</button>
        <h1 style={{ fontSize:24, fontWeight:900, color:C.dark, marginBottom:8, lineHeight:1.4 }}>🎧 お問い合わせ</h1>
        <p style={{ fontSize:13, color:C.warmGray, marginBottom:24, lineHeight:1.7 }}>
          Qoccaに関するご質問・ご要望はこちらから🐾<br/>
          3営業日以内にメールにてご返信いたします。
        </p>

        <div style={{ background:C.white, borderRadius:16, padding:"24px", border:`1px solid ${C.border}` }}>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>お問い合わせ種別</label>
            <select value={category} onChange={e=>setCategory(e.target.value)} style={{
              width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
              fontSize:13, fontFamily:"inherit", outline:"none", background:C.white, boxSizing:"border-box"
            }}>
              <option value="general">一般的なご質問</option>
              <option value="account">アカウント・ログインについて</option>
              <option value="order">注文・取引について</option>
              <option value="payment">決済・支払いについて</option>
              <option value="creator">出品者として参加したい</option>
              <option value="bug">不具合の報告</option>
              <option value="feature">機能要望・提案</option>
              <option value="press">取材・メディア掲載依頼</option>
              <option value="other">その他</option>
            </select>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>返信先メールアドレス *</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" style={{
              width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
              fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box"
            }}/>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>件名 *</label>
            <input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={100} placeholder="例: 出品方法について" style={{
              width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
              fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box"
            }}/>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:800, color:C.dark, display:"block", marginBottom:6 }}>お問い合わせ内容 *</label>
            <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={6} maxLength={3000} placeholder="お問い合わせの詳細をご記入ください" style={{
              width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`,
              fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box"
            }}/>
            <div style={{ fontSize:10, color:C.warmGray, textAlign:"right", marginTop:4 }}>{message.length}/3000</div>
          </div>

          {error && <div style={{ background:"#FFEBEE", color:C.red, padding:"10px 12px", borderRadius:10, fontSize:12, marginBottom:12 }}>{error}</div>}

          <div style={{ background:C.cream, borderRadius:10, padding:"12px 14px", fontSize:11, color:"#5D4037", lineHeight:1.7, marginBottom:14 }}>
            📋 個人情報の取扱いについては<span onClick={()=>setPage("privacy")} style={{ color:C.orange, fontWeight:700, cursor:"pointer" }}>プライバシーポリシー</span>をご確認ください。<br/>
            🐾 お返事まで通常2-3営業日いただきます。お急ぎの場合はその旨ご記載ください。
          </div>

          <button disabled={submitting} onClick={handleSubmit} style={{
            width:"100%", padding:"14px", background:submitting?C.warmGray:C.orange, border:"none", borderRadius:12,
            color:"#fff", fontWeight:800, fontSize:14, cursor:submitting?"not-allowed":"pointer", fontFamily:"inherit"
          }}>{submitting ? "送信中..." : "📨 送信する"}</button>
        </div>
      </div>
    </div>
  );
};

// ── Qocca Town Guide ("What is Qocca?" 街の機能ガイド)─────────────────
export const QoccaTownGuide = ({ setPage }) => {
  const features = [
    { icon:"💬", emoji:"🏞", label:"広場", title:"仲間と話せる広場", desc:"同じ犬種・年齢・お悩みの仲間とつながる。\nペット好き専用のコミュニティ。", to:"communities" },
    { icon:"🛍", emoji:"🏪", label:"商店街", title:"想いを形にした商店街", desc:"似顔絵・ハンドメイド服・写真撮影。\nペット好きクリエイターの一点物が並ぶ。", to:"marketplace" },
    { icon:"🗺", emoji:"🏯", label:"案内所", title:"全国の施設・イベント案内所", desc:"ドッグラン、公園、ペット可カフェ。\n全国の情報がここに集まる。", to:"facilities" },
    { icon:"📷", emoji:"🖼", label:"掲示板", title:"うちの子の写真掲示板", desc:"自慢のうちの子をシェアして、\n他の住民とコメントで盛り上がる。", to:"gallery" },
  ];
  return (
    <section style={{ padding:"50px 20px 40px", background:C.cream }}>
      <div style={{ maxWidth:880, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ display:"inline-block", padding:"4px 14px", background:C.orangePale, color:C.orange, fontSize:11, fontWeight:800, borderRadius:20, marginBottom:14, letterSpacing:0.5 }}>
            🏘 QOCCA TOWN
          </div>
          <h2 style={{ fontSize:24, fontWeight:900, color:C.dark, lineHeight:1.4, marginBottom:10 }}>
            Qoccaは、こんな街です 🐾
          </h2>
          <p style={{ fontSize:13, color:C.warmGray, lineHeight:1.8 }}>
            ペット好きしか住んでいない、温かい街。<br/>
            ここには、4つの場所があります。
          </p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:14 }}>
          {features.map((f,i) => (
            <div key={i} onClick={()=>setPage(f.to)} style={{
              background:C.white, borderRadius:16, padding:"24px 18px", border:`1px solid ${C.border}`,
              cursor:"pointer", transition:"transform 0.15s, box-shadow 0.15s",
              boxShadow:"0 2px 8px rgba(0,0,0,0.04)"
            }} onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow="0 8px 20px rgba(245,169,74,0.15)"; }} onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.04)"; }}>
              <div style={{ fontSize:42, marginBottom:10, lineHeight:1 }}>{f.emoji}</div>
              <div style={{ fontSize:10, color:C.orange, fontWeight:800, letterSpacing:1, marginBottom:6 }}>{f.icon} {f.label.toUpperCase()}</div>
              <div style={{ fontSize:14, fontWeight:900, color:C.dark, marginBottom:8, lineHeight:1.4 }}>{f.title}</div>
              <div style={{ fontSize:11, color:C.warmGray, lineHeight:1.7, whiteSpace:"pre-line" }}>{f.desc}</div>
              <div style={{ fontSize:11, color:C.orange, fontWeight:700, marginTop:12 }}>のぞいてみる →</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:28, padding:"18px 20px", background:`linear-gradient(135deg, ${C.orangePale} 0%, ${C.cream} 100%)`, borderRadius:14, textAlign:"center", border:`1px dashed ${C.orange}` }}>
          <p style={{ fontSize:13, color:C.dark, fontWeight:700, lineHeight:1.7, margin:0 }}>
            🐨 「動物を飼ったら、まずQocca」
          </p>
          <p style={{ fontSize:11, color:C.warmGray, marginTop:6, lineHeight:1.7 }}>
            そんな"当たり前"を目指して、街を育てています。
          </p>
        </div>
      </div>
    </section>
  );
};

// ── First Step Guide ("はじめての方へ" 3ステップ)────────────────────
export const FirstStepGuide = ({ setPage }) => {
  const steps = [
    { num:"1", emoji:"🐾", title:"住民になる(30秒)", desc:"うちの子のプロフィールを登録。\n街の住民として歓迎されます。", action:"アカウント作成", to:"signup" },
    { num:"2", emoji:"💬", title:"広場で挨拶する(1分)", desc:"同じ犬種・地域の仲間がいる\nコミュニティに参加してみよう。", action:"広場をのぞく", to:"communities" },
    { num:"3", emoji:"🏘", title:"街を散歩する", desc:"商店街でお気に入りを探したり、\n近所の施設を案内所でチェック。", action:"街を歩く", to:"marketplace" },
  ];
  return (
    <section style={{ padding:"40px 20px 50px", background:C.white }}>
      <div style={{ maxWidth:780, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ display:"inline-block", padding:"4px 14px", background:"#E8F5E9", color:"#2E7D32", fontSize:11, fontWeight:800, borderRadius:20, marginBottom:14, letterSpacing:0.5 }}>
            👋 FIRST STEP
          </div>
          <h2 style={{ fontSize:22, fontWeight:900, color:C.dark, lineHeight:1.4, marginBottom:8 }}>
            はじめての方へ
          </h2>
          <p style={{ fontSize:13, color:C.warmGray, lineHeight:1.8 }}>
            3ステップで、Qoccaの住民デビュー 🐨
          </p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {steps.map((s,i)=>(
            <div key={i} style={{
              display:"flex", alignItems:"center", gap:16, padding:"18px 20px",
              background:C.cream, borderRadius:16, border:`1px solid ${C.border}`
            }}>
              <div style={{
                width:48, height:48, borderRadius:"50%",
                background:`linear-gradient(135deg, ${C.orange} 0%, ${C.orangeLight} 100%)`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:18, fontWeight:900, color:"#fff", flexShrink:0,
                boxShadow:"0 4px 10px rgba(245,169,74,0.3)"
              }}>{s.num}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  <span style={{ fontSize:18 }}>{s.emoji}</span>
                  <span style={{ fontSize:14, fontWeight:900, color:C.dark }}>{s.title}</span>
                </div>
                <div style={{ fontSize:12, color:C.warmGray, lineHeight:1.7, whiteSpace:"pre-line", marginBottom:8 }}>{s.desc}</div>
                <button onClick={()=>setPage(s.to)} style={{
                  padding:"6px 14px", background:C.white, border:`1.5px solid ${C.orange}`,
                  borderRadius:20, color:C.orange, fontWeight:800, fontSize:11,
                  cursor:"pointer", fontFamily:"inherit"
                }}>{s.action} →</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:24, textAlign:"center" }}>
          <p style={{ fontSize:12, color:C.warmGray, lineHeight:1.7 }}>
            迷ったら、まずは <span onClick={()=>setPage("communities")} style={{ color:C.orange, fontWeight:800, cursor:"pointer", textDecoration:"underline" }}>広場をのぞいてみる</span> のがおすすめ 🐾
          </p>
        </div>
      </div>
    </section>
  );
};

// ── 依頼書 #36 (2026/5/31): 初期メンバー紹介ページ /founding-creators ─────────
// 「想いを込めて、置いていく人たち」 = 出品済みクリエイター + 創業クリエイター + 初期メンバー
// 公開 view founding_creators_view (anon 可) から ORDER で並ぶ
// FoundingCreator 型は src/types.ts へ移動 (Phase5 ①static / InitialMembersSection と共有のため中立化)

export const FoundingCreatorsPage = ({ setPage: _setPage }: { setPage: (p: string) => void }) => {
  const navigate = useNavigate();
  const [creators, setCreators] = useState<FoundingCreator[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("founding_creators_view")
        .select("id, display_name, avatar_url, bio, creator_intro, is_founding_creator, is_initial_member, approved_count")
        .order("is_founding_creator", { ascending: false })
        .order("approved_count", { ascending: false })
        .order("created_at", { ascending: true });
      setCreators((data as any[]) || []);
      setLoaded(true);
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.cream, paddingTop: 64, paddingBottom: 80, fontFamily: "'Noto Sans JP',sans-serif" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎨</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: C.dark, margin: "0 0 10px", lineHeight: 1.5 }}>
            想いを込めて、置いていく人たち
          </h1>
          <p style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.9, margin: 0 }}>
            Qocca の街で 最初に作品を<br />
            置いてくださったクリエイターさん🐾
          </p>
        </div>

        {!loaded ? (
          <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>読み込み中...</div>
        ) : creators.length === 0 ? (
          <div style={{ background: C.white, borderRadius: 20, padding: 40, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🌱</div>
            <p style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.8, margin: 0 }}>
              まだクリエイターさんがいません。<br />
              クラウドファンディング 公開中。創業パートナーさんを順次紹介してまいります🌅
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
              {creators.map(c => {
                const name = c.display_name || "（名前未設定）";
                const introRaw = (c.creator_intro || c.bio || "").trim();
                const intro = introRaw.length > 80 ? introRaw.slice(0, 80) + "…" : introRaw;
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/profile/${c.id}`)}
                    style={{
                      background: C.white, borderRadius: 16, padding: 20,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s",
                      display: "flex", gap: 16, alignItems: "flex-start",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
                  >
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt={name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.cream, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>🎨</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: C.dark }}>{name}</div>
                        {c.is_founding_creator && (
                          <span style={{ background: "#F3E5F5", color: "#AB47BC", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>⭐ 創業クリエイター</span>
                        )}
                        {!c.is_founding_creator && c.is_initial_member && (
                          <span style={{ background: "#FFF3E0", color: "#A07640", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>🌱 初期メンバー</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: C.warmGray, marginBottom: intro ? 6 : 0 }}>
                        🎨 出品 {c.approved_count}件
                      </div>
                      {intro && (
                        <div style={{ fontSize: 12, color: C.dark, lineHeight: 1.7, marginBottom: 6 }}>
                          "{intro}"
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>作品を見る →</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ background: C.white, borderRadius: 16, padding: 24, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.dark, margin: "0 0 10px" }}>
                あなたも創業クリエイターになる🌅
              </h3>
              <p style={{ fontSize: 12, color: C.warmGray, lineHeight: 1.8, margin: "0 0 14px" }}>
                CAMPFIRE の「創業クリエイター」リターン (¥8,000) で<br />
                <strong style={{ color: C.dark }}>事業が存続する限り手数料 3% (通常 10%→3%)</strong> + 創業クリエイターバッジ獲得
              </p>
              <a
                href={CAMPFIRE_PROJECT_URL_WITH_UTM}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-block", padding: "10px 22px", background: C.orange, color: "#fff", borderRadius: 22, fontSize: 13, fontWeight: 800, textDecoration: "none" }}
              >
                📣 CAMPFIRE で支援する →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── 依頼書 #35 v2 (2026/5/31): 法人スポンサー一覧ページ /sponsors ─────────
// 公開専用ビュー crowdfunding_founding_partners_public (anon可・amount/backer_id非露出) から corporate_300000 のみ
// ビュー側で public_display=true & redeemed_at IS NOT NULL & founding_display_consent=true を内包・グリッド表示
// 空状態は CTA 中心、登録あれば法人ロゴ + 社名 + Web リンク
export const SponsorsPage = ({ setPage: _setPage }: { setPage: (p: string) => void }) => {
  const [sponsors, setSponsors] = useState<Array<{
    sponsor_logo_url: string | null;
    sponsor_company_name: string | null;
    sponsor_website_url: string | null;
    display_name: string | null;
    created_at: string;
  }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      // 公開専用ビュー (同意法人のみ・amount/backer_id 非露出)
      const { data } = await supabase
        .from("crowdfunding_founding_partners_public")
        .select("sponsor_logo_url, sponsor_company_name, sponsor_website_url, display_name, created_at")
        .eq("tier", "corporate_300000")
        .order("created_at", { ascending: true });
      setSponsors((data as any[]) || []);
      setLoaded(true);
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.cream, paddingTop: 64, paddingBottom: 80, fontFamily: "'Noto Sans JP',sans-serif" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🏢</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: C.dark, margin: "0 0 8px" }}>
            法人スポンサー
          </h1>
          <p style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.8, margin: 0 }}>
            Qocca の街を支えてくださっている法人スポンサーの皆様です🐾<br />
            <span style={{ fontSize: 11, opacity: 0.7 }}>クラウドファンディング ¥300,000 リターン「法人スポンサー｜街の協力者」掲載</span>
          </p>
        </div>

        {!loaded ? (
          <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>読み込み中...</div>
        ) : sponsors.length === 0 ? (
          <div style={{ background: C.white, borderRadius: 20, padding: 40, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 38, marginBottom: 14 }}>🌱</div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.dark, margin: "0 0 10px" }}>
              法人スポンサー募集中
            </h3>
            <p style={{ fontSize: 12.5, color: C.warmGray, lineHeight: 1.9, margin: "0 0 20px" }}>
              Qocca の街を 一緒に育ててくださる法人パートナーを募集しています🐾<br />
              ¥300,000 のクラウドファンディング支援で、<br />
              法人スポンサーとして以下を提供します：<br /><br />
              ・このページに法人ロゴ + 社名 + Web リンク掲載<br />
              ・HomePage 創業パートナーセクションに法人名掲載<br />
              ・利用規約 第29条で正式支援者として明文化
            </p>
            <a
              href={CAMPFIRE_PROJECT_URL_WITH_UTM}
              target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", padding: "12px 26px", background: C.orange, color: "#fff", borderRadius: 24, fontSize: 13, fontWeight: 800, textDecoration: "none" }}
            >
              📣 CAMPFIRE で支援する →
            </a>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
              {sponsors.map((s, i) => {
                const name = s.sponsor_company_name || s.display_name || "法人スポンサー";
                return (
                  <div key={i} style={{ background: C.white, borderRadius: 16, padding: 24, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                    {s.sponsor_logo_url ? (
                      <img src={s.sponsor_logo_url} alt={name} style={{ maxWidth: "100%", maxHeight: 80, objectFit: "contain", marginBottom: 12 }} />
                    ) : (
                      <div style={{ fontSize: 44, marginBottom: 12 }}>🏢</div>
                    )}
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 6 }}>{name}</div>
                    {s.sponsor_website_url ? (
                      <a href={s.sponsor_website_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.orange, textDecoration: "underline" }}>
                        Web サイト →
                      </a>
                    ) : (
                      <div style={{ fontSize: 11, color: C.warmGray, opacity: 0.6 }}>—</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ background: C.white, borderRadius: 16, padding: 24, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.dark, margin: "0 0 10px" }}>
                あなたの会社も Qocca を支援できます🐾
              </h3>
              <p style={{ fontSize: 12, color: C.warmGray, lineHeight: 1.8, margin: "0 0 14px" }}>
                CAMPFIRE で「法人スポンサー」リターン (¥300,000) をご支援いただくと<br />
                このページに法人ロゴと社名を掲載します。
              </p>
              <a
                href={CAMPFIRE_PROJECT_URL_WITH_UTM}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-block", padding: "10px 22px", background: C.orange, color: "#fff", borderRadius: 22, fontSize: 13, fontWeight: 800, textDecoration: "none" }}
              >
                📣 CAMPFIRE で支援する →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Legal Pages ───────────────────────────────────────────────────────────
export const LegalPage = ({ type, setPage }) => {
  const pages = {
    // 依頼書 #105 (2026/6/3): 弁護士確認版 利用規約 v2.0 (前文 + 第1〜28条 + 第29条クラファン + 附則)
    terms: {
      title: TERMS_V2.title,
      updated: TERMS_V2.effective_date + " 施行 (" + TERMS_V2.lawyer_reviewed + " 弁護士確認版)",
      sections: TERMS_V2.sections,
    },
    privacy: {
      title: "プライバシーポリシー",
      updated: "2026年5月16日",
      sections: [
        { h:"1. 収集する情報", p:"当サービスは以下の情報を収集します。(1)アカウント情報（メールアドレス、表示名、パスワードのハッシュ値） (2)プロフィール情報（プロフィール画像、自己紹介文） (3)取引情報（注文履歴、メッセージ内容、レビュー、商品バリエーション選択履歴） (4)決済情報（Stripeが処理。当サービスはクレジットカード番号を保持しません） (5)利用情報（アクセスログ、IPアドレス、ブラウザ情報）" },
        { h:"2. 情報の利用目的", p:"収集した情報は以下の目的で利用します。(1)サービスの提供・運営 (2)ユーザーサポート (3)不正利用の防止・検出 (4)サービスの改善・新機能の開発 (5)お知らせ・マーケティング情報の送信（オプトアウト可能）" },
        { h:"3. 情報の第三者提供", p:"法令に基づく場合、ユーザーの同意がある場合、または以下の業務委託先を除き、個人情報を第三者に提供しません。決済処理：Stripe, Inc.、ホスティング：Vercel Inc.、データベース：Supabase Inc." },
        { h:"4. 情報の保管・セキュリティ", p:"個人情報はSupabaseの暗号化されたデータベースに保管されます。パスワードはbcryptによりハッシュ化されます。SSL/TLSによる通信の暗号化を実施しています。" },
        { h:"5. Cookie", p:"当サービスはセッション管理のためにCookieを使用します。ブラウザの設定でCookieを無効にできますが、一部の機能が利用できなくなる場合があります。" },
        { h:"6. ユーザーの権利", p:"ユーザーは自身の個人情報について、開示・訂正・削除・利用停止を請求できます。アカウント設定ページから、またはお問い合わせフォームからご連絡ください。" },
        { h:"7. 未成年者の利用", p:"18歳未満のユーザーは保護者の同意を得た上でご利用ください。13歳未満のお子様の個人情報を意図的に収集することはありません。" },
        { h:"8. 改定", p:"本ポリシーは随時改定される場合があります。重要な変更はメールまたはアプリ内通知でお知らせします。" },
        { h:"9. お問い合わせ", p:"プライバシーに関するお問い合わせは、アプリ内サポートまたは support@qocca.pet までご連絡ください。" },
      ]
    },
    tokusho: {
      title: "特定商取引法に基づく表記",
      updated: "2026年5月16日",
      sections: [
        { h:"事業者名", p:"Qocca（個人事業）" },
        { h:"代表者", p:"正和1204（開業届提出後に本名を記載）" },
        { h:"所在地", p:"大阪府（詳細住所は請求があった場合に遅滞なく開示いたします）" },
        { h:"連絡先", p:"support@qocca.pet（お問い合わせはアプリ内サポートをご利用ください）\n電話番号は請求があった場合に遅滞なく開示いたします。" },
        { h:"販売価格", p:"各出品ページに表示された金額（税込）。商品にバリエーション（色違い・サイズ違い等）がある場合、選択したバリエーションごとに価格が異なる場合があります。購入者が支払う金額は表示価格のみです。決済手数料・サービス手数料はすべて出品者が負担します。" },
        { h:"支払方法", p:"クレジットカード決済（Stripe経由：VISA、Mastercard、JCB、American Express対応）" },
        { h:"支払時期", p:"注文確定時に決済されます。エスクロー方式により、取引完了まで当サービスがお預かりします。" },
        { h:"サービス提供時期", p:"注文確定後、出品者が設定した納期内に提供されます。" },
        { h:"返品・キャンセル", p:"作業開始前（購入者都合）：決済手数料（3.6%）を差し引いた金額を返金。\n作業開始前（出品者都合）：全額返金。\n納品後72時間以内：異議申し立て可能（出品者都合の場合は全額返金）。\n納品後72時間経過：取引完了（返金不可）。\n詳細は利用規約第12条をご確認ください。" },
        { h:"動作環境", p:"Google Chrome、Safari、Firefox、Edgeの最新版を推奨。\nスマートフォンはiOS 15以降、Android 10以降を推奨。" },
        { h:"役務の対価以外の必要料金", p:"インターネット接続料金、通信料はユーザー負担となります。" },
      ]
    },
    contact: {
      title: "お問い合わせ",
      updated: "",
      sections: [
        { h:"お問い合わせ方法", p:"Qoccaへのお問い合わせは、以下の方法で受け付けています。" },
        { h:"アプリ内サポート（推奨）", p:"ログイン後、マイページ → サポート からメッセージをお送りください。通常48時間以内にご回答いたします。緊急の場合は「緊急」とご記入ください。" },
        { h:"メール", p:"support@qocca.pet 宛にお送りください。件名に「お問い合わせ」と注文番号（お持ちの場合）をご記入ください。" },
        { h:"Instagram DM", p:"@qocca_pet 宛にダイレクトメッセージをお送りください。" },
        { h:"対応時間", p:"平日 10:00〜18:00（土日祝休み）。緊急の不正利用報告は24時間受付。" },
      ]
    }
  };

  const pg = pages[type];
  if (!pg) return null;

  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream }}>
      <div style={{ padding:"12px 16px", background:C.white, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={()=>setPage("home")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:C.orange, fontWeight:700 }}>←</button>
        <span style={{ fontSize:14, fontWeight:700, color:C.dark }}>{pg.title}</span>
      </div>
      <div style={{ maxWidth:640, margin:"0 auto", padding:"24px 16px 80px" }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:C.dark, marginBottom:8 }}>{pg.title}</h1>
        {pg.updated && <div style={{ fontSize:12, color:C.warmGray, marginBottom:24 }}>最終更新日：{pg.updated}</div>}
        {pg.sections.map((s,i) => (
          <div key={i} style={{ marginBottom:20 }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:6 }}>{s.h}</div>
            <div style={{ fontSize:13, color:"#555", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{s.p}</div>
          </div>
        ))}
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16, marginTop:24, fontSize:11, color:C.warmGray }}>
          © 2026 Qocca. All rights reserved.
        </div>
      </div>
    </div>
  );
};

// ── FAQ ページ (依頼書 #128 Phase C, 2026/6/5) ─────────────────────────
//   AI 検索 (ChatGPT search / Perplexity / Claude / Google AI Overviews) で
//   Qocca が引用される際の「質問→簡潔回答」資産。
//   index.html の FAQPage JSON-LD + /llms.txt の FAQ 要約 と本ページで 3 層 GEO 対策。
//   ⚠️ 手数料表記はマーケ戦略書 v1.0 準拠 (BP4% は法律ページ以外で出さない)
export const FAQPage = ({ setPage, isPC }: { setPage: (p: string) => void; isPC?: boolean }) => {
  const faqs = [
    { q: "Qocca(クオッカ)とは何ですか?", a: "Qocca は、ペットオーナーとクリエイターをつなぐ日本発のペット専門マーケットプレイスです。売上の 3% を特定非営利活動法人アニマルレフュージ関西に寄付しています。" },
    { q: "どんな商品が買えますか?", a: "ペット似顔絵、ハンドメイド服、フォト撮影、オリジナルグッズ、ペット食品 (おやつ等)、トレーニング動画など、ペットと暮らす日々を豊かにする幅広い商品があります。" },
    { q: "出品する方法を教えてください", a: "無料でアカウント登録した上で、出品ページから商品情報・画像を登録します。運営審査を経て公開されます。創業期メンバー枠 (限定) は1年間の手数料優遇枠があります。" },
    { q: "購入の流れは?", a: "気になる商品を選び、配送先を指定して Stripe で決済します。取引完了まで Qocca が代金を預かるエスクロー方式で、受取確認後に出品者へ送金されます。" },
    { q: "配送方法は選べますか?", a: "出品者が複数の配送方法 (クリックポスト・宅急便等) を登録できる仕組みがあり、購入者は購入時に好みの配送方法を選べます (商品ごとに異なります)。" },
    { q: "寄付の仕組みを教えてください", a: "Qocca の売上 3% を月次で集計し、特定非営利活動法人アニマルレフュージ関西 (略称 ARK) へ送金しています。寄付内訳は公開ダッシュボードで開示しています。" },
    { q: "安全に取引できますか?", a: "1人1アカウント原則・Stripe エスクロー方式・取引メッセージ管理・通報機能を組み合わせ、安全な取引を支えています。" },
    { q: "なぜ 1人1アカウント なのですか?", a: "なりすまし・不正取引を防ぎ、クリエイターと購入者双方の信頼を守るためです。違反は規約違反として停止対象になります。" },
    { q: "出品手数料はかかりますか?", a: "出品者プラン (創業期メンバー / 通常) によって異なります。詳細は /help/fees ページにてご確認ください。" },
    { q: "対応しているペットの種類は?", a: "犬、猫、うさぎ、ハムスター、モルモット、フェレット、チンチラ、ハリネズミ、リス、鳥、爬虫類、両生類、魚、甲殻類、昆虫、その他 (計16種) に対応しています。" },
  ];
  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:"#FFF9F0" }}>
      <div style={{ maxWidth:780, margin:"0 auto", padding:"40px 20px 60px" }}>
        <button onClick={()=>setPage("home")} style={{ background:"none", border:"none", color:"#888780", fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:16, padding:0, fontFamily:"inherit" }}>← ホームに戻る</button>
        <h1 style={{ fontSize:24, fontWeight:900, color:"#2C2C2A", marginBottom:8, lineHeight:1.4 }}>❓ よくあるご質問 (FAQ)</h1>
        <p style={{ fontSize:12, color:"#888780", marginBottom:24 }}>Qocca のサービスに関する代表的なご質問への回答です。</p>
        <div style={{ background:"#FFFFFF", borderRadius:16, padding:"24px 28px", border:"1px solid #F1EFE8", lineHeight:1.9, fontSize:13, color:"#333" }}>
          {faqs.map((f, i) => (
            <details key={i} open={i < 3} style={{ borderBottom: i < faqs.length-1 ? "1px solid #F1EFE8" : "none", padding:"12px 0" }}>
              <summary style={{ cursor:"pointer", fontSize:14, fontWeight:800, color:"#2C2C2A", listStyle:"none", display:"flex", alignItems:"flex-start", gap:8 }}>
                <span style={{ color:"#F5A94A", flexShrink:0 }}>Q.</span>
                <span>{f.q}</span>
              </summary>
              <div style={{ marginTop:8, paddingLeft:24, color:"#555", lineHeight:1.85 }}>
                <span style={{ color:"#7FB069", fontWeight:800 }}>A. </span>{f.a}
              </div>
            </details>
          ))}
          <div style={{ marginTop:24, padding:"14px 16px", background:"#FFF9F0", borderRadius:10, fontSize:12, color:"#888780", lineHeight:1.7 }}>
            🐾 ここに無いご質問は <span onClick={()=>setPage("contact")} style={{ color:"#F5A94A", fontWeight:700, cursor:"pointer" }}>お問い合わせ</span> または <span onClick={()=>setPage("help")} style={{ color:"#F5A94A", fontWeight:700, cursor:"pointer" }}>ヘルプ</span> をご確認ください。
          </div>
        </div>
      </div>
    </div>
  );
};


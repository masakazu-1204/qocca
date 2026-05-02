// ============================================================
// HelpPage.tsx
// Qoccaヘルプセンター
// 出品の始め方 / Stripe Connect 登録ガイド / 購入ガイド
// ============================================================
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

// ── ブランドカラー ─────────────────────────────────────────────
const C = {
  orange: "#F5A94A",
  orangePale: "#FFF4E6",
  orangeDeep: "#E89432",
  dark: "#3E2723",
  warmGray: "#7B6F66",
  border: "#E8DDD3",
  cream: "#FBF7F2",
  white: "#FFFFFF",
  green: "#4CAF50",
  greenPale: "#E8F5E9",
  blue: "#2196F3",
  bluePale: "#E3F2FD",
  red: "#E53935",
};

// ── ヘルプ記事メタデータ ──────────────────────────────────────
const HELP_ARTICLES: Record<string, { title: string; emoji: string; description: string; category: string }> = {
  "getting-started": {
    title: "出品の始め方",
    emoji: "📝",
    description: "アカウント作成から初めての出品までを丁寧にご案内します。",
    category: "出品者向け",
  },
  "stripe-connect": {
    title: "Stripe Connect 登録ガイド",
    emoji: "💳",
    description: "売上を受け取るために必要な Stripe Connect の登録方法を解説します。",
    category: "出品者向け",
  },
  "buying": {
    title: "購入ガイド",
    emoji: "🛒",
    description: "商品を探してから受け取りまでの流れをご案内します。",
    category: "購入者向け",
  },
};

// ── 汎用パーツ ────────────────────────────────────────────────
const PageWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ background: C.cream, minHeight: "100vh", paddingBottom: 60 }}>
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px" }}>{children}</div>
  </div>
);

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ fontSize: 20, fontWeight: 900, color: C.dark, marginTop: 32, marginBottom: 14, paddingBottom: 8, borderBottom: `2px solid ${C.orangePale}` }}>{children}</h2>
);

const H3: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 style={{ fontSize: 16, fontWeight: 800, color: C.dark, marginTop: 22, marginBottom: 10 }}>{children}</h3>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ fontSize: 14, lineHeight: 1.8, color: "#444", margin: "0 0 12px" }}>{children}</p>
);

const Note: React.FC<{ children: React.ReactNode; color?: "blue" | "orange" | "red" | "green" }> = ({ children, color = "blue" }) => {
  const map = {
    blue: { bg: C.bluePale, border: C.blue, icon: "💡" },
    orange: { bg: C.orangePale, border: C.orange, icon: "⚠️" },
    red: { bg: "#FFEBEE", border: C.red, icon: "🚨" },
    green: { bg: C.greenPale, border: C.green, icon: "✅" },
  };
  const s = map[color];
  return (
    <div style={{ background: s.bg, borderLeft: `4px solid ${s.border}`, padding: "12px 16px", margin: "12px 0", borderRadius: 8, fontSize: 13, lineHeight: 1.7, color: C.dark }}>
      <span style={{ marginRight: 6 }}>{s.icon}</span>{children}
    </div>
  );
};

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <div style={{ display: "flex", gap: 14, marginBottom: 20, alignItems: "flex-start" }}>
    <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", background: C.orange, color: "#fff", fontSize: 14, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.dark, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.7, color: "#555" }}>{children}</div>
    </div>
  </div>
);

const FAQ: React.FC<{ q: string; a: React.ReactNode }> = ({ q, a }) => (
  <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 18px", marginBottom: 10 }}>
    <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Q. {q}</div>
    <div style={{ fontSize: 13, lineHeight: 1.7, color: "#555" }}>A. {a}</div>
  </div>
);

const BackToTop: React.FC = () => {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate("/help")} style={{ marginTop: 30, padding: "10px 20px", background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.warmGray, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
      ← ヘルプ一覧に戻る
    </button>
  );
};

const ContactCard: React.FC = () => (
  <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "18px 20px", marginTop: 30 }}>
    <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 8 }}>📧 解決しない場合は</div>
    <div style={{ fontSize: 13, lineHeight: 1.7, color: "#555", marginBottom: 12 }}>
      上記の手順で解決しない場合や、ご不明な点がある場合はお気軽にお問い合わせください。
    </div>
    <a href="mailto:support@qocca.pet?subject=Qocca お問い合わせ"
      style={{ display: "inline-block", padding: "10px 18px", background: C.orange, color: "#fff", borderRadius: 10, fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
      support@qocca.pet
    </a>
  </div>
);

// ── ヘルプトップページ ────────────────────────────────────────
const HelpIndex: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageWrap>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate("/")} style={{ background: "transparent", border: "none", color: C.warmGray, fontSize: 13, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>← ホームに戻る</button>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 900, color: C.dark, marginTop: 0, marginBottom: 8 }}>📚 ヘルプセンター</h1>
      <p style={{ fontSize: 14, color: C.warmGray, lineHeight: 1.7, marginBottom: 28 }}>
        Qocca のご利用に関するご質問や使い方をご案内しています。
      </p>

      <H2>🛍 出品者向け</H2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        {Object.entries(HELP_ARTICLES)
          .filter(([_, a]) => a.category === "出品者向け")
          .map(([slug, a]) => (
            <button key={slug} onClick={() => navigate(`/help/${slug}`)} style={{
              background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "16px 18px",
              display: "flex", gap: 14, alignItems: "center", cursor: "pointer", textAlign: "left", fontFamily: "inherit"
            }}>
              <div style={{ fontSize: 32, flexShrink: 0 }}>{a.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.dark, marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: C.warmGray, lineHeight: 1.6 }}>{a.description}</div>
              </div>
              <div style={{ color: C.orange, fontSize: 18, flexShrink: 0 }}>→</div>
            </button>
          ))}
      </div>

      <H2>🛒 購入者向け</H2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        {Object.entries(HELP_ARTICLES)
          .filter(([_, a]) => a.category === "購入者向け")
          .map(([slug, a]) => (
            <button key={slug} onClick={() => navigate(`/help/${slug}`)} style={{
              background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "16px 18px",
              display: "flex", gap: 14, alignItems: "center", cursor: "pointer", textAlign: "left", fontFamily: "inherit"
            }}>
              <div style={{ fontSize: 32, flexShrink: 0 }}>{a.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.dark, marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: C.warmGray, lineHeight: 1.6 }}>{a.description}</div>
              </div>
              <div style={{ color: C.orange, fontSize: 18, flexShrink: 0 }}>→</div>
            </button>
          ))}
      </div>

      <ContactCard />
    </PageWrap>
  );
};

// ── ① 出品の始め方 ──────────────────────────────────────────
const GettingStarted: React.FC = () => (
  <PageWrap>
    <BackToTop />
    <h1 style={{ fontSize: 26, fontWeight: 900, color: C.dark, marginTop: 16, marginBottom: 8 }}>📝 出品の始め方</h1>
    <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 24 }}>所要時間: 約10〜15分</p>

    <Note color="blue">
      Qocca では、ペットオーナーの方々がペット関連の商品やサービスを出品して販売できます。<br/>
      このガイドでは、はじめての出品までの流れを丁寧にご案内します。
    </Note>

    <H2>📋 出品までの流れ</H2>
    <Step n={1} title="アカウント作成・ログイン">
      ホーム画面の「ログイン」からメールアドレスでアカウント登録してください。<br/>
      届いた認証メールのリンクをクリックすると登録完了です。
    </Step>
    <Step n={2} title="プロフィール設定">
      マイページから表示名・自己紹介・アイコンを設定しましょう。<br/>
      ペットや出品物に関する情報を書くと、購入者の信頼につながります。
    </Step>
    <Step n={3} title="Stripe Connect の登録（売上受取設定）">
      売上を受け取るために、Stripe Connect の登録が必要です。<br/>
      売上タブの「設定を変更する」から登録を進めてください。<br/>
      <a href="/help/stripe-connect" style={{ color: C.orange, fontWeight: 700, textDecoration: "none" }}>→ Stripe Connect 登録ガイドはこちら</a>
    </Step>
    <Step n={4} title="出品作成">
      ヘッダーの「出品する」ボタンから出品ページに進みます。<br/>
      カテゴリ・タイトル・説明・写真・価格・配送タイプを入力してください。
    </Step>
    <Step n={5} title="運営による審査">
      出品内容は運営側で審査します。通常 1〜2 営業日以内に審査が完了します。<br/>
      審査通過後、サイトに公開されます。
    </Step>

    <H2>🖼 出品作成のポイント</H2>
    <H3>カテゴリ</H3>
    <P>適切なカテゴリを選択することで、購入者に見つけてもらいやすくなります。</P>
    <ul style={{ fontSize: 13, lineHeight: 1.9, color: "#555", paddingLeft: 22 }}>
      <li>🎨 似顔絵・イラスト</li>
      <li>👕 お洋服・アクセサリー</li>
      <li>📸 写真撮影</li>
      <li>✨ ペットグッズ</li>
      <li>🍖 ペットフード・おやつ</li>
      <li>🐕 しつけ・トレーニング</li>
    </ul>

    <H3>写真</H3>
    <P>1枚目の写真がサムネイルとして使われます。明るく、商品やサービスがわかりやすい写真を選びましょう。</P>
    <Note color="orange">
      著作権のある画像（他人が撮影した写真、キャラクター画像など）は使用しないでください。
    </Note>

    <H3>価格設定</H3>
    <P>類似商品の相場を参考にしましょう。手数料を踏まえた金額設定もおすすめです。</P>
    <Note color="green">
      <strong>手数料について</strong><br/>
      ・初回取引: Qocca手数料 0%（Stripe決済手数料 3.6% のみ）<br/>
      ・登録から3ヶ月以内: Qocca手数料 5% + Stripe決済手数料 3.6%<br/>
      ・3ヶ月以降: Qocca手数料 10% + Stripe決済手数料 3.6%
    </Note>

    <H3>配送タイプ</H3>
    <P>商品の性質に合わせて配送方法を選択してください。</P>
    <ul style={{ fontSize: 13, lineHeight: 1.9, color: "#555", paddingLeft: 22 }}>
      <li>📦 <strong>配送あり</strong>: 物理的な商品を購入者の住所に送る</li>
      <li>💻 <strong>データのみ</strong>: デジタルデータのみ（取引メッセージで受け渡し）</li>
      <li>📍 <strong>訪問あり</strong>: トレーニング・撮影など対面で実施</li>
    </ul>

    <H2>🚫 出品できないもの</H2>
    <Note color="red">
      以下のものは出品禁止です。違反した場合、出品の削除・アカウント停止の対象となります。
    </Note>
    <ul style={{ fontSize: 13, lineHeight: 1.9, color: "#555", paddingLeft: 22 }}>
      <li>生体（犬・猫などの動物そのもの）</li>
      <li>動物医療品・処方が必要な薬</li>
      <li>動物虐待を連想させる商品</li>
      <li>法令で販売が制限されているもの</li>
      <li>第三者の著作権・商標権を侵害するもの</li>
      <li>偽ブランド品・コピー商品</li>
    </ul>

    <H2>📞 取引の流れ</H2>
    <P>注文が入ると、以下の流れで取引が進みます。</P>
    <Step n={1} title="注文確定">
      購入者が決済を完了すると、販売管理タブに新しい注文が表示されます。
    </Step>
    <Step n={2} title="作業を開始">
      販売管理タブから「🎨 作業を開始」ボタンを押し、購入者に通知します。<br/>
      取引メッセージで購入者と詳細をやり取りできます。
    </Step>
    <Step n={3} title="納品">
      商品の制作・配送・データ送信が完了したら「📦 納品完了として通知」を押します。
    </Step>
    <Step n={4} title="売上受取">
      購入者が受取確認を行うと、Stripe Connect で売上が自動的に振り込まれます。<br/>
      売上タブから振込履歴を確認できます。
    </Step>

    <ContactCard />
    <BackToTop />
  </PageWrap>
);

// ── ② Stripe Connect 登録ガイド ────────────────────────────
const StripeConnectGuide: React.FC = () => (
  <PageWrap>
    <BackToTop />
    <h1 style={{ fontSize: 26, fontWeight: 900, color: C.dark, marginTop: 16, marginBottom: 8 }}>💳 Stripe Connect 登録ガイド</h1>
    <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 24 }}>所要時間: 約15〜20分</p>

    <Note color="blue">
      Qocca で売上を受け取るには、決済プラットフォーム「Stripe Connect」への登録が必要です。<br/>
      登録は無料で、一度設定すれば毎月の振込が自動で行われます。
    </Note>

    <H2>📋 登録前に準備するもの</H2>
    <ul style={{ fontSize: 13, lineHeight: 2, color: "#555", paddingLeft: 22 }}>
      <li>📱 <strong>本人確認書類</strong>（いずれか1点）<br/>
        運転免許証 / マイナンバーカード / パスポート / 在留カード
      </li>
      <li>🏦 <strong>銀行口座情報</strong>（売上振込先）<br/>
        銀行名・支店名・口座番号・口座名義
      </li>
      <li>📞 <strong>電話番号</strong>（SMS認証を受けられるもの）</li>
      <li>🏠 <strong>住所</strong>（本人確認書類と一致するもの）</li>
    </ul>

    <Note color="orange">
      本人確認書類と入力情報（氏名・住所など）は完全に一致している必要があります。<br/>
      情報が異なると審査が通らないことがあります。
    </Note>

    <H2>🎯 登録手順</H2>
    <Step n={1} title="マイページから「売上タブ」を開く">
      ログイン後、マイページのタブから「💰 売上」を選択します。
    </Step>
    <Step n={2} title="「銀行口座・支払い設定」セクションへ">
      売上タブの中に「🏦 銀行口座・支払い設定」のセクションがあります。<br/>
      初回は「Stripe Connect を設定する」のようなボタンが表示されます。
    </Step>
    <Step n={3} title="Stripe Express にリダイレクト">
      ボタンを押すと Stripe の登録ページ（connect.stripe.com）に移動します。
    </Step>
    <Step n={4} title="基本情報入力">
      メールアドレス・電話番号を入力 → SMS認証コードを受け取り、入力します。
    </Step>
    <Step n={5} title="個人情報入力">
      氏名（カタカナ・漢字）・生年月日・住所などを入力します。<br/>
      <strong>必ず本人確認書類と一致する情報を入力してください。</strong>
    </Step>
    <Step n={6} title="本人確認書類のアップロード">
      指定された書類を撮影してアップロードします。<br/>
      ピンボケや反射のないクリアな画像にしてください。
    </Step>
    <Step n={7} title="銀行口座登録">
      売上の振込先となる銀行口座を登録します。<br/>
      銀行名・支店名（または支店番号）・口座番号・口座名義を入力します。
    </Step>
    <Step n={8} title="登録完了">
      Stripe側での審査（通常即時〜数営業日）が完了すると、Qoccaの売上タブに「設定完了」が表示されます。<br/>
      これで売上を受け取れる状態になります。
    </Step>

    <H2>💰 売上の振込について</H2>
    <H3>振込タイミング</H3>
    <ul style={{ fontSize: 13, lineHeight: 1.9, color: "#555", paddingLeft: 22 }}>
      <li>📅 月末締めで翌月初に振込（自動）</li>
      <li>💴 売上残高が <strong>30,000 円以上</strong> の場合は振込手数料無料</li>
      <li>⚡ 即時受取も可能（手数料 1.5%、最低 250 円）</li>
    </ul>

    <H3>手数料の詳細</H3>
    <P>取引完了時に以下の手数料が引かれた金額が振込されます。</P>
    <ul style={{ fontSize: 13, lineHeight: 1.9, color: "#555", paddingLeft: 22 }}>
      <li>Stripe 決済手数料: <strong>3.6%</strong>（固定）</li>
      <li>Qocca プラットフォーム手数料:
        <ul style={{ marginTop: 4 }}>
          <li>初回取引: <strong>0%</strong></li>
          <li>登録から 3ヶ月以内: <strong>5%</strong></li>
          <li>3ヶ月以降: <strong>10%</strong></li>
        </ul>
      </li>
    </ul>

    <Note color="green">
      <strong>計算例</strong>: 1,000 円の商品を販売した場合<br/>
      初回取引: 1,000 円 - Stripe 36 円 = <strong>964 円</strong> が売上<br/>
      3ヶ月以内: 1,000 円 - Stripe 36 円 - Qocca 50 円 = <strong>914 円</strong> が売上
    </Note>

    <H2>❓ よくあるご質問</H2>
    <FAQ q="屋号で登録できますか？" a="個人事業主の方は本名で登録した上で、屋号を併記する形になります。法人として登録する場合は法人名義で登録できます。" />
    <FAQ q="海外口座は使えますか？" a="現在は日本国内の銀行口座のみ対応しています。" />
    <FAQ q="本人確認書類が承認されません" a="書類のピンボケ・反射・切れがないか確認してください。光が反射していると承認されないことがあります。再アップロードを試してください。" />
    <FAQ q="認証コードのSMSが届きません" a="電話番号の入力ミスがないか確認してください。+81 で始まる国際表記が必要な場合があります。届かない場合は時間をおいて再試行してください。" />
    <FAQ q="登録した情報を変更したい" a="売上タブの「設定を変更する」ボタンから Stripe Express ダッシュボードにアクセスし、変更できます。" />
    <FAQ q="登録は無料ですか？" a="登録自体は無料です。料金は取引が発生したときの手数料のみです。" />

    <H2>🚨 トラブル時の対応</H2>
    <Note color="red">
      <strong>登録途中でエラーが出た場合</strong><br/>
      1. ブラウザを更新して再試行<br/>
      2. 別のブラウザで試す（Chrome / Safari など）<br/>
      3. それでも解決しない場合は、support@qocca.pet までお問い合わせください
    </Note>

    <ContactCard />
    <BackToTop />
  </PageWrap>
);

// ── ③ 購入ガイド ────────────────────────────────────────────
const BuyingGuide: React.FC = () => (
  <PageWrap>
    <BackToTop />
    <h1 style={{ fontSize: 26, fontWeight: 900, color: C.dark, marginTop: 16, marginBottom: 8 }}>🛒 購入ガイド</h1>
    <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 24 }}>所要時間: 約5〜10分</p>

    <Note color="blue">
      Qocca はペットオーナーの方々が出品する商品・サービスを購入できるマーケットプレイスです。<br/>
      安心して取引いただけるよう、決済はすべて Stripe を経由した安全な仕組みになっています。
    </Note>

    <H2>📋 購入の流れ</H2>
    <Step n={1} title="商品を探す">
      ホームの検索ボックスやカテゴリから商品を探せます。<br/>
      ギャラリー・ランキング・新着商品もご活用ください。
    </Step>
    <Step n={2} title="商品詳細を確認">
      気になる商品をクリックすると詳細ページが開きます。<br/>
      写真・説明・出品者プロフィール・配送タイプを確認しましょう。
    </Step>
    <Step n={3} title="出品者プロフィール確認（任意）">
      「👤 出品者のプロフィールを見る」から、過去の出品実績や評価を確認できます。
    </Step>
    <Step n={4} title="購入ボタンを押す">
      商品ページの「🛒 購入する」ボタンを押します。<br/>
      未ログインの場合はログイン画面に遷移します。
    </Step>
    <Step n={5} title="決済情報入力">
      Stripe の安全な決済画面に遷移します。<br/>
      クレジットカード情報を入力してください。
    </Step>
    <Step n={6} title="配送先入力（配送ありの場合）">
      物理的な商品の場合は、配送先住所を入力します。<br/>
      入力済み住所を選択することもできます。
    </Step>
    <Step n={7} title="決済完了">
      決済が完了すると、注文確定の画面が表示されます。<br/>
      注文履歴タブで取引状況を確認できます。
    </Step>

    <H2>📊 取引のステータス</H2>
    <P>注文後、取引は以下のステータスで進行します。</P>
    <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, fontSize: 13, lineHeight: 2, color: "#444" }}>
      📝 <strong>注文確定</strong> → 出品者が注文を確認します<br/>
      🎨 <strong>作業中</strong> → 出品者が制作・準備中です<br/>
      📦 <strong>納品済み</strong> → 商品の発送・データ送信が完了しました<br/>
      ✅ <strong>取引完了</strong> → 受取確認が完了しました
    </div>

    <H2>✅ 受取確認のタイミング</H2>
    <P>商品を受け取り、内容に問題がないことを確認したら、注文履歴タブから「✅ 受取完了」ボタンを押してください。</P>
    <Note color="orange">
      受取確認を行うと、出品者へ売上が支払われます。<br/>
      確認前にトラブルがある場合は「問題を報告」から異議申し立てができます。
    </Note>
    <Note color="blue">
      納品から 72 時間が経過すると、自動的に取引完了となります。
    </Note>

    <H2>💬 取引メッセージ</H2>
    <P>取引中は出品者と取引メッセージでやり取りできます。</P>
    <ul style={{ fontSize: 13, lineHeight: 1.9, color: "#555", paddingLeft: 22 }}>
      <li>マイページの「メッセージ」タブから取引メッセージを確認</li>
      <li>受け取り日時の調整、サイズや仕様の確認などにご活用ください</li>
      <li>個人情報（電話番号など）の交換はトラブルの元になるため、Qocca内で完結させましょう</li>
    </ul>

    <H2>⭐ レビュー</H2>
    <P>取引完了後、出品者へのレビューを書くことができます。</P>
    <P>あなたのレビューは他のユーザーが安心して購入する助けになります。良かった点は具体的に書いていただけると喜ばれます。</P>

    <H2>🚨 トラブル時の対応</H2>
    <H3>商品が届かない</H3>
    <P>まず取引メッセージで出品者に連絡してください。<br/>
    数日返信がない場合や解決しない場合は、注文履歴タブの「問題を報告」から運営に通報してください。</P>

    <H3>商品が説明と違う</H3>
    <P>取引メッセージで出品者に状況を伝えてください。<br/>
    解決しない場合は「問題を報告」から異議申し立てを行ってください。運営が確認次第対応いたします。</P>

    <H3>出品者と連絡が取れない</H3>
    <P>3〜5 日経っても返信がない場合は、運営にご相談ください。<br/>
    必要に応じて返金などの対応を行います。</P>

    <H2>❓ よくあるご質問</H2>
    <FAQ q="使える支払い方法は？" a="クレジットカード（Visa / Mastercard / JCB / American Express / Diners）でのお支払いが可能です。" />
    <FAQ q="領収書は発行できますか？" a="決済後、登録メールアドレスに Stripe から領収書のリンクが送信されます。再発行が必要な場合は support@qocca.pet までご連絡ください。" />
    <FAQ q="キャンセルしたい" a="出品者がまだ作業を開始していない場合は、取引メッセージでご相談ください。作業開始後のキャンセルは、内容により対応可否が変わります。" />
    <FAQ q="返金はされますか？" a="出品者の事情で取引が成立しない場合や、運営判断で返金が認められた場合は全額返金されます。返金は元のクレジットカードに対して行われます（反映まで5〜10営業日）。" />
    <FAQ q="複数の商品をまとめて購入できますか？" a="現状は商品ごとに個別の購入になります。同じ出品者から複数購入する場合は、取引メッセージで相談されることをおすすめします。" />

    <ContactCard />
    <BackToTop />
  </PageWrap>
);

// ── メインコンポーネント ──────────────────────────────────────
const HelpPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();

  // ページ遷移時にスクロールトップに戻す
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [slug]);

  if (!slug) return <HelpIndex />;
  if (slug === "getting-started") return <GettingStarted />;
  if (slug === "stripe-connect") return <StripeConnectGuide />;
  if (slug === "buying") return <BuyingGuide />;

  // 不明なslug → トップへリダイレクト相当
  return <HelpIndex />;
};

export default HelpPage;

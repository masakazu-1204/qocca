import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../supabaseClient";
import { C, QC_FONT_DISPLAY } from "../constants/theme";
import { REDEEM_TIER_THEME } from "../constants/data";
import { petLabelShort, petIcon } from "../constants/pets";
import { resolveFontFamily } from "../constants/fonts";
// 2026/7/15 CV精度修正: CompleteRegistration の発火は App.tsx (初回ログイン検知) へ移設したため import 不要に。
import { Logo } from "../components/ui";
import { MyPage } from "./mypage";

// Phase8 8b: account 系7ページを App.tsx から byte同一 line-slice 移動 (元 App.tsx 141-1514)

export const SignupPage = ({ setPage }) => {
  const { user, signUp, signIn, signInWithProvider, resetPassword } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // ログイン済みならマイページへ
  if (user) return <MyPage setPage={setPage}/>;

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "register" && !agreeTerms) {
      setError("利用規約への同意が必要です。");
      setLoading(false);
      return;
    }

    if (!email || !pass) {
      setError("メールアドレスとパスワードを入力してください。");
      setLoading(false);
      return;
    }

    if (pass.length < 6) {
      setError("パスワードは6文字以上にしてください。");
      setLoading(false);
      return;
    }

    try {
      if (mode === "login") {
        const { error } = await signIn(email, pass);
        if (error) {
          if (error.message.includes("Invalid login")) {
            setError("メールアドレスまたはパスワードが正しくありません。");
          } else {
            setError(error.message);
          }
        } else {
          setPage("home");
        }
      } else {
        const { data, error } = await signUp(email, pass, displayName || email.split("@")[0]);
        if (error) {
          if (error.message.includes("already registered")) {
            setError("このメールアドレスは既に登録されています。");
          } else {
            setError(error.message);
          }
        } else if (data?.user?.identities?.length === 0) {
          setError("このメールアドレスは既に登録されています。");
        } else {
          setMessage("✉️ 確認メールを送信しました！メール内のリンクをクリックして登録を完了してください。");
          // 2026/7/15 CV精度修正: ここでの CompleteRegistration 発火は廃止。
          //   確認メール"送信"時点の発火 = メール未認証もCVに計上(過大計上)だった。
          //   さらに Google(OAuth)経由はここを通らず計測漏れ(過少計上)。
          //   → 両方を App.tsx の「初回ログイン成功時1回だけ」に統一 (経路を問わず正確に1件)。
        }
      }
    } catch (e) {
      setError("エラーが発生しました。もう一度お試しください。");
    }
    setLoading(false);
  };

  const handleOAuth = async (provider) => {
    setError("");
    const { error } = await signInWithProvider(provider);
    if (error) setError(error.message);
  };

  const handleReset = async () => {
    setError("");
    setMessage("");
    if (!email) {
      setError("メールアドレスを入力してください。");
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      setError(error.message);
    } else {
      setMessage("✉️ パスワードリセットメールを送信しました。メールをご確認ください。");
    }
    setLoading(false);
  };

  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center", padding:"80px 16px" }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <Logo size={36}/>
          <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginTop:14 }}>
            {showReset ? "パスワードリセット" : mode==="login" ? "ログイン" : "新規登録"}
          </h1>
        </div>
        <div style={{ background:C.white, borderRadius:20, padding:"24px 16px", border:`1px solid ${C.border}` }}>
          {!showReset && (
            <div style={{ display:"flex", background:C.lightGray, borderRadius:10, padding:4, marginBottom:20 }}>
              {[["login","ログイン"],["register","新規登録"]].map(([v,l])=>(
                <button key={v} onClick={()=>{setMode(v);setError("");setMessage("");}} style={{
                  flex:1, padding:"9px", border:"none", borderRadius:8, cursor:"pointer",
                  background:mode===v?C.white:"transparent", fontWeight:800, fontSize:13, fontFamily:"inherit",
                  color:mode===v?C.dark:C.warmGray
                }}>{l}</button>
              ))}
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div style={{ background:C.redPale, border:`1px solid ${C.red}`, borderRadius:12, padding:"10px 14px", marginBottom:16, fontSize:13, color:C.red, fontWeight:600 }}>
              ⚠️ {error}
            </div>
          )}
          {message && (
            <div style={{ background:C.greenPale, border:`1px solid ${C.green}`, borderRadius:12, padding:"10px 14px", marginBottom:16, fontSize:13, color:C.green, fontWeight:600 }}>
              {message}
            </div>
          )}

          {showReset ? (
            <>
              <p style={{ fontSize:13, color:C.warmGray, marginBottom:16, lineHeight:1.6 }}>
                登録時のメールアドレスを入力してください。パスワードリセットのリンクをお送りします。
              </p>
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>メールアドレス</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"
                  style={{ width:"100%", padding:"12px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
              </div>
              <button onClick={handleReset} disabled={loading} style={{
                width:"100%", padding:"14px", background:loading?C.warmGray:C.orange, border:"none", borderRadius:12,
                color:"#fff", fontWeight:800, fontSize:15, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit"
              }}>{loading ? "送信中..." : "リセットメールを送信"}</button>
              <button onClick={()=>{setShowReset(false);setError("");setMessage("");}} style={{
                width:"100%", padding:"12px", marginTop:12, background:"none", border:"none",
                color:C.orange, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit"
              }}>← ログインに戻る</button>
            </>
          ) : (
            <>
              {/* 新規登録時のみ表示名 */}
              {mode==="register" && (
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>表示名（ニックネーム）</label>
                  <input type="text" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="例：みかん工房"
                    style={{ width:"100%", padding:"12px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                </div>
              )}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>メールアドレス</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"
                  style={{ width:"100%", padding:"12px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
              </div>
              <div style={{ marginBottom:mode==="register"?14:6 }}>
                <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>パスワード</label>
                <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="6文字以上"
                  style={{ width:"100%", padding:"12px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
              </div>

              {/* パスワードリセットリンク */}
              {mode==="login" && (
                <div style={{ textAlign:"right", marginBottom:16 }}>
                  <button onClick={()=>{setShowReset(true);setError("");setMessage("");}} style={{
                    background:"none", border:"none", color:C.orange, fontSize:12, fontWeight:600,
                    cursor:"pointer", fontFamily:"inherit", padding:0
                  }}>パスワードを忘れた方</button>
                </div>
              )}

              {/* 利用規約同意（新規登録のみ） */}
              {mode==="register" && (
                <div style={{ marginBottom:20 }}>
                  <label style={{ display:"flex", alignItems:"flex-start", gap:8, cursor:"pointer" }}>
                    <input type="checkbox" checked={agreeTerms} onChange={e=>setAgreeTerms(e.target.checked)}
                      style={{ marginTop:3, accentColor:C.orange, width:18, height:18 }}/>
                    <span style={{ fontSize:12, color:C.warmGray, lineHeight:1.6 }}>
                      <span onClick={()=>setPage("terms")} style={{ color:C.orange, fontWeight:700, cursor:"pointer" }}>利用規約</span>
                      、
                      <span onClick={()=>setPage("privacy")} style={{ color:C.orange, fontWeight:700, cursor:"pointer" }}>プライバシーポリシー</span>
                      に同意します
                    </span>
                  </label>
                </div>
              )}

              <button onClick={handleSubmit} disabled={loading} style={{
                width:"100%", padding:"14px", background:loading?C.warmGray:C.orange, border:"none", borderRadius:12,
                color:"#fff", fontWeight:800, fontSize:15, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit",
                opacity:loading?0.7:1, transition:"opacity 0.2s"
              }}>
                {loading ? (
                  <span>処理中...</span>
                ) : (
                  mode==="login" ? "ログイン" : "アカウントを作成"
                )}
              </button>

              <div style={{ display:"flex", alignItems:"center", gap:8, margin:"16px 0" }}>
                <div style={{ flex:1, height:1, background:C.border }}/>
                <span style={{ fontSize:12, color:C.warmGray }}>または</span>
                <div style={{ flex:1, height:1, background:C.border }}/>
              </div>

              {/* ソーシャルログイン */}
              <button onClick={()=>handleOAuth("google")} style={{
                width:"100%", padding:"11px", marginBottom:8, border:`1.5px solid ${C.border}`,
                borderRadius:10, background:C.white, cursor:"pointer", fontSize:13, fontWeight:700,
                fontFamily:"inherit", color:C.dark, display:"flex", alignItems:"center", justifyContent:"center", gap:8
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Googleで続ける
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── MY PAGE ───────────────────────────────────────────────────────────────
// ── USER PROFILE PAGE（他ユーザーのプロフィール閲覧） ──
// UserProfilePage は pages/marketplace.tsx へ移動 (Phase6 6a)

// Phase D Phase 2 (5/22 夜): /pet/:petId — 個別ペット詳細ページ (King 推奨A案)
export const PetDetailPage = ({ setPage: _setPage }: { setPage: (p: string) => void }) => {
  const { petId } = useParams();
  const navigate = useNavigate();
  // 2026/6/28: 認証ガードは削除 — うちの子詳細ページは未ログインで閲覧可。
  //   理由: 作家の SNS シェア機会損失の解消。データ層は RLS で公開制限済 (pets/pet_photos=true, profiles=true)。
  //   write系UI(健康記録の追加など)はそれぞれの onClick 側で auth.getUser() を見るためここでのgateは不要。
  //   保護必要ページ(/mypage, /sell, /redeem, /admin, /settings/*, /update-password)の認証は不変。
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState<{
    id: string; owner_id: string; name: string; species: string;
    breed?: string | null; birthday?: string | null; bio?: string | null;
    avatar_url?: string | null; gender?: string | null; status: string;
  } | null>(null);
  const [photos, setPhotos] = useState<Array<{ id: string; photo_url: string; caption?: string | null; taken_at?: string | null }>>([]);
  const [owner, setOwner] = useState<{ id: string; display_name: string; avatar_url?: string | null; font_pet_name?: string | null } | null>(null);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  // 依頼書 #136 B1 Step 2 (2026/6/8): 健康記録 (体重 + 通院) - 飼い主専用
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [weights, setWeights] = useState<Array<{ id: string; recorded_at: string; weight_kg: number; memo: string | null }>>([]);
  const [clinicVisits, setClinicVisits] = useState<Array<{ id: string; visited_at: string; clinic_name: string | null; reason: string | null; memo: string | null }>>([]);
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [wDate, setWDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [wKg, setWKg] = useState("");
  const [wMemo, setWMemo] = useState("");
  const [showClinicForm, setShowClinicForm] = useState(false);
  const [cDate, setCDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cName, setCName] = useState("");
  const [cReason, setCReason] = useState("");
  const [cMemo, setCMemo] = useState("");
  const [hrSaving, setHrSaving] = useState(false);
  const [hrError, setHrError] = useState("");

  // pet + photos + owner 取得
  useEffect(() => {
    if (!petId) return;
    (async () => {
      setLoading(true);
      const { data: petData } = await supabase
        .from("pets")
        .select("id, owner_id, name, species, breed, birthday, bio, avatar_url, gender, status")
        .eq("id", petId)
        .single();
      setPet(petData || null);

      if (petData) {
        const { data: photoData } = await supabase
          .from("pet_photos")
          .select("id, photo_url, caption, taken_at")
          .eq("pet_id", petId)
          .order("display_order", { ascending: true });
        setPhotos(photoData || []);

        const { data: ownerData } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url, font_pet_name")
          .eq("id", petData.owner_id)
          .single();
        setOwner(ownerData || null);
      }
      setLoading(false);
    })();
  }, [petId]);

  // 依頼書 #136 B1 Step 2 (2026/6/8): currentUser 取得 + 飼い主のみ健康記録 fetch
  // 設計憲法: 飼い主のみ参照可 (RLS で保護 / fetch 結果も RLS 側で 0行 になる安全二重)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    })();
  }, []);
  useEffect(() => {
    if (!petId || !pet || !currentUserId || currentUserId !== pet.owner_id) {
      setWeights([]);
      setClinicVisits([]);
      return;
    }
    (async () => {
      const [{ data: ws }, { data: cs }] = await Promise.all([
        supabase.from("pet_weights").select("id, recorded_at, weight_kg, memo").eq("pet_id", petId).order("recorded_at", { ascending: false }).limit(20),
        supabase.from("pet_clinic_visits").select("id, visited_at, clinic_name, reason, memo").eq("pet_id", petId).order("visited_at", { ascending: false }).limit(20),
      ]);
      setWeights(ws || []);
      setClinicVisits(cs || []);
    })();
  }, [petId, pet, currentUserId]);

  // 依頼書 #136 B1 Step 2: 体重記録追加
  const handleAddWeight = async () => {
    if (!petId || !currentUserId) return;
    const kgNum = parseFloat(wKg);
    if (!wDate || isNaN(kgNum) || kgNum <= 0 || kgNum >= 200) {
      setHrError("日付と体重 (0 < kg < 200) を入力してください");
      return;
    }
    setHrSaving(true); setHrError("");
    const { data, error } = await supabase.from("pet_weights").insert({
      pet_id: petId, recorded_at: wDate, weight_kg: kgNum, memo: wMemo.trim() || null, created_by: currentUserId
    }).select("id, recorded_at, weight_kg, memo").single();
    setHrSaving(false);
    if (error) { setHrError("保存に失敗しました: " + error.message); return; }
    if (data) setWeights([data, ...weights]);
    setShowWeightForm(false); setWKg(""); setWMemo(""); setWDate(new Date().toISOString().slice(0, 10));
  };

  // 依頼書 #136 B1 Step 2: 通院記録追加
  const handleAddClinic = async () => {
    if (!petId || !currentUserId) return;
    if (!cDate) { setHrError("日付を入力してください"); return; }
    setHrSaving(true); setHrError("");
    const { data, error } = await supabase.from("pet_clinic_visits").insert({
      pet_id: petId, visited_at: cDate, clinic_name: cName.trim() || null, reason: cReason.trim() || null, memo: cMemo.trim() || null, created_by: currentUserId
    }).select("id, visited_at, clinic_name, reason, memo").single();
    setHrSaving(false);
    if (error) { setHrError("保存に失敗しました: " + error.message); return; }
    if (data) setClinicVisits([data, ...clinicVisits]);
    setShowClinicForm(false); setCName(""); setCReason(""); setCMemo(""); setCDate(new Date().toISOString().slice(0, 10));
  };

  // 削除 (体重・通院 共通)
  const handleDeleteWeight = async (id: string) => {
    if (!confirm("この体重記録を削除しますか?")) return;
    const { error } = await supabase.from("pet_weights").delete().eq("id", id);
    if (!error) setWeights(weights.filter(w => w.id !== id));
  };
  const handleDeleteClinic = async (id: string) => {
    if (!confirm("この通院記録を削除しますか?")) return;
    const { error } = await supabase.from("pet_clinic_visits").delete().eq("id", id);
    if (!error) setClinicVisits(clinicVisits.filter(c => c.id !== id));
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.warmGray }}>読み込み中...</div>;
  if (!pet) return <div style={{ padding: 40, textAlign: "center", color: C.warmGray }}>うちの子が見つかりません</div>;

  const isMemorial = pet.status === "memorial";
  const speciesEmoji = petIcon(pet.species);
  const genderIcon = pet.gender === "male" ? "♂" : pet.gender === "female" ? "♀" : "";
  const speciesLabel = petLabelShort(pet.species);
  const heroPhoto = photos[selectedPhotoIdx]?.photo_url || pet.avatar_url || "";
  const showBio = !!pet.bio && !pet.bio.startsWith("(Phase D サンプル");

  // 年齢計算
  let ageText = "";
  if (pet.birthday) {
    const bd = new Date(pet.birthday);
    const now = new Date();
    const years = now.getFullYear() - bd.getFullYear();
    const m = now.getMonth() - bd.getMonth();
    const isBeforeBirthday = m < 0 || (m === 0 && now.getDate() < bd.getDate());
    const ageYears = isBeforeBirthday ? years - 1 : years;
    if (ageYears > 0) ageText = `${ageYears}歳`;
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* 戻るボタン (owner のプロフィールへ) */}
      {owner && (
        <button
          onClick={() => navigate(`/profile/${owner.id}`)}
          style={{
            background: "none",
            border: "none",
            color: C.warmGray,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            padding: "10px 0",
            marginBottom: 8,
            fontFamily: "inherit",
            minHeight: 40,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← {owner.display_name} のプロフィールへ
        </button>
      )}

      {/* ヒーロー写真 */}
      <div style={{
        width: "100%",
        aspectRatio: "4 / 3",
        background: "#FFF5EB",
        borderRadius: 16,
        marginBottom: photos.length > 1 ? 12 : 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 96,
        position: "relative",
        opacity: isMemorial ? 0.94 : 1,
        overflow: "hidden",
      }}>
        {heroPhoto ? (
          <img src={heroPhoto} alt={pet.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : speciesEmoji}
        {isMemorial && (
          <div style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(255,255,255,0.95)",
            color: "#8B6F4E",
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 14px",
            borderRadius: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}>
            🌈 虹の橋を渡った子
          </div>
        )}
      </div>

      {/* サムネイル列 (2枚以上ある場合のみ) */}
      {photos.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "thin" }}>
          {photos.map((ph, i) => (
            <button
              key={ph.id}
              onClick={() => setSelectedPhotoIdx(i)}
              style={{
                flexShrink: 0,
                width: 64,
                height: 64,
                borderRadius: 10,
                overflow: "hidden",
                background: C.orangePale,
                cursor: "pointer",
                border: `2px solid ${i === selectedPhotoIdx ? C.orange : "transparent"}`,
                transition: "border 0.2s",
                padding: 0,
                fontFamily: "inherit",
              }}
              aria-label={`写真 ${i + 1}`}
            >
              <img src={ph.photo_url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      )}

      {/* 基本情報カード */}
      <div style={{
        background: C.white,
        borderRadius: 16,
        padding: "20px",
        border: `1px solid ${C.border}`,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.dark, marginBottom: 6, lineHeight: 1.3, fontFamily: resolveFontFamily(owner?.font_pet_name) }}>
          {pet.name}
          {genderIcon && (
            <span style={{ color: C.warmGray, fontSize: 18, fontWeight: 600, marginLeft: 10 }}>{genderIcon}</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.8 }}>
          {speciesEmoji} {pet.breed || speciesLabel}
          {pet.birthday && (
            <> ・ {new Date(pet.birthday).getFullYear()}年生まれ{ageText && ` (${ageText})`}</>
          )}
        </div>
      </div>

      {/* 自己紹介 (うちの子の物語) */}
      {showBio && (
        <div style={{
          background: C.orangePale,
          borderRadius: 14,
          padding: "16px 20px",
          marginBottom: 16,
          fontSize: 14,
          color: C.dark,
          lineHeight: 1.8,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {pet.bio}
        </div>
      )}

      {/* 軌跡セクション (Phase D Phase 2 後半で taken_at タイムライン詳細実装) */}
      <div style={{
        background: C.white,
        borderRadius: 14,
        padding: "24px 20px",
        border: `1px dashed ${C.border}`,
        marginBottom: 16,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
          📜 うちの子の軌跡
        </div>
        <div style={{ fontSize: 12, color: C.warmGray, lineHeight: 1.7 }}>
          {photos.length > 0
            ? `これまでの ${photos.length} 枚の記録を、もうすぐここに。`
            : "写真とともに、これまでの記録をここに残せるようになります。"}
        </div>
      </div>

      {/* 依頼書 #136 B1 Step 2 (2026/6/8): 健康のきろく (飼い主専用 / 設計憲法 6箇条 厳守)
          - 記録 + 可視化のみ / 診断・助言・自動判定・公開流出 一切なし
          - RLS で飼い主のみアクセス / フロント側で currentUserId === pet.owner_id でも二重ガード */}
      {currentUserId && pet.owner_id === currentUserId && (
        <div style={{ marginBottom: 16 }}>
          {/* セクションヘッダー */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: QC_FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 6, letterSpacing: "0.04em" }}>
              📋 健康のきろく
            </div>
            <div style={{ fontSize: 11, color: C.warmGray, lineHeight: 1.7 }}>
              あなた専用 — このページは飼い主にしか見えません
            </div>
          </div>

          {/* 獣医師相談 定型文 (設計憲法 #6) */}
          <div style={{ background: "#FFF8E1", border: "1px solid #F5D680", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#7A5C00", lineHeight: 1.7 }}>
            ⚠️ 体調の急変や気になる症状がある場合は、必ず獣医師にご相談ください。Qocca は記録の保存・可視化のみを行います。
          </div>

          {hrError && (
            <div style={{ background: C.redPale, color: C.red, padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>⚠️ {hrError}</div>
          )}

          {/* 2 カード レイアウト: 体重 / 通院 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>

            {/* 体重カード */}
            <div style={{ background: C.white, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>⚖️ 体重 ({weights.length})</div>
                <button onClick={() => setShowWeightForm(!showWeightForm)} style={{ background: showWeightForm ? C.lightGray : C.orange, color: showWeightForm ? C.dark : "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {showWeightForm ? "閉じる" : "+ 記録する"}
                </button>
              </div>
              {showWeightForm && (
                <div style={{ background: C.lightGray, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} style={{ padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" }} />
                    <input type="number" inputMode="decimal" step="0.1" min="0.1" max="199.9" value={wKg} onChange={(e) => setWKg(e.target.value)} placeholder="体重 (kg)" style={{ padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" }} />
                  </div>
                  <input type="text" value={wMemo} onChange={(e) => setWMemo(e.target.value)} maxLength={100} placeholder="メモ (任意・100文字以内)" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", marginBottom: 8 }} />
                  <button onClick={handleAddWeight} disabled={hrSaving} style={{ width: "100%", padding: "9px", background: hrSaving ? C.warmGray : C.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: hrSaving ? "wait" : "pointer", fontFamily: "inherit" }}>
                    {hrSaving ? "保存中..." : "💾 記録する"}
                  </button>
                </div>
              )}
              {/* 依頼書 #136 B1 Step 3 (2026/6/8): 体重推移グラフ (SVG / 2件以上で表示 / 過去並列のみ・判定なし) */}
              {weights.length >= 2 && (() => {
                const sorted = [...weights].slice(0, 10).reverse(); // ASC
                const vals = sorted.map(d => Number(d.weight_kg));
                const max = Math.max(...vals);
                const min = Math.min(...vals);
                const range = Math.max(max - min, 0.1);
                const yMin = min - range * 0.15;
                const yMax = max + range * 0.15;
                const W = 280, H = 80;
                const points = sorted.map((d, i) => ({
                  x: sorted.length === 1 ? W / 2 : (i / (sorted.length - 1)) * W,
                  y: H - ((Number(d.weight_kg) - yMin) / (yMax - yMin)) * H,
                  ...d,
                }));
                const pathD = points.map((p, i) => (i === 0 ? `M${p.x.toFixed(1)},${p.y.toFixed(1)}` : `L${p.x.toFixed(1)},${p.y.toFixed(1)}`)).join(" ");
                const first = sorted[0], last = sorted[sorted.length - 1];
                return (
                  <div style={{ background: C.cream, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: C.warmGray, marginBottom: 4 }}>📈 直近 {sorted.length} 件の推移 (過去並列・判定なし)</div>
                    <svg viewBox={`0 0 ${W} ${H + 18}`} style={{ width: "100%", height: 96, display: "block" }} preserveAspectRatio="none" role="img" aria-label="体重推移グラフ">
                      <path d={pathD} stroke={C.orange} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                      {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={C.orange} />
                      ))}
                      <text x={0} y={H + 14} fill={C.warmGray} fontSize="9">{first.recorded_at.slice(5)} {first.weight_kg}kg</text>
                      <text x={W} y={H + 14} fill={C.warmGray} fontSize="9" textAnchor="end">{last.recorded_at.slice(5)} {last.weight_kg}kg</text>
                    </svg>
                  </div>
                );
              })()}
              {weights.length === 0 ? (
                <div style={{ fontSize: 12, color: C.warmGray, textAlign: "center", padding: 16 }}>まだ記録がありません</div>
              ) : (
                <div>
                  {weights.slice(0, 10).map((w) => (
                    <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: C.warmGray, fontSize: 11, marginRight: 8 }}>{w.recorded_at}</span>
                        <span style={{ color: C.dark, fontWeight: 700 }}>{w.weight_kg} kg</span>
                        {w.memo && <span style={{ color: C.warmGray, fontSize: 11, marginLeft: 8 }}>· {w.memo}</span>}
                      </div>
                      <button onClick={() => handleDeleteWeight(w.id)} style={{ background: "none", border: "none", color: C.warmGray, fontSize: 14, cursor: "pointer", padding: 4 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 依頼書 #136 B1 Step 4 (2026/6/8): 時系列タイムライン (体重 + 通院 を merge) */}
            {(weights.length > 0 || clinicVisits.length > 0) && (() => {
              const merged: Array<{ type: 'w' | 'c'; date: string; key: string; line1: string; line2?: string }> = [];
              weights.forEach(w => merged.push({ type: 'w', date: w.recorded_at, key: `w-${w.id}`, line1: `⚖️ ${w.weight_kg} kg`, line2: w.memo || undefined }));
              clinicVisits.forEach(c => merged.push({ type: 'c', date: c.visited_at, key: `c-${c.id}`,
                line1: `🏥 ${c.clinic_name || "(病院名なし)"}${c.reason ? ` · ${c.reason}` : ""}`,
                line2: c.memo || undefined }));
              merged.sort((a, b) => b.date.localeCompare(a.date)); // DESC
              const top = merged.slice(0, 30);
              return (
                <div style={{ background: C.white, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4 }}>📜 時系列 ({merged.length})</div>
                  <div style={{ fontSize: 10, color: C.warmGray, marginBottom: 10 }}>体重と通院を時系列で並べた振り返り (飼い主専用 / 判定なし)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {top.map((e) => (
                      <div key={e.key} style={{
                        display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px",
                        background: e.type === 'c' ? "#FFF8E7" : C.cream, borderRadius: 8,
                        borderLeft: `2px solid ${e.type === 'c' ? "#D9B888" : C.orangeLight}`,
                      }}>
                        <div style={{ fontSize: 10, color: C.warmGray, minWidth: 56, fontFamily: "monospace" }}>{e.date.slice(5)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: C.dark, fontWeight: 600 }}>{e.line1}</div>
                          {e.line2 && <div style={{ fontSize: 10, color: C.warmGray, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{e.line2}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {merged.length > 30 && (
                    <div style={{ fontSize: 10, color: C.warmGray, textAlign: "center", marginTop: 8 }}>...直近 30 件のみ表示</div>
                  )}
                </div>
              );
            })()}

            {/* 通院カード */}
            <div style={{ background: C.white, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>🏥 通院 ({clinicVisits.length})</div>
                <button onClick={() => setShowClinicForm(!showClinicForm)} style={{ background: showClinicForm ? C.lightGray : C.orange, color: showClinicForm ? C.dark : "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {showClinicForm ? "閉じる" : "+ 記録する"}
                </button>
              </div>
              {showClinicForm && (
                <div style={{ background: C.lightGray, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", marginBottom: 8 }} />
                  <input type="text" value={cName} onChange={(e) => setCName(e.target.value)} maxLength={50} placeholder="病院名 (任意)" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", marginBottom: 8 }} />
                  <input type="text" value={cReason} onChange={(e) => setCReason(e.target.value)} maxLength={50} placeholder="理由 (定期検診/ワクチン/その他)" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", marginBottom: 8 }} />
                  <input type="text" value={cMemo} onChange={(e) => setCMemo(e.target.value)} maxLength={200} placeholder="メモ (任意・200文字以内)" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", marginBottom: 8 }} />
                  <button onClick={handleAddClinic} disabled={hrSaving} style={{ width: "100%", padding: "9px", background: hrSaving ? C.warmGray : C.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: hrSaving ? "wait" : "pointer", fontFamily: "inherit" }}>
                    {hrSaving ? "保存中..." : "💾 記録する"}
                  </button>
                </div>
              )}
              {clinicVisits.length === 0 ? (
                <div style={{ fontSize: 12, color: C.warmGray, textAlign: "center", padding: 16 }}>まだ記録がありません</div>
              ) : (
                <div>
                  {clinicVisits.slice(0, 10).map((c) => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: C.warmGray, fontSize: 11, marginBottom: 2 }}>{c.visited_at}</div>
                        <div style={{ color: C.dark, fontWeight: 700, fontSize: 13 }}>{c.clinic_name || "(病院名なし)"}{c.reason ? ` · ${c.reason}` : ""}</div>
                        {c.memo && <div style={{ color: C.warmGray, fontSize: 11, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.memo}</div>}
                      </div>
                      <button onClick={() => handleDeleteClinic(c.id)} style={{ background: "none", border: "none", color: C.warmGray, fontSize: 14, cursor: "pointer", padding: 4, marginLeft: 8 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Phase D: /profile/me — ログイン中ユーザの公開プロフィールへリダイレクト
export const ProfileMeRedirect: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate(`/profile/${user.id}`, { replace: true });
      } else {
        const returnTo = encodeURIComponent("/profile/me");
        navigate(`/login?returnTo=${returnTo}`, { replace: true });
      }
    })();
  }, [navigate]);
  return <div style={{ padding: 40, textAlign: "center", color: C.warmGray, fontSize: 13 }}>読み込み中...</div>;
};

// ============================================================================
// UpdatePasswordPage (依頼書 #138 タスク2 Step 2, 2026/6/9)
// パスワード再設定リンクを受ける専用ルート (/update-password)
// 設計憲法:
//   1. isRecovery=true (recovery メール経由) のみ新パスワード入力を許可
//   2. 通常ログイン中のユーザーが直接 URL を叩いてもエラー画面 (=自分のパスワードを書き換えできない)
//   3. 成功時は signOut → /login へ navigate (新パスワードで再ログイン)
//   4. Editorial Documentary トーン
// ============================================================================
export const UpdatePasswordPage = () => {
  const navigate = useNavigate();
  const { isRecovery, user, updatePassword, signOut } = useAuth() as any;
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setErrMsg("");
    if (pass.length < 6) { setErrMsg("パスワードは 6文字以上で入力してください"); return; }
    if (pass !== pass2) { setErrMsg("確認用パスワードが一致しません"); return; }
    setSubmitting(true);
    const { error } = await updatePassword(pass);
    setSubmitting(false);
    if (error) { setErrMsg(error.message || "パスワード変更に失敗しました"); return; }
    setSuccess(true);
    // 安全のため signOut してログイン画面へ
    setTimeout(async () => {
      await signOut();
      navigate("/?page=login");
    }, 1800);
  };

  // ガード: isRecovery=false かつ user=非ログイン → 無効アクセス
  // recovery 経由でない通常ログイン中ユーザーも はじく (= 自分のパスワードを誤って書き換えできない)
  if (!isRecovery) {
    return (
      <div style={{ paddingTop: 60, minHeight: "100vh", background: "#FAF5EC", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
        <div style={{ maxWidth: 440, width: "100%", background: "#fff", borderRadius: 18, padding: "32px 22px", textAlign: "center", border: `1px solid ${C.border}`, boxShadow: "0 4px 18px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
          <div style={{ fontFamily: QC_FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: C.dark, marginBottom: 10, letterSpacing: "0.04em" }}>
            無効なアクセスです
          </div>
          <div style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.85, marginBottom: 22 }}>
            このページはメールで届いた<br />
            パスワード再設定リンクからのみ開けます。<br /><br />
            パスワードをお忘れの方は、ログイン画面の<br />
            「パスワードを忘れた方」からやり直してください。
          </div>
          <button onClick={() => navigate(user ? "/" : "/?page=login")} style={{ padding: "10px 22px", background: C.orange, color: "#fff", border: "none", borderRadius: 22, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 42 }}>
            {user ? "ホームへ戻る" : "ログイン画面へ"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 60, minHeight: "100vh", background: "#FAF5EC", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
      <div style={{ maxWidth: 440, width: "100%", background: "#fff", borderRadius: 18, padding: "32px 22px", border: `1px solid ${C.border}`, boxShadow: "0 4px 18px rgba(0,0,0,0.04)" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
          <div style={{ fontFamily: QC_FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 8, letterSpacing: "0.04em" }}>
            新しいパスワードを設定
          </div>
          <div style={{ fontSize: 12.5, color: C.warmGray, lineHeight: 1.8 }}>
            6文字以上の新しいパスワードを<br />入力してください。
          </div>
        </div>

        {success ? (
          <div style={{ background: "#E8F5E9", color: "#2E7D32", padding: "18px 14px", borderRadius: 12, textAlign: "center", fontSize: 13, fontWeight: 700, lineHeight: 1.7 }}>
            ✅ パスワードを変更しました<br />
            <span style={{ fontSize: 11, fontWeight: 400, color: "#558B5C" }}>ログイン画面へ移動します...</span>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: C.dark, display: "block", marginBottom: 6 }}>新しいパスワード</label>
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="6文字以上" autoComplete="new-password" style={{ width: "100%", padding: "12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}/>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: C.dark, display: "block", marginBottom: 6 }}>確認のためもう一度</label>
              <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="もう一度入力" autoComplete="new-password" style={{ width: "100%", padding: "12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}/>
            </div>
            {errMsg && (
              <div style={{ background: "#FFE4E1", color: "#A33C2E", padding: "10px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 14, lineHeight: 1.6 }}>⚠️ {errMsg}</div>
            )}
            <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: 13, background: submitting ? C.warmGray : C.orange, color: "#fff", border: "none", borderRadius: 24, fontSize: 14, fontWeight: 700, cursor: submitting ? "wait" : "pointer", fontFamily: "inherit", minHeight: 46 }}>
              {submitting ? "変更中..." : "パスワードを変更する"}
            </button>
            <div style={{ marginTop: 14, fontSize: 11, color: C.warmGray, textAlign: "center", lineHeight: 1.7 }}>
              変更後は安全のため自動でログアウトされます。<br />新パスワードで改めてログインしてください。
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── /redeem ページ (依頼書 #7 Phase A, 2026/5/25) ───────────────────────────
// CAMPFIRE クラファンバッカーがメールで受け取ったコードを引き換える
// redeem-crowdfunding-code Edge Function → RPC redeem_crowdfunding_code v2 呼び出し
// REDEEM_TIER_THEME は constants/data.ts へ移動 (Phase7 / RedeemPage+MyPage 共有のため中立化)

export const RedeemPage = ({ setPage }: { setPage: (p: string) => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (user === null) {
      navigate("/login?returnTo=" + encodeURIComponent("/redeem"), { replace: true });
    }
  }, [user, navigate]);

  const handleRedeem = async () => {
    setError("");
    setResult(null);
    if (!code.trim()) { setError("コードを入力してください"); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("ログインが必要です"); setLoading(false); return; }
      const res = await fetch(
        "https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/redeem-crowdfunding-code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code: code.trim() }),
        }
      );
      const data = await res.json();
      if (!data?.success) {
        setError(data?.message || "コードの引き換えに失敗しました");
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError("通信エラー: " + (err?.message || String(err)));
    }
    setLoading(false);
  };

  const theme = result?.reward_id ? REDEEM_TIER_THEME[result.reward_id] : null;

  if (!user) return <div style={{ padding: 40, textAlign: "center", color: C.warmGray }}>読み込み中...</div>;

  return (
    <div style={{ minHeight: "100vh", background: C.cream, paddingTop: 64, paddingBottom: 80, fontFamily: "'Noto Sans JP',sans-serif" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎁</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: C.dark, margin: "0 0 6px" }}>クラファン特典を受け取る</h1>
          <p style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.6, margin: 0 }}>
            CAMPFIRE のメールで届いた引き換えコードを入力してや🐾<br />
            <span style={{ fontSize: 11, opacity: 0.7 }}>創業期住民として、Qocca の街にようこそ🌅</span>
          </p>
        </div>

        {!result && (
          <div style={{ background: C.white, borderRadius: 20, padding: 24, boxShadow: "0 4px 14px rgba(0,0,0,0.06)" }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
              引き換えコード
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="QOCCA-XXXX-XXXX-XXXX"
              maxLength={32}
              style={{
                width: "100%", padding: "14px 16px", fontSize: 16, letterSpacing: 1.5,
                fontFamily: "monospace", border: `2px solid ${C.border}`, borderRadius: 12,
                outline: "none", boxSizing: "border-box", textAlign: "center", fontWeight: 700,
              }}
            />
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 6, textAlign: "center" }}>
              大文字小文字どっちで入力しても OK・空白は無視
            </div>

            {error && (
              <div style={{ marginTop: 16, padding: "12px 14px", background: "#FFEBEE", color: "#C62828", borderRadius: 10, fontSize: 13, lineHeight: 1.5 }}>
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={handleRedeem}
              disabled={loading || !code.trim()}
              style={{
                width: "100%", marginTop: 20, padding: "16px", fontSize: 15, fontWeight: 800,
                background: loading || !code.trim() ? C.warmGray : C.orange,
                color: "#fff", border: "none", borderRadius: 12,
                cursor: loading || !code.trim() ? "wait" : "pointer", fontFamily: "inherit",
                transition: "background 0.2s",
              }}
            >
              {loading ? "確認中..." : "🎉 特典を受け取る"}
            </button>

            <div style={{ marginTop: 20, padding: 12, background: C.cream, borderRadius: 10, fontSize: 11, color: C.warmGray, lineHeight: 1.7 }}>
              💡 <strong style={{ color: C.dark }}>困った時は:</strong><br />
              ・コードが届いてない → CAMPFIRE のメッセージ機能でお問い合わせください<br />
              ・「既に使用されています」と出る → 既に引き換え済みです。マイページで特典をご確認ください<br />
              ・その他 → <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => navigate("/contact")}>お問い合わせ</span>
            </div>
          </div>
        )}

        {result && theme && (
          <div style={{ background: C.white, borderRadius: 20, padding: 28, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 12, animation: "qoccaBounce 0.6s ease" }}>{theme.icon}</div>
            <div style={{ background: theme.bg, color: theme.color, display: "inline-block", padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 800, marginBottom: 14 }}>
              {theme.label}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: C.dark, margin: "0 0 8px" }}>
              ありがとうございます🌅
            </h2>
            <p style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.7, margin: "0 0 20px" }}>
              <strong style={{ color: C.dark }}>{result.reward_name}</strong> の特典を受け取りました。<br />
              Qocca の街は、あなたという住民を得て<br />一歩深くなりました🐾
            </p>

            {/* 受け取った特典リスト */}
            <div style={{ background: C.cream, borderRadius: 12, padding: 16, marginBottom: 16, textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 10 }}>✨ 受け取った特典</div>
              {(result.benefits || []).filter((b: string) => !b.startsWith("badge:") && b !== "founding_creator" && b !== "founding_mayor" && b !== "founding_fee_rate_3" && b !== "early_supporter").map((b: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: C.dark, padding: "4px 0", borderBottom: i < (result.benefits.length - 1) ? `1px solid ${C.border}` : "none" }}>
                  ・{b}
                </div>
              ))}
              {(result.newly_granted_badges || []).length > 0 && (
                <div style={{ marginTop: 10, padding: "10px 0 0", borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>🏅 獲得バッジ</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {result.newly_granted_badges.map((b: string) => (
                      <span key={b} style={{ background: theme.bg, color: theme.color, padding: "4px 10px", borderRadius: 14, fontSize: 11, fontWeight: 700 }}>
                        {b.replace("crowdfund-", "")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(result.profile_flags_set || []).length > 0 && (
                <div style={{ marginTop: 10, padding: "10px 0 0", borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6 }}>⭐ プロフィール特典</div>
                  {result.profile_flags_set.includes("is_founding_creator") && (
                    <div style={{ fontSize: 12, color: C.dark, marginTop: 2 }}>🎨 創業クリエイター認定 (事業が存続する限り手数料 3%)</div>
                  )}
                  {result.profile_flags_set.includes("is_founding_mayor") && (
                    <div style={{ fontSize: 12, color: C.dark, marginTop: 2 }}>👑 創業首長認定</div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => { setPage("mypage"); navigate("/mypage"); }}
              style={{ width: "100%", padding: "14px", background: C.orange, color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}
            >
              🏠 マイページで確認
            </button>
            <button
              onClick={() => { setResult(null); setCode(""); }}
              style={{ width: "100%", padding: "12px", background: "transparent", color: C.warmGray, border: `1px solid ${C.border}`, borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              別のコードを引き換える
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes qoccaBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }`}</style>
    </div>
  );
};

// ============================================================================
// PostsTab (依頼書 #38 Phase C-E)
// ギャラリー / ブログ 投稿の新規作成・編集・削除
// 戦略書 §1.3 多様性: pet_categories マスター (13カテゴリ) からセレクト
// "住める速度を超えない" UX: 急かさない・キャンセル可能・削除確認
// ============================================================================
// MyPage クラスタ(15部品+PetCategory型: MyPage/各タブ/ActivityDetailModal/DisputeModal/compose群) は pages/mypage.tsx へ移動 (Phase7)

// BlogPage は pages/gallery.tsx へ移動 (Phase5 ②gallery)

// ── Pet Facilities (ドッグラン・ペット施設マップ) ──────────────────────────
// FACILITY_CATS / MOOD_TAGS / FACILITY_REPORT_REASONS / FACILITY_NG_WORDS は constants/data.ts へ移動 (Phase 1 ②)

// checkFacilityNGWords は utils/moderation.ts へ移動 (Phase 1 ④)


// PREFS は constants/data.ts へ移動 (Phase 1 ②)

// 施設マップ群 (facilityDisplayDesc/FacilityMapView/FacilitiesPage/FacilityDetailView/FacilityVisitForm/FacilityReportModal/FacilityCorrectionForm) は pages/facilities.tsx へ移動 (Phase5 ④facilities)

// GalleryPage は pages/gallery.tsx へ移動 (Phase5 ②gallery)

// ============================================================================
// PhoneVerificationPage (v3.2 第29-30章: 1人=1アカウント、Stripe JCB違反者再登録防止)
// Twilio Verify API 経由で SMS OTP 認証、住民の任意機能 (出品者推奨)
// ============================================================================
// 2026/6/30 Twilio Inactive 対応: SMS送信不可のため新規認証フローを「準備中」案内に置換。
// 既に verified_at がある住民(Step 3)は通常通り「認証済み」表示 → 既存ユーザーは無影響。
// 認証本体(AuthContext)・メール認証フロー・Edge Function(send-verification-code / verify-code)
// は1文字も触らない。Twilio 復旧後は SMS_VERIFICATION_AVAILABLE = true に戻すだけで完全復活。
const SMS_VERIFICATION_AVAILABLE = false;

// 文言定数 (King 微調整用に分離)
const SMS_UNAVAILABLE_COPY = {
  title: '電話番号認証は現在準備中です',
  body: 'メール認証で、Qoccaの全ての機能をご利用いただけます。\n電話番号認証は近日中に再開予定です。\nご不便をおかけしますが、しばしお待ちください。',
  buttonLabel: 'マイページへ戻る',
};

export const PhoneVerificationPage = ({ setPage: _setPage }: any) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phoneNumber, setPhoneNumber] = useState("+81");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  // 既に認証済みかチェック (Step 1 初期表示時)
  const [alreadyVerified, setAlreadyVerified] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("account_phone_verification")
        .select("phone_number, verified_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.verified_at) {
        setAlreadyVerified(true);
        setPhoneNumber(data.phone_number);
        setStep(3);
      } else {
        setAlreadyVerified(false);
      }
    })();
  }, [user?.id]);

  const handleSendCode = async () => {
    setError(null);
    if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
      setError("国際形式で入力してください (例: +818012345678)");
      return;
    }
    setBusy(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("send-verification-code", {
        body: { phone_number: phoneNumber },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) {
        if (data.error === "rate_limited" && data.retry_after_seconds) {
          setRetryAfter(data.retry_after_seconds);
        }
        setError(data.message || data.error);
        return;
      }
      setStep(2);
    } catch (e: any) {
      setError(e?.message || "送信に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    if (!/^\d{4,10}$/.test(code)) {
      setError("コードは数字のみで入力してください");
      return;
    }
    setBusy(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("verify-code", {
        body: { phone_number: phoneNumber, code },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) {
        setError(data.message || data.error);
        return;
      }
      if (data?.success && data?.verified) {
        setStep(3);
        setAlreadyVerified(true);
      } else {
        setError(data?.message || "認証に失敗しました");
      }
    } catch (e: any) {
      setError(e?.message || "認証に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleBackToPhone = () => {
    setStep(1);
    setCode("");
    setError(null);
  };

  if (!user) {
    return (
      <div style={{ paddingTop: isMobile ? 60 : 0, minHeight: "100vh", background: C.cream, padding: "80px 16px 40px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 15, color: C.dark, marginBottom: 16 }}>ログインが必要です。</div>
          <button onClick={() => navigate("/login")} style={{
            minHeight: 44, padding: "10px 20px", background: "transparent",
            color: C.orange, border: `1.5px solid ${C.orange}`, borderRadius: 20,
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>ログインへ →</button>
        </div>
      </div>
    );
  }

  // 共通の input スタイル (スマホ第一原則: minHeight 44)
  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 44,
    padding: "12px 14px",
    fontSize: 16,
    fontFamily: "inherit",
    border: `1.5px solid ${C.border}`,
    borderRadius: 10,
    background: C.white,
    color: C.dark,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ paddingTop: isMobile ? 60 : 0, minHeight: "100vh", background: C.cream, padding: "80px 16px 40px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* ヘッダー */}
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => navigate("/mypage")} style={{
            background: "none", border: "none", cursor: "pointer",
            color: C.warmGray, fontSize: 13, padding: 0, fontFamily: "inherit",
          }}>← マイページへ戻る</button>
          <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: C.dark, marginTop: 12, marginBottom: 6 }}>
            電話番号の認証
          </h1>
          <p style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.7, margin: 0 }}>
            {SMS_VERIFICATION_AVAILABLE ? (
              <>
                出品をはじめる方には認証をおすすめしています。<br/>
                安心して使える街のための、ささやかな手続きです。
              </>
            ) : (
              <>
                電話番号認証は現在準備中です。<br/>
                メール認証で、すべての機能をご利用いただけます。
              </>
            )}
          </p>
        </div>

        {/* 2026/6/30 Twilio Inactive 対応: SMS_VERIFICATION_AVAILABLE=false の間は
            Step 1 (新規認証フォーム) を「準備中」カードに差し替え。
            Step 2/3 のロジックは温存 → フラグ true 復帰時に即元通り動作。
            既に verified_at がある住民は alreadyVerified=true → Step 3 表示で本ブロックを通らず無影響。 */}
        {step === 1 && alreadyVerified === false && !SMS_VERIFICATION_AVAILABLE && (
          <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "28px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.6 }}>🌿</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 12, lineHeight: 1.6 }}>
              {SMS_UNAVAILABLE_COPY.title}
            </div>
            <div style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.85, marginBottom: 24, whiteSpace: "pre-line" }}>
              {SMS_UNAVAILABLE_COPY.body}
            </div>
            <button
              onClick={() => navigate("/mypage")}
              style={{
                minHeight: 44, padding: "12px 24px",
                background: "transparent", color: C.orange,
                border: `1.5px solid ${C.orange}`, borderRadius: 22,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit",
                transition: "background 0.3s ease, color 0.3s ease",
              }}
            >
              {SMS_UNAVAILABLE_COPY.buttonLabel} →
            </button>
          </div>
        )}
        {/* Step 1: 電話番号入力 (SMS_VERIFICATION_AVAILABLE=true の時のみ表示) */}
        {step === 1 && alreadyVerified === false && SMS_VERIFICATION_AVAILABLE && (
          <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "20px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 8 }}>1 / 2 — 電話番号を入力</div>
            <label style={{ display: "block", fontSize: 12, color: C.warmGray, marginBottom: 6 }}>
              国際形式で入力してください (例: +818012345678)
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\+0-9]/g, ""))}
              placeholder="+818012345678"
              style={inputStyle}
              disabled={busy}
            />
            {error && (
              <div style={{ fontSize: 12, color: C.red, marginTop: 8, lineHeight: 1.6 }}>
                {error}
                {retryAfter !== null && ` (約${retryAfter}秒後に再試行可能)`}
              </div>
            )}
            <div style={{ fontSize: 11, color: C.warmGray, marginTop: 12, lineHeight: 1.7 }}>
              SMS で 6 桁のコードをお送りします。<br/>
              SMS 受信料金が発生する場合があります。
            </div>
            <button
              onClick={handleSendCode}
              disabled={busy || !phoneNumber}
              style={{
                width: "100%", minHeight: 44, marginTop: 16, padding: "12px 20px",
                background: "transparent", color: C.orange,
                border: `1.5px solid ${C.orange}`, borderRadius: 22,
                fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: busy ? 0.5 : 1,
                transition: "background 0.3s ease, color 0.3s ease",
              }}
            >
              {busy ? "送信中..." : "認証コードを送る →"}
            </button>
          </div>
        )}

        {/* Step 2: コード入力 */}
        {step === 2 && (
          <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "20px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 8 }}>2 / 2 — 受信したコードを入力</div>
            <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 14, lineHeight: 1.6 }}>
              <span style={{ color: C.dark }}>{phoneNumber}</span> 宛に送ったコードを入力してください。
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
              placeholder="6桁のコード"
              style={{ ...inputStyle, fontSize: 18, letterSpacing: "0.2em", textAlign: "center" }}
              disabled={busy}
            />
            {error && (
              <div style={{ fontSize: 12, color: C.red, marginTop: 8, lineHeight: 1.6 }}>{error}</div>
            )}
            <button
              onClick={handleVerifyCode}
              disabled={busy || !code}
              style={{
                width: "100%", minHeight: 44, marginTop: 16, padding: "12px 20px",
                background: "transparent", color: C.orange,
                border: `1.5px solid ${C.orange}`, borderRadius: 22,
                fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: busy ? 0.5 : 1,
                transition: "background 0.3s ease, color 0.3s ease",
              }}
            >
              {busy ? "確認中..." : "認証する →"}
            </button>
            <button
              onClick={handleBackToPhone}
              disabled={busy}
              style={{
                width: "100%", minHeight: 44, marginTop: 10, padding: "10px 20px",
                background: "transparent", color: C.warmGray,
                border: "none", fontSize: 12, cursor: busy ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              ← 電話番号を変更する
            </button>
          </div>
        )}

        {/* Step 3: 完了 */}
        {step === 3 && (
          <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "24px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 8 }}>
              {alreadyVerified ? "認証済みです" : "認証が完了しました"}
            </div>
            <div style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.7, marginBottom: 20 }}>
              {phoneNumber}<br/>
              この街への準備が、ひとつ整いました。
            </div>
            <button
              onClick={() => navigate("/mypage")}
              style={{
                minHeight: 44, padding: "10px 24px",
                background: "transparent", color: C.orange,
                border: `1.5px solid ${C.orange}`, borderRadius: 22,
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                transition: "background 0.3s ease, color 0.3s ease",
              }}
            >
              マイページへ戻る →
            </button>
          </div>
        )}

        {/* loading 表示 (alreadyVerified === null) */}
        {alreadyVerified === null && step !== 3 && (
          <div style={{ textAlign: "center", padding: 24, color: C.warmGray, fontSize: 13 }}>読み込み中…</div>
        )}
      </div>
    </div>
  );
};

// ── データ削除リクエスト確認ページ (Phase Threads, 2026/5/24) ────────────────
// Meta threads-deletion-callback が返す url の確認ページ
// 認証不要、シンプル静的、?id=<confirmation_code> クエリで表示
export const DeletionStatusPage: React.FC = () => {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const confirmationId = params.get("id") || "";

  return (
    <div style={{ minHeight: "70vh", maxWidth: 600, margin: "0 auto", padding: "60px 20px 40px" }}>
      <div style={{ fontSize: 56, textAlign: "center", marginBottom: 16 }}>🗑️</div>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: C.dark, textAlign: "center", marginBottom: 16 }}>
        データ削除リクエストを受け付けました
      </h1>
      <p style={{ fontSize: 14, color: "#444", lineHeight: 1.9, textAlign: "center", marginBottom: 24 }}>
        Threads (Meta) 経由でのデータ削除リクエストを受け付けました。<br/>
        Qocca に保存されている Threads 連携情報は順次削除されます。
      </p>

      {confirmationId && (
        <div style={{ background: C.cream, borderRadius: 14, padding: "20px 24px", border: `1px solid ${C.border}`, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 6, textAlign: "center" }}>確認 ID</div>
          <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: C.dark, textAlign: "center", letterSpacing: "0.08em", wordBreak: "break-all" }}>
            {confirmationId}
          </div>
        </div>
      )}

      <div style={{ background: "#F8F6F2", borderRadius: 12, padding: "16px 20px", fontSize: 12, color: "#666", lineHeight: 1.8, marginBottom: 24 }}>
        <strong style={{ color: C.dark }}>削除される情報:</strong><br/>
        ・Threads アクセストークン<br/>
        ・Threads ユーザー ID<br/>
        ・Threads プロフィール情報のキャッシュ<br/>
        <br/>
        <strong style={{ color: C.dark }}>削除されない情報:</strong><br/>
        ・Qocca アカウント本体 (継続利用可能)<br/>
        ・ペット情報・出品作品・取引履歴等<br/>
        <br/>
        ご質問は <a href="/contact" onClick={(e) => { e.preventDefault(); navigate("/contact"); }} style={{ color: C.orange, fontWeight: 700, textDecoration: "none" }}>お問い合わせフォーム</a> までお願いします。
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button onClick={() => navigate("/")} style={{ padding: "12px 28px", background: C.orange, color: "#fff", border: "none", borderRadius: 22, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 44 }}>
          ホームに戻る
        </button>
      </div>
    </div>
  );
};

// ── X (Twitter) 連携ページ (Phase X, 2026/5/24, 案C 移植 5/26) ───────────────
// X API v2 OAuth 2.0 (PKCE) + 投稿テスト + プロフィール + 連携解除

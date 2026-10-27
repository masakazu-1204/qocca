// 2026/10/28 /pet/new: 「うちの子を登録する」画面への入口 (街だより・お知らせメールから)
//   住民 147 人のうち うちの子を登録しているのは 17 人。メールから 1 回で登録画面まで届くように。
//   ログイン済み → マイページのプロフィールタブで、うちの子の追加画面を開く (home の「はじめの一歩」と同じ state)。
//   未ログイン → ログインへ。終わったらここへ戻る (lib/returnTo)。
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function PetNewRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (user) navigate("/mypage", { replace: true, state: { tab: "profile", openPetAdd: true } });
    else navigate(`/login?returnTo=${encodeURIComponent("/pet/new")}`, { replace: true });
  }, [user, loading, navigate]);
  return null;
}

// 認証コンテキスト (App.tsx 分割 Phase 2)
// ⚠️ createContext は新規生成せず App.tsx から「切り取って移動」したもの (唯一の Auth Context)。
//   2個目を作ると認証・リアルタイム購読・決済導線が壊れるため絶対に複製しない。
// supabase クライアントは既存の単一 client (src/supabaseClient.ts) を import。
// ロジック・参照名は App.tsx 時点から1文字も改変なし。

import { useState, useEffect, createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";

// 2026/7/27 型負債返済: createContext(null) のせいで useAuth() の戻り値が null 型になり、
//   全画面で「Property 'user' does not exist on type 'null'」が出ていた (42件)。
//   ⚠️ 実装・呼び出し順・リアルタイム購読は1行も変更していない。型注釈の追加のみ。
//   返り値の形は supabase 自身の型から導出しているので推測が入らない。
type SignUpResult = Awaited<ReturnType<typeof supabase.auth.signUp>>;
type SignInResult = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
type OAuthResult = Awaited<ReturnType<typeof supabase.auth.signInWithOAuth>>;
type SignOutResult = Awaited<ReturnType<typeof supabase.auth.signOut>>;
type ResetResult = Awaited<ReturnType<typeof supabase.auth.resetPasswordForEmail>>;
type UpdateUserResult = Awaited<ReturnType<typeof supabase.auth.updateUser>>;
/** "google" | "line" ... supabase が受け付ける OAuth プロバイダ */
export type OAuthProvider = Parameters<typeof supabase.auth.signInWithOAuth>[0]["provider"];

/** 実装は supabase の戻り値を { data, error } に組み直して返すため、
 *  元の判別可能ユニオンの対応関係が外れる。その実態に合わせた形。 */
type Split<T extends { data: unknown; error: unknown }> = { data: T["data"]; error: T["error"] };

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isRecovery: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<Split<SignUpResult>>;
  signIn: (email: string, password: string) => Promise<Split<SignInResult>>;
  signInWithProvider: (provider: OAuthProvider) => Promise<Split<OAuthResult>>;
  signOut: () => Promise<{ error: SignOutResult["error"] }>;
  resetPassword: (email: string) => Promise<Split<ResetResult>>;
  updatePassword: (newPassword: string) => Promise<Split<UpdateUserResult>>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  // 依頼書 #138 タスク2 (2026/6/9): PASSWORD_RECOVERY 検出フラグ
  // recovery メール経由のみ true / 通常ログインは絶対に false
  // /update-password の表示ガードに使用
  const [isRecovery, setIsRecovery] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 現在のセッションを取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Auth状態の変更を監視
    // 依頼書 #138 タスク2: PASSWORD_RECOVERY を検出して /update-password へ強制 navigate
    // 通常ログイン・OAuth・既存セッション復帰の挙動は完全に不変
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          // recovery セッション: user は記録するが isRecovery=true で印を付ける
          setUser(session?.user ?? null);
          setIsRecovery(true);
          // /update-password 以外にいる場合のみ強制 navigate (recovery flow ループ防止)
          if (typeof window !== "undefined" && window.location.pathname !== "/update-password") {
            window.location.assign("/update-password");
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setIsRecovery(false);
        } else {
          // SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED 等: 通常通り user を更新
          // isRecovery は維持 (recovery flow 中の中間 SIGNED_IN で誤って解除されない)
          setUser(session?.user ?? null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signInWithProvider = async (provider: OAuthProvider) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  // 依頼書 #138 タスク2 (2026/6/9): redirectTo を専用ルート /update-password へ変更
  // 旧 /?page=reset は処理ロジックがなかった (= バグ根本原因の一つ)
  // King が Supabase Auth → URL Configuration → Redirect URLs に下記URLを追加することが前提:
  //   - https://qocca.pet/update-password
  //   - https://www.qocca.pet/update-password
  //   - Vercel preview env: https://*.vercel.app/update-password
  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/update-password` : undefined,
    });
    return { data, error };
  };

  // 依頼書 #138 タスク2: 新パスワード適用 (UpdatePasswordPage 側で呼び出し)
  // isRecovery=true のときのみ呼ばれる想定 (UI 側でガード)
  const updatePassword = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    return { data, error };
  };

  return (
    <AuthContext.Provider value={{ user, loading, isRecovery, signUp, signIn, signInWithProvider, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

// Provider は App 全体を包んでいるため、呼び出し側では常に値が入っている。
// 実行時の挙動を変えないよう throw は追加せず、型だけ非nullとして扱う。
export const useAuth = () => useContext(AuthContext) as AuthContextValue;

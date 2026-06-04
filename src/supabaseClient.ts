// src/supabaseClient.ts
// 依頼書 #119 Phase C (2026/6/5): admin 系ページの RLS 認証問題解消のため、
// supabase client をアプリ全体で唯一のインスタンスとして共有する。
//
// 背景: 各 admin ページ (AdminEventSources / AdminArkDonations /
//   AdminCorporateSponsors / AdminAnalytics) は createClient(URL, ANON) で
//   新規 instance を作っていたため、auth session を継承できず、
//   authenticated 限定 RLS ポリシーで 0 件返却していた。
// 修正: 全ファイルでこのファイルから import { supabase } して共有。

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const SUPABASE_ANON =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

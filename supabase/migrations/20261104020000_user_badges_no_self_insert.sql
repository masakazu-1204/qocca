-- ============================================
-- 2026/11/4 自分でバッジを入れられないようにする
--   user_badges_insert_own があると、ログイン中なら誰でも自分に好きなバッジを入れられる。
--   称号が意味を持たなくなり、クラファン支援者限定の広場の門 (communities.required_badges) も通れてしまう。
--   画面からバッジを入れている箇所は無く、付与は SECURITY DEFINER の関数と service_role だけ。
--   戻し方: create policy user_badges_insert_own on public.user_badges for insert with check (auth.uid() = user_id);
-- ============================================

drop policy if exists user_badges_insert_own on public.user_badges;

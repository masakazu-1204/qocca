-- ============================================
-- 2026/11/4 バッジ付与の関数を外から呼べないようにする
--   grant_badge_with_tier_replace は SECURITY DEFINER で本人確認が無く、anon / authenticated が実行できた。
--   ログインなしでも、誰にでも好きなバッジを付けられ、同じカテゴリの下位バッジを消せる状態だった。
--   呼び元は evaluate_*_badges (すべて SECURITY DEFINER / postgres) だけで、画面と Edge Function からの呼び出しは無い。
--   戻し方: grant execute on function public.grant_badge_with_tier_replace(uuid, text) to anon, authenticated;
-- ============================================

revoke execute on function public.grant_badge_with_tier_replace(uuid, text) from public, anon, authenticated;

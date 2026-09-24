-- 2026/9/25 友達紹介 (住民が住民を招く) — 適用済 (Supabase MCP apply_migration "friend_invite_rpcs")
--
--   招待リンク: https://www.qocca.pet/welcome/r/<code>  (code = 招く人の user id の先頭12桁・ハイフン無し)
--   着地は既存の広告用ページ (src/pages/welcome.tsx)。計測は既存の registration_sources.landing_path
--   (= /welcome/r/<code>) で足りるので、表も列も増やさない。
--   1) resolve_invite_code: 招待ページで「〇〇さんの紹介」を出すための逆引き (表示名とアバターだけ返す)
--   2) count_my_referrals: 自分の招待で登録した人数 (registration_sources は本人分しか読めないので definer で数える)
-- 戻し方: drop function public.resolve_invite_code(text); drop function public.count_my_referrals();

create or replace function public.resolve_invite_code(p_code text)
returns table (display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.display_name, p.avatar_url
    from profiles p
   where p_code ~ '^[0-9a-f]{12}$'
     and replace(p.id::text, '-', '') like p_code || '%'
   limit 1
$$;

create or replace function public.count_my_referrals()
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int
    from registration_sources r
   where auth.uid() is not null
     and r.landing_path = '/welcome/r/' || left(replace(auth.uid()::text, '-', ''), 12)
     and r.user_id <> auth.uid()
$$;

grant execute on function public.resolve_invite_code(text) to anon, authenticated;
grant execute on function public.count_my_referrals() to authenticated;

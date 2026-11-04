-- ============================================
-- 2026/11/4 称号「広場をひらいた人」
--   King「コミュニティの掲示板を作った人に称号を与えよう」。街を盛り上げてくれる人を見える形にする。
--   作成した瞬間に付く。運営 (role=admin) には付けない。掲示板が閉じても称号は残す。
--   既存の 2 人 (Tails Up さん・かわはるさん) にも付ける。
-- ============================================

insert into public.badges (id, category, tier, tier_order, name, description, requirement_type, requirement_count)
values ('community-founder', 'special', 'special', 8, '広場をひらいた人', 'コミュニティの掲示板をひらいた住民の証', 'community_create', 1)
on conflict (id) do nothing;

create or replace function public.grant_community_founder_title()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if NEW.creator_id is not null
     and not exists (select 1 from profiles where id = NEW.creator_id and role = 'admin') then
    insert into user_badges (user_id, badge_id)
    values (NEW.creator_id, 'community-founder')
    on conflict (user_id, badge_id) do nothing;
  end if;
  return NEW;
exception when others then
  -- 称号の失敗で掲示板の作成を止めない
  raise warning 'grant_community_founder_title failed: %', sqlerrm;
  return NEW;
end;
$function$;

drop trigger if exists trg_community_founder_title on public.communities;
create trigger trg_community_founder_title
  after insert on public.communities
  for each row execute function public.grant_community_founder_title();

insert into public.user_badges (user_id, badge_id)
select distinct c.creator_id, 'community-founder'
from public.communities c
join public.profiles p on p.id = c.creator_id
where coalesce(p.role, '') <> 'admin'
on conflict (user_id, badge_id) do nothing;

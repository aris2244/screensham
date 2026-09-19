-- Run in Supabase SQL Editor AFTER waitlist_emails table exists.
-- Referral = friend installed via your link AND finished onboarding.

-- ── Referrals (one row per successful referred install) ──
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_code text not null,
  referred_install_id text not null unique,
  new_user_code text not null,
  created_at timestamptz default now()
);

create index if not exists referrals_referrer_code_idx on referrals (referrer_code);

-- ── Pro grants for referrers (audit trail) ──
create table if not exists referral_pro_grants (
  id uuid primary key default gen_random_uuid(),
  referrer_code text not null,
  referred_install_id text not null,
  months int not null default 1,
  pro_until timestamptz not null,
  created_at timestamptz default now()
);

-- ── Current Pro status per referral code ──
create table if not exists referrer_pro_status (
  referral_code text primary key,
  pro_until timestamptz,
  successful_referrals int not null default 0,
  updated_at timestamptz default now()
);

alter table referrals enable row level security;
alter table referral_pro_grants enable row level security;
alter table referrer_pro_status enable row level security;

-- App can insert referrals + update status via RPC only (below).
-- No direct anon insert on referrals (RPC uses security definer).

-- ── Register referral (called when NEW user finishes onboarding) ──
create or replace function register_referral(
  p_referrer_code text,
  p_referred_install_id text,
  p_new_user_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_referrals constant int := 3;
  v_count int;
  v_current_until timestamptz;
  v_new_until timestamptz;
begin
  p_referrer_code := upper(trim(p_referrer_code));
  p_referred_install_id := trim(p_referred_install_id);
  p_new_user_code := upper(trim(p_new_user_code));

  if p_referrer_code = '' or p_referred_install_id = '' or p_new_user_code = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_fields');
  end if;

  if p_referrer_code = p_new_user_code then
    return jsonb_build_object('ok', false, 'error', 'self_referral');
  end if;

  if exists (select 1 from referrals where referred_install_id = p_referred_install_id) then
    return jsonb_build_object('ok', false, 'error', 'already_registered');
  end if;

  select count(*) into v_count from referrals where referrer_code = p_referrer_code;

  insert into referrals (referrer_code, referred_install_id, new_user_code)
  values (p_referrer_code, p_referred_install_id, p_new_user_code);

  if v_count >= v_max_referrals then
    return jsonb_build_object(
      'ok', true,
      'granted', false,
      'reason', 'referrer_cap_reached',
      'referrer_code', p_referrer_code
    );
  end if;

  select pro_until into v_current_until
  from referrer_pro_status
  where referral_code = p_referrer_code;

  v_new_until := greatest(
    coalesce(v_current_until, now()),
    now()
  ) + interval '1 month';

  insert into referral_pro_grants (referrer_code, referred_install_id, months, pro_until)
  values (p_referrer_code, p_referred_install_id, 1, v_new_until);

  insert into referrer_pro_status (referral_code, pro_until, successful_referrals, updated_at)
  values (p_referrer_code, v_new_until, 1, now())
  on conflict (referral_code) do update set
    pro_until = v_new_until,
    successful_referrals = referrer_pro_status.successful_referrals + 1,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'granted', true,
    'referrer_code', p_referrer_code,
    'pro_until', v_new_until
  );
end;
$$;

-- ── Sync Pro status (called when ANY user opens app) ──
create or replace function get_referrer_pro_status(p_referral_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row referrer_pro_status%rowtype;
begin
  p_referral_code := upper(trim(p_referral_code));

  select * into v_row from referrer_pro_status where referral_code = p_referral_code;

  if not found then
    return jsonb_build_object('ok', true, 'pro_until', null, 'successful_referrals', 0);
  end if;

  return jsonb_build_object(
    'ok', true,
    'pro_until', v_row.pro_until,
    'successful_referrals', v_row.successful_referrals
  );
end;
$$;

grant execute on function register_referral(text, text, text) to anon;
grant execute on function get_referrer_pro_status(text) to anon;

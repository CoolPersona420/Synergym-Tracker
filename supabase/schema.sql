-- Synergym database schema for Supabase.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
-- Safe to re-run: every statement is idempotent.
--
-- Security model: Row Level Security is on for every table. A user can only read and
-- write their own rows. Sharing a split goes through SECURITY DEFINER functions that
-- check ownership, so no user can list other users, their exercises or their sessions.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  unit          text not null default 'kg' check (unit in ('kg','lb')),
  weekly_target int  not null default 3  check (weekly_target between 1 and 7),
  rest_seconds  int  not null default 90 check (rest_seconds between 15 and 600),
  rest_enabled  boolean not null default true,
  rest_sound    boolean not null default true,
  bodyweight    numeric not null default 75 check (bodyweight between 30 and 300),
  display_name  text check (char_length(display_name) <= 40),
  experience    text check (experience in ('beginner','intermediate','advanced')),
  goal          text check (goal in ('strength','muscle','fitness','fat_loss')),
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now()
);
-- Columns added after the first release (no-ops on a fresh install).
alter table public.profiles add column if not exists display_name text check (char_length(display_name) <= 40);
alter table public.profiles add column if not exists experience text check (experience in ('beginner','intermediate','advanced'));
alter table public.profiles add column if not exists goal text check (goal in ('strength','muscle','fitness','fat_loss'));
alter table public.profiles add column if not exists onboarded boolean not null default false;
alter table public.profiles add column if not exists theme text check (char_length(theme) <= 30);
alter table public.profiles add column if not exists muscles jsonb check (muscles is null or (jsonb_typeof(muscles) = 'array' and jsonb_array_length(muscles) <= 40));
-- Home screen widgets, in order (ids from the app's widget catalog)
alter table public.profiles add column if not exists widgets jsonb check (widgets is null or (jsonb_typeof(widgets) = 'array' and jsonb_array_length(widgets) <= 20));
-- Days the user marked as rest from the Home screen ("YYYY-M-D", most recent kept)
alter table public.profiles add column if not exists rest_days jsonb check (rest_days is null or (jsonb_typeof(rest_days) = 'array' and jsonb_array_length(rest_days) <= 400));
-- The split day the user picked as their next session ({sp, i, at}); used until they start a session after "at"
alter table public.profiles add column if not exists next_day jsonb check (next_day is null or jsonb_typeof(next_day) = 'object');
-- One device per account: the auth session id of the newest sign-in. Other devices sign themselves out.
alter table public.profiles add column if not exists active_session uuid;
-- Bodyweight history: [{"d":"YYYY-MM-DD","kg":80.5}], one entry per day, most recent 400 kept
alter table public.profiles add column if not exists bw_log jsonb check (bw_log is null or (jsonb_typeof(bw_log) = 'array' and jsonb_array_length(bw_log) <= 400));
-- Deleted splits that sessions still point at: {"<split id>": {"name", "days": [{"type","rest","same"}], "at"}}, so history keeps their names
alter table public.profiles add column if not exists split_archive jsonb check (split_archive is null or (jsonb_typeof(split_archive) = 'object' and pg_column_size(split_archive) < 100000));
-- Account status: pending (signed up, waiting for an admin to approve), active, or deactivated by an admin.
-- Accounts that existed before approval was introduced are active. Only admins can change it (see profiles_status).
alter table public.profiles add column if not exists status text not null default 'active' check (status in ('pending','active','deactivated'));
alter table public.profiles add column if not exists status_at timestamptz;

-- The starter list every new account receives (copied per user, then theirs to edit).
create table if not exists public.default_exercises (
  name   text primary key,
  muscle text not null,
  kind   text not null check (kind in ('w','bw'))
);

create table if not exists public.exercises (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  muscle     text not null check (char_length(muscle) between 1 and 30),
  kind       text not null default 'w' check (kind in ('w','bw')),
  archived   boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists exercises_user_name_uq on public.exercises (user_id, lower(name));
-- The user's confirmed one-rep max, updated when they accept a new PR while logging.
alter table public.exercises add column if not exists one_rm numeric check (one_rm > 0 and one_rm < 2000);
alter table public.exercises add column if not exists one_rm_at timestamptz;

create table if not exists public.sessions (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text check (char_length(name) <= 80),
  started_at timestamptz not null,
  ended_at   timestamptz,
  notes      text not null default '' check (char_length(notes) <= 4000),
  items      jsonb not null default '[]'::jsonb
             check (jsonb_typeof(items) = 'array' and pg_column_size(items) < 200000),
  split_id   uuid,
  split_day  int,
  updated_at timestamptz not null default now()
);
create index if not exists sessions_user_started on public.sessions (user_id, started_at desc);

create table if not exists public.splits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 1000),
  days        jsonb not null default '[]'::jsonb
              check (jsonb_typeof(days) = 'array' and jsonb_array_length(days) <= 14 and pg_column_size(days) < 100000),
  share_token uuid unique,
  copied_from text check (char_length(copied_from) <= 40),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists splits_user on public.splits (user_id);
-- An account keeps at most 6 splits. Updating an existing split is always allowed.
create or replace function public.splits_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.splits where id = new.id)
     and (select count(*) from public.splits where user_id = new.user_id) >= 6 then
    raise exception 'A user can keep up to 6 splits' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists splits_limit on public.splits;
create trigger splits_limit before insert on public.splits for each row execute function public.splits_limit();

create table if not exists public.split_shares (
  split_id   uuid not null references public.splits(id) on delete cascade,
  from_user  uuid not null references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (split_id, to_user)
);
create index if not exists split_shares_to on public.split_shares (to_user);
create index if not exists split_shares_from_user_idx on public.split_shares (from_user);

-- ---------------------------------------------------------------- accounts: approval and admins
-- Who can use the admin console (/admin). Changed only through the admin functions below, or in SQL.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- App-wide settings: one row. require_approval: new accounts start as pending until an admin approves them.
create table if not exists public.app_settings (
  id               int primary key default 1 check (id = 1),
  require_approval boolean not null default true,
  updated_at       timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
-- Every admin action, kept for accountability. Emails are copied so the record survives a deleted account.
create table if not exists public.admin_log (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  admin_id     uuid,
  admin_email  text,
  action       text not null,
  target_id    uuid,
  target_email text,
  detail       text check (char_length(detail) <= 500)
);
create index if not exists admin_log_at on public.admin_log (at desc);
alter table public.admins       enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_log    enable row level security;
revoke all on public.admins, public.app_settings, public.admin_log from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
-- Only active accounts can read or write data (checked by every data table's policy below).
create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;
-- The status a new account starts with.
create or replace function public.signup_status() returns text
language sql stable security definer set search_path = public as $$
  select case when coalesce((select require_approval from public.app_settings where id = 1), false) then 'pending' else 'active' end;
$$;
revoke execute on function public.is_admin(), public.is_active(), public.signup_status() from public, anon;
grant execute on function public.is_admin(), public.is_active(), public.signup_status() to authenticated;

-- A new profile gets its status from the settings, whatever the insert says; after that only an admin
-- (or SQL run by the database owner) can change it. Runs as the caller, so current_user tells them apart.
create or replace function public.profiles_status() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := public.signup_status(); new.status_at := now();
  elsif new.status is distinct from old.status then
    if current_user in ('authenticated', 'anon') and not public.is_admin() then new.status := old.status;
    else new.status_at := now(); end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_status on public.profiles;
create trigger profiles_status before insert or update on public.profiles for each row execute function public.profiles_status();

-- ---------------------------------------------------------------- row level security

alter table public.profiles          enable row level security;
alter table public.default_exercises enable row level security;
alter table public.exercises         enable row level security;
alter table public.sessions          enable row level security;
alter table public.splits            enable row level security;
alter table public.split_shares      enable row level security;

-- (select auth.uid()) is evaluated once per query rather than once per row.
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists default_exercises_read on public.default_exercises;
create policy default_exercises_read on public.default_exercises for select to authenticated using (true);

drop policy if exists exercises_own on public.exercises;
create policy exercises_own on public.exercises for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active())) with check (user_id = (select auth.uid()) and (select public.is_active()));

drop policy if exists sessions_own on public.sessions;
create policy sessions_own on public.sessions for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active())) with check (user_id = (select auth.uid()) and (select public.is_active()));

drop policy if exists splits_own on public.splits;
create policy splits_own on public.splits for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active())) with check (user_id = (select auth.uid()) and (select public.is_active()));

-- Shares are created only through share_split(); either side may remove one.
drop policy if exists split_shares_read on public.split_shares;
create policy split_shares_read on public.split_shares for select to authenticated
  using ((from_user = (select auth.uid()) or to_user = (select auth.uid())) and (select public.is_active()));
drop policy if exists split_shares_delete on public.split_shares;
create policy split_shares_delete on public.split_shares for delete to authenticated
  using ((from_user = (select auth.uid()) or to_user = (select auth.uid())) and (select public.is_active()));

-- Anonymous visitors get nothing from the tables directly.
revoke all on public.profiles, public.exercises, public.sessions, public.splits, public.split_shares, public.default_exercises from anon;

-- ---------------------------------------------------------------- new users

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.exercises (user_id, name, muscle, kind, is_default)
    select new.id, d.name, d.muscle, d.kind, true from public.default_exercises d
    on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- functions

-- Put back any default exercises the user deleted, and unarchive archived defaults.
create or replace function public.restore_default_exercises()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or not public.is_active() then raise exception 'Sign in first'; end if;
  insert into public.exercises (user_id, name, muscle, kind, is_default)
    select auth.uid(), d.name, d.muscle, d.kind, true from public.default_exercises d
    where not exists (select 1 from public.exercises e where e.user_id = auth.uid() and lower(e.name) = lower(d.name));
  get diagnostics n = row_count;
  update public.exercises e set archived = false
    from public.default_exercises d
    where e.user_id = auth.uid() and lower(e.name) = lower(d.name) and e.archived;
  return n;
end $$;

-- Share one of your splits with another user by username.
create or replace function public.share_split(p_split uuid, p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare v_to uuid; v_name text := lower(btrim(coalesce(p_username, '')));
begin
  if auth.uid() is null or not public.is_active() then raise exception 'Sign in first'; end if;
  if left(v_name, 1) = '@' then v_name := substr(v_name, 2); end if;
  if not exists (select 1 from public.splits where id = p_split and user_id = auth.uid()) then
    raise exception 'Split not found';
  end if;
  if (select count(*) from public.split_shares where from_user = auth.uid() and created_at > now() - interval '1 day') >= 50 then
    raise exception 'You have shared 50 times today. Try again tomorrow.';
  end if;
  select id into v_to from public.profiles where username = v_name and status = 'active';
  if v_to is null then raise exception 'No user called @%', v_name; end if;
  if v_to = auth.uid() then raise exception 'That is your own username'; end if;
  insert into public.split_shares (split_id, from_user, to_user) values (p_split, auth.uid(), v_to)
    on conflict (split_id, to_user) do nothing;
  return v_name;
end $$;

create or replace function public.unshare_split(p_split uuid, p_username text)
returns void language sql security definer set search_path = public as $$
  delete from public.split_shares sh using public.profiles p
  where sh.split_id = p_split and sh.from_user = auth.uid() and sh.to_user = p.id and p.username = lower(btrim(p_username)) and public.is_active();
$$;

-- Who a split of mine is shared with.
create or replace function public.split_recipients(p_split uuid)
returns table (username text, shared_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.username, sh.created_at from public.split_shares sh join public.profiles p on p.id = sh.to_user
  where sh.split_id = p_split and sh.from_user = auth.uid() and public.is_active()
  order by sh.created_at;
$$;

-- Splits other users shared with me.
create or replace function public.shared_with_me()
returns table (split_id uuid, name text, description text, days jsonb, from_username text, shared_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description, s.days, p.username, sh.created_at, s.updated_at
  from public.split_shares sh
  join public.splits s on s.id = sh.split_id
  left join public.profiles p on p.id = sh.from_user
  where sh.to_user = auth.uid() and public.is_active() and coalesce(p.status, 'active') = 'active'
  order by sh.created_at desc;
$$;

-- A split published by link. The token is a random UUID the owner can revoke.
create or replace function public.get_public_split(p_token uuid)
returns table (name text, description text, days jsonb, owner_username text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.name, s.description, s.days, p.username, s.updated_at
  from public.splits s left join public.profiles p on p.id = s.user_id
  where s.share_token = p_token and p_token is not null and coalesce(p.status, 'active') = 'active';
$$;

-- Permanently delete the signed-in account and all of its data.
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.restore_default_exercises(), public.share_split(uuid, text), public.unshare_split(uuid, text),
  public.split_recipients(uuid), public.shared_with_me(), public.delete_account() from public, anon;
grant execute on function public.restore_default_exercises(), public.share_split(uuid, text), public.unshare_split(uuid, text),
  public.split_recipients(uuid), public.shared_with_me(), public.delete_account() to authenticated;
revoke execute on function public.get_public_split(uuid) from public;
grant execute on function public.get_public_split(uuid) to anon, authenticated;

-- Errors the app hit in someone's browser, so problems surface without the user reporting them.
-- Written only through report_error() (signed-in users, at most 30 an hour each); nobody can read it
-- through the API. Rows older than 30 days are cleared as new ones arrive.
create table if not exists public.client_errors (
  id      bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  at      timestamptz not null default now(),
  message text not null check (char_length(message) <= 500),
  stack   text check (char_length(stack) <= 4000),
  path    text check (char_length(path) <= 200),
  build   text check (char_length(build) <= 80),
  ua      text check (char_length(ua) <= 300)
);
create index if not exists client_errors_user_at on public.client_errors (user_id, at desc);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;

create or replace function public.report_error(p_message text, p_stack text, p_path text, p_build text, p_ua text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.client_errors where user_id = auth.uid() and at > now() - interval '1 hour') >= 30 then return; end if;
  insert into public.client_errors (user_id, message, stack, path, build, ua)
  values (auth.uid(), left(coalesce(p_message, ''), 500), left(p_stack, 4000), left(p_path, 200), left(p_build, 80), left(p_ua, 300));
  if random() < 0.02 then delete from public.client_errors where at < now() - interval '30 days'; end if;
end $$;

-- Replace all of the signed-in user's data with an export, in one transaction: if anything fails,
-- nothing changes. Runs as the caller, so row level security still applies to every statement.
-- The app gives every row a fresh id before sending. Username, onboarding and the active device are kept.
create or replace function public.import_replace(p jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if jsonb_typeof(p->'library') <> 'array' or jsonb_typeof(p->'sessions') <> 'array' or jsonb_typeof(p->'splits') <> 'array' then
    raise exception 'Invalid import';
  end if;
  if jsonb_array_length(p->'sessions') > 20000 or jsonb_array_length(p->'library') > 2000 or jsonb_array_length(p->'splits') > 200 then
    raise exception 'Import too large';
  end if;
  delete from public.sessions where user_id = uid;
  delete from public.splits where user_id = uid;
  delete from public.exercises where user_id = uid;
  insert into public.exercises (id, user_id, name, muscle, kind, archived, is_default, one_rm, one_rm_at)
    select x.id, uid, x.name, x.muscle, x.kind, coalesce(x.archived, false), coalesce(x.is_default, false), x.one_rm, x.one_rm_at
    from jsonb_to_recordset(p->'library') as x(id uuid, name text, muscle text, kind text, archived boolean, is_default boolean, one_rm numeric, one_rm_at timestamptz);
  insert into public.sessions (id, user_id, name, started_at, ended_at, notes, items, split_id, split_day)
    select x.id, uid, x.name, x.started_at, x.ended_at, coalesce(x.notes, ''), coalesce(x.items, '[]'), x.split_id, x.split_day
    from jsonb_to_recordset(p->'sessions') as x(id uuid, name text, started_at timestamptz, ended_at timestamptz, notes text, items jsonb, split_id uuid, split_day int);
  insert into public.splits (id, user_id, name, description, days, copied_from)
    select x.id, uid, x.name, coalesce(x.description, ''), coalesce(x.days, '[]'), x.copied_from
    from jsonb_to_recordset(p->'splits') as x(id uuid, name text, description text, days jsonb, copied_from text);
  if jsonb_typeof(p->'profile') = 'object' then
    update public.profiles t set
      unit = coalesce(r.unit, t.unit), weekly_target = coalesce(r.weekly_target, t.weekly_target),
      rest_seconds = coalesce(r.rest_seconds, t.rest_seconds), rest_enabled = coalesce(r.rest_enabled, t.rest_enabled),
      rest_sound = coalesce(r.rest_sound, t.rest_sound), bodyweight = coalesce(r.bodyweight, t.bodyweight),
      display_name = coalesce(r.display_name, t.display_name), experience = coalesce(r.experience, t.experience),
      goal = coalesce(r.goal, t.goal), theme = r.theme, muscles = r.muscles, widgets = r.widgets,
      rest_days = r.rest_days, next_day = r.next_day, bw_log = r.bw_log, split_archive = r.split_archive
    from jsonb_populate_record(null::public.profiles, p->'profile') r
    where t.id = uid;
  end if;
end $$;

revoke execute on function public.report_error(text, text, text, text, text), public.import_replace(jsonb) from public, anon;
grant execute on function public.report_error(text, text, text, text, text), public.import_replace(jsonb) to authenticated;

-- ---------------------------------------------------------------- workout reminders
-- The schedule and the shared secret are set up separately: see supabase/reminders-cron.sql.

-- Workout reminders: when and on which days (bit 0 = Monday … bit 6 = Sunday), in the user's time zone
alter table public.profiles add column if not exists reminder_on boolean not null default false;
alter table public.profiles add column if not exists reminder_time time not null default '18:00';
alter table public.profiles add column if not exists reminder_days smallint not null default 127 check (reminder_days between 0 and 127);
alter table public.profiles add column if not exists tz text check (char_length(tz) <= 64);
alter table public.profiles add column if not exists reminder_sent_on date;

-- A time zone the database doesn't know would break the reminder query for everyone, so it is dropped on write
create or replace function public.profiles_check_tz() returns trigger language plpgsql set search_path = public as $$
begin
  if new.tz is not null then
    begin perform now() at time zone new.tz; exception when others then new.tz := null; end;
  end if;
  return new;
end $$;
drop trigger if exists profiles_tz on public.profiles;
create trigger profiles_tz before insert or update of tz on public.profiles for each row execute function public.profiles_check_tz();

-- Where to deliver reminders: one row per device (a browser's push endpoint)
create table if not exists public.push_subscriptions (
  endpoint   text primary key check (char_length(endpoint) <= 1000),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active())) with check (user_id = (select auth.uid()) and (select public.is_active()));
revoke all on public.push_subscriptions from anon;

-- Save this device for the signed-in user. A device that was signed in as someone else is moved over.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_active() then raise exception 'Sign in first'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth);
end $$;

-- Called by the reminders function every few minutes with the shared secret (kept in Vault).
-- Returns the devices to remind now and marks those users as reminded for their local day. Users who
-- already trained today are marked but not reminded. The window is 45 minutes so a late run still sends.
create or replace function public.reminders_due(p_secret text)
returns table (endpoint text, p256dh text, auth text, title text, body text)
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or not exists (select 1 from vault.decrypted_secrets where name = 'reminder_secret' and decrypted_secret = p_secret) then
    raise exception 'forbidden';
  end if;
  return query
  with due as (
    select p.id, p.tz, coalesce(p.weekly_target, 3) as target, (now() at time zone p.tz) as lt
    from public.profiles p
    where p.reminder_on and p.tz is not null and p.status = 'active'
      and (p.reminder_days & (1 << (extract(isodow from now() at time zone p.tz)::int - 1))) <> 0
      and ((extract(epoch from (now() at time zone p.tz)::time) - extract(epoch from p.reminder_time))::int + 86400) % 86400 < 2700
      and (p.reminder_sent_on is null or p.reminder_sent_on < (now() at time zone p.tz)::date)
  ), marked as (
    update public.profiles t set reminder_sent_on = d.lt::date from due d where t.id = d.id
    returning t.id, d.tz, d.target, d.lt
  ), info as (
    select m.id, m.target,
      exists (select 1 from public.sessions s where s.user_id = m.id and (s.started_at at time zone m.tz)::date = m.lt::date) as trained,
      (select count(*) from public.sessions s where s.user_id = m.id and s.items <> '[]'::jsonb
         and (s.started_at at time zone m.tz) >= date_trunc('week', m.lt)) as wk
    from marked m
  )
  select ps.endpoint, ps.p256dh, ps.auth, 'Time to train'::text,
    case when i.wk = 0 then 'Start your week strong. Your first session is waiting.'
         when i.wk < i.target then i.wk || ' of ' || i.target || ' sessions done this week. Keep it going.'
         else 'Weekly target hit. Up for a bonus session?' end
  from info i join public.push_subscriptions ps on ps.user_id = i.id
  where not i.trained;
end $$;

-- Devices the push service says are gone (uninstalled, permission revoked)
create or replace function public.reminders_drop(p_secret text, p_endpoints text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or not exists (select 1 from vault.decrypted_secrets where name = 'reminder_secret' and decrypted_secret = p_secret) then
    raise exception 'forbidden';
  end if;
  delete from public.push_subscriptions where endpoint = any(p_endpoints);
end $$;

revoke execute on function public.save_push_subscription(text, text, text), public.reminders_due(text), public.reminders_drop(text, text[]) from public, anon, authenticated;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.reminders_due(text), public.reminders_drop(text, text[]) to anon;

-- ---------------------------------------------------------------- admin console
-- Everything the admin console (/admin) does goes through these functions. Each one checks that the caller
-- is an admin, and every change is written to admin_log. Admins see accounts and counts, not workouts.

-- This account's access: its status and whether it is an admin. The app checks it before loading anything.
create or replace function public.my_access() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', coalesce((select status from public.profiles where id = auth.uid()), 'active'), 'admin', public.is_admin());
$$;

create or replace function public.admin_guard() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  return auth.uid();
end $$;

create or replace function public.admin_note(p_action text, p_target uuid, p_detail text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_log (admin_id, admin_email, action, target_id, target_email, detail)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), p_action, p_target,
          (select email from auth.users where id = p_target), left(p_detail, 500));
end $$;

-- Numbers for the overview: accounts, activity, content, reminders and errors, plus 30 days of sign-ups and sessions.
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public.admin_guard();
  select jsonb_build_object(
    'users', (select jsonb_build_object('total', count(*), 'pending', count(*) filter (where status = 'pending'),
                'active', count(*) filter (where status = 'active'), 'deactivated', count(*) filter (where status = 'deactivated')) from public.profiles),
    'admins', (select count(*) from public.admins),
    'signups_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'signups_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_7d', (select count(distinct user_id) from public.sessions where started_at > now() - interval '7 days'),
    'active_30d', (select count(distinct user_id) from public.sessions where started_at > now() - interval '30 days'),
    'sessions_today', (select count(*) from public.sessions where started_at >= date_trunc('day', now())),
    'sessions_7d', (select count(*) from public.sessions where started_at > now() - interval '7 days'),
    'sessions_30d', (select count(*) from public.sessions where started_at > now() - interval '30 days'),
    'sessions_total', (select count(*) from public.sessions),
    'sets_30d', (select coalesce(sum((select count(*) from jsonb_array_elements(s.items) it, jsonb_array_elements(coalesce(it->'sets', '[]'::jsonb)) st
                   where jsonb_typeof(st->'r') = 'number' and (st->>'r')::numeric > 0)), 0)
                 from public.sessions s where s.started_at > now() - interval '30 days'),
    'splits', (select count(*) from public.splits),
    'shared_links', (select count(*) from public.splits where share_token is not null),
    'shares', (select count(*) from public.split_shares),
    'reminders_on', (select count(*) from public.profiles where reminder_on),
    'devices', (select count(*) from public.push_subscriptions),
    'errors_7d', (select count(*) from public.client_errors where at > now() - interval '7 days'),
    'require_approval', (select require_approval from public.app_settings where id = 1),
    'daily', (select jsonb_agg(jsonb_build_object('d', d::date,
                'signups', (select count(*) from auth.users u where u.created_at >= d and u.created_at < d + interval '1 day'),
                'sessions', (select count(*) from public.sessions x where x.started_at >= d and x.started_at < d + interval '1 day')) order by d)
              from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d)
  ) into r;
  return r;
end $$;

-- Accounts, newest first with pending ones on top. p_status: pending, active, deactivated, admin, or null for all.
create or replace function public.admin_users(p_search text default null, p_status text default null, p_limit int default 50, p_offset int default 0)
returns table (id uuid, email text, username text, display_name text, status text, is_admin boolean, created_at timestamptz,
               last_sign_in_at timestamptz, sessions bigint, last_session_at timestamptz, splits bigint, total bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare q text := '%' || replace(replace(replace(coalesce(btrim(p_search), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  perform public.admin_guard();
  return query
  select u.id, u.email::text, p.username, p.display_name, p.status, exists (select 1 from public.admins a where a.user_id = u.id),
    u.created_at, u.last_sign_in_at,
    (select count(*) from public.sessions x where x.user_id = u.id), (select max(x.started_at) from public.sessions x where x.user_id = u.id),
    (select count(*) from public.splits x where x.user_id = u.id), count(*) over ()
  from auth.users u join public.profiles p on p.id = u.id
  where (coalesce(p_status, '') = '' or p.status = p_status or (p_status = 'admin' and exists (select 1 from public.admins a where a.user_id = u.id)))
    and (coalesce(btrim(p_search), '') = '' or u.email ilike q or p.username ilike q or p.display_name ilike q)
  order by (p.status = 'pending') desc, u.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- One account in detail: profile, sign-in, counts, and the admin actions taken on it.
create or replace function public.admin_user(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public.admin_guard();
  select jsonb_build_object(
    'id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at, 'confirmed_at', u.email_confirmed_at,
    'banned', u.banned_until is not null and u.banned_until > now(),
    'username', p.username, 'display_name', p.display_name, 'status', p.status, 'status_at', p.status_at,
    'is_admin', exists (select 1 from public.admins a where a.user_id = u.id),
    'onboarded', p.onboarded, 'experience', p.experience, 'goal', p.goal, 'unit', p.unit, 'weekly_target', p.weekly_target, 'theme', p.theme,
    'reminder_on', p.reminder_on, 'tz', p.tz,
    'sessions', (select count(*) from public.sessions x where x.user_id = u.id),
    'sessions_30d', (select count(*) from public.sessions x where x.user_id = u.id and x.started_at > now() - interval '30 days'),
    'last_session_at', (select max(x.started_at) from public.sessions x where x.user_id = u.id),
    'splits', (select count(*) from public.splits x where x.user_id = u.id),
    'custom_exercises', (select count(*) from public.exercises x where x.user_id = u.id and not x.is_default),
    'devices', (select count(*) from public.push_subscriptions x where x.user_id = u.id),
    'errors_30d', (select count(*) from public.client_errors x where x.user_id = u.id and x.at > now() - interval '30 days'),
    'log', (select coalesce(jsonb_agg(jsonb_build_object('at', l.at, 'action', l.action, 'admin_email', l.admin_email, 'detail', l.detail) order by l.at desc), '[]'::jsonb)
            from (select * from public.admin_log where target_id = u.id order by at desc limit 20) l)
  ) into r
  from auth.users u join public.profiles p on p.id = u.id where u.id = p_id;
  if r is null then raise exception 'User not found'; end if;
  return r;
end $$;

-- Approve (pending to active), deactivate, or reactivate an account. Deactivating also blocks sign-in and
-- signs the account out everywhere; reactivating lifts the block. Not for your own account or other admins.
create or replace function public.admin_set_status(p_id uuid, p_status text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); cur text; act text;
begin
  if p_status not in ('active', 'deactivated') then raise exception 'Unknown status'; end if;
  if p_id = me then raise exception 'You can''t change your own account here'; end if;
  if exists (select 1 from public.admins where user_id = p_id) then raise exception 'Remove their admin access first'; end if;
  select status into cur from public.profiles where id = p_id;
  if cur is null then raise exception 'User not found'; end if;
  if cur = p_status then return cur; end if;
  update public.profiles set status = p_status where id = p_id;
  if p_status = 'deactivated' then
    update auth.users set banned_until = now() + interval '100 years' where id = p_id;
    delete from auth.sessions where user_id = p_id;
    act := 'deactivate';
  else
    update auth.users set banned_until = null where id = p_id;
    act := case when cur = 'pending' then 'approve' else 'reactivate' end;
  end if;
  perform public.admin_note(act, p_id, cur || ' → ' || p_status);
  return p_status;
end $$;

-- Sign an account out on every device (their open app signs out within the hour, when its session expires).
create or replace function public.admin_sign_out(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard();
begin
  if p_id = me then raise exception 'Use Log out for your own account'; end if;
  delete from auth.sessions where user_id = p_id;
  perform public.admin_note('sign_out', p_id, null);
end $$;

-- Delete an account and everything in it, permanently. Not your own account or another admin.
create or replace function public.admin_delete_user(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard();
begin
  if p_id = me then raise exception 'Delete your own account from Settings'; end if;
  if exists (select 1 from public.admins where user_id = p_id) then raise exception 'Remove their admin access first'; end if;
  if not exists (select 1 from auth.users where id = p_id) then raise exception 'User not found'; end if;
  perform public.admin_note('delete', p_id, (select coalesce('@' || username, 'no username') from public.profiles where id = p_id));
  delete from auth.users where id = p_id;
end $$;

-- Give or take admin access. Only active accounts can be admins, and you can't remove your own.
create or replace function public.admin_set_admin(p_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard();
begin
  if p_on then
    if not exists (select 1 from public.profiles where id = p_id and status = 'active') then raise exception 'Only active accounts can be admins'; end if;
    insert into public.admins (user_id) values (p_id) on conflict do nothing;
    perform public.admin_note('grant_admin', p_id, null);
  else
    if p_id = me then raise exception 'You can''t remove your own admin access'; end if;
    delete from public.admins where user_id = p_id;
    perform public.admin_note('revoke_admin', p_id, null);
  end if;
end $$;

create or replace function public.admin_settings(p_require_approval boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  update public.app_settings set require_approval = p_require_approval, updated_at = now() where id = 1;
  perform public.admin_note('settings', null, 'require approval: ' || case when p_require_approval then 'on' else 'off' end);
end $$;

-- Errors from people's browsers, grouped by message.
create or replace function public.admin_errors(p_days int default 7)
returns table (message text, n bigint, users bigint, last_at timestamptz, path text, build text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.admin_guard();
  return query
  select e.message, count(*), count(distinct e.user_id), max(e.at),
    (array_agg(e.path order by e.at desc))[1], (array_agg(e.build order by e.at desc))[1]
  from public.client_errors e where e.at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30))
  group by e.message order by max(e.at) desc limit 100;
end $$;

create or replace function public.admin_clear_errors() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  delete from public.client_errors;
  perform public.admin_note('clear_errors', null, null);
end $$;

create or replace function public.admin_log_list(p_limit int default 50, p_offset int default 0)
returns table (at timestamptz, admin_email text, action text, target_email text, detail text, total bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.admin_guard();
  return query
  select l.at, l.admin_email, l.action, l.target_email, l.detail, count(*) over ()
  from public.admin_log l order by l.at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end $$;

revoke execute on function public.admin_guard(), public.admin_note(text, uuid, text) from public, anon, authenticated;
revoke execute on function public.my_access(), public.admin_overview(), public.admin_users(text, text, int, int), public.admin_user(uuid),
  public.admin_set_status(uuid, text), public.admin_sign_out(uuid), public.admin_delete_user(uuid), public.admin_set_admin(uuid, boolean),
  public.admin_settings(boolean), public.admin_errors(int), public.admin_clear_errors(), public.admin_log_list(int, int) from public, anon;
grant execute on function public.my_access(), public.admin_overview(), public.admin_users(text, text, int, int), public.admin_user(uuid),
  public.admin_set_status(uuid, text), public.admin_sign_out(uuid), public.admin_delete_user(uuid), public.admin_set_admin(uuid, boolean),
  public.admin_settings(boolean), public.admin_errors(int), public.admin_clear_errors(), public.admin_log_list(int, int) to authenticated;

-- The first admin is set in SQL (replace the email with yours):
--   insert into public.admins (user_id) select id from auth.users where lower(email) = lower('you@example.com') on conflict do nothing;

-- ---------------------------------------------------------------- starter exercise list

insert into public.default_exercises (name, muscle, kind) values
 ('Bench Press','Chest','w'),('Incline Dumbbell Press','Chest','w'),('Dumbbell Fly','Chest','w'),('Chest Press Machine','Chest','w'),('Pec Deck','Chest','w'),('Push-up','Chest','bw'),
 ('Pull-up','Back','bw'),('Chin-up','Back','bw'),('Barbell Row','Back','w'),('T-Bar Row','Back','w'),('Lat Pulldown','Back','w'),('Seated Cable Row','Back','w'),('Deadlift','Back','w'),('Shrug','Back','w'),
 ('Overhead Press','Shoulders','w'),('Arnold Press','Shoulders','w'),('Lateral Raise','Shoulders','w'),('Rear Delt Fly','Shoulders','w'),('Face Pull','Shoulders','w'),
 ('Barbell Curl','Biceps','w'),('Hammer Curl','Biceps','w'),('Preacher Curl','Biceps','w'),
 ('Tricep Pushdown','Triceps','w'),('Skull Crusher','Triceps','w'),('Overhead Triceps Extension','Triceps','w'),('Dip','Triceps','bw'),
 ('Back Squat','Quads','w'),('Front Squat','Quads','w'),('Leg Press','Quads','w'),('Leg Extension','Quads','w'),('Bulgarian Split Squat','Quads','w'),('Goblet Squat','Quads','w'),('Walking Lunge','Quads','w'),
 ('Romanian Deadlift','Hamstrings','w'),('Leg Curl','Hamstrings','w'),('Hip Thrust','Glutes','w'),('Cable Kickback','Glutes','w'),
 ('Calf Raise','Calves','w'),('Hanging Leg Raise','Core','bw'),('Cable Crunch','Core','w'),('Ab Wheel Rollout','Core','bw'),('Kettlebell Swing','Full body','w'),('Clean and Press','Full body','w')
on conflict (name) do nothing;

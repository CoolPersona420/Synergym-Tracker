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

create table if not exists public.split_shares (
  split_id   uuid not null references public.splits(id) on delete cascade,
  from_user  uuid not null references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (split_id, to_user)
);
create index if not exists split_shares_to on public.split_shares (to_user);
create index if not exists split_shares_from_user_idx on public.split_shares (from_user);

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
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists sessions_own on public.sessions;
create policy sessions_own on public.sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists splits_own on public.splits;
create policy splits_own on public.splits for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Shares are created only through share_split(); either side may remove one.
drop policy if exists split_shares_read on public.split_shares;
create policy split_shares_read on public.split_shares for select to authenticated
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));
drop policy if exists split_shares_delete on public.split_shares;
create policy split_shares_delete on public.split_shares for delete to authenticated
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));

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
  if auth.uid() is null then raise exception 'Sign in first'; end if;
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
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if left(v_name, 1) = '@' then v_name := substr(v_name, 2); end if;
  if not exists (select 1 from public.splits where id = p_split and user_id = auth.uid()) then
    raise exception 'Split not found';
  end if;
  if (select count(*) from public.split_shares where from_user = auth.uid() and created_at > now() - interval '1 day') >= 50 then
    raise exception 'You have shared 50 times today. Try again tomorrow.';
  end if;
  select id into v_to from public.profiles where username = v_name;
  if v_to is null then raise exception 'No user called @%', v_name; end if;
  if v_to = auth.uid() then raise exception 'That is your own username'; end if;
  insert into public.split_shares (split_id, from_user, to_user) values (p_split, auth.uid(), v_to)
    on conflict (split_id, to_user) do nothing;
  return v_name;
end $$;

create or replace function public.unshare_split(p_split uuid, p_username text)
returns void language sql security definer set search_path = public as $$
  delete from public.split_shares sh using public.profiles p
  where sh.split_id = p_split and sh.from_user = auth.uid() and sh.to_user = p.id and p.username = lower(btrim(p_username));
$$;

-- Who a split of mine is shared with.
create or replace function public.split_recipients(p_split uuid)
returns table (username text, shared_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.username, sh.created_at from public.split_shares sh join public.profiles p on p.id = sh.to_user
  where sh.split_id = p_split and sh.from_user = auth.uid()
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
  where sh.to_user = auth.uid()
  order by sh.created_at desc;
$$;

-- A split published by link. The token is a random UUID the owner can revoke.
create or replace function public.get_public_split(p_token uuid)
returns table (name text, description text, days jsonb, owner_username text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.name, s.description, s.days, p.username, s.updated_at
  from public.splits s left join public.profiles p on p.id = s.user_id
  where s.share_token = p_token and p_token is not null;
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

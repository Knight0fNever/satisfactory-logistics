-- Base schema for a fresh fork of satisfactory-logistics.
-- Reconstructed from src/core/database.types.ts plus the RLS shape required
-- by the application code in src/games and src/solver/share.
--
-- Tables:
--   profiles, games, shared_games, shared_solvers
--
-- Functions:
--   handle_new_user (trigger helper to seed profiles)
--   can_user_access_game_id, has_user_shared_game_id, is_user_sharing_game_with
--   secure_token_for_game_id, share_token_matches_game_id
--
-- Legacy upstream tables `factories` and `factories_users` are intentionally
-- omitted: they are only referenced by the deprecated loadFromOldRemote()
-- code path and never written to by current builds.
--
-- This migration is numbered 0000 so it runs before 0001_game_presence,
-- 0002_game_versions, and 0003_snapshot_game_minimal_return, which depend
-- on public.games and public.shared_games existing.

------------------------------------------------------------------------
-- Extensions
------------------------------------------------------------------------

create extension if not exists pgcrypto;

------------------------------------------------------------------------
-- profiles: one row per auth.user, holding display info.
------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text,
  avatar_url  text
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all_authenticated" on public.profiles;
create policy "profiles_select_all_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a profile row for every new auth user, populating username +
-- avatar from the OAuth provider's metadata when available.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'user_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------------------
-- games: the primary cloud-saved object. JSON `data` blob holds the
-- serialized game (factories, solvers, settings, layout).
------------------------------------------------------------------------

create table if not exists public.games (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles(id) on delete cascade,
  name         text,
  data         jsonb,
  share_token  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists games_author_idx on public.games (author_id);

alter table public.games enable row level security;

------------------------------------------------------------------------
-- shared_games: collaborator membership.
------------------------------------------------------------------------

create table if not exists public.shared_games (
  id          bigint generated always as identity primary key,
  game_id     uuid not null references public.games(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (game_id, user_id)
);

create index if not exists shared_games_user_idx on public.shared_games (user_id);
create index if not exists shared_games_game_idx on public.shared_games (game_id);

alter table public.shared_games enable row level security;

------------------------------------------------------------------------
-- Helper functions used by RLS policies and by client code.
--
-- Marked SECURITY DEFINER so they can read across rows the caller would
-- not normally have RLS visibility into (e.g. checking shared_games
-- membership while evaluating a games policy).
------------------------------------------------------------------------

create or replace function public.has_user_shared_game_id(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.shared_games
    where game_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.can_user_access_game_id(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.games g
    where g.id = gid
      and (g.author_id = auth.uid() or public.has_user_shared_game_id(g.id))
  );
$$;

create or replace function public.is_user_sharing_game_with(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  -- True if the caller owns at least one game that `uid` is a member of.
  select exists (
    select 1
    from public.games g
    join public.shared_games s on s.game_id = g.id
    where g.author_id = auth.uid() and s.user_id = uid
  );
$$;

create or replace function public.secure_token_for_game_id(gid uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select share_token from public.games where id = gid;
$$;

-- Reads the share_token HTTP header set by the client via setHeader().
-- Returns true when it matches the game's stored share_token, allowing an
-- otherwise-unauthorized SELECT/INSERT.
create or replace function public.share_token_matches_game_id(
  gid uuid,
  token text
) returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  stored text;
begin
  select share_token into stored from public.games where id = gid;
  return stored is not null and stored = token;
end;
$$;

create or replace function public.current_share_token_header()
returns text
language sql
stable
as $$
  select nullif(
    current_setting('request.headers', true)::json->>'share_token',
    ''
  );
$$;

------------------------------------------------------------------------
-- RLS policies: games.
------------------------------------------------------------------------

drop policy if exists "games_select_visible" on public.games;
create policy "games_select_visible"
  on public.games for select
  using (
    author_id = auth.uid()
    or public.has_user_shared_game_id(id)
    or (
      share_token is not null
      and public.current_share_token_header() = share_token
    )
  );

drop policy if exists "games_insert_own" on public.games;
create policy "games_insert_own"
  on public.games for insert
  with check (author_id = auth.uid());

drop policy if exists "games_update_visible" on public.games;
create policy "games_update_visible"
  on public.games for update
  using (
    author_id = auth.uid()
    or public.has_user_shared_game_id(id)
  )
  with check (
    author_id = auth.uid()
    or public.has_user_shared_game_id(id)
  );

drop policy if exists "games_delete_own" on public.games;
create policy "games_delete_own"
  on public.games for delete
  using (author_id = auth.uid());

------------------------------------------------------------------------
-- RLS policies: shared_games.
--
-- Visibility: the game's author can see all rows for their game; a member
-- can see their own row.
-- INSERT: a user can add themselves to a game when they present a matching
-- share_token header (the public-link import flow).
-- DELETE: the game's author can remove members; a member can remove
-- themselves.
------------------------------------------------------------------------

drop policy if exists "shared_games_select" on public.shared_games;
create policy "shared_games_select"
  on public.shared_games for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.games g
      where g.id = shared_games.game_id and g.author_id = auth.uid()
    )
  );

drop policy if exists "shared_games_insert_self_with_token" on public.shared_games;
create policy "shared_games_insert_self_with_token"
  on public.shared_games for insert
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1 from public.games g
        where g.id = shared_games.game_id and g.author_id = auth.uid()
      )
      or public.share_token_matches_game_id(
        shared_games.game_id,
        public.current_share_token_header()
      )
    )
  );

drop policy if exists "shared_games_delete" on public.shared_games;
create policy "shared_games_delete"
  on public.shared_games for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.games g
      where g.id = shared_games.game_id and g.author_id = auth.uid()
    )
  );

------------------------------------------------------------------------
-- shared_solvers: standalone solver share links (separate from games).
------------------------------------------------------------------------

create table if not exists public.shared_solvers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  local_id    text not null default '',
  data        jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists shared_solvers_user_idx on public.shared_solvers (user_id);

alter table public.shared_solvers enable row level security;

-- Anyone with the link (i.e. who knows the id) can read; only the author
-- can write. The id is a uuid so it is functionally unguessable.
drop policy if exists "shared_solvers_select_all" on public.shared_solvers;
create policy "shared_solvers_select_all"
  on public.shared_solvers for select
  using (true);

drop policy if exists "shared_solvers_insert_own" on public.shared_solvers;
create policy "shared_solvers_insert_own"
  on public.shared_solvers for insert
  with check (user_id = auth.uid());

drop policy if exists "shared_solvers_update_own" on public.shared_solvers;
create policy "shared_solvers_update_own"
  on public.shared_solvers for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "shared_solvers_delete_own" on public.shared_solvers;
create policy "shared_solvers_delete_own"
  on public.shared_solvers for delete
  using (user_id = auth.uid());

------------------------------------------------------------------------
-- Realtime: opt the games table into realtime broadcasts so
-- useRealtimeGameSync receives change events on shared games.
------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
exception
  when undefined_object then
    -- supabase_realtime publication does not exist yet (e.g. local stack
    -- without realtime); ignore.
    null;
end $$;

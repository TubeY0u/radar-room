-- ===================================================================
-- Radar Room – Datenbank-Schema
-- Im Supabase-Dashboard unter "SQL Editor" einmal komplett ausführen.
-- ===================================================================

create table if not exists public.strats (
  id          uuid primary key,
  map         text        not null,
  side        text        not null check (side in ('T','CT')),
  name        text        not null default '',
  tags        jsonb       not null default '[]'::jsonb,
  players     jsonb       not null default '[]'::jsonb,
  steps       jsonb       not null default '[]'::jsonb,
  util        jsonb       not null default '[]'::jsonb,
  draw        jsonb       not null default '[]'::jsonb,
  notes       text        not null default '',
  created_at  bigint      not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at  bigint      not null default (extract(epoch from now()) * 1000)::bigint,
  updated_by  text        not null default ''
);

create index if not exists strats_map_side_idx on public.strats (map, side);

create table if not exists public.meta (
  id     int   primary key default 1,
  team   text  not null default 'Team',
  roster jsonb not null default '["","","","",""]'::jsonb,
  constraint meta_single_row check (id = 1)
);

insert into public.meta (id) values (1) on conflict (id) do nothing;

-- --- Zugriffsregeln: nur angemeldete Nutzer, dafür volle Rechte ------
alter table public.strats enable row level security;
alter table public.meta   enable row level security;

drop policy if exists "team liest strats"     on public.strats;
drop policy if exists "team schreibt strats"  on public.strats;
drop policy if exists "team liest meta"       on public.meta;
drop policy if exists "team schreibt meta"    on public.meta;

create policy "team liest strats"    on public.strats for select to authenticated using (true);
create policy "team schreibt strats" on public.strats for all    to authenticated using (true) with check (true);
create policy "team liest meta"      on public.meta   for select to authenticated using (true);
create policy "team schreibt meta"   on public.meta   for all    to authenticated using (true) with check (true);

-- --- Live-Sync einschalten ------------------------------------------
alter publication supabase_realtime add table public.strats;
alter publication supabase_realtime add table public.meta;

-- Damit Änderungen anderer sauber ankommen, auch beim Löschen:
alter table public.strats replica identity full;
alter table public.meta   replica identity full;

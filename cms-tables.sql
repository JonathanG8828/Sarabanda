-- ═══════════════════════════════════════════════════════
--  TABELLE CMS — Sarabanda
--  Supabase → SQL Editor → New Query → incolla → Run
--  Sicuro da rieseguire più volte (idempotente)
-- ═══════════════════════════════════════════════════════

-- ── 1. cms_settings: prezzi e testi modificabili ──
create table if not exists public.cms_settings (
  id bigint generated always as identity primary key,
  chiave text unique not null,
  valore text not null,
  categoria text not null default 'generale',
  updated_at timestamptz default now()
);
alter table public.cms_settings enable row level security;

drop policy if exists "Admin gestisce cms_settings" on public.cms_settings;
create policy "Admin gestisce cms_settings" on public.cms_settings for all
  using (auth.jwt() ->> 'email' = 'sarabandalivorno@gmail.com')
  with check (auth.jwt() ->> 'email' = 'sarabandalivorno@gmail.com');

drop policy if exists "Chiunque legge cms_settings" on public.cms_settings;
create policy "Chiunque legge cms_settings" on public.cms_settings for select using (true);


-- ── 2. chiusure: giorni di chiusura del centro ──
create table if not exists public.chiusure (
  id bigint generated always as identity primary key,
  data date unique not null,
  motivo text,
  created_at timestamptz default now()
);
alter table public.chiusure enable row level security;

drop policy if exists "Admin gestisce chiusure" on public.chiusure;
create policy "Admin gestisce chiusure" on public.chiusure for all
  using (auth.jwt() ->> 'email' = 'sarabandalivorno@gmail.com')
  with check (auth.jwt() ->> 'email' = 'sarabandalivorno@gmail.com');

drop policy if exists "Chiunque legge chiusure" on public.chiusure;
create policy "Chiunque legge chiusure" on public.chiusure for select using (true);


-- ── 3. pacchetti_compleanno: pacchetti feste ──
create table if not exists public.pacchetti_compleanno (
  id bigint generated always as identity primary key,
  nome text not null,
  prezzo numeric not null,
  dettaglio text,
  popolare boolean default false,
  attivo boolean default true,
  created_at timestamptz default now()
);
alter table public.pacchetti_compleanno enable row level security;

drop policy if exists "Admin gestisce pacchetti" on public.pacchetti_compleanno;
create policy "Admin gestisce pacchetti" on public.pacchetti_compleanno for all
  using (auth.jwt() ->> 'email' = 'sarabandalivorno@gmail.com')
  with check (auth.jwt() ->> 'email' = 'sarabandalivorno@gmail.com');

drop policy if exists "Chiunque legge pacchetti" on public.pacchetti_compleanno;
create policy "Chiunque legge pacchetti" on public.pacchetti_compleanno for select using (attivo = true);


-- ── 4. Dati iniziali: i pacchetti attuali ──
insert into public.pacchetti_compleanno (nome, prezzo, dettaglio, popolare)
select * from (values
  ('Solo stanza',                           100, 'Affitto sala',                                        false),
  ('Stanza + 1h animazione',                150, '2 animatrici',                                        false),
  ('Stanza + 1h animazione + truccabimbi',  190, '2 animatrici',                                        false),
  ('Stanza + buffet',                       200, 'Buffet per bambini e adulti',                         false),
  ('Stanza + 2h animazione + truccabimbi',  220, '3 animatrici',                                        true),
  ('Pacchetto completo',                    300, 'Buffet + 2h animazione + truccabimbi + 3 animatrici', false)
) as v(nome, prezzo, dettaglio, popolare)
where not exists (select 1 from public.pacchetti_compleanno);

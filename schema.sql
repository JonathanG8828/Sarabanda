-- TABELLA PROFILI GENITORI
create table public.profili (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  cognome text not null,
  email text not null,
  telefono text not null,
  created_at timestamp with time zone default now()
);

-- TABELLA BAMBINI
create table public.bambini (
  id uuid default gen_random_uuid() primary key,
  profilo_id uuid references public.profili(id) on delete cascade not null,
  nome text not null,
  created_at timestamp with time zone default now()
);

-- TABELLA PRENOTAZIONI
create table public.prenotazioni (
  id uuid default gen_random_uuid() primary key,
  profilo_id uuid references public.profili(id) on delete cascade not null,
  bambino_id uuid references public.bambini(id) on delete cascade not null,
  tipo_servizio text not null check (tipo_servizio in ('babyparking', 'compleanno')),
  pacchetto text not null,
  prezzo numeric(10,2) not null,
  data_prenotazione date not null,
  orario_uscita text,
  pagamento text not null default 'loco' check (pagamento in ('loco', 'online')),
  stato text not null default 'confermata' check (stato in ('confermata', 'in_attesa', 'annullata')),
  created_at timestamp with time zone default now()
);

-- ROW LEVEL SECURITY: ogni utente vede solo i propri dati
alter table public.profili enable row level security;
alter table public.bambini enable row level security;
alter table public.prenotazioni enable row level security;

create policy "Utente vede solo il proprio profilo"
  on public.profili for all using (auth.uid() = id);

create policy "Utente vede solo i propri bambini"
  on public.bambini for all using (auth.uid() = profilo_id);

create policy "Utente vede solo le proprie prenotazioni"
  on public.prenotazioni for all using (auth.uid() = profilo_id);

-- ═══════════════════════════════════════════════════════════
--  TABELLA FAQ — Domande frequenti Sarabanda
--  Supabase → SQL Editor → New Query → incolla → Run
--
--  Sicuro da eseguire sia la prima volta sia se avevi già
--  incollato la versione precedente: le vecchie domande
--  vengono sostituite da queste.
-- ═══════════════════════════════════════════════════════════

create table if not exists public.faq (
  id bigint generated always as identity primary key,
  domanda text not null,
  risposta text not null,
  ordine int not null default 0,
  attivo boolean not null default true,
  created_at timestamptz default now()
);

alter table public.faq enable row level security;

drop policy if exists "Admin gestisce faq" on public.faq;
create policy "Admin gestisce faq" on public.faq for all
  using (auth.jwt() ->> 'email' = 'sarabandalivorno@gmail.com')
  with check (auth.jwt() ->> 'email' = 'sarabandalivorno@gmail.com');

drop policy if exists "Chiunque legge faq" on public.faq;
create policy "Chiunque legge faq" on public.faq for select using (attivo = true);


-- ── Sostituisce le domande con quelle reali ──
delete from public.faq;

insert into public.faq (domanda, risposta, ordine) values

  ('Da che ora posso prenotare la stanza?',
   'Il sabato e la domenica dalle 10:00. Dal lunedì al venerdì dalle 16:00, perché nella fascia della mattina la struttura è occupata dal babyparking.',
   1),

  ('Da che età prendete i bambini?',
   'Dai 3 anni compiuti.',
   2),

  ('Che dimensioni ha il frigo?',
   'Il frigo misura 45 cm di larghezza e 36 cm di profondità, con vari ripiani. Ci sta una torta fino a 3 kg: se la tua è più grande, dicci qualcosa in anticipo e troviamo una soluzione.',
   3),

  ('Mio figlio ha allergie o intolleranze alimentari: è un problema?',
   'No, ma dobbiamo saperlo prima. Scrivilo nelle note della prenotazione o avvisaci su WhatsApp: prepariamo il buffet tenendone conto e facciamo attenzione durante la merenda.',
   4),

  ('Come si accende e si collega la cassa per la musica?',
   'Accendi la cassa e premi il tasto MODE finché non arrivi alla modalità Bluetooth: senti un suono di conferma. A quel punto prendi il telefono, apri il Bluetooth e cerca "ibizaport": collegala e la musica esce dalla cassa.',
   5);


-- ── Verifica ──
select ordine, domanda from public.faq order by ordine;

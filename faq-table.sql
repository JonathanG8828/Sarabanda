-- ═══════════════════════════════════════════════════════════
--  TABELLA FAQ — Domande frequenti
--  Supabase → SQL Editor → New Query → incolla → Run
--  Sicuro da rieseguire più volte (idempotente)
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


-- ── Domande di partenza (Sara può modificarle dal CMS) ──
insert into public.faq (domanda, risposta, ordine)
select * from (values
  ('Devo fare la tessera per iscrivere mio figlio?',
   'Sì. Il tesseramento è obbligatorio per il babyparking e per il centro estivo, perché Sarabanda è un''associazione culturale e i bambini vengono iscritti come soci. Costa 60€ per il primo figlio e 40€ per ogni figlio successivo, vale un anno e si paga una sola volta. Per le feste di compleanno non serve.',
   1),

  ('Quali sono gli orari del babyparking?',
   'Dal lunedì al venerdì, dalle 8:00 alle 16:00. Puoi scegliere l''uscita alle 12:30, alle 14:30 o alle 16:00: la tariffa cambia in base all''orario di uscita.',
   2),

  ('Come si paga?',
   'Puoi pagare in loco il giorno stesso, oppure con bonifico bancario sull''IBAN dell''associazione che trovi nella schermata di conferma. Se paghi in loco la prenotazione è confermata subito; con il bonifico resta "in attesa" finché non lo vediamo arrivare.',
   3),

  ('Posso annullare o spostare una prenotazione?',
   'Sì. Dalla sezione "Le mie prenotazioni" puoi annullare, oppure chiamaci al 334 725 0887 o scrivici su WhatsApp e troviamo insieme un''altra data. Per le feste di compleanno ti chiediamo di avvisarci con qualche giorno di anticipo, perché la sala e le animatrici vengono bloccate per te.',
   4),

  ('Cosa serve per prenotare una festa di compleanno?',
   'Scegli il pacchetto, la data e l''orario dall''app. Per bloccare la sala è prevista una caparra; il resto si paga il giorno della festa. Dicci quanti bambini saranno e se ci sono allergie o intolleranze, così organizziamo il buffet in sicurezza.',
   5),

  ('Mio figlio ha allergie o intolleranze alimentari: è un problema?',
   'No, ma dobbiamo saperlo prima. Scrivilo nelle note della prenotazione o avvisaci su WhatsApp: prepariamo il buffet tenendone conto e facciamo attenzione durante la merenda.',
   6),

  ('Da che età prendete i bambini?',
   'Chiamaci al 334 725 0887 e ne parliamo: valutiamo insieme in base all''età e alle esigenze del bambino.',
   7),

  ('Il centro estivo quando apre?',
   'Dal 10 giugno al 28 settembre, dal lunedì al venerdì. Le tariffe sono le stesse del babyparking e il tesseramento è obbligatorio anche qui.',
   8),

  ('Dove siete e come vi contatto?',
   'Siamo in Viale Ippolito Nievo 30, a Livorno. Telefono e WhatsApp: 334 725 0887. Ci trovi anche su Facebook come Sarabanda Associazione Culturale.',
   9)
) as v(domanda, risposta, ordine)
where not exists (select 1 from public.faq);


-- ── Verifica ──
select ordine, domanda from public.faq order by ordine;

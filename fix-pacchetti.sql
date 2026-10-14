-- ═══════════════════════════════════════════════════════════
--  CORREZIONE PACCHETTI COMPLEANNO
--  Supabase → SQL Editor → New Query → incolla → Run
--
--  I 6 pacchetti inseriti in precedenza avevano prezzi e nomi
--  sbagliati. Questo script li sostituisce con quelli reali.
-- ═══════════════════════════════════════════════════════════

-- 1. Rimuove le righe sbagliate
delete from public.pacchetti_compleanno;

-- 2. Inserisce i pacchetti reali (prezzi presi dall'app)
insert into public.pacchetti_compleanno (nome, prezzo, dettaglio, popolare, attivo) values
  ('Solo stanza',                     100, 'Affitto sala',                                        false, true),
  ('Stanza + 1h animazione',          150, '2 animatrici',                                        false, true),
  ('Stanza + 1h animazione + truccabimbi', 190, '2 animatrici',                                   false, true),
  ('Stanza + buffet',                 200, 'Buffet per bambini e adulti',                         false, true),
  ('Stanza + 2h animazione + truccabimbi', 220, '3 animatrici',                                   true,  true),
  ('Pacchetto completo',              300, 'Buffet + 2h animazione + truccabimbi + 3 animatrici', false, true);

-- 3. Verifica
select nome, prezzo, dettaglio, popolare from public.pacchetti_compleanno order by prezzo;

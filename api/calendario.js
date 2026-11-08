import { getAccessToken, calendarUrl } from './_google.js';

// ═══════════════════════════════════════════════════════════
//  GOOGLE CALENDAR — crea e cancella eventi dalle prenotazioni
//
//  Variabili d'ambiente richieste su Vercel:
//    GOOGLE_SA_EMAIL     email dell'account di servizio
//    GOOGLE_SA_KEY       chiave privata (campo private_key del JSON)
//    GOOGLE_CALENDAR_ID  id del calendario condiviso con l'account
//
//  Se mancano, l'endpoint non fa nulla e risponde ok: le
//  prenotazioni continuano a funzionare come prima.
// ═══════════════════════════════════════════════════════════

const TIMEZONE = 'Europe/Rome';

// L'id evento di Google accetta solo [a-v0-9]: l'uuid senza
// trattini e' gia' esadecimale, quindi va bene cosi' com'e'.
// Deterministico: serve per ritrovare l'evento e cancellarlo.
function eventId(prenotazioneId) {
  return String(prenotazioneId).replace(/-/g, '').toLowerCase();
}

function orarioDaPacchetto(pacchetto) {
  const m = String(pacchetto || '').match(/(\d{1,2}):(\d{2})/);
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
}

function costruisciEvento(d) {
  const inizio = orarioDaPacchetto(d.pacchetto);

  let oraInizio, oraFine;
  if (d.tipo_servizio === 'compleanno') {
    const h = inizio ? inizio.h : 16;
    const min = inizio ? inizio.m : 0;
    oraInizio = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
    oraFine = `${String(Math.min(h + 3, 23)).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
  } else {
    oraInizio = '08:00:00';
    oraFine = '16:00:00';
  }

  const titolo = d.tipo_servizio === 'compleanno'
    ? `🎂 Compleanno — ${d.nome_bambino}`
    : `🧒 Babyparking — ${d.nome_bambino}`;

  const statoLabel = d.stato === 'in_attesa' ? 'IN ATTESA DI PAGAMENTO' : 'Confermata';

  return {
    id: eventId(d.id),
    summary: titolo,
    description: [
      `Servizio: ${d.tipo_servizio === 'compleanno' ? 'Compleanno' : 'Babyparking'}`,
      `Bambino/a: ${d.nome_bambino}`,
      `Genitore: ${d.nome_genitore}`,
      `Telefono: ${d.telefono}`,
      `Pacchetto: ${d.pacchetto}`,
      `Prezzo: €${d.prezzo}`,
      `Pagamento: ${d.pagamento === 'loco' ? 'In loco' : 'Online / bonifico'}`,
      `Stato: ${statoLabel}`
    ].join('\n'),
    start: { dateTime: `${d.data_prenotazione}T${oraInizio}`, timeZone: TIMEZONE },
    end: { dateTime: `${d.data_prenotazione}T${oraFine}`, timeZone: TIMEZONE }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  // Non ancora configurato: non e' un errore, l'app va avanti.
  if (!process.env.GOOGLE_SA_EMAIL || !process.env.GOOGLE_SA_KEY || !calendarId) {
    return res.status(200).json({ ok: true, skipped: 'Google Calendar non configurato' });
  }

  const { azione, data } = req.body || {};

  if (!data || !data.id) {
    return res.status(400).json({ error: 'Dati prenotazione mancanti' });
  }

  try {
    const token = await getAccessToken();
    const base = calendarUrl(calendarId);
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // ── CANCELLAZIONE ──
    if (azione === 'annulla') {
      const r = await fetch(`${base}/${eventId(data.id)}`, { method: 'DELETE', headers: auth });
      // 410 = gia' cancellato, 404 = mai creato: nessuno dei due e' un problema.
      if (!r.ok && ![404, 410].includes(r.status)) {
        const err = await r.text();
        console.error('Calendar delete error:', err);
        return res.status(502).json({ error: 'Google non ha cancellato l\'evento' });
      }
      return res.status(200).json({ ok: true, azione: 'annulla' });
    }

    // ── CREAZIONE (o aggiornamento, se l'evento esiste gia') ──
    const evento = costruisciEvento(data);
    let r = await fetch(base, { method: 'POST', headers: auth, body: JSON.stringify(evento) });

    if (r.status === 409) {
      const { id, ...resto } = evento;
      r = await fetch(`${base}/${id}`, { method: 'PUT', headers: auth, body: JSON.stringify(resto) });
    }

    if (!r.ok) {
      const err = await r.text();
      console.error('Calendar insert error:', err);
      return res.status(502).json({ error: 'Google non ha creato l\'evento' });
    }

    return res.status(200).json({ ok: true, azione: 'crea' });
  } catch (err) {
    console.error('Calendar error:', err.message);
    return res.status(500).json({ error: 'Errore Google Calendar' });
  }
}

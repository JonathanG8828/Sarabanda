import { getAccessToken, calendarUrl } from './_google.js';

// ═══════════════════════════════════════════════════════════
//  CHIUSURE DA GOOGLE CALENDAR
//
//  Legge il calendario dei blocchi e restituisce l'elenco dei
//  giorni da rendere non prenotabili. Un evento, di qualsiasi
//  durata, chiude l'intera giornata.
//
//  Variabile d'ambiente:
//    GOOGLE_BLOCK_CALENDAR_ID  id del calendario dei blocchi
//
//  Deve essere un calendario DIVERSO da quello su cui l'app
//  scrive le prenotazioni, altrimenti ogni prenotazione
//  chiuderebbe la giornata a tutti gli altri clienti.
// ═══════════════════════════════════════════════════════════

const MESI_AVANTI = 12;

function isoGiorno(d) {
  return d.toISOString().split('T')[0];
}

// Un evento puo' durare piu' giorni: li elenca tutti.
// Negli eventi di un giorno intero Google mette in end.date il
// giorno DOPO la fine, quindi va escluso.
function giorniCoperti(evento) {
  const giorni = [];

  const inizioStr = evento.start?.date || evento.start?.dateTime;
  const fineStr = evento.end?.date || evento.end?.dateTime;
  if (!inizioStr) return giorni;

  const inizio = new Date(inizioStr.split('T')[0] + 'T12:00:00Z');
  let fine = fineStr ? new Date(fineStr.split('T')[0] + 'T12:00:00Z') : new Date(inizio);

  if (evento.start?.date) {
    fine.setUTCDate(fine.getUTCDate() - 1);
  }
  if (fine < inizio) fine = new Date(inizio);

  const cursore = new Date(inizio);
  let guardia = 0;
  while (cursore <= fine && guardia < 400) {
    giorni.push(isoGiorno(cursore));
    cursore.setUTCDate(cursore.getUTCDate() + 1);
    guardia++;
  }
  return giorni;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const calendarId = process.env.GOOGLE_BLOCK_CALENDAR_ID;

  // Non configurato: nessuna chiusura, l'app funziona come prima.
  if (!calendarId || !process.env.GOOGLE_SA_EMAIL) {
    return res.status(200).json({ chiusure: [], motivi: {} });
  }

  try {
    const token = await getAccessToken('https://www.googleapis.com/auth/calendar.readonly');

    const da = new Date();
    da.setHours(0, 0, 0, 0);
    const a = new Date(da);
    a.setMonth(a.getMonth() + MESI_AVANTI);

    const params = new URLSearchParams({
      timeMin: da.toISOString(),
      timeMax: a.toISOString(),
      singleEvents: 'true',        // espande gli eventi ricorrenti
      orderBy: 'startTime',
      maxResults: '2500'
    });

    const r = await fetch(`${calendarUrl(calendarId)}?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('Calendar read error:', err);
      // Meglio nessuna chiusura che un calendario bloccato:
      // le chiusure del CMS continuano comunque a valere.
      return res.status(200).json({ chiusure: [], motivi: {}, errore: true });
    }

    const body = await r.json();
    const chiusure = new Set();
    const motivi = {};

    for (const evento of body.items || []) {
      if (evento.status === 'cancelled') continue;
      // "Libero" in Google significa che l'impegno non occupa:
      // chi lo segna cosi' non intende bloccare le prenotazioni.
      if (evento.transparency === 'transparent') continue;

      for (const giorno of giorniCoperti(evento)) {
        chiusure.add(giorno);
        if (!motivi[giorno] && evento.summary) motivi[giorno] = evento.summary;
      }
    }

    // Cache breve: Sara blocca un giorno e lo vede subito,
    // ma non interroghiamo Google a ogni apertura del calendario.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ chiusure: [...chiusure].sort(), motivi });
  } catch (err) {
    console.error('Chiusure Google error:', err.message);
    return res.status(200).json({ chiusure: [], motivi: {}, errore: true });
  }
}

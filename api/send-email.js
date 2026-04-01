export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
 
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const { type, data } = req.body;
 
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY non configurata' });
  }
 
  let emails = [];
 
  // ── EMAIL DI BENVENUTO ──
  if (type === 'benvenuto') {
    emails.push({
      from: 'Sarabanda Livorno <info@sarabandalivorno.it>',
      to: data.email,
      subject: 'Benvenuto in Sarabanda! 🎉',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
          <div style="background: #1A3D2E; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; letter-spacing: 3px; margin: 0;">SARABANDA</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">Babyparking & Compleanni · Livorno</p>
          </div>
          <div style="background: #f9f9f7; padding: 32px 24px; border-radius: 0 0 12px 12px; border: 1px solid #e8e8e4; border-top: none;">
            <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 16px;">Ciao ${data.nome}! 👋</h2>
            <p style="color: #555; line-height: 1.6; margin: 0 0 16px;">
              Benvenuto in Sarabanda! Il tuo account è stato creato con successo.
            </p>
            <div style="background: #E1F5EE; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
              <p style="margin: 0; color: #0F6E56; font-size: 14px;"><strong>I tuoi dati:</strong></p>
              <p style="margin: 8px 0 0; color: #0F6E56; font-size: 14px;">Nome: ${data.nome} ${data.cognome}</p>
              <p style="margin: 4px 0 0; color: #0F6E56; font-size: 14px;">Email: ${data.email}</p>
              <p style="margin: 4px 0 0; color: #0F6E56; font-size: 14px;">Telefono: ${data.telefono}</p>
            </div>
            <p style="color: #555; line-height: 1.6; margin: 0 0 24px;">
              Ora puoi prenotare il babyparking o la stanza per il compleanno direttamente dall'app.
            </p>
            <div style="text-align: center;">
              <a href="https://sarabandalivorno.it" style="background: #1A3D2E; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Apri l'app</a>
            </div>
            <p style="color: #999; font-size: 12px; margin: 32px 0 0; text-align: center;">
              Sarabanda · Viale Ippolito Nievo 30, Livorno · Tel. 334 725 0887 · info@sarabandalivorno.it
            </p>
          </div>
        </div>
      `
    });
  }
 
  // ── EMAIL CONFERMA PRENOTAZIONE (al cliente) ──
  if (type === 'prenotazione') {
    const dataFmt = new Date(data.data_prenotazione + 'T12:00:00').toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
 
    emails.push({
      from: 'Sarabanda Livorno <info@sarabandalivorno.it>',
      to: data.email,
      subject: `Prenotazione confermata — ${data.tipo_servizio === 'babyparking' ? 'Babyparking' : 'Compleanno'} per ${data.nome_bambino}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
          <div style="background: #1A3D2E; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; letter-spacing: 3px; margin: 0;">SARABANDA</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">Babyparking & Compleanni · Livorno</p>
          </div>
          <div style="background: #f9f9f7; padding: 32px 24px; border-radius: 0 0 12px 12px; border: 1px solid #e8e8e4; border-top: none;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: #E1F5EE; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px;">✓</div>
            </div>
            <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 8px; text-align: center;">Prenotazione confermata!</h2>
            <p style="color: #777; text-align: center; margin: 0 0 24px; font-size: 14px;">Ciao ${data.nome_genitore}, ecco il riepilogo</p>
 
            <div style="background: #fff; border: 1px solid #e8e8e4; border-radius: 10px; overflow: hidden; margin-bottom: 24px;">
              <div style="background: #1A3D2E; padding: 12px 16px;">
                <p style="color: #fff; margin: 0; font-weight: 600; font-size: 14px;">
                  ${data.tipo_servizio === 'babyparking' ? '🧒 Babyparking' : '🎂 Compleanno'}
                </p>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 12px 16px; color: #888;">Bambino/a</td>
                  <td style="padding: 12px 16px; color: #1a1a1a; text-align: right; font-weight: 500;">${data.nome_bambino}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 12px 16px; color: #888;">Data</td>
                  <td style="padding: 12px 16px; color: #1a1a1a; text-align: right; font-weight: 500;">${dataFmt}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 12px 16px; color: #888;">Pacchetto</td>
                  <td style="padding: 12px 16px; color: #1a1a1a; text-align: right; font-weight: 500;">${data.pacchetto}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 12px 16px; color: #888;">Pagamento</td>
                  <td style="padding: 12px 16px; color: #1a1a1a; text-align: right; font-weight: 500;">${data.pagamento === 'loco' ? 'In loco all\'arrivo' : 'Online'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; color: #888; font-weight: 600;">Totale</td>
                  <td style="padding: 12px 16px; color: #1A3D2E; text-align: right; font-weight: 700; font-size: 16px;">€${data.prezzo}</td>
                </tr>
              </table>
            </div>
 
            <p style="color: #555; line-height: 1.6; font-size: 14px; margin: 0 0 24px;">
              Per qualsiasi informazione o modifica, rispondi a questa email o contattaci su WhatsApp.
            </p>
            <div style="text-align: center;">
              <a href="https://sarabandalivorno.it" style="background: #1A3D2E; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Gestisci prenotazione</a>
            </div>
            <p style="color: #999; font-size: 12px; margin: 32px 0 0; text-align: center;">
              Sarabanda · Viale Ippolito Nievo 30, Livorno · Tel. 334 725 0887 · info@sarabandalivorno.it
            </p>
          </div>
        </div>
      `
    });
 
    // ── NOTIFICA INTERNA ──
    emails.push({
      from: 'Sarabanda App <info@sarabandalivorno.it>',
      to: 'info@sarabandalivorno.it',
      subject: `🔔 Nuova prenotazione — ${data.tipo_servizio === 'babyparking' ? 'Babyparking' : 'Compleanno'} per ${data.nome_bambino}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="color: #1A3D2E; margin: 0 0 24px;">🔔 Nuova prenotazione ricevuta</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; border: 1px solid #e8e8e4; border-radius: 10px; overflow: hidden;">
            <tr style="background: #1A3D2E;">
              <td colspan="2" style="padding: 12px 16px; color: #fff; font-weight: 600;">Dettagli prenotazione</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 16px; color: #888; background: #fafafa;">Servizio</td>
              <td style="padding: 10px 16px; font-weight: 500;">${data.tipo_servizio === 'babyparking' ? 'Babyparking' : 'Compleanno'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 16px; color: #888; background: #fafafa;">Genitore</td>
              <td style="padding: 10px 16px; font-weight: 500;">${data.nome_genitore}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 16px; color: #888; background: #fafafa;">Email</td>
              <td style="padding: 10px 16px;">${data.email}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 16px; color: #888; background: #fafafa;">Telefono</td>
              <td style="padding: 10px 16px;">${data.telefono}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 16px; color: #888; background: #fafafa;">Bambino/a</td>
              <td style="padding: 10px 16px; font-weight: 500;">${data.nome_bambino}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 16px; color: #888; background: #fafafa;">Data</td>
              <td style="padding: 10px 16px; font-weight: 500;">${dataFmt}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 16px; color: #888; background: #fafafa;">Pacchetto</td>
              <td style="padding: 10px 16px;">${data.pacchetto}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 16px; color: #888; background: #fafafa;">Pagamento</td>
              <td style="padding: 10px 16px;">${data.pagamento === 'loco' ? 'In loco' : 'Online'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; color: #888; background: #fafafa; font-weight: 600;">Totale</td>
              <td style="padding: 10px 16px; color: #1A3D2E; font-weight: 700; font-size: 16px;">€${data.prezzo}</td>
            </tr>
          </table>
        </div>
      `
    });
  }
 
  // ── INVIA TUTTE LE EMAIL ──
  try {
    for (const email of emails) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(email)
      });
      if (!response.ok) {
        const err = await response.text();
        console.error('Resend error:', err);
      }
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email error:', err);
    return res.status(500).json({ error: 'Errore invio email' });
  }
}

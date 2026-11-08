import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════
//  Autenticazione Google condivisa fra gli endpoint.
//  Il nome inizia con _ quindi Vercel non lo espone come rotta.
// ═══════════════════════════════════════════════════════════

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Scambia un JWT firmato con la chiave privata per un access token.
export async function getAccessToken(scope = 'https://www.googleapis.com/auth/calendar') {
  const email = process.env.GOOGLE_SA_EMAIL;
  const rawKey = process.env.GOOGLE_SA_KEY;
  if (!email || !rawKey) throw new Error('Credenziali Google mancanti');

  // Vercel salva gli a capo come \n letterali.
  const privateKey = rawKey.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const signature = signer.sign(privateKey, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${signature}`
    })
  });

  const body = await r.json();
  if (!r.ok) throw new Error('Token Google rifiutato: ' + JSON.stringify(body));
  return body.access_token;
}

export function calendarUrl(calendarId, path = '') {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${path}`;
}

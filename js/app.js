// ═══════════════════════════════════════════
//  CONFIGURAZIONE SUPABASE
// ═══════════════════════════════════════════
const SUPABASE_URL = 'https://rnqgoefwyimemkowoknu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DNPzkYyrV0dZ96Jxu0Qwsg_48XfoCDE';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ═══════════════════════════════════════════
//  COSTANTI
// ═══════════════════════════════════════════
const ADMIN_EMAIL = 'sarabandalivorno@gmail.com';

// ═══════════════════════════════════════════
//  STATO APPLICAZIONE
// ═══════════════════════════════════════════
let currentUser = null;
let currentProfile = null;
let currentBambini = [];
let selectedTariffName = '';
let selectedTariffPrice = 0;
let selectedPaymentType = 'loco';
let adminAllBookings = []; // cache prenotazioni admin
let tesseraScelta = 'ora'; // 'ora' o 'dopo'
let tesseraPagamento = 'loco'; // 'loco' o 'online'
let bambinoCount = 1;

// ═══════════════════════════════════════════
//  INIZIALIZZAZIONE
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadUserData();
    showApp('home');
    showWrapper('app');
  } else {
    showWrapper('auth');
    showAuthScreen('landing');
  }

  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      await loadUserData();
      showApp('home');
      showWrapper('app');
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      currentBambini = [];
      adminAllBookings = [];
      showWrapper('auth');
    }
  });
});

// ═══════════════════════════════════════════
//  WRAPPER VISIBILITY
// ═══════════════════════════════════════════
function showWrapper(type) {
  document.getElementById('auth-wrapper').style.display = type === 'auth' ? 'flex' : 'none';
  document.getElementById('app-wrapper').style.display = type === 'app' ? 'block' : 'none';
}

// ═══════════════════════════════════════════
//  AUTH SCREENS
// ═══════════════════════════════════════════
function showAuthScreen(name) {
  document.querySelectorAll('.auth-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

// ═══════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.remove('visible');

  if (!email || !password) {
    showError(errEl, 'Inserisci email e password.');
    return;
  }

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    showError(errEl, 'Email o password errati. Riprova.');
  }
}

// ═══════════════════════════════════════════
//  REGISTRAZIONE
// ═══════════════════════════════════════════
async function handleRegister() {
  const nome = document.getElementById('reg-nome').value.trim();
  const cognome = document.getElementById('reg-cognome').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const telefono = document.getElementById('reg-telefono').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('register-error');
  errEl.classList.remove('visible');

  if (!nome || !cognome || !email || !telefono || !password) {
    showError(errEl, 'Compila tutti i campi.');
    return;
  }
  const primoNomeBambino = document.querySelector('.bambino-nome')?.value.trim();
  if (!primoNomeBambino) {
    showError(errEl, 'Inserisci almeno il nome di un bambino/a.');
    return;
  }
  if (password.length < 6) {
    showError(errEl, 'La password deve essere di almeno 6 caratteri.');
    return;
  }

  const { data, error } = await db.auth.signUp({ email, password });
  if (error) {
    showError(errEl, 'Errore durante la registrazione: ' + error.message);
    return;
  }

  const userId = data.user.id;

  const serviziInteresse = [];
  if (document.getElementById('svc-babyparking')?.checked) serviziInteresse.push('babyparking');
  if (document.getElementById('svc-compleanno')?.checked) serviziInteresse.push('compleanno');
  if (document.getElementById('svc-centroestivo')?.checked) serviziInteresse.push('centro_estivo');

  const { error: profErr } = await db.from('profili').insert({
    id: userId, nome, cognome, email, telefono,
    servizi_interesse: serviziInteresse
  });
  if (profErr) { showError(errEl, 'Errore nel salvataggio profilo.'); return; }

  // Crea bambini e tessere
  const bambinoRows = document.querySelectorAll('.bambino-row');
  const bambiniCreati = [];
  let idx = 0;
  for (const row of bambinoRows) {
    const nomeBambino = row.querySelector('.bambino-nome')?.value.trim();
    if (!nomeBambino) continue;
    const cognomeBambino = row.querySelector('.bambino-cognome')?.value.trim() || null;
    const dataNascita = row.querySelector('.bambino-nascita')?.value || null;
    const luogoNascita = row.querySelector('.bambino-luogo')?.value.trim() || null;
    const indirizzo = row.querySelector('.bambino-indirizzo')?.value.trim() || null;
    const codiceFiscale = row.querySelector('.bambino-cf')?.value.trim() || null;

    const { data: bamData, error: bamErr } = await db.from('bambini').insert({
      profilo_id: userId,
      nome: nomeBambino,
      cognome: cognomeBambino,
      data_nascita: dataNascita,
      luogo_nascita: luogoNascita,
      indirizzo,
      codice_fiscale: codiceFiscale
    }).select().single();
    if (bamErr) { showError(errEl, 'Errore nel salvataggio bambino.'); return; }

    // Crea tessera se il genitore sceglie di tesserare ora
    if (tesseraScelta === 'ora') {
      const importo = idx === 0 ? 60 : 40;
      await db.from('tessere').insert({
        profilo_id: userId,
        bambino_id: bamData.id,
        importo,
        pagamento: tesseraPagamento,
        stato: 'in_attesa',
        anno: new Date().getFullYear()
      });
      bambiniCreati.push({ nome: nomeBambino, importo });
    }
    idx++;
  }

  // Email benvenuto + tessere
  const totaleTessere = bambiniCreati.reduce((s, b) => s + b.importo, 0);
  await sendEmail('benvenuto', {
    nome, cognome, email, telefono,
    tessere: bambiniCreati,
    totaleTessere,
    tesseraPagamento: tesseraScelta === 'ora' ? tesseraPagamento : null
  });
}

// ═══════════════════════════════════════════
//  LOGOUT
// ═══════════════════════════════════════════
async function handleLogout() {
  await db.auth.signOut();
  currentUser = null;
  currentProfile = null;
  currentBambini = [];
  adminAllBookings = [];
  showWrapper('auth');
  showAuthScreen('login');
}

// ═══════════════════════════════════════════
//  CARICA DATI UTENTE
// ═══════════════════════════════════════════
async function loadUserData() {
  const { data: profile } = await db.from('profili').select('*').eq('id', currentUser.id).single();
  currentProfile = profile;

  const { data: bambini } = await db.from('bambini').select('*').eq('profilo_id', currentUser.id);
  currentBambini = bambini || [];

  // Aggiorna UI profilo
  if (profile) {
    const nomeCompleto = `${profile.nome} ${profile.cognome}`;
    document.getElementById('greeting-name').textContent = `Ciao, ${profile.nome}!`;
    document.getElementById('profilo-nome').textContent = nomeCompleto;
    document.getElementById('profilo-email').textContent = profile.email;
    document.getElementById('profilo-tel').textContent = profile.telefono;
    document.getElementById('profilo-avatar').textContent = (profile.nome[0] + profile.cognome[0]).toUpperCase();
    document.getElementById('profilo-bambini').textContent = currentBambini.map(b => b.nome).join(', ') || '—';
  }

  // Mostra pulsante admin se è l'admin
  const isAdmin = (currentUser.email === ADMIN_EMAIL) || (currentUser.user_metadata?.email === ADMIN_EMAIL) || (profile?.email === ADMIN_EMAIL);
  const adminBtn = document.getElementById('admin-btn-wrapper');
  if (adminBtn) adminBtn.style.display = isAdmin ? 'block' : 'none';
}

// ═══════════════════════════════════════════
//  NAVIGAZIONE APP
// ═══════════════════════════════════════════
function showApp(screenName) {
  document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + screenName).classList.add('active');

  if (screenName === 'home') loadHomeBookings();
  if (screenName === 'prenotazioni') { loadPrenotazioni(); loadPagamentiSospeso(); }
  if (screenName === 'admin') {
    // Solo l'admin può accedere
    if (currentUser?.email !== ADMIN_EMAIL) {
      showApp('home');
      return;
    }
    loadAdminBookings();
  }
}

// ═══════════════════════════════════════════
//  TARIFFE
// ═══════════════════════════════════════════
function selectTariff(el, name, price) {
  const container = el.closest('.content');
  if (container) container.querySelectorAll('.tariff-row').forEach(r => r.classList.remove('selected'));
  el.classList.add('selected');
  selectedTariffName = name;
  selectedTariffPrice = price;
}

function switchBpTab(el, tabId) {
  el.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['giornaliero','settimanale','mensile','ore'].forEach(id => {
    document.getElementById('bp-' + id).style.display = id === tabId ? 'block' : 'none';
  });
}

function switchCeTab(el, tabId) {
  el.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['giornaliero','settimanale','mensile','ore'].forEach(id => {
    document.getElementById('ce-' + id).style.display = id === tabId ? 'block' : 'none';
  });
}

// ═══════════════════════════════════════════
//  CALENDARIO
// ═══════════════════════════════════════════
let calYear = 0;
let calMonth = 0;
let calTipoServizio = '';
let calDateOccupate = [];
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

async function goToConferma(tipo) {
  if (!selectedTariffName) {
    alert('Seleziona prima un pacchetto.');
    return;
  }

  calTipoServizio = tipo;
  document.getElementById('conf-servizio').textContent = selectedTariffName;
  document.getElementById('conf-prezzo').textContent = '€' + selectedTariffPrice;
  document.getElementById('conf-data').value = '';
  document.getElementById('conf-orario').value = '';

  // Mostra/nascondi slot orari (solo compleanni)
  document.getElementById('orario-wrapper').style.display = tipo === 'compleanno' ? 'block' : 'none';

  // Popola select bambini
  const sel = document.getElementById('conf-bambino');
  sel.innerHTML = '<option value="">Seleziona bambino/a...</option>';
  currentBambini.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.nome;
    sel.appendChild(opt);
  });

  // Back button
  document.getElementById('conferma-back-btn').onclick = () => showApp(tipo === 'babyparking' ? 'babyparking' : 'compleanni');

  selectPayment('loco');
  document.getElementById('conferma-error').classList.remove('visible');

  // Carica date occupate e inizializza calendario
  await caricaDateOccupate(tipo);
  const oggi = new Date();
  calYear = oggi.getFullYear();
  calMonth = oggi.getMonth();
  renderCalendario();

  showApp('conferma');
}

async function caricaDateOccupate(tipo) {
  if (tipo === 'centro_estivo') {
    calDateOccupate = [];
    return;
  }
  const { data } = await db
    .from('prenotazioni')
    .select('data_prenotazione')
    .eq('tipo_servizio', tipo)
    .neq('stato', 'annullata');
  calDateOccupate = (data || []).map(p => p.data_prenotazione);
}

function calPrevMonth() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendario();
}

function calNextMonth() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendario();
}

function renderCalendario() {
  document.getElementById('cal-month-label').textContent = `${MESI[calMonth]} ${calYear}`;
  const grid = document.getElementById('cal-giorni');
  grid.innerHTML = '';

  const oggi = new Date();
  oggi.setHours(0,0,0,0);
  const primoGiorno = new Date(calYear, calMonth, 1);
  const ultimoGiorno = new Date(calYear, calMonth + 1, 0);

  // Offset lunedì=0
  let offset = primoGiorno.getDay() - 1;
  if (offset < 0) offset = 6;

  // Celle vuote
  for (let i = 0; i < offset; i++) {
    const div = document.createElement('div');
    div.className = 'cal-cell cal-empty';
    grid.appendChild(div);
  }

  for (let d = 1; d <= ultimoGiorno.getDate(); d++) {
    const data = new Date(calYear, calMonth, d);
    const dataStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = data.getDay(); // 0=dom, 1=lun, ..., 6=sab
    const isToday = data.getTime() === oggi.getTime();
    const isPast = data < oggi;

    let stato = 'available';

    if (isPast) {
      stato = 'past';
    } else if (calTipoServizio === 'babyparking') {
      if (dow === 0 || dow === 6) stato = 'closed';
    } else {
      if (calDateOccupate.includes(dataStr)) stato = 'busy';
    }

    const div = document.createElement('div');
    div.textContent = d;
    div.className = 'cal-cell';

    if (stato === 'past') div.classList.add('cal-past');
    else if (stato === 'closed') div.classList.add('cal-closed');
    else if (stato === 'busy') div.classList.add('cal-busy');
    else {
      div.classList.add('cal-available');
      if (isToday) div.classList.add('cal-today');
      div.onclick = () => selezionaData(div, dataStr, dow);
    }

    grid.appendChild(div);
  }
}

function selezionaData(el, dataStr, dow) {
  document.querySelectorAll('#cal-giorni .cal-selected').forEach(d => {
    d.classList.remove('cal-selected');
  });
  el.classList.add('cal-selected');
  document.getElementById('conf-data').value = dataStr;
  document.getElementById('conf-orario').value = '';

  if (calTipoServizio === 'compleanno') {
    renderOrari(dow);
  }
}

function renderOrari(dow) {
  const wrapper = document.getElementById('orario-slots');
  const info = document.getElementById('orario-info');
  wrapper.innerHTML = '';

  const isWeekend = dow === 0 || dow === 6;
  const orari = isWeekend
    ? ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00']
    : ['16:00','17:00','18:00','19:00','20:00'];

  info.textContent = isWeekend ? 'Weekend: disponibile tutto il giorno' : 'Giorno feriale: disponibile dalle 16:00';

  orari.forEach(ora => {
    const div = document.createElement('div');
    div.className = 'slot';
    div.textContent = ora;
    div.onclick = () => {
      document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
      div.classList.add('selected');
      document.getElementById('conf-orario').value = ora;
    };
    wrapper.appendChild(div);
  });
}

function selectPayment(type) {
  selectedPaymentType = type;
  ['loco', 'bonifico'].forEach(t => {
    const opt = document.getElementById('pay-' + t);
    const radio = document.getElementById('radio-' + t);
    if (opt) opt.classList.toggle('selected', t === type);
    if (radio) radio.className = 'radio' + (t === type ? ' checked' : '');
  });
}

async function salvaPrenotazione() {
  const data = document.getElementById('conf-data').value;
  const orario = document.getElementById('conf-orario').value;
  const bambinoId = document.getElementById('conf-bambino').value;
  const errEl = document.getElementById('conferma-error');
  errEl.classList.remove('visible');

  if (!data) { showError(errEl, 'Seleziona una data dal calendario.'); return; }
  if (calTipoServizio === 'compleanno' && !orario) { showError(errEl, 'Seleziona un orario di inizio.'); return; }
  if (!bambinoId) { showError(errEl, 'Seleziona il bambino/a.'); return; }

  const tipoServizio = calTipoServizio === 'compleanno' ? 'compleanno' : 'babyparking';
  const pacchettoConOrario = orario ? `${selectedTariffName} — ore ${orario}` : selectedTariffName;

  const { error } = await db.from('prenotazioni').insert({
    profilo_id: currentUser.id,
    bambino_id: bambinoId,
    tipo_servizio: tipoServizio,
    pacchetto: pacchettoConOrario,
    prezzo: selectedTariffPrice,
    data_prenotazione: data,
    pagamento: selectedPaymentType,
    stato: selectedPaymentType === 'loco' ? 'confermata' : 'in_attesa'
  });

  if (error) {
    showError(errEl, 'Errore nel salvataggio. Riprova.');
    return;
  }

  const bambino = currentBambini.find(b => b.id === bambinoId);

  await sendEmail('prenotazione', {
    email: currentProfile.email,
    nome_genitore: `${currentProfile.nome} ${currentProfile.cognome}`,
    telefono: currentProfile.telefono,
    nome_bambino: bambino?.nome || '—',
    tipo_servizio: tipoServizio,
    pacchetto: pacchettoConOrario,
    prezzo: selectedTariffPrice,
    data_prenotazione: data,
    pagamento: selectedPaymentType
  });

  selectedTariffName = '';
  selectedTariffPrice = 0;
  showApp('prenotazioni');
}

// ═══════════════════════════════════════════
//  INVIA EMAIL
// ═══════════════════════════════════════════
async function sendEmail(type, data) {
  try {
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data })
    });
  } catch (err) {
    console.error('Errore invio email:', err);
  }
}

// ═══════════════════════════════════════════
//  CARICA PRENOTAZIONI HOME
// ═══════════════════════════════════════════
async function loadHomeBookings() {
  const el = document.getElementById('home-bookings-list');
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await db
    .from('prenotazioni')
    .select('*, bambini(nome)')
    .eq('profilo_id', currentUser.id)
    .neq('stato', 'annullata')
    .gte('data_prenotazione', today)
    .order('data_prenotazione', { ascending: true })
    .limit(2);

  if (error || !data || data.length === 0) {
    el.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);padding:8px 0">Nessuna prenotazione imminente</p>';
    return;
  }
  el.innerHTML = data.map(b => bookingCardHTML(b, false)).join('') +
    '<button class="btn-outline" style="margin-top:8px;font-size:13px;padding:10px" onclick="showApp(\'prenotazioni\')">Vedi tutte →</button>';
}

// ═══════════════════════════════════════════
//  PAGAMENTI IN SOSPESO
// ═══════════════════════════════════════════
async function loadPagamentiSospeso() {
  const wrapper = document.getElementById('pagamenti-sospeso-wrapper');
  const list = document.getElementById('pagamenti-sospeso-list');

  // Carica tessere in attesa
  const { data: tessere } = await db
    .from('tessere')
    .select('*, bambini(nome)')
    .eq('profilo_id', currentUser.id)
    .eq('stato', 'in_attesa');

  // Carica prenotazioni in loco non ancora pagate
  const { data: prenotazioni } = await db
    .from('prenotazioni')
    .select('*, bambini(nome)')
    .eq('profilo_id', currentUser.id)
    .eq('pagamento', 'loco')
    .eq('pagato', false)
    .neq('stato', 'annullata');

  const hasTessere = tessere && tessere.length > 0;
  const hasPren = prenotazioni && prenotazioni.length > 0;

  if (!hasTessere && !hasPren) {
    wrapper.style.display = 'none';
    return;
  }

  wrapper.style.display = 'block';
  let html = '';
  let totale = 0;

  if (hasTessere) {
    tessere.forEach(t => {
      totale += parseFloat(t.importo);
      html += `
        <div class="booking-card" style="border-left:3px solid var(--amber-dark)">
          <div class="booking-header">
            <div>
              <div class="booking-title">🎫 Tessera — ${t.bambini?.nome || '—'}</div>
              <div class="booking-meta">Anno ${t.anno} · ${t.pagamento === 'loco' ? 'Paga in loco entro 48h' : 'Pagamento online'}</div>
            </div>
            <span class="badge badge-amber">In attesa</span>
          </div>
          <div class="booking-pkg">Tesseramento + assicurazione · <strong>€${t.importo}</strong></div>
        </div>`;
    });
  }

  if (hasPren) {
    prenotazioni.forEach(p => {
      totale += parseFloat(p.prezzo);
      const dataFmt = new Date(p.data_prenotazione + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
      html += `
        <div class="booking-card" style="border-left:3px solid var(--amber-dark)">
          <div class="booking-header">
            <div>
              <div class="booking-title">💶 ${p.tipo_servizio === 'babyparking' ? 'Babyparking' : 'Compleanno'} — ${p.bambini?.nome || '—'}</div>
              <div class="booking-meta">${dataFmt} · Da pagare in loco</div>
            </div>
            <span class="badge badge-amber">Da pagare</span>
          </div>
          <div class="booking-pkg">${p.pacchetto} · <strong>€${p.prezzo}</strong></div>
        </div>`;
    });
  }

  html += `<div style="text-align:right;font-size:14px;font-weight:700;color:var(--amber-dark);margin-bottom:16px;padding:8px 0;border-top:1px solid var(--amber-light)">Totale da pagare in loco: €${totale.toFixed(0)}</div>`;
  list.innerHTML = html;
}
// ═══════════════════════════════════════════
//  CARICA TUTTE LE PRENOTAZIONI
// ═══════════════════════════════════════════

async function loadPrenotazioni() {
  const el = document.getElementById('prenotazioni-list');
  el.innerHTML = '<div class="loading-text">Caricamento...</div>';

  const { data, error } = await db
    .from('prenotazioni')
    .select('*, bambini(nome)')
    .eq('profilo_id', currentUser.id)
    .neq('stato', 'annullata')
    .order('data_prenotazione', { ascending: true });

  if (error || !data || data.length === 0) {
    el.innerHTML = '<div class="empty-state">Nessuna prenotazione attiva</div>';
    return;
  }
  el.innerHTML = data.map(b => bookingCardHTML(b, true)).join('');
}

// ═══════════════════════════════════════════
//  HTML CARD PRENOTAZIONE (utente)
// ═══════════════════════════════════════════
function bookingCardHTML(b, showCancel) {
  const dataFmt = new Date(b.data_prenotazione + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const badgeClass = b.stato === 'confermata' ? 'badge-green' : b.stato === 'in_attesa' ? 'badge-amber' : 'badge-red';
  const badgeLabel = b.stato === 'confermata' ? 'Confermata' : b.stato === 'in_attesa' ? 'In attesa' : 'Annullata';
  const nomeB = b.bambini?.nome || '—';

  return `
    <div class="booking-card" id="booking-${b.id}">
      <div class="booking-header">
        <div>
          <div class="booking-title">${b.tipo_servizio === 'babyparking' ? 'Babyparking' : b.tipo_servizio === 'centro_estivo' ? 'Centro Estivo' : 'Compleanno'} — ${nomeB}</div>
          <div class="booking-meta">${dataFmt}</div>
        </div>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="booking-pkg">${b.pacchetto} · €${b.prezzo}</div>
      ${showCancel ? `<div class="divider"></div><button class="cancel-btn" onclick="cancellaPrenotazione('${b.id}')">Elimina prenotazione</button>` : ''}
    </div>`;
}

// ═══════════════════════════════════════════
//  CANCELLA PRENOTAZIONE (utente)
// ═══════════════════════════════════════════
async function cancellaPrenotazione(id) {
  if (!confirm('Vuoi eliminare questa prenotazione?')) return;

  const { error } = await db.from('prenotazioni').update({ stato: 'annullata' }).eq('id', id);
  if (error) { alert('Errore durante la cancellazione.'); return; }

  const el = document.getElementById('booking-' + id);
  if (el) el.remove();

  const list = document.getElementById('prenotazioni-list');
  if (list && list.querySelectorAll('.booking-card').length === 0) {
    list.innerHTML = '<div class="empty-state">Nessuna prenotazione attiva</div>';
  }
}

// ═══════════════════════════════════════════
//  PANNELLO ADMIN — CARICA PRENOTAZIONI
// ═══════════════════════════════════════════
async function loadAdminBookings() {
  const el = document.getElementById('admin-bookings-list');
  el.innerHTML = '<div class="loading-text">Caricamento...</div>';

  // Carica tutte le prenotazioni con dati cliente (join profili + bambini)
  const { data, error } = await db
    .from('prenotazioni')
    .select('*, bambini(nome), profili(nome, cognome, email, telefono)')
    .neq('stato', 'annullata')
    .order('data_prenotazione', { ascending: true });

  if (error) {
    el.innerHTML = '<div class="empty-state">Errore nel caricamento.</div>';
    return;
  }

  adminAllBookings = data || [];
  adminApplyFilters();
  adminUpdateStats();
}

function adminUpdateStats() {
  const attive = adminAllBookings.filter(b => b.stato !== 'annullata');
  const incasso = attive.reduce((sum, b) => sum + parseFloat(b.prezzo || 0), 0);
  const today = new Date().toISOString().split('T')[0];
  const oggi = attive.filter(b => b.data_prenotazione === today).length;

  document.getElementById('admin-stat-tot').textContent = attive.length;
  document.getElementById('admin-stat-incasso').textContent = `€${incasso.toFixed(0)}`;
  document.getElementById('admin-stat-oggi').textContent = oggi;
}

function adminApplyFilters() {
  const tipoFilter = document.getElementById('admin-filter-tipo').value;
  const dataFilter = document.getElementById('admin-filter-data').value;

  let filtered = adminAllBookings;
  if (tipoFilter) filtered = filtered.filter(b => b.tipo_servizio === tipoFilter);
  if (dataFilter) filtered = filtered.filter(b => b.data_prenotazione === dataFilter);

  const el = document.getElementById('admin-bookings-list');
  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state">Nessuna prenotazione trovata</div>';
    return;
  }
  el.innerHTML = filtered.map(b => adminBookingCardHTML(b)).join('');
}

// ═══════════════════════════════════════════
//  ADMIN — TAB SWITCH
// ═══════════════════════════════════════════
function adminSwitchTab(tab) {
  document.getElementById('admin-tab-prenotazioni').classList.toggle('active', tab === 'prenotazioni');
  document.getElementById('admin-tab-utenti').classList.toggle('active', tab === 'utenti');
  document.getElementById('admin-bookings-list').style.display = tab === 'prenotazioni' ? 'block' : 'none';
  document.getElementById('admin-filters').style.display = tab === 'prenotazioni' ? 'flex' : 'none';
  document.getElementById('admin-users-list').style.display = tab === 'utenti' ? 'block' : 'none';
  if (tab === 'utenti') loadAdminUsers();
}

// ═══════════════════════════════════════════
//  ADMIN — CARICA UTENTI
// ═══════════════════════════════════════════
async function loadAdminUsers() {
  const el = document.getElementById('admin-users-list');
  el.innerHTML = '<div class="loading-text">Caricamento...</div>';

  const { data, error } = await db
    .from('profili')
    .select('*, bambini(nome)')
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    el.innerHTML = '<div class="empty-state">Nessun utente registrato</div>';
    return;
  }

  el.innerHTML = data
    .filter(u => u.email !== 'sarabandalivorno@gmail.com')
    .map(u => `
      <div class="admin-booking-card">
        <div class="booking-header">
          <div>
            <div class="booking-title">👤 ${u.nome} ${u.cognome}</div>
            <div class="booking-meta">Iscritto il ${new Date(u.created_at).toLocaleDateString('it-IT')}</div>
          </div>
        </div>
        <div class="admin-client-info">
          <div class="admin-info-row">
            <span class="admin-info-label">Email</span>
            <a class="admin-info-val admin-link" href="mailto:${u.email}">${u.email}</a>
          </div>
          <div class="admin-info-row">
            <span class="admin-info-label">Telefono</span>
            <a class="admin-info-val admin-link" href="tel:${u.telefono}">${u.telefono}</a>
          </div>
          <div class="admin-info-row">
            <span class="admin-info-label">Bambini</span>
            <span class="admin-info-val">${u.bambini?.map(b => b.nome).join(', ') || '—'}</span>
          </div>
        </div>
      </div>`).join('');
}

function adminClearFilters() {
  document.getElementById('admin-filter-tipo').value = '';
  document.getElementById('admin-filter-data').value = '';
  adminApplyFilters();
}

// ═══════════════════════════════════════════
//  HTML CARD PRENOTAZIONE (admin)
// ═══════════════════════════════════════════
function adminBookingCardHTML(b) {
  const dataFmt = new Date(b.data_prenotazione + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const badgeClass = b.stato === 'confermata' ? 'badge-green' : b.stato === 'in_attesa' ? 'badge-amber' : 'badge-red';
  const badgeLabel = b.stato === 'confermata' ? 'Confermata' : b.stato === 'in_attesa' ? 'In attesa' : 'Annullata';
  const nomeGenitore = b.profili ? `${b.profili.nome} ${b.profili.cognome}` : '—';
  const email = b.profili?.email || '—';
  const telefono = b.profili?.telefono || '—';
  const nomeBambino = b.bambini?.nome || '—';

  return `
    <div class="admin-booking-card" id="admin-booking-${b.id}">
      <div class="booking-header">
        <div>
          <div class="booking-title">${b.tipo_servizio === 'babyparking' ? '🧒 Babyparking' : '🎂 Compleanno'}</div>
          <div class="booking-meta">${dataFmt}</div>
        </div>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="booking-pkg">${b.pacchetto} · <strong>€${b.prezzo}</strong></div>
      <div class="admin-client-info">
        <div class="admin-info-row">
          <span class="admin-info-label">Genitore</span>
          <span class="admin-info-val">${nomeGenitore}</span>
        </div>
        <div class="admin-info-row">
          <span class="admin-info-label">Bambino/a</span>
          <span class="admin-info-val">${nomeBambino}</span>
        </div>
        <div class="admin-info-row">
          <span class="admin-info-label">Email</span>
          <a class="admin-info-val admin-link" href="mailto:${email}">${email}</a>
        </div>
        <div class="admin-info-row">
          <span class="admin-info-label">Telefono</span>
          <a class="admin-info-val admin-link" href="tel:${telefono}">${telefono}</a>
        </div>
        <div class="admin-info-row">
          <span class="admin-info-label">Pagamento</span>
          <span class="admin-info-val">${b.pagamento === 'loco' ? 'In loco' : 'Online'}</span>
        </div>
      </div>
      <div class="divider"></div>
      <div class="admin-actions">
        ${b.stato !== 'confermata' ? `<button class="admin-confirm-btn" onclick="adminConferma('${b.id}')">✓ Conferma</button>` : ''}
        ${b.pagamento === 'loco' && !b.pagato ? `<button class="admin-confirm-btn" onclick="adminSegnaPageto('${b.id}')">💶 Pagato</button>` : ''}
        <button class="admin-cancel-btn" onclick="adminAnnulla('${b.id}')">✕ Annulla</button>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════
//  ADMIN — CONFERMA PRENOTAZIONE
// ═══════════════════════════════════════════
async function adminConferma(id) {
  const { error } = await db.from('prenotazioni').update({ stato: 'confermata' }).eq('id', id);
  if (error) { alert('Errore durante la conferma.'); return; }
  // Aggiorna in cache
  const b = adminAllBookings.find(x => x.id === id);
  if (b) b.stato = 'confermata';
  adminApplyFilters();
  adminUpdateStats();
}

// ═══════════════════════════════════════════
//  ADMIN — SEGNA COME PAGATO
// ═══════════════════════════════════════════
async function adminSegnaPageto(id) {
  const { error } = await db.from('prenotazioni').update({ pagato: true }).eq('id', id);
  if (error) { alert('Errore durante l\'aggiornamento.'); return; }
  const b = adminAllBookings.find(x => x.id === id);
  if (b) b.pagato = true;
  adminApplyFilters();
}

// ═══════════════════════════════════════════
//  ADMIN — ANNULLA PRENOTAZIONE
// ═══════════════════════════════════════════
async function adminAnnulla(id) {
  if (!confirm('Vuoi annullare questa prenotazione?')) return;
  const { error } = await db.from('prenotazioni').update({ stato: 'annullata' }).eq('id', id);
  if (error) { alert('Errore durante l\'annullamento.'); return; }
  // Rimuovi dalla cache e ricarica
  adminAllBookings = adminAllBookings.filter(x => x.id !== id);
  adminApplyFilters();
  adminUpdateStats();
}

// ═══════════════════════════════════════════
//  REGISTRAZIONE A STEP
// ═══════════════════════════════════════════
let regCurrentStep = 1;

function regShowStep(step) {
  ['1','2','3','finale'].forEach(s => {
    const el = document.getElementById('reg-step-' + s);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById('reg-step-' + step);
  if (target) target.style.display = 'block';
  regCurrentStep = step;

  // Aggiorna barra progressione
  const stepNum = step === 'finale' ? 3 : parseInt(step);
  ['1','2','3'].forEach((s, i) => {
    const bar = document.getElementById('step-bar-' + s);
    if (bar) bar.style.background = i < stepNum ? 'var(--green)' : 'var(--border)';
  });

  // Aggiorna label
  const labels = { '1': 'Passo 1 di 3 — Dati personali', '2': 'Passo 2 di 3 — I tuoi bambini', '3': 'Passo 3 di 3 — Tesseramento', 'finale': 'Ultimo passo — Conferma' };
  const lbl = document.getElementById('step-label');
  if (lbl) lbl.textContent = labels[step] || '';
}

function regNextStep(from) {
  const errEl = document.getElementById('register-error');
  errEl.classList.remove('visible');

  if (from === 1) {
    const nome = document.getElementById('reg-nome').value.trim();
    const cognome = document.getElementById('reg-cognome').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const telefono = document.getElementById('reg-telefono').value.trim();
    const password = document.getElementById('reg-password').value;
    if (!nome || !cognome || !email || !telefono || !password) {
      showError(errEl, 'Compila tutti i campi.');
      return;
    }
    if (password.length < 6) {
      showError(errEl, 'La password deve essere di almeno 6 caratteri.');
      return;
    }
    regShowStep(2);
  }

  if (from === 2) {
    const primoNome = document.querySelector('.bambino-nome')?.value.trim();
    if (!primoNome) {
      showError(errEl, 'Inserisci almeno il nome di un bambino/a.');
      return;
    }
    // Controlla se ha scelto babyparking o centro estivo
    const needsTessera = document.getElementById('svc-babyparking')?.checked ||
                         document.getElementById('svc-centroestivo')?.checked;
    aggiornaTotaleTessere();
    regShowStep(needsTessera ? 3 : 'finale');
  }
}

function regPrevStep(from) {
  if (from === 2) regShowStep(1);
  if (from === 3) regShowStep(2);
  if (from === 'finale') regShowStep(2);
}
// ═══════════════════════════════════════════
//  TESSERAMENTO
// ═══════════════════════════════════════════
function selectTessera(scelta) {
  tesseraScelta = scelta;
  document.getElementById('tess-ora').classList.toggle('selected', scelta === 'ora');
  document.getElementById('tess-dopo').classList.toggle('selected', scelta === 'dopo');
  document.getElementById('radio-tess-ora').className = 'radio' + (scelta === 'ora' ? ' checked' : '');
  document.getElementById('radio-tess-dopo').className = 'radio' + (scelta === 'dopo' ? ' checked' : '');
  document.getElementById('tessera-pagamento-wrapper').style.display = scelta === 'ora' ? 'block' : 'none';
  aggiornaTotaleTessere();
}

function selectTeseraPagamento(tipo) {
  tesseraPagamento = tipo;
  document.getElementById('tess-pay-loco').classList.toggle('selected', tipo === 'loco');
  document.getElementById('tess-pay-online').classList.toggle('selected', tipo === 'online');
  document.getElementById('radio-tess-pay-loco').className = 'radio' + (tipo === 'loco' ? ' checked' : '');
  document.getElementById('radio-tess-pay-online').className = 'radio' + (tipo === 'online' ? ' checked' : '');
}

function aggiornaTotaleTessere() {
  if (tesseraScelta !== 'ora') {
    document.getElementById('tessera-totale').textContent = '';
    return;
  }
  const rows = document.querySelectorAll('.bambino-row');
  let tot = 0;
  let idx = 0;
  rows.forEach(r => {
    const n = r.querySelector('.bambino-nome')?.value.trim();
    if (n) { tot += idx === 0 ? 60 : 40; idx++; }
  });
  document.getElementById('tessera-totale').textContent = `Totale tessere: €${tot}`;
}

function aggiungiBambino() {
  const list = document.getElementById('bambini-list');
  const idx = bambinoCount++;
  const div = document.createElement('div');
  div.className = 'bambino-row';
  div.id = `bambino-${idx}`;
  div.style.cssText = 'border-top:0.5px solid var(--border);padding-top:10px;margin-top:8px;';
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <span style="font-size:12px;font-weight:600;color:var(--text-secondary)">Bambino/a ${idx + 1}</span>
      <button type="button" onclick="this.closest('.bambino-row').remove(); aggiornaTotaleTessere();" style="font-size:12px;color:var(--red-dark);background:none;border:none;cursor:pointer;">Rimuovi</button>
    </div>
    <input type="text" class="bambino-nome input-field" placeholder="Nome bambino/a" style="margin-bottom:4px" oninput="aggiornaTotaleTessere()" />
    <div class="bambino-extra" style="display:none">
      <input type="text" class="bambino-cognome input-field" placeholder="Cognome" style="margin-bottom:4px" />
      <input type="date" class="bambino-nascita input-field" style="margin-bottom:4px" />
      <input type="text" class="bambino-luogo input-field" placeholder="Luogo di nascita" style="margin-bottom:4px" />
      <input type="text" class="bambino-indirizzo input-field" placeholder="Indirizzo di residenza" style="margin-bottom:4px" />
      <input type="text" class="bambino-cf input-field" placeholder="Codice fiscale" style="margin-bottom:8px" />
    </div>
    <button type="button" onclick="toggleBambinoExtra(${idx})" style="font-size:12px;color:var(--green);background:none;border:none;cursor:pointer;padding:0;margin-bottom:8px;">+ Aggiungi dati completi per tesseramento</button>
  `;
  list.appendChild(div);
  aggiornaTotaleTessere();
}

function toggleBambinoExtra(idx) {
  const row = document.getElementById(`bambino-${idx}`);
  if (!row) return;
  const extra = row.querySelector('.bambino-extra');
  const btn = row.querySelector('.btn-toggle-extra') || row.querySelectorAll('button')[1];
  if (!extra) return;
  const isVisible = extra.style.display !== 'none';
  extra.style.display = isVisible ? 'none' : 'block';
  if (btn) btn.textContent = isVisible ? '+ Aggiungi dati completi per tesseramento' : '− Nascondi dati tesseramento';
}

// ═══════════════════════════════════════════
//  TOGGLE PASSWORD VISIBILE
// ═══════════════════════════════════════════
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.style.color = isPassword ? 'var(--green)' : 'var(--text-tertiary)';
}
// ═══════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════
function showError(el, msg) {
  el.textContent = msg;
  el.classList.add('visible');
}

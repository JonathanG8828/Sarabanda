// ═══════════════════════════════════════════
//  CONFIGURAZIONE SUPABASE
// ═══════════════════════════════════════════
const SUPABASE_URL = 'https://rnqgoefwyimemkowoknu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DNPzkYyrV0dZ96Jxu0Qwsg_48XfoCDE';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ═══════════════════════════════════════════
//  STATO APPLICAZIONE
// ═══════════════════════════════════════════
let currentUser = null;
let currentProfile = null;
let currentBambini = [];
let selectedTariffName = '';
let selectedTariffPrice = 0;
let selectedPaymentType = 'loco';

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
  const bambino = document.getElementById('reg-bambino').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('register-error');
  errEl.classList.remove('visible');

  if (!nome || !cognome || !email || !telefono || !bambino || !password) {
    showError(errEl, 'Compila tutti i campi.');
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

  // Crea profilo
  const { error: profErr } = await db.from('profili').insert({
    id: userId, nome, cognome, email, telefono
  });
  if (profErr) { showError(errEl, 'Errore nel salvataggio profilo.'); return; }

  // Crea bambino
  const { error: bamErr } = await db.from('bambini').insert({
    profilo_id: userId, nome: bambino
  });
  if (bamErr) { showError(errEl, 'Errore nel salvataggio bambino.'); return; }

  // Invia email di benvenuto
  await sendEmail('benvenuto', { nome, cognome, email, telefono });
}

// ═══════════════════════════════════════════
//  LOGOUT
// ═══════════════════════════════════════════
async function handleLogout() {
  await db.auth.signOut();
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
}

// ═══════════════════════════════════════════
//  NAVIGAZIONE APP
// ═══════════════════════════════════════════
function showApp(screenName) {
  document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + screenName).classList.add('active');

  if (screenName === 'home') loadHomeBookings();
  if (screenName === 'prenotazioni') loadPrenotazioni();
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

// ═══════════════════════════════════════════
//  CONFERMA PRENOTAZIONE
// ═══════════════════════════════════════════
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

    let stato = 'available'; // available | closed | busy

    if (isPast) {
      stato = 'past';
    } else if (calTipoServizio === 'babyparking') {
      // Babyparking: solo lun-ven
      if (dow === 0 || dow === 6) stato = 'closed';
    } else {
      // Compleanni: tutti i giorni
      // Controlla se già occupato
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
  // Deseleziona tutti
  document.querySelectorAll('#cal-giorni .cal-selected').forEach(d => {
    d.classList.remove('cal-selected');
  });
  el.classList.add('cal-selected');
  document.getElementById('conf-data').value = dataStr;
  document.getElementById('conf-orario').value = '';

  // Aggiorna slot orari per compleanni
  if (calTipoServizio === 'compleanno') {
    renderOrari(dow);
  }
}

function renderOrari(dow) {
  const wrapper = document.getElementById('orario-slots');
  const info = document.getElementById('orario-info');
  wrapper.innerHTML = '';

  // Feriali: dalle 16:00 in poi | Weekend: tutto il giorno
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
  const isOnline = type === 'online';
  document.getElementById('pay-loco').classList.toggle('selected', !isOnline);
  document.getElementById('pay-online').classList.toggle('selected', isOnline);
  document.getElementById('radio-loco').className = 'radio' + (!isOnline ? ' checked' : '');
  document.getElementById('radio-online').className = 'radio' + (isOnline ? ' checked' : '');
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
    stato: selectedPaymentType === 'online' ? 'in_attesa' : 'confermata'
  });

  if (error) {
    showError(errEl, 'Errore nel salvataggio. Riprova.');
    return;
  }

  // Trova nome bambino selezionato
  const bambino = currentBambini.find(b => b.id === bambinoId);

  // Invia email conferma + notifica interna
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
    .limit(3);

  if (error || !data || data.length === 0) {
    el.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);padding:8px 0">Nessuna prenotazione imminente</p>';
    return;
  }
  el.innerHTML = data.map(b => bookingCardHTML(b, false)).join('');
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
//  HTML CARD PRENOTAZIONE
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
          <div class="booking-title">${b.tipo_servizio === 'babyparking' ? 'Babyparking' : 'Compleanno'} — ${nomeB}</div>
          <div class="booking-meta">${dataFmt}</div>
        </div>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="booking-pkg">${b.pacchetto} · €${b.prezzo}</div>
      ${showCancel ? `<div class="divider"></div><button class="cancel-btn" onclick="cancellaPrenotazione('${b.id}')">Elimina prenotazione</button>` : ''}
    </div>`;
}

// ═══════════════════════════════════════════
//  CANCELLA PRENOTAZIONE
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
//  UTILITY
// ═══════════════════════════════════════════
function showError(el, msg) {
  el.textContent = msg;
  el.classList.add('visible');
}

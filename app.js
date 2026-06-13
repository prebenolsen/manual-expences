// --- Supabase init ---
if (!window.ENV || !window.ENV.SUPABASE_URL || window.ENV.SUPABASE_URL.startsWith('PLACEHOLDER')) {
  document.getElementById('login-feil').textContent = 'Konfigurasjonsfeil: Supabase-nøkler mangler. Sjekk GitHub Secrets og deploy på nytt.';
  document.getElementById('login-feil').className = 'feil';
  throw new Error('Supabase-nøkler ikke konfigurert');
}
const { createClient } = supabase;
const db = createClient(window.ENV.SUPABASE_URL, window.ENV.SUPABASE_ANON_KEY);

// --- Helpers ---
function osloDateString() {
  // sv-SE locale produces YYYY-MM-DD which <input type="date"> requires
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
}

function visStatus(tekst, type) {
  const el = document.getElementById('melding');
  el.textContent = tekst;
  el.className = type;
  if (tekst) setTimeout(() => { el.textContent = ''; el.className = ''; }, 4000);
}

// --- Auth: vis/skjul skjermer ---
function visApp() {
  document.getElementById('login-skjerm').classList.add('skjult');
  document.getElementById('app-skjerm').classList.remove('skjult');
}

function visLogin() {
  document.getElementById('app-skjerm').classList.add('skjult');
  document.getElementById('login-skjerm').classList.remove('skjult');
}

let appInitialisert = false;

db.auth.onAuthStateChange((_event, session) => {
  if (session) {
    visApp();
    if (!appInitialisert) {
      initApp();
      appInitialisert = true;
    }
  } else {
    visLogin();
    appInitialisert = false;
  }
});

// --- Innlogging ---
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn   = document.getElementById('login-btn');
  const feilEl = document.getElementById('login-feil');
  btn.disabled = true;
  btn.textContent = 'Logger inn…';
  feilEl.textContent = '';
  feilEl.className = '';

  const { error } = await db.auth.signInWithPassword({
    email:    document.getElementById('epost').value,
    password: document.getElementById('passord').value
  });

  if (error) {
    feilEl.textContent = 'Feil e-post eller passord.';
    feilEl.className = 'feil';
    btn.disabled = false;
    btn.textContent = 'Logg inn';
  }
  // Ved suksess håndterer onAuthStateChange overgangen
});

// --- Utlogging ---
document.getElementById('logg-ut-btn').addEventListener('click', async () => {
  await db.auth.signOut();
});

// --- Populer kategorier ---
function populerKategorier() {
  const sel = document.getElementById('kategori');
  const cfg = window.APP_CONFIG;
  Object.keys(cfg.categories).forEach(kat => {
    const opt = document.createElement('option');
    opt.value = kat;
    opt.textContent = kat;
    if (kat === cfg.defaultCategory) opt.selected = true;
    sel.appendChild(opt);
  });
  populerButikker(sel.value);
}

// --- Populer butikker basert på kategori ---
function populerButikker(kategori) {
  const sel = document.getElementById('butikk');
  sel.innerHTML = '';
  const butikker = window.APP_CONFIG.categories[kategori]?.stores ?? [];
  butikker.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    sel.appendChild(opt);
  });
}

document.getElementById('kategori').addEventListener('change', e => {
  populerButikker(e.target.value);
});

// --- Skjema: lagre utgift ---
document.getElementById('expense-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('lagre-btn');
  btn.disabled = true;
  btn.textContent = 'Lagrer…';

  const dato     = document.getElementById('dato').value;
  const kategori = document.getElementById('kategori').value;
  const butikk   = document.getElementById('butikk').value;
  const belop    = parseInt(document.getElementById('belop').value, 10);
  const notat    = document.getElementById('notat').value.trim() || null;

  if (!dato || !kategori || !butikk || !belop || belop < 1) {
    visStatus('Fyll ut alle påkrevde felt.', 'feil');
    btn.disabled = false;
    btn.textContent = 'Lagre utgift';
    return;
  }

  const { error } = await db.from('expenses').insert({
    expense_date: dato,
    category: kategori,
    store: butikk,
    amount: belop,
    note: notat
  });

  if (error) {
    visStatus('Feil ved lagring: ' + error.message, 'feil');
  } else {
    visStatus('Utgift lagret!', 'suksess');
    document.getElementById('belop').value = '';
    document.getElementById('notat').value = '';
    document.getElementById('dato').value = osloDateString();
  }

  btn.disabled = false;
  btn.textContent = 'Lagre utgift';
});

// --- Eksport til CSV ---
document.getElementById('eksport-btn').addEventListener('click', async () => {
  const ar    = document.getElementById('eksport-ar').value;
  const maned = document.getElementById('eksport-maned').value;

  if (!ar) {
    alert('Velg et år for eksport.');
    return;
  }

  let fraDato, tilDato;
  if (maned) {
    const m = maned.padStart(2, '0');
    const sisteDag = new Date(parseInt(ar, 10), parseInt(maned, 10), 0).getDate();
    fraDato = `${ar}-${m}-01`;
    tilDato = `${ar}-${m}-${String(sisteDag).padStart(2, '0')}`;
  } else {
    fraDato = `${ar}-01-01`;
    tilDato = `${ar}-12-31`;
  }

  const { data, error } = await db
    .from('expenses')
    .select('expense_date, category, store, amount, note')
    .gte('expense_date', fraDato)
    .lte('expense_date', tilDato)
    .order('expense_date', { ascending: true });

  if (error) { alert('Feil: ' + error.message); return; }
  if (!data || !data.length) { alert('Ingen data funnet for valgt periode.'); return; }

  const rader = [['year', 'month', 'day', 'dd-mm-yyyy', 'category', 'store', 'sum', 'note']];
  data.forEach(r => {
    const [y, mo, d] = r.expense_date.split('-');
    rader.push([
      y,
      parseInt(mo, 10),
      parseInt(d, 10),
      `${d}-${mo}-${y}`,
      r.category,
      r.store,
      r.amount,
      r.note ?? ''
    ]);
  });

  const csv = rader
    .map(rad => rad.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  // BOM ensures Excel opens Norwegian characters correctly
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = maned
    ? `utgifter-${ar}-${maned.padStart(2, '0')}.csv`
    : `utgifter-${ar}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// --- Init (kjøres én gang etter innlogging) ---
function initApp() {
  document.getElementById('dato').value = osloDateString();
  document.getElementById('eksport-ar').value = osloDateString().slice(0, 4);
  populerKategorier();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/manual-expences/sw.js');
  }
}

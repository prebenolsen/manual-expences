// --- Supabase init ---
if (!window.ENV || !window.ENV.SUPABASE_URL || window.ENV.SUPABASE_URL.startsWith('PLACEHOLDER')) {
  document.getElementById('login-feil').textContent = 'Konfigurasjonsfeil: Supabase-nøkler mangler. Sjekk GitHub Secrets og deploy på nytt.';
  document.getElementById('login-feil').className = 'feil';
  throw new Error('Supabase-nøkler ikke konfigurert');
}
const { createClient } = supabase;
const db = createClient(window.ENV.SUPABASE_URL, window.ENV.SUPABASE_ANON_KEY);

// --- Globale data ---
let appKategorier = {};

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

// Escape user-supplied strings before inserting into innerHTML
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  const btn    = document.getElementById('login-btn');
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

// --- Last kategorier fra Supabase ---
async function lastKategorier() {
  const { data, error } = await db
    .from('custom_options')
    .select('category, store')
    .order('created_at', { ascending: true });

  if (error) {
    // Tabellen finnes ikke ennå – fall tilbake til config.js
    console.warn('custom_options ikke tilgjengelig, bruker config.js:', error.message);
    brukKonfigurasjonsdata();
    return;
  }

  if (!data.length) {
    await frøKategorier();
    return lastKategorier();
  }

  appKategorier = {};
  data.forEach(({ category, store }) => {
    if (!appKategorier[category]) appKategorier[category] = [];
    if (store) appKategorier[category].push(store);
  });
}

function brukKonfigurasjonsdata() {
  appKategorier = {};
  Object.entries(window.APP_CONFIG.categories).forEach(([kat, { stores }]) => {
    appKategorier[kat] = [...stores];
  });
}

async function frøKategorier() {
  const rader = [];
  Object.entries(window.APP_CONFIG.categories).forEach(([kat, { stores }]) => {
    rader.push({ category: kat, store: '' });
    stores.forEach(s => rader.push({ category: kat, store: s }));
  });
  const { error } = await db.from('custom_options').insert(rader);
  if (error) console.error('Feil ved seeding av kategorier:', error);
}

// --- Populer kategorier ---
function populerKategorier() {
  const sel = document.getElementById('kategori');
  sel.innerHTML = '';
  const defaultKat = window.APP_CONFIG.defaultCategory;
  Object.keys(appKategorier).forEach(kat => {
    const opt = document.createElement('option');
    opt.value = kat;
    opt.textContent = kat;
    if (kat === defaultKat) opt.selected = true;
    sel.appendChild(opt);
  });
  populerButikker(sel.value);
}

// --- Populer butikker basert på kategori ---
function populerButikker(kategori) {
  const sel = document.getElementById('butikk');
  sel.innerHTML = '';
  const butikker = appKategorier[kategori] ?? [];
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

// --- Ny kategori ---
document.getElementById('ny-kategori-toggle').addEventListener('click', () => {
  const rad = document.getElementById('ny-kategori-rad');
  rad.classList.toggle('skjult');
  if (!rad.classList.contains('skjult')) document.getElementById('ny-kategori-input').focus();
});

document.getElementById('ny-kategori-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('ny-kategori-btn').click(); }
});

document.getElementById('ny-kategori-btn').addEventListener('click', async () => {
  const input = document.getElementById('ny-kategori-input');
  const navn = input.value.trim();
  if (!navn) return;

  if (appKategorier[navn] !== undefined) {
    visStatus('Kategorien finnes allerede.', 'feil');
    return;
  }

  const { error } = await db.from('custom_options').insert({ category: navn, store: '' });
  if (error) { visStatus('Feil: ' + error.message, 'feil'); return; }

  appKategorier[navn] = [];

  const sel = document.getElementById('kategori');
  const opt = document.createElement('option');
  opt.value = navn;
  opt.textContent = navn;
  sel.appendChild(opt);
  sel.value = navn;
  populerButikker(navn);

  input.value = '';
  document.getElementById('ny-kategori-rad').classList.add('skjult');
  visStatus(`Kategori "${navn}" lagt til.`, 'suksess');
});

// --- Ny butikk ---
document.getElementById('ny-butikk-toggle').addEventListener('click', () => {
  const rad = document.getElementById('ny-butikk-rad');
  rad.classList.toggle('skjult');
  if (!rad.classList.contains('skjult')) document.getElementById('ny-butikk-input').focus();
});

document.getElementById('ny-butikk-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('ny-butikk-btn').click(); }
});

document.getElementById('ny-butikk-btn').addEventListener('click', async () => {
  const input = document.getElementById('ny-butikk-input');
  const navn = input.value.trim();
  const kategori = document.getElementById('kategori').value;
  if (!navn || !kategori) return;

  const eksisterende = appKategorier[kategori] ?? [];
  if (eksisterende.includes(navn)) {
    visStatus('Butikken finnes allerede i denne kategorien.', 'feil');
    return;
  }

  const { error } = await db.from('custom_options').insert({ category: kategori, store: navn });
  if (error) { visStatus('Feil: ' + error.message, 'feil'); return; }

  if (!appKategorier[kategori]) appKategorier[kategori] = [];
  appKategorier[kategori].push(navn);

  const sel = document.getElementById('butikk');
  const opt = document.createElement('option');
  opt.value = navn;
  opt.textContent = navn;
  sel.appendChild(opt);
  sel.value = navn;

  input.value = '';
  document.getElementById('ny-butikk-rad').classList.add('skjult');
  visStatus(`Butikk "${navn}" lagt til under "${kategori}".`, 'suksess');
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
    lastUtgifter();
  }

  btn.disabled = false;
  btn.textContent = 'Lagre utgift';
});

// --- Mine utgifter: hent og vis liste ---
async function lastUtgifter() {
  const ar    = document.getElementById('vis-ar').value;
  const maned = document.getElementById('vis-maned').value.padStart(2, '0');
  const sisteDag = new Date(parseInt(ar, 10), parseInt(maned, 10), 0).getDate();
  const fraDato  = `${ar}-${maned}-01`;
  const tilDato  = `${ar}-${maned}-${String(sisteDag).padStart(2, '0')}`;

  const { data, error } = await db
    .from('expenses')
    .select('id, expense_date, category, store, amount, note')
    .gte('expense_date', fraDato)
    .lte('expense_date', tilDato)
    .order('expense_date', { ascending: false });

  if (error) { console.error('Feil ved henting av utgifter:', error); return; }
  visUtgifterListe(data ?? []);
}

function visUtgifterListe(data) {
  const liste = document.getElementById('utgifter-liste');

  if (!data.length) {
    liste.innerHTML = '<p class="tom-liste">Ingen utgifter denne måneden.</p>';
    return;
  }

  const total = data.reduce((sum, u) => sum + u.amount, 0);
  const totalStr = total.toLocaleString('nb-NO');

  liste.innerHTML = `<p class="utgifter-total">${data.length} poster · ${totalStr} kr</p>`;

  data.forEach(u => {
    const [y, mo, d] = u.expense_date.split('-');
    const datoStr = `${d}.${mo}.${y}`;

    const rad = document.createElement('div');
    rad.className = 'utgift-rad';
    rad.innerHTML = `
      <div class="utgift-topp">
        <span class="utgift-dato">${esc(datoStr)}</span>
        <span class="utgift-belop">${u.amount.toLocaleString('nb-NO')} kr</span>
      </div>
      <div class="utgift-bunn">
        <span class="utgift-kat">${esc(u.category)} · ${esc(u.store)}</span>
        <div class="utgift-handlinger">
          <button class="btn-rediger" type="button">Rediger</button>
          <button class="btn-slett" type="button">Slett</button>
        </div>
      </div>
      ${u.note ? `<p class="utgift-notat">${esc(u.note)}</p>` : ''}
    `;

    rad.querySelector('.btn-rediger').addEventListener('click', () => apneRedigerModal(u));
    rad.querySelector('.btn-slett').addEventListener('click', () => slettUtgift(u.id, rad));

    liste.appendChild(rad);
  });
}

document.getElementById('hent-btn').addEventListener('click', lastUtgifter);

// --- Slett utgift ---
async function slettUtgift(id, radEl) {
  if (!confirm('Slett denne utgiften?')) return;

  const { error } = await db.from('expenses').delete().eq('id', id);
  if (error) { alert('Feil ved sletting: ' + error.message); return; }

  // Remove row and update total
  radEl.remove();
  const gjenstående = document.querySelectorAll('#utgifter-liste .utgift-rad');
  if (!gjenstående.length) {
    document.getElementById('utgifter-liste').innerHTML = '<p class="tom-liste">Ingen utgifter denne måneden.</p>';
    return;
  }
  // Recalculate total from remaining rows
  lastUtgifter();
}

// --- Redigeringsmodal ---
function populerRedigerButikker(kategori, valgtButikk) {
  const sel = document.getElementById('rediger-butikk');
  sel.innerHTML = '';
  const butikker = appKategorier[kategori] ?? [];
  butikker.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    if (b === valgtButikk) opt.selected = true;
    sel.appendChild(opt);
  });
  // If the stored store isn't in the list, add it so the form still shows the correct value
  if (valgtButikk && !butikker.includes(valgtButikk)) {
    const opt = document.createElement('option');
    opt.value = valgtButikk;
    opt.textContent = valgtButikk;
    opt.selected = true;
    sel.appendChild(opt);
  }
}

function apneRedigerModal(utgift) {
  document.getElementById('rediger-id').value    = utgift.id;
  document.getElementById('rediger-dato').value  = utgift.expense_date;
  document.getElementById('rediger-belop').value = utgift.amount;
  document.getElementById('rediger-notat').value = utgift.note ?? '';

  const katSel = document.getElementById('rediger-kategori');
  katSel.innerHTML = '';
  Object.keys(appKategorier).forEach(kat => {
    const opt = document.createElement('option');
    opt.value = kat;
    opt.textContent = kat;
    if (kat === utgift.category) opt.selected = true;
    katSel.appendChild(opt);
  });
  if (!appKategorier[utgift.category]) {
    const opt = document.createElement('option');
    opt.value = utgift.category;
    opt.textContent = utgift.category;
    opt.selected = true;
    katSel.appendChild(opt);
  }

  populerRedigerButikker(utgift.category, utgift.store);

  document.getElementById('modal-bakgrunn').classList.remove('skjult');
  document.getElementById('rediger-dato').focus();
}

function lukkRedigerModal() {
  document.getElementById('modal-bakgrunn').classList.add('skjult');
}

document.getElementById('avbryt-btn').addEventListener('click', lukkRedigerModal);

document.getElementById('modal-bakgrunn').addEventListener('click', e => {
  if (e.target === e.currentTarget) lukkRedigerModal();
});

document.getElementById('rediger-kategori').addEventListener('change', e => {
  populerRedigerButikker(e.target.value, '');
});

document.getElementById('rediger-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('lagre-rediger-btn');
  btn.disabled = true;
  btn.textContent = 'Lagrer…';

  const id       = document.getElementById('rediger-id').value;
  const dato     = document.getElementById('rediger-dato').value;
  const kategori = document.getElementById('rediger-kategori').value;
  const butikk   = document.getElementById('rediger-butikk').value;
  const belop    = parseInt(document.getElementById('rediger-belop').value, 10);
  const notat    = document.getElementById('rediger-notat').value.trim() || null;

  const { error } = await db
    .from('expenses')
    .update({ expense_date: dato, category: kategori, store: butikk, amount: belop, note: notat })
    .eq('id', id);

  if (error) {
    alert('Feil ved oppdatering: ' + error.message);
  } else {
    lukkRedigerModal();
    lastUtgifter();
  }

  btn.disabled = false;
  btn.textContent = 'Lagre';
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
async function initApp() {
  const iDag = osloDateString();
  document.getElementById('dato').value        = iDag;
  document.getElementById('eksport-ar').value  = iDag.slice(0, 4);
  document.getElementById('vis-ar').value      = iDag.slice(0, 4);
  document.getElementById('vis-maned').value   = String(parseInt(iDag.slice(5, 7), 10));

  await lastKategorier();
  populerKategorier();
  lastUtgifter();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/manual-expences/sw.js');
  }
}

# Utgiftssporing

En PWA (Progressive Web App) for å registrere og eksportere personlige utgifter. Installeres som en app på Android-hjemskjerm og krever innlogging.

**Funksjoner:**
- Krever innlogging – kun din konto har tilgang
- Legg til utgifter med dato, kategori, butikk, beløp og notat
- Legg til nye kategorier og butikker direkte i appen – lagres i Supabase
- Se, rediger og slett egne utgifter med månedsoversikt
- Lagring i Supabase
- Eksporter til CSV (åpnes korrekt i Excel med norske tegn)
- Fungerer offline for app-skallet (krever internett for å lagre/hente data)

---

## Oppsett

### 1. Opprett Supabase-prosjekt

1. Gå til [supabase.com](https://supabase.com) og opprett et nytt prosjekt.
2. Når prosjektet er klart, gå til **SQL Editor** og kjør følgende SQL for å opprette tabellene og RLS-policyer:

```sql
-- Utgifter
create table expenses (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  expense_date date not null,
  category     text not null,
  store        text not null,
  amount       integer not null check (amount > 0),
  note         text
);

alter table expenses enable row level security;

create policy "Allow authenticated insert"
  on expenses for insert to authenticated with check (true);

create policy "Allow authenticated select"
  on expenses for select to authenticated using (true);

create policy "Allow authenticated update"
  on expenses for update to authenticated using (true) with check (true);

create policy "Allow authenticated delete"
  on expenses for delete to authenticated using (true);

-- Egendefinerte kategorier og butikker (per bruker)
create table custom_options (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null default auth.uid(),
  category   text not null,
  store      text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, category, store)
);

alter table custom_options enable row level security;

create policy "Users manage own options"
  on custom_options for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

> **Merk:** Policyer bruker `authenticated`-rollen, ikke `anon`. Det betyr at kun innloggede brukere kan lese og skrive data.
>
> `custom_options` er per bruker – hver bruker har sin egen liste med kategorier og butikker.

### 2. Opprett bruker

Siden dette er en privat app, oppretter du brukeren manuelt i Supabase:

1. Gå til **Authentication** → **Users** i Supabase-dashbordet.
2. Klikk **Add user** → **Create new user**.
3. Fyll inn din e-post og et passord.
4. Klikk **Create user**.

### 3. Deaktiver registrering (valgfritt, anbefalt)

For å sikre at ingen andre kan opprette kontoer:

1. Gå til **Authentication** → **Providers** → **Email**.
2. Skru av **Enable email confirmations** og skru av **Enable sign ups** (eller sett **Restrict signups** til kun din e-post).

### 4. Hent API-nøkler

1. Gå til **Project Settings** → **API** i Supabase-dashbordet.
2. Kopier:
   - **Project URL** (f.eks. `https://abcdefgh.supabase.co`)
   - **anon / public**-nøkkelen (den lange `eyJ...`-strengen)

### 5. Legg til GitHub Secrets

1. Gå til GitHub-repoet → **Settings** → **Secrets and variables** → **Actions**.
2. Klikk **New repository secret** og legg til to secrets:
   - `SUPABASE_URL` = Project URL fra steg 4
   - `SUPABASE_ANON_KEY` = anon-nøkkelen fra steg 4

### 6. Aktiver GitHub Pages

1. Gå til GitHub-repoet → **Settings** → **Pages**.
2. Under **Source**, velg **GitHub Actions**.

### 7. Deploy

Push en commit til `main`-branchen. GitHub Actions kjører automatisk og deployer appen.

Du kan følge med under **Actions**-fanen i repoet. Når den er grønn, er appen live på:

```
https://prebenolsen.github.io/manual-expences/
```

### 8. Installer på Android

1. Åpne URL-en over i **Chrome** på telefonen.
2. Logg inn med e-post og passord.
3. Trykk på de tre prikkene øverst til høyre.
4. Velg **Legg til på startskjerm**.
5. Appen dukker opp som et ikon på hjemskjermen – og husker innloggingen din.

---

## Tilpassing

### Se, rediger og slett utgifter

Etter innlogging vises seksjonen **Mine utgifter** med alle poster for inneværende måned. Bruk år/måned-filteret og trykk **Hent** for å bytte periode.

- **Rediger**: Åpner et skjema med alle felt forhåndsutfylt – lagre oppdaterer raden umiddelbart.
- **Slett**: Ber om bekreftelse, deretter fjernes raden permanent fra Supabase.

### Legg til kategorier og butikker i appen

Når du er innlogget kan du legge til nye kategorier og butikker direkte i skjemaet:

- Trykk **+ Ny kategori** under kategorilisten for å opprette en ny kategori.
- Trykk **+ Ny butikk** under butikklisten for å legge til en ny butikk under valgt kategori.

Nye oppføringer lagres øyeblikkelig i Supabase og er tilgjengelige ved neste innlogging.

**Første innlogging:** Appen seeder automatisk `custom_options`-tabellen med standardverdiene fra `config.js`. Fra da av er Supabase kilden til alle kategorier og butikker.

### Endre standardkategorier (config.js)

`config.js` brukes kun som startseed ved første innlogging. Ønsker du å endre standardsettet for nye installasjoner, rediger `config.js` og opprett en ny bruker (eller tøm `custom_options`-raden for din bruker i Supabase). Eksisterende brukere beholder sine lagrede valg i Supabase.

### Bytt ut ikoner

Erstatt `icons/icon-192.png` (192x192 px) og `icons/icon-512.png` (512x512 px) med egne PNG-filer. Bruk f.eks. [realfavicongenerator.net](https://realfavicongenerator.net) for å lage ikoner fra et bilde eller logo.

---

## Lokal utvikling

For å teste lokalt uten å deploye:

1. Opprett filen `env.js` i rotmappen (denne er i `.gitignore` og blir aldri committet):

```js
window.ENV = {
  SUPABASE_URL: 'https://ditt-prosjekt.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...'
};
```

2. Åpne `index.html` direkte i Chrome, eller bruk VS Code Live Server.

> **NB:** Service worker fungerer ikke på `file://`-URL-er, men innlogging, lagring og eksport fungerer fint.

---

## CSV-eksport

Filen inneholder kolonnene: `year`, `month`, `day`, `dd-mm-yyyy`, `category`, `store`, `sum`, `note`.

Filen er lagret med UTF-8 BOM slik at Excel på Windows åpner norske tegn (ø, æ, å) korrekt uten ekstra innstillinger.

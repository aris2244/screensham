# Waitlist emails — Supabase setup (ScreenSham)

Goal: every email from **Get Pro → Join waitlist** lands in one table you can open in a browser.

---

## Τι είναι το Supabase;

**Supabase** = cloud database (σαν Google Sheets, αλλά για apps) + dashboard.

- **Δωρεάν tier** για validation (χιλιάδες rows, αρκετό για τώρα)
- Βλέπεις όλα τα emails σε **Table Editor** ή κάνεις export CSV
- Η app στέλνει email με **1 HTTP request** — χωρίς δικό σου server

**Γιατί το θέλεις τώρα:** χωρίς αυτό, τα emails μένουν μόνο στο κινητό του χρήστη. Εσύ δεν βλέπεις τίποτα.

**Branch.io** (αργότερα): smart links «φίλος κατέβασε app → εσύ παίρνεις free month». Όχι τώρα.

---

## Setup (~15 λεπτά)

### 1. Λογαριασμός

1. [supabase.com](https://supabase.com) → Sign up (GitHub OK)
2. **New project** → όνομα π.χ. `screensham` → region **Frankfurt** (κοντά στην Ελλάδα)
3. Βάλε database password — **κράτα το** (δεν το χρειάζεσαι συχνά)

### 2. Πίνακας emails

Στο project: **SQL Editor** → New query → paste & **Run**:

```sql
create table waitlist_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz default now()
);

alter table waitlist_emails enable row level security;

-- App μπορεί μόνο να βάζει νέο email (όχι να διαβάζει/διαγράφει)
create policy "allow anon insert"
  on waitlist_emails
  for insert
  to anon
  with check (true);
```

**Table Editor** → `waitlist_emails` — εδώ θα εμφανίζονται τα emails.

### 3. API keys

**Project Settings** → **API**:

- **Project URL** → π.χ. `https://abcdefgh.supabase.co`
- **anon public** key → μακρύ string (ξεκινάει `eyJ...`)

### 4. `.env` στο project

Στο root του `appb2c`, δημιούργησε αρχείο `.env` (copy από `.env.example`):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...your_anon_key...
EXPO_PUBLIC_WAITLIST_TABLE=waitlist_emails
```

**Μην κάνεις commit το `.env`** — είναι ήδη στο `.gitignore`.

### 5. Restart Expo

```bash
npx expo start --clear
```

Ξανατρέξε την app στο κινητό. Δοκίμασε **Get Pro → Join waitlist** με test email.

### 6. Δες τα emails

Supabase → **Table Editor** → `waitlist_emails`

Ή **SQL Editor**:

```sql
select count(*) as total from waitlist_emails;
select email, created_at from waitlist_emails order by created_at desc;
```

Export: Table Editor → export CSV.

---

## Troubleshooting

| Πρόβλημα | Λύση |
|---------|------|
| «Could not submit» | Έλεγξε URL/key στο `.env`, restart με `--clear` |
| Duplicate email | Normal — unique constraint, ο χρήστης ήταν ήδη στη λίστα |
| Δεν φαίνεται `.env` | Πρέπει restart Metro **μετά** τη δημιουργία του `.env` |

---

## Αργότερα (όχι τώρα)

- Κωδικοί 50% off → όταν έχεις αρκετά emails
- Branch.io → referral install tracking
- RevenueCat → πραγματικές πληρωμές

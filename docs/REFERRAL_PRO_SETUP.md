# Referral Pro — οδηγός setup (ScreenSham)

Pro **τώρα** δίνεται μόνο μέσω invite φίλου. Το κουμπί **Get Pro** στο paywall είναι **waitlist** για μελλοντική πληρωμή (RevenueCat) — όχι άμεση πρόσβαση.

---

## Πώς δουλεύει (flow)

1. Ο χρήστης A μοιράζει link: `https://screensham.app/?ref=ABC123`
2. Ο φίλος B κάνει κλικ → εγκαθιστά από Play Store → ανοίγει την εφαρμογή
3. Το `ref` αποθηκεύεται τοπικά (`pendingReferrerCode`)
4. Όταν ο B **τελειώνει το onboarding**, η εφαρμογή καλεί Supabase RPC `register_referral`
5. Ο A παίρνει **+1 μήνα Pro** (μέχρι **3 μήνες σύνολο**)
6. Κάθε φορά που ανοίγει η εφαρμογή, γίνεται sync με `get_referrer_pro_status` → ενημερώνεται το `proExpiresAt` τοπικά

**Ο φίλος (B) δεν παίρνει Pro** — μόνο ο referrer (A).

---

## Anti-exploit (τι μπλοκάρει η βάση)

| Κανόνας | Πού |
|--------|-----|
| Max **3** επιτυχημένα referrals ανά κωδικό | `register_referral` → `v_max_referrals := 3` |
| **Όχι self-referral** (ίδιος κωδικός) | `p_referrer_code = p_new_user_code` → error |
| **Ένα credit ανά εγκατάσταση** | `referred_install_id` UNIQUE στο `referrals` |
| Stable install ID | `src/storage/installId.ts` — δεν αλλάζει με reinstall μόνο αν κρατήσεις data |
| Pro expiry από server | `pro_until` — μετά τη λήξη, `tier` γίνεται `free` |

> **Σημείωση:** Αν κάποιος ξαναεγκαταστήσει και καθαρίσει app data, παίρνει νέο `install_id` — αυτό είναι αποδεκτό για early stage. Για stricter control αργότερα: device fingerprint ή login.

---

## Βήμα 1 — Supabase SQL

1. Άνοιξε [Supabase Dashboard](https://supabase.com/dashboard) → project → **SQL Editor**
2. Τρέξε **ολόκληρο** το αρχείο:

```
docs/supabase-referrals.sql
```

3. Έλεγξε ότι δημιουργήθηκαν:
   - `referrals`
   - `referral_pro_grants`
   - `referrer_pro_status`
   - Functions: `register_referral`, `get_referrer_pro_status`

Το `.env` σου ήδη έχει (ίδια με waitlist):

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Δεν χρειάζεται extra env var — τα RPC τρέχουν με anon key.

---

## Βήμα 2 — Rebuild εφαρμογής

Μετά τις αλλαγές κώδικα:

```bash
npx expo run:android --device
```

---

## Βήμα 3 — Δοκιμή χωρίς Branch (dev)

### A) Βρες τον κωδικό σου

Settings → Manage Subscription → δες **YOUR INVITE LINK** → π.χ. `screensham.app/?ref=K7M2NP`

### B) Simulate νέος χρήστης με referral

Σε **δεύτερη συσκευή/emulator** (ή μετά από Reset Onboarding + clear data):

```bash
adb shell am start -a android.intent.action.VIEW \
  -d "screensham://open?ref=K7M2NP" \
  com.screensham.app
```

Ή:

```bash
adb shell am start -a android.intent.action.VIEW \
  -d "https://screensham.app/?ref=K7M2NP" \
  com.screensham.app
```

3. Ολοκλήρωσε onboarding στη «νέα» εγκατάσταση
4. Στο Supabase → **Table Editor** → `referrals` — πρέπει να εμφανιστεί row
5. Στο `referrer_pro_status` — ο κωδικός του A έχει `pro_until` ~1 μήνα μπροστά
6. Άνοιξε ξανά την εφαρμογή του A → unlimited blocked apps

### C) Έλεγχος cap (3 μήνες)

Μετά το 3ο επιτυχημένο referral, το 4ο καταγράφεται στο `referrals` αλλά **δεν** δίνει επιπλέon μήνα (`granted: false`, `reason: referrer_cap_reached`).

---

## Βήμα 4 — Play Store installs (χωρίς Branch, δωρεάν)

**Ενημέρωση:** Το Branch.io (~€40/μήνα) **δεν χρησιμοποιείται πια.** Αντί γι'
αυτό, η εφαρμογή χρησιμοποιεί το **Google Play Install Referrer API** —
επίσημο, δωρεάν API της Google που κάνει ακριβώς την ίδια δουλειά (attribution
Play Store install → referral code) χωρίς μηνιαίο κόστος ή custom domain.

Πλήρης οδηγός setup + testing: **[`docs/PLAY_INSTALL_REFERRER_SETUP.md`](./PLAY_INSTALL_REFERRER_SETUP.md)**

Σύντομα:
- Το invite link είναι πλέον Play Store URL:  
  `https://play.google.com/store/apps/details?id=com.screensham.app&referrer=ref%3DCODE`
- Native module `InstallReferrerModule.kt` διαβάζει το referrer στο πρώτο άνοιγμα
- Τα deep links (`screensham://`, `screensham.app/?ref=`) παραμένουν ως fallback
  για ήδη εγκατεστημένους χρήστες
- Test **μόνο** μέσω πραγματικό Play Store install (Internal Testing track) —
  όχι με `adb install`

---

## Τι βλέπει ο χρήστης

| Ενέργεια | Αποτέλεσμα |
|----------|------------|
| Free user | 1 blocked app |
| Referrer με ενεργό Pro | Unlimited apps μέχρι `pro_until` |
| Get Pro (waitlist) | Email στη λίστα — **όχι** άμεσο Pro |
| Share invite | Μήνυμα + link με `?ref=` |

---

## Αρχεία κώδικα

| Αρχείο | Ρόλος |
|--------|--------|
| `docs/supabase-referrals.sql` | Schema + RPC |
| `src/services/referralApi.ts` | Supabase calls |
| `src/services/referralService.ts` | Μετά onboarding |
| `src/storage/installId.ts` | Unique install |
| `src/storage/pendingReferral.ts` | Pending `ref` |
| `src/utils/referralAttribution.ts` | Deep link + install referrer capture |
| `src/utils/installReferrer.ts` | JS bridge στο native Play Install Referrer module |
| `android/.../InstallReferrerModule.kt` | Native: διαβάζει referrer από Play Store |
| `src/storage/subscriptionStorage.ts` | `proExpiresAt`, sync |
| `App.tsx` | Capture link + install referrer + register after onboarding |
| `HomeScreen.tsx` | Sync Pro on open |

---

## Troubleshooting

**Δεν εμφανίζεται Pro μετά referral**
- Έλεγξε `referrer_pro_status` στο Supabase
- Βεβαιώσου ότι ο φίλος **ολοκλήρωσε onboarding** (όχι μόνο install)
- Restart app στο τηλέφωνο του referrer

**RPC error / not configured**
- `.env` με σωστά Supabase keys
- Rebuild μετά αλλαγή `.env` (`expo run:android`)

**`already_registered`**
- Το ίδιο `install_id` προσπάθησε ξανά — expected

**Self-referral**
- Δεν δουλεύει αν βάλεις δικό σου κωδικό — expected

---

## Μελλοντικά

- [ ] EAS Build / Play Console production release
- [ ] Landing page στο `screensham.app` (προαιρετικό, μόνο για marketing — όχι απαραίτητο για το referral)
- [ ] RevenueCat — paid Pro αντί waitlist
- [ ] Κουπόνια 50% για waitlist emails (όταν έχεις αρκετά signups)

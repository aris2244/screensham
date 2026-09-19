# Referral Pro μέσω Google Play Install Referrer (δωρεάν)

Αντί για Branch.io (πληρωμένο, ~€40/μήνα), χρησιμοποιούμε το **Google Play Install
Referrer API** — επίσημο, δωρεάν API της Google φτιαγμένο ακριβώς για αυτή τη
δουλειά: «κάποιος πάτησε ένα link → εγκατέστησε από το Play Store → ποιος τον
έστειλε;».

**Κόστος: €0.** Δεν χρειάζεται λογαριασμός, SDK τρίτων, ή domain/landing page.

---

## Πώς δουλεύει

1. Ο χρήστης A μοιράζει link:
   ```
   https://play.google.com/store/apps/details?id=com.screensham.app&referrer=ref%3D5MWKQK
   ```
2. Ο φίλος B πατάει το link → ανοίγει Play Store → πατάει **Install**
3. Το Play Store **θυμάται** το `referrer=ref%3D5MWKQK` (URL-encoded `ref=5MWKQK`)
4. Μόλις ο B ανοίξει την εφαρμογή για πρώτη φορά, το native module
   (`InstallReferrerModule.kt`) ρωτάει το Play Store: *«με τι referrer
   εγκαταστάθηκα;»* και παίρνει πίσω `ref=5MWKQK`
5. Αποθηκεύεται ως **pending referral** (ίδιο σύστημα με τα deep links)
6. Όταν ο B ολοκληρώσει το onboarding, καλείται το `register_referral` RPC στο
   Supabase (ήδη υπάρχον flow) → ο A παίρνει **+1 μήνα Pro** (μέχρι 3 μήνες)

**Ο κώδικας που κάνει register/reward/anti-exploit είναι ο ίδιος με πριν** —
άλλαξε μόνο **πώς πιάνουμε τον κωδικό referral** στο πρώτο άνοιγμα μετά την
εγκατάσταση.

---

## Τι άλλαξε στον κώδικα

| Αρχείο | Τι κάνει |
|--------|----------|
| `android/app/build.gradle` | Πρόσθεσε `com.android.installreferrer:installreferrer:2.2` (Google, δωρεάν) |
| `android/.../InstallReferrerModule.kt` | Native module — διαβάζει το referrer από το Play Store |
| `android/.../InstallReferrerPackage.kt` | Καταχωρεί το module στο React Native |
| `android/.../MainApplication.kt` | Registers το package |
| `AndroidManifest.xml` | Πρόσθεσε `<package android:name="com.android.vending"/>` στα `<queries>` (χρειάζεται στο Android 11+ για να «βλέπει» το Play Store app) |
| `src/utils/installReferrer.ts` | JS bridge: `getPlayInstallReferrerCode()` |
| `src/utils/referralAttribution.ts` | `captureInstallReferrer()` — τρέχει 1 φορά ανά install |
| `App.tsx` | Καλεί το `captureInstallReferrer()` στο cold start |
| `ProPaywallModal.tsx` | Το «Share invite link» στέλνει πλέον Play Store link με `&referrer=ref%3DCODE` |

Το παλιό deep-link σύστημα (`screensham://`, `https://screensham.app/?ref=`)
**παραμένει** — χρησιμεύει όταν η εφαρμογή είναι ήδη εγκατεστημένη (π.χ. κάποιος
ξανανοίγει το link σου). Το Install Referrer καλύπτει την **κύρια περίπτωση**:
νέος χρήστης που δεν έχει ακόμα την εφαρμογή.

---

## Βήμα 1 — Rebuild

Υποχρεωτικό μετά τις native αλλαγές (Kotlin + Gradle + Manifest):

```bash
npx expo run:android --device
```

Αν δεις gradle sync error για το `installreferrer` dependency, σιγουρέψου ότι
έχεις internet στο build (κατεβάζει από Maven Central, δωρεάν πακέτο).

---

## Βήμα 2 — Ανέβασε την εφαρμογή στο Play Console (Internal Testing)

**Σημαντικό:** Το Install Referrer **δεν μπορεί να δοκιμαστεί με `adb install`
ή dev build** — χρειάζεται πραγματικό install από το Play Store. Ελάχιστη
απαίτηση: **Internal Testing track** (δωρεάν, δεν χρειάζεται δημόσια δημοσίευση).

1. [Play Console](https://play.google.com/console) → δημιούργησε την εφαρμογή
   (αν δεν υπάρχει ήδη) με package `com.screensham.app`
2. **Release → Testing → Internal testing** → δημιούργησε release, ανέβασε ένα
   signed AAB/APK (`npx expo run:android --variant release` ή EAS Build)
3. Πρόσθεσε το δικό σου email/λογαριασμό ως **tester**
4. Πάρε το **opt-in link** του internal testing (π.χ.
   `https://play.google.com/apps/internaltest/...`) — μπες με αυτό μία φορά
   ώστε ο λογαριασμός σου να «βλέπει» την εφαρμογή στο Play Store σαν
   κανονικό installable app

> Αν ήδη έχεις ανεβασμένη την εφαρμογή (production ή testing), προχώρα κατευθείαν
> στο Βήμα 3.

---

## Βήμα 3 — Δοκιμή αναφοράς (referral test)

1. Στο τηλέφωνο του referrer (ή στο Settings της εφαρμογής) βρες τον κωδικό,
   π.χ. `5MWKQK`
2. Σε **άλλη συσκευή** (ή afou κάνεις πλήρη απεγκατάσταση + clear στην ίδια):
   - Άνοιξε browser και πήγαινε στο:
     ```
     https://play.google.com/store/apps/details?id=com.screensham.app&referrer=ref%3D5MWKQK
     ```
   - Πάτα **Install** από το Play Store (όχι sideload)
3. Άνοιξε την εφαρμογή για πρώτη φορά — ολοκλήρωσε το onboarding
4. Στο Supabase → **Table Editor** → `referrals` — πρέπει να εμφανιστεί νέο row
5. Στο `referrer_pro_status` — ο κωδικός `5MWKQK` έχει `pro_until` ~1 μήνα μπροστά
6. Άνοιξε ξανά την εφαρμογή στο τηλέφωνο του referrer → unlimited blocked apps

**Γιατί δεν δοκιμάζουμε με `adb`:** Το Install Referrer API μιλάει με την
πραγματική υπηρεσία του Play Store app (`com.android.vending`) στη συσκευή. Αν
δεν εγκαταστάθηκε μέσω Play Store με αυτό το URL, δεν θα υπάρχει referrer data
— η κλήση θα επιστρέψει `null`, όχι error.

---

## Anti-exploit (ίδιο με πριν, δεν άλλαξε)

| Κανόνας | Πού |
|--------|-----|
| Max **3 μήνες** δωρεάν ανά κωδικό | `register_referral` RPC (Supabase) |
| Όχι self-referral | Ελέγχεται server-side |
| 1 credit ανά εγκατάσταση | Unique `install_id` (`src/storage/installId.ts`) |
| Λήξη Pro | `pro_until` — μετά τη λήξη ξαναγίνεται free |

Επιπλέον προστασία με το Install Referrer: αφού διαβάζεται **μία φορά** ανά
install (flag `install_referrer_checked` στο AsyncStorage), δεν μπορεί να
ξαναδιαβαστεί/παραποιηθεί μετά το πρώτο άνοιγμα.

---

## Περιορισμοί που πρέπει να ξέρεις

- **Μόνο Play Store installs.** Sideload / APK που στέλνεις εσύ απευθείας δεν
  περνάει referrer.
- **Χρονικό παράθυρο.** Η Google κρατάει το referrer data για μικρό διάστημα
  μετά το install (συνήθως αρκετό — διαβάζεται στο πρώτο άνοιγμα, οπότε δεν
  είναι πρόβλημα σε normal χρήση).
- **Δεν λειτουργεί σε emulator χωρίς Play Store** (π.χ. AOSP emulator images).
  Χρησιμοποίησε emulator image με Play Store ή πραγματική συσκευή.
- **Δεν αντικαθιστά πλήρως deferred deep linking σε κάθε σενάριο** (π.χ. δεν
  περνάει custom rich data πέρα από ένα string) — αλλά για το use case μας
  (ένας κωδικός referral) είναι απόλυτα αρκετό.

---

## Τι ΔΕΝ χρειάζεται πια

- ❌ Branch.io λογαριασμός / πληρωμή
- ❌ Custom domain για deferred deep linking
- ❌ Landing page για attribution (μπορείς να προσθέσεις αργότερα μόνο για
  marketing, όχι για να δουλέψει το referral)

---

## Μελλοντικά

- [ ] EAS Build / Play Console production release
- [ ] RevenueCat — paid Pro αντί waitlist
- [ ] Κουπόνια 50% για waitlist emails

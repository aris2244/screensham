# ScreenSham

**Block the apps that waste your day.** An Android app that uses your real usage data to enforce a daily limit on the apps you choose — with friction, not just a dumb timer, to make bypassing it annoying on purpose.

## What it does

- **App blocking with real usage data** — reads Android's Usage Stats to know how long you've spent in each app today, and blocks a chosen app once it hits your daily limit.
- **Friction, not a hard wall** — hitting the limit doesn't just lock you out silently; it shows a "friction lock" screen (with a one-time session bypass) and a "roast" notification system that nags you with configurable messages instead of politely asking.
- **Survives reboot** — a `BootReceiver` + background `WatchdogService` (native Kotlin) keep the block running even after the phone restarts, not just while the app is open.
- **Onboarding & permission setup** — guided flow to grant Android's Usage Access permission (required for any of this to work).
- **Referral system** — invite a friend with your link; once they finish onboarding, you get a free month of Pro (max 3 months). Tracked via Supabase, with anti-abuse rules enforced server-side (max referrals per code, no self-referral, one credit per install).
- **Play Store install attribution** — uses Google's official Play Install Referrer API (native module) to attribute installs to a referral code, so referral tracking doesn't depend on a paid attribution service.
- **Pro waitlist** — Pro has no real payment flow yet; "Get Pro" joins a waitlist (collected via Supabase) for a discount at launch.

## Tech stack

| Layer | Technology |
|---|---|
| App framework | React Native + Expo (dev client / bare workflow), TypeScript |
| Native (Android) | Kotlin modules: `UsageStatsModule`, `InstallReferrerModule`, `WatchdogService`, `BootReceiver`, `FrictionLockActivity`, `BlockOverlayManager` |
| Local storage | `@react-native-async-storage/async-storage` |
| Backend | None of its own — talks directly to Supabase (Postgres + REST + RPC) for the waitlist and referral system |
| Navigation | `@react-navigation/native` |

## Project structure

```
.
├── App.tsx                          # App entry: watchdog, referral capture, navigation
├── src/
│   ├── screens/                      # Onboarding, permission setup, home, friction lock
│   ├── components/home/                # Modals: paywall, settings, daily limit, monthly overview
│   ├── services/
│   │   ├── proInterestApi.ts            # Waitlist email → Supabase REST
│   │   └── referralApi.ts                 # Referral register/status → Supabase RPC
│   ├── storage/                             # AsyncStorage wrappers (profile, blocked apps, subscription, etc.)
│   ├── utils/                                 # Usage stats, watchdog bridge, notifications, referral attribution
│   └── constants/                               # Colors, roast copy, subscription config, package names
├── android/app/src/main/java/com/screensham/app/  # Native Kotlin modules (see above)
├── _native_modules_ready_to_copy/                   # Older/reference copies of native modules — the live ones are under android/app/src/main/java/
├── docs/
│   ├── WAITLIST_SUPABASE.md                           # Supabase setup for the waitlist table
│   ├── REFERRAL_PRO_SETUP.md                            # Supabase setup for the referral system
│   ├── PLAY_INSTALL_REFERRER_SETUP.md                      # Play Install Referrer API setup
│   └── supabase-referrals.sql                                # SQL schema + RPC functions for referrals
└── .env.example                                                # Template for required environment variables
```

## Getting started

### 1. Prerequisites

- Node.js, Android Studio / an Android device or emulator
- A Supabase project (free tier is enough) — only needed for the waitlist and referral features; the core blocking/friction features work without it

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in your Supabase project URL and **anon** key (see `docs/WAITLIST_SUPABASE.md` and `docs/REFERRAL_PRO_SETUP.md` for the full setup, including the SQL schema and Row Level Security policies). **Never commit `.env`** — it's already covered by `.gitignore`.

### 4. Run on Android

```bash
npx expo run:android
```

### 5. Release builds

Copy `android/gradle.properties.example` to `android/gradle.properties` and fill in your own release-signing values (keystore path, alias, passwords). **Never commit the real `gradle.properties` or your release keystore** — both are already covered by `.gitignore`. The debug keystore (`android/app/debug.keystore`) is the standard shared Android debug key used by every React Native project and is intentionally committed — it is not a secret.

## Security notes

The Supabase key used by the client (`EXPO_PUBLIC_SUPABASE_ANON_KEY`) is the **anon/public** key, by design — it's meant to be shipped inside the app bundle. It only works because every table it touches has Row Level Security enabled with policies that limit the anon role to exactly what's safe (insert-only on the waitlist table, and the referral logic runs through Postgres RPC functions with server-side anti-abuse checks, not direct table access). If you fork this project and add new Supabase tables, make sure RLS is enabled before using the anon key against them — never put a `service_role` key in client code.

No API keys, passwords, or other secrets were found hardcoded in this repository's source or its git history.

## License

No license has been specified yet. All rights reserved by default until one is added.

# Working notes

Running log for picking the project up on another computer. `README.md` is
user-facing, `CLAUDE.md` is the code map, `CHECKLIST.md` is the on-device QA
list — this file is "where things stand and what's next".

## Set up on a new machine

```bash
git clone https://github.com/Asbatty/WorksOut.git
cd WorksOut
npm ci
npm run dev        # http://localhost:5173/WorksOut/
npm test           # vitest, node env
npm run build      # validate routine.json -> tsc -b -> vite build
npm run preview -- --port 4318
```

- **Node is a portable winget install on the Windows box** and fresh shells
  don't get it on PATH. Prefix commands with:
  `$env:Path = "C:\Users\andre\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64;$env:Path"`
  (bash: prepend the same dir to `$PATH`). On another machine just install Node 20+.
- Deploy is automatic: push to `main` -> `.github/workflows/deploy.yml` builds
  and publishes to GitHub Pages (`https://asbatty.github.io/WorksOut/`). Repo
  must stay **public** and Pages Source = **GitHub Actions**.

## Current status (2026-09-07)

- Branch **`multi-user-onboarding`**, PR **#1** -> `main`
  (https://github.com/Asbatty/WorksOut/pull/1). **Not merged.**
- `npm run build` and 49 tests pass.
- **Blocking merge:** the first-run wizard and the Android install prompt have
  not been exercised on a real phone. Run the `CHECKLIST.md` *First-run wizard*
  and *Backup nudge & install reminder* sections on an Android device and an
  iPhone.

## Background: what was asked and decided (2026-09-06/07 session)

Original ask (Andrew):

1. Anyone with the link on their phone should get **their own user**, not the
   `andrew` one.
2. **First visit asks who you are** — name, weight, experience, desired program
   — and sets the app up from that.
3. A **better way to store user data** so it isn't lost if the site's storage
   is cleared. Ideas floated: an open-source spreadsheet-style store, or a
   Google account creating a Google Sheet that syncs periodically as a backup.
4. Talk the options through with pros/cons *before* building anything.

Clarifications he gave during the discussion:

- **One phone per person.** Multi-device sync is pointless here.
- **iPhones are in the group.** It should be available to anyone who wants it.
- He wants **zero infrastructure**: nothing he runs, nothing he owns, no
  server, no OAuth app. It should just run locally on each user's phone.
- The **spreadsheet / Google Sheet idea doesn't matter** to him — being able to
  read the data as a grid was never the point. He just wants users to be able
  to **actively save their data** so it survives.

Options weighed, and why each landed where it did:

| Option | Verdict |
|---|---|
| **A. Keep data on the phone, make it sturdy** — install to home screen (stops browsers auto-wiping it) + `navigator.storage.persist()` + one-tap backup to the user's own iCloud/Drive with nudges | **Chosen.** Only option that needs no server, no account, no OAuth app, and works on iPhone for unlimited users. Weakness: the backup is a manual tap. |
| B. Auto-save to each user's Google Drive (`drive.file`) | Rejected for now. Genuinely automatic, but Andrew would have to create and *own* a Google Cloud OAuth app and pass Google's verification (privacy policy, domain checks) so strangers don't hit a scary warning. That's "owning something". Keep as the escalation if manual backups prove unreliable. |
| C. Ship via App Store / Play Store (Capacitor) so the OS backs data up to iCloud/Google automatically | Rejected for now. Truly automatic and no server, but $99/yr Apple + review. The codebase is already kept Capacitor-compatible, so this stays open. |
| Google **Sheets** specifically (his idea) | Dropped. Would need flattening nested sessions/sets into rows (fragile work) or a JSON blob in a cell (defeats the readable-grid point he didn't care about anyway). |
| Firebase / Supabase / self-hosted Cloudflare Worker | Rejected — all are "a service Andrew runs/owns", which he explicitly doesn't want. |

Extra decision from the discussion: the **install step must come before profile
setup**, because on iOS a home-screen web app doesn't reliably share storage
with the Safari tab — entering data first and installing after can lose it.
So installing first is correctness, not just UX.

Then: write a memory doc, clone the repo, build it, commit + push the branch,
open the PR, and keep this file current for work across machines.

## What this branch does

Goal: the app is shared by link, so a fresh visitor should set *themselves* up
instead of inheriting the hardcoded "Andrew" profile, and should be pushed to
install (on iOS a home-screen web app is the only place a tab's stored data
reliably survives more than ~a week).

- **Schema** — `AppState` gains `onboarded`, `lastBackupAt`,
  `installReminderDismissed` (device-global). **No `SCHEMA_VERSION` bump.**
  `migrate()` sets `onboarded: true` when the stored state already has logged
  workouts, so existing installs (incl. Andrew's phone) never see the wizard.
- **Neutral default profile** — `DEFAULT_PROFILE_ID` is now `"me"`, name "You",
  beginner, 160 lb. The wizard overwrites name / bodyweight / experience /
  program on the last step.
- **`src/screens/Onboarding.tsx`** — gated in `App.tsx` on `!onboarded`:
  1. Install step, shown only in a browser tab (skipped on desktop or when
     already `display-mode: standalone`). Android: one-tap button from a
     captured `beforeinstallprompt`, auto-advances on `appinstalled`. iOS:
     Share -> Add to Home Screen instructions + "use Safari" note. Always a
     "Skip for now".
  2. name -> bodyweight -> experience -> program. Store writes happen only in
     `finish()`.
- **`src/platform.ts`** — `isIOS()`, `isAndroid()`, `isDesktop()`,
  `isStandalone()`, `canPromptInstall()`, `promptInstall()`. Registers the
  `beforeinstallprompt` listener at import time (must beat the event) and
  re-broadcasts it as an `install-available` window event.
- **`src/persistence.ts`** — `requestPersistentStorage()` wraps
  `navigator.storage.persist()`, called fire-and-forget from `main.tsx`.
  Real effect on Chromium; a no-op on iOS (install is what matters there).
- **`src/components/Reminders.tsx`** — app-level, same screen slot as the
  update toast, never both at once:
  - install reminder for someone who skipped it in the wizard; "Got it" sets
    `installReminderDismissed` and it's gone for good.
  - backup nudge once `workoutsSinceBackup()` >= 3; "Back up" calls the
    existing `exportBackup()` then `noteBackup()`; "Later" hides it for the
    session.
- **`src/history.ts`** — `workoutsSinceBackup(sessions, lastBackupAt)`, pure,
  tested in `src/history.test.ts`.
- **`Settings.tsx`** — "Your data" shows the last backup date; the export
  button now also calls `noteBackup()`.

### Files added

```
src/screens/Onboarding.tsx
src/components/Reminders.tsx
src/platform.ts
src/persistence.ts
src/history.test.ts
```

### Files changed

```
src/types.ts          AppState fields
src/storage.ts         defaultState + migrate + neutral DEFAULT_PROFILE_ID
src/store.ts           setOnboarded, noteBackup, dismissInstallReminder
src/App.tsx            gate on !onboarded, render <Reminders/>
src/main.tsx           import ./platform, call requestPersistentStorage()
src/history.ts         workoutsSinceBackup()
src/screens/Settings.tsx
src/index.css          .onboarding*, .reminder*
src/schedule.test.ts   test AppState literal needs onboarded
src/storage.test.ts    migrate cases for the new fields
README.md CLAUDE.md CHECKLIST.md
```

## Key decisions (don't relitigate without reason)

- **Storage approach = keep data on the phone, make that sturdy** (install +
  `persist()` + backup nudges). No cloud sync, no accounts, no service we run,
  no OAuth app to own. Chosen because: users are phone-only, one phone per
  person, iPhones in the mix, and Andrew wants zero infrastructure. The
  next step up if people keep losing data is a Google Drive `drive.file`
  auto-backup (needs a Google Cloud OAuth app + verification — a chore we'd
  own). App Store / Capacitor (OS does iCloud/Android backup automatically) is
  the option after that; costs $99/yr Apple + review.
- **`localStorage` -> IndexedDB: deferred.** On iOS, eviction clears
  localStorage + IndexedDB + caches together, so IndexedDB buys ~nothing there,
  and localStorage's ~5 MB is many years of workout logs. Converting the
  synchronous store to async loading wasn't worth the regression risk. Easy to
  add later if wanted — `src/storage.ts` is the single seam.
- **No `SCHEMA_VERSION` bump for the new fields** — they're additive and
  `migrate()` fills them in; nothing needs transforming.

## Next steps / TODO

- [ ] Real-device QA (see "Current status"). Then merge PR #1.
- [ ] Consider: the update toast and a `Reminders` bar can overlap if both fire
      at once (same `bottom`, same `z-index: 30`). Rare; offset one if it bites.
- [ ] Optional: `localStorage` -> IndexedDB + `navigator.storage.persisted()`
      surfaced in Settings so a user can see whether their data is protected.
- [ ] Optional next tier: Google Drive `drive.file` auto-backup after each
      finished workout (see decisions above for the cost).
- [ ] The iOS Share glyph in the wizard is a hand-drawn inline SVG
      (`ShareGlyph` in `Onboarding.tsx`); fine, but not pixel-accurate to
      Apple's icon.

## Watch out for

- **Service worker caches aggressively.** During local QA, unregister the SW
  and clear site data or you'll test stale code. `devOptions.enabled: false`
  means no SW in `npm run dev` — the install prompt only appears under
  `npm run build && npm run preview`.
- `base` in `vite.config.ts` is `/WorksOut/`, case-sensitive, must match the
  repo name.
- Tests run in **node** env; `store.test.ts` shims `localStorage`. Keep
  store / suggest / schedule / migrate / history green — they're the only
  automated coverage.

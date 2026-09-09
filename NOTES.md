# NOTES — working context

Running log so context survives between machines and Claude Code sessions.
Claude Code session transcripts are stored **locally per machine** and don't
sync, so anything worth carrying forward goes here, gets committed, and is
pulled on the other computer. `CLAUDE.md` is the architecture map; `README.md`
is user-facing; `CHECKLIST.md` is the on-device QA list; this file is "where
things stand and what's next".

## Status — 2026-09-08

- **PR #1 (`multi-user-onboarding`) is MERGED and DEPLOYED.** Merged 2026-09-07,
  the merge commit deployed to GitHub Pages on 2026-09-08 (Actions run green).
  The first-run wizard, per-visitor profiles, `storage.persist()`, install
  prompt and backup nudges are all live at https://asbatty.github.io/WorksOut/ .
- `npm run build` and 49 unit tests pass. Onboarding flow still only exercised
  in Chrome at phone width — **not yet on a real phone.**
- `main` tip after the merge: `9704891`. Everything from the 2026-09-03/04
  session shipped earlier and was QA'd in Chrome at phone width (set rows on
  their own lines, no auto-expand, ghost-button glass, paper-plane detail link,
  skip-exercise, rest-stopwatch z-order, 3-program picker + local Profiles).
- 2026-09-08 follow-up (this session, uncommitted at time of writing → then
  committed): set/exercise compression on "done", rest-timer only-while-running
  + corner placement off Today, plus `SESSION.md` as the fast re-open doc.

## Open items

- **Onboarding — real-device QA (now post-ship).** Run the `CHECKLIST.md`
  *First-run wizard* and *Backup nudge & install reminder* sections on an
  Android phone and an iPhone. It merged without this pass, so it's verification
  of live behaviour, not a merge gate. The iOS Safari "Add to Home Screen" path
  is the untested one that matters most.
- **QA the 2026-09-08 UI changes** (`CHECKLIST.md` "Log a full workout" and
  "rest timer" sections) under `npm run build && npm run preview`.
- Decided against (still): rewriting the public commit email; adding a
  medical/training-advice disclaimer.

## In progress: multi-user onboarding + backups (branch `multi-user-onboarding`)

### What was asked (2026-09-06/07 session)

1. Anyone with the link on their phone gets **their own user**, not `andrew`.
2. **First visit asks who you are** — name, weight, experience, desired program
   — and sets the app up from that.
3. A **better way to store user data** so it isn't lost if site storage is
   cleared. Ideas floated: an open-source spreadsheet-style store, or a Google
   account creating a Google Sheet that syncs periodically as a backup.
4. Discuss the options with pros/cons *before* building anything.

Clarifications given during the discussion:

- **One phone per person.** Multi-device sync is pointless here.
- **iPhones are in the group;** it should be available to anyone who wants it.
- **Zero infrastructure** — nothing Andrew runs or owns, no server, no OAuth
  app. It should just run locally on each user's phone.
- The **spreadsheet / Google Sheet idea doesn't matter** — reading the data as
  a grid was never the point. He just wants users to **actively save their
  data** so it survives.

### Options weighed

| Option | Verdict |
|---|---|
| **A. Keep data on the phone, make it sturdy** — install to home screen (stops browsers auto-wiping it) + `navigator.storage.persist()` + one-tap backup to the user's own iCloud/Drive with nudges | **Chosen.** Only option needing no server, no account, no OAuth app, that works on iPhone for unlimited users. Weakness: the backup is a manual tap. |
| B. Auto-save to each user's Google Drive (`drive.file`) | Deferred. Genuinely automatic, but Andrew would have to create and *own* a Google Cloud OAuth app and pass Google's verification (privacy policy, domain checks) so strangers don't hit a scary warning. Escalation path if manual backups prove unreliable. |
| C. App Store / Play Store via Capacitor — the OS backs data up to iCloud / Google automatically | Deferred. Automatic and no server, but $99/yr Apple + review. Codebase is already kept Capacitor-safe, so this stays open. |
| Google **Sheets** specifically | Dropped. Needs fragile flattening of nested sessions/sets into rows, or a JSON blob in a cell (defeats the readable-grid point he didn't want anyway). |
| Firebase / Supabase / self-hosted Cloudflare Worker | Rejected — all are "a service Andrew runs/owns". |

Extra decision: the **install step comes before profile setup**. On iOS a
home-screen web app doesn't reliably share storage with the Safari tab, so
entering data first and installing after can lose it — install-first is
correctness, not just UX.

Follow-on requests in the session: write a memory doc, clone the repo, build
it, commit + push the branch, open PR #1, and keep this file current for work
across machines.

### What the branch implements

- **Schema** — `AppState` gains `onboarded`, `lastBackupAt`,
  `installReminderDismissed` (device-global). **No `SCHEMA_VERSION` bump.**
  `migrate()` sets `onboarded: true` when the stored state already has logged
  workouts, so existing installs (incl. Andrew's phone) skip the wizard.
- **Neutral default profile** — `DEFAULT_PROFILE_ID` is now `"me"`, name "You",
  beginner, 160 lb. The wizard overwrites name / bodyweight / experience /
  program on its last step.
- **`src/screens/Onboarding.tsx`** — gated in `App.tsx` on `!onboarded`:
  1. Install step, shown only in a browser tab (skipped on desktop or when
     already `display-mode: standalone`). Android: one-tap button from a
     captured `beforeinstallprompt`, auto-advances on `appinstalled`. iOS:
     Share → Add to Home Screen instructions + "use Safari" note. Always a
     "Skip for now".
  2. name → bodyweight → experience → program. Store writes only in `finish()`.
- **`src/platform.ts`** — `isIOS/isAndroid/isDesktop/isStandalone`,
  `canPromptInstall`, `promptInstall`. Registers the `beforeinstallprompt`
  listener at import time (must beat the event) and rebroadcasts it as an
  `install-available` window event.
- **`src/persistence.ts`** — `requestPersistentStorage()` wraps
  `navigator.storage.persist()`, fire-and-forget from `main.tsx`. Real effect
  on Chromium; a no-op on iOS (install is what matters there).
- **`src/components/Reminders.tsx`** — app-level, same screen slot as the
  update toast, never both at once: a one-time install reminder (`Got it` sets
  `installReminderDismissed`), and a backup nudge once `workoutsSinceBackup()`
  ≥ 3 that shares a backup via the existing `exportBackup()` then `noteBackup()`.
- **`src/history.ts`** — `workoutsSinceBackup(sessions, lastBackupAt)`, pure,
  tested in `src/history.test.ts`.
- **`Settings.tsx`** — "Your data" shows the last backup date; the export
  button also calls `noteBackup()`.
- Docs updated: `README.md`, `CLAUDE.md`, `CHECKLIST.md`.

Files added: `src/screens/Onboarding.tsx`, `src/components/Reminders.tsx`,
`src/platform.ts`, `src/persistence.ts`, `src/history.test.ts`. Changed:
`types.ts`, `storage.ts`, `store.ts`, `App.tsx`, `main.tsx`, `history.ts`,
`screens/Settings.tsx`, `index.css`, `schedule.test.ts`, `storage.test.ts`.

### Deferred on purpose

- **`localStorage` → IndexedDB.** On iOS, eviction clears localStorage +
  IndexedDB + caches together, so IndexedDB buys ~nothing there, and
  localStorage's ~5 MB is many years of workout logs. Converting the
  synchronous store to async loading wasn't worth the regression risk.
  `src/storage.ts` is the single seam if it's added later.

## Backlog / ideas (not committed to)

- Capacitor wrapper for a real installable Android build (code kept
  WebView-safe per `CLAUDE.md`) — this is also option C above.
- Google Drive `drive.file` auto-backup after each finished workout — option B
  above; only if manual backups prove unreliable.
- The update toast and a `Reminders` bar can overlap if both fire at once
  (same `bottom`, `z-index: 30`). Rare; offset one if it bites.
- Surface `navigator.storage.persisted()` in Settings so a user can see whether
  their data is protected.
- No automated browser/E2E coverage — only node unit tests
  (schedule/suggest/storage/store/history). `CHECKLIST.md` is the manual gate.

## Machine setup

```bash
git clone https://github.com/Asbatty/WorksOut.git
cd WorksOut
npm ci
npm run dev        # http://localhost:5173/WorksOut/
npm test           # vitest, node env
npm run build      # validate routine.json -> tsc -b -> vite build
npm run preview -- --port 4318
```

- **Windows box:** Node is a portable winget install and fresh shells don't get
  it on PATH. Prefix commands with:
  `$env:Path = "C:\Users\andre\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64;$env:Path"`
  (bash: prepend the same dir to `$PATH`). On another machine just install
  Node 20+.
- The install prompt and service worker only exist in a real build
  (`devOptions.enabled: false`), so QA the wizard under
  `npm run build && npm run preview`, not `npm run dev`. Clear site data /
  unregister the SW between runs or you'll see stale code.
- `base` in `vite.config.ts` is `/WorksOut/`, case-sensitive, must match the
  repo name. Deploy is automatic: push to `main` → `.github/workflows/deploy.yml`
  → GitHub Pages (`https://asbatty.github.io/WorksOut/`). Repo stays **public**,
  Pages Source = **GitHub Actions**.

## Carrying context to the other computer

1. `git pull` on that machine — it gets this file + `CLAUDE.md`.
2. To reuse an exact past session instead: copy the `.jsonl` from
   `~/.claude/projects/<matching-folder>/` on the source machine into the same
   path on the target, then `claude --resume`.

## Session log

- **2026-09-08** — PR #1 merged + deployed. Then: `SESSION.md` fast-reopen doc;
  set folds to a summary line when ticked done and the exercise card
  auto-collapses after its last set; rest timer renders only while running and
  drops to the bottom-right corner on any screen other than an active Today
  workout. `SetRow.tsx`, `Today.tsx`, `RestTimer.tsx`, `index.css`, docs.
- **2026-09-06/07** — multi-user first-run wizard + per-visitor profiles +
  install prompt + backup nudges, on branch `multi-user-onboarding` / PR #1.
  `navigator.storage.persist()` added; `localStorage`→IndexedDB deferred. Not
  on `main`; needs real-device QA. Commits `31b73b3`, `1849dc7`, `6857fcd`
  (plus the merge of `main`).
- **2026-09-03/04** — set-row fix, undo/reopen finished workouts, multi-program
  splits, rest stopwatch, local profile switching, paper-plane detail link,
  skip-exercise, no auto-expand, rest timer z-order, `CLAUDE.md`. Commits
  `97ef9d7`..`4bd6980`.

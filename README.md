# Lift

An offline-first hypertrophy workout tracker meant to be shared by link. Vite +
React + TypeScript, packaged as a PWA and deployed to GitHub Pages. All data
lives on the phone; there is no backend and no account.

## First visit

Open the deployed URL — `https://<your-user>.github.io/WorksOut/` — on your
phone. A short first-run wizard walks every new user through:

1. **Adding Lift to the home screen.** Android shows a one-tap button; iPhone
   gets step-by-step instructions (it must be done from **Safari**). This isn't
   optional polish — a browser tab's storage gets wiped after about a week
   unused, especially on iOS, so installing first is what keeps your history.
   "Skip for now" is there if you insist; the app re-asks later.
2. **Setting up your profile** — name, bodyweight, experience, training split.

Everyone who opens the link gets their own data on their own phone. To update
the app: open it while online — it picks up new builds automatically and shows
an "Update available" toast — tap **Reload**.

## Daily use

- **Today** shows the next workout in the cycle. Tap **Start**, then use the
  big +/- steppers to log weight and reps per set and the ✓ to tick a set
  off. Everything is saved the instant you change it. **Finish workout** at
  the bottom advances the cycle.
- **Swap** (⇄ on an exercise) offers equipment-appropriate alternatives, for
  this session or "always".
- Tap an exercise name for its **form cue**, muscles, a YouTube form-check
  link, and your weight history with a chart.
- The **rest stopwatch** (bottom-right pill) auto-starts when you tick a set
  done; tap ⟳ to restart, ✕ to stop. It counts up, no alarm.
- **Calendar** and **History** show what you've done. **Editor** tweaks the
  current program. **Settings** picks the training split (Upper/Lower, Full
  Body, Push/Pull/Legs) and has export/import and profile.

## Training splits

Three programs ship in `routine.json`, all balanced hypertrophy for an
intermediate lifter and sharing one exercise library:

- **Upper / Lower** (4 days) — default; each muscle 2x/week.
- **Full Body** (3 days) — highest weekly frequency per muscle.
- **Push / Pull / Legs** (3–6 days) — rolling cycle.

Switch in **Settings → Program**. Switching restarts you at day 1 of the new
split; your per-exercise history and weight suggestions carry over. Each
program keeps its own in-app edits.

## Editing the routine

`public/routine.json` (schema v2) is one shared `exercises` library plus a
list of `programs`, each with a `name`, `description`, `daysPerWeek`, an
ordered `cycle`, and its `days`. To change it:

- **In the app:** use the **Editor** screen. Edits are stored as a local
  overlay and win over the file. **Settings → Reset routine to file**
  discards them.
- **In the repo:** edit `public/routine.json` directly and push. Run
  `npm run validate` first — the build also runs it and fails on a bad file.
  Every id used in a day slot or in an exercise's `alternatives` must exist
  in `exercises`, and day ids must be unique across programs. `ratio` is
  `{ beginner, intermediate, advanced }`, each a fraction of bodyweight for
  the middle of that exercise's rep range.

## Profiles

The first-run wizard sets up the profile for whoever opened the link. Beyond
that, **Settings → Profiles** keeps more than one person's training on the same
device — each profile has its own history, program, swaps and cycle position.
Switch anytime; the one you leave is saved, not lost. This is a local-only
convenience: there is no sign-in and nothing syncs between devices. Every
session records which profile logged it.

## Backups

The app keeps your data on the phone and asks the browser to hold onto it, but
the only thing that survives a new phone or a "clear browsing data" is an
export you saved somewhere.

**Settings → Export data** writes a `lift-backup-YYYY-MM-DD.json` covering
**every profile on the device** (via the share sheet — save it to Files /
iCloud Drive / Google Drive — or a plain download). After a few workouts pile
up with no backup, a nudge above the nav bar offers to do it in one tap; the
date of the last export is shown in **Settings → Your data**. **Import data**
reads a backup back and, after a confirmation that names the profile and
workout counts, replaces everything. Back up before clearing data or switching
phones.

## Run locally

```bash
npm install
npm run dev        # dev server at http://localhost:5173/WorksOut/
npm run build      # production build into dist/
npm run preview    # serve the production build
npm test           # unit tests for suggest.ts and schedule.ts
npm run gen-icons  # regenerate the PWA icons
```

## Deploy

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages
on every push to `main`. In the repo settings set **Pages → Build and
deployment → Source** to **GitHub Actions**. If you fork or rename the repo,
update `base` in `vite.config.ts` to `/<repo-name>/`.

## Notes

- Keep app logic independent of the browser shell so the same build can be
  wrapped with Capacitor for a Play Store release later. Don't use APIs a
  Capacitor WebView can't support.
- No UI, charting, or state libraries — just React state and `src/storage.ts`.

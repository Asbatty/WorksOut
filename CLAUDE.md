# WorksOut ("Lift") — dev map

Offline-first hypertrophy workout tracker. PWA, **no backend, no accounts**.
Vite + React 18 + TypeScript. Deployed to GitHub Pages at
`https://asbatty.github.io/WorksOut/` via `.github/workflows/deploy.yml` on push
to `main`. All data is in one `localStorage` key on the device.

This file is the fast on-ramp for future changes. README.md is user-facing;
CHECKLIST.md is the on-device QA list.

## Commands

```
npm run dev        # http://localhost:5173/WorksOut/
npm run build      # validate routine.json -> tsc -b -> vite build  (fails on any)
npm test           # vitest run (node env): schedule, suggest, storage, store
npm run preview    # serve dist/ (used for browser QA at :4318/:4319)
npm run validate   # scripts/validate-routine.mjs
npm run gen-icons  # regenerate public/icons/*.png (committed)
```

Node is a portable winget install; PATH isn't picked up by fresh shells — prefix:
`$env:Path = "C:\Users\andre\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64;$env:Path"`

## Architecture (data flow)

```
public/routine.json (schema v2 file: exercises[] + programs[])
        │  fetch (SW: network-first, cache fallback)
        ▼
src/routine.ts  activeProgram() + overlay -> flat Routine
        │
src/useRoutine.ts  hook: { routine, programs, activeProgramId, dayName(), ... }
        │
screens/*  read routine + useAppState(); call store mutators
        │
src/store.ts  external store (useSyncExternalStore), every mutator persists
        ▼
src/storage.ts  loadState/saveState (one localStorage key "lift.appstate"),
                SCHEMA_VERSION + migrate()
```

- `Routine` (flat: name/cycle/days/exercises) is what schedule.ts, suggest.ts and
  screens consume. It's built from the active `Program` + shared `exercises`,
  unless a per-program overlay replaces it.
- `schedule.ts` / `suggest.ts` / `history.ts` are **pure** — take args, no store,
  no DOM. That's why they're unit-tested and screens aren't.

## Files

| File | Role |
|---|---|
| `src/types.ts` | all types. `AppState` is schema **v3**. |
| `src/storage.ts` | localStorage IO, `SCHEMA_VERSION`, `migrate()`, export/import, `uid()` |
| `src/store.ts` | in-memory `AppState` + `useAppState()` + all mutators (autosave) |
| `src/routine.ts` | fetch file, pick active program, flatten to `Routine`, `validateRoutine()` |
| `src/useRoutine.ts` | the hook screens use; also `dayName(id)` resolves across all programs |
| `src/schedule.ts` | rolling cycle math (nextDay, workoutNumber, advance, positionAfterDay) |
| `src/suggest.ts` | starting weight + double progression (build-plan section 6) |
| `src/history.ts` | pull an exercise's past sets out of finished sessions |
| `src/router.tsx` | hand-rolled hash router (`#/today`, `#/exercise/:id`, `#/session/:id`, ...) |
| `src/App.tsx` | layout, bottom nav, `<RestTimer/>`, update toast |
| `screens/Today.tsx` | PlannedDay + ActiveWorkout (the big one) |
| `screens/Exercise.tsx` | cue, muscles, YouTube search, history list, `<Chart/>`, alternatives |
| `screens/{Calendar,History,SessionView}.tsx` | read-only views |
| `screens/Editor.tsx` | edits the active program -> `routineOverlays[programId]` |
| `screens/Settings.tsx` | profiles, program picker, profile fields, export/import, reset, wipe |
| `components/Stepper.tsx` | big +/- input, press-and-hold repeat, `mode` = decimal/numeric |
| `components/SetRow.tsx` | one set: header (num + Done toggle), weight row, reps row |
| `components/Chart.tsx` | dependency-free inline-SVG line chart |
| `components/RestTimer.tsx` | floating stopwatch pill (App-level) |
| `components/ExercisePicker.tsx` | searchable exercise list (Editor) |
| `scripts/validate-routine.mjs` | routine.json integrity (runs in `build`) |
| `scripts/gen-icons.mjs` | PNG icon generator (no image lib) |

## State model (AppState v3)

Flat fields = **the active profile's data**. Other profiles are parked:

```
schemaVersion: 3
activeProfileId, otherProfiles: Record<id, ProfileSnapshot>   // switchProfile moves data between flat <-> here
profile, sessions, cyclePosition, activeProgramId, swaps,
routineOverlays: Record<programId, Routine>                   // per-program in-app edits
routineFileVersion            // device-global
restStartedAt?: number        // rest stopwatch start epoch; >2h old dropped on load
```

- **Session lifecycle**: in-progress (`!finishedAt`) → finished (`finishedAt` set,
  `cycleAdvanced`, `prevCyclePosition`) → optionally reopened (`editing:true`,
  keeps `finishedAt`; latest one also rewinds the cycle). `activeSession()` =
  `!finishedAt || editing`.
- **ExerciseLog**: `exerciseId` (post-swap), `slotExerciseId` (original), `sets`,
  `note?`, `skipped?`. Skipped / no-working-set logs are excluded from history,
  suggestions, set counts, and render as "skipped"/"not performed".
- **Swaps**: `swaps["dayId:slotIndex"] = exerciseId` (persistent). Per-session
  swap lives on the ExerciseLog only.
- Autosave: every store mutator calls `saveState`. Never add a code path that
  mutates a session without going through the store.

## Conventions

- **Dark only.** CSS custom props in `:root` in `src/index.css` (`--bg`,
  `--surface`, `--surface-2`, `--border`, `--text`, `--text-dim`, `--accent`,
  `--good`/`--warn`/`--danger`, `--glass`/`--glass-border`, `--tap` 48px,
  `--nav-h`). One stylesheet, sectioned by comment headers.
- Tap targets ≥ 48px (`--tap`). `.ghost` buttons = frosted glass
  (`--glass` + `backdrop-filter`).
- **No UI / charting / state libraries.** Charts and icons are inline SVG.
- Routing is hash-based (GitHub Pages + future Capacitor). `navigate("#/...")`.
- Cross-component signals use `window` CustomEvents (e.g. `sw-need-refresh`,
  `finish-confirm`) — see App.tsx / RestTimer.tsx / Today.tsx.
- Keep logic browser-shell-independent (Capacitor later): no APIs a WebView lacks.

## How to make common changes

**Cosmetic tweak** → `src/index.css` (find the section header) and/or the JSX in
the relevant screen. Rebuild, `npm run preview`, QA in Chrome at phone width
(~430px). No schema/test impact.

**Add / edit a training split** → `public/routine.json` → `programs[]`. Give it a
unique `id`, `name`, `description`, `daysPerWeek`, `cycle` (day ids), `days`.
**Day ids must be globally unique across all programs.** Every `exerciseId` and
every `alternatives` id must exist in `exercises[]`. `npm run validate` (and the
build) enforce this. It auto-appears in Settings → Program.

**Add an exercise to the library** → `exercises[]` entry: `id` (slug), `name`,
`equipment[]`, `primary[]`, `secondary?[]`, `pattern`, `cue`, `loadType`
(`total`/`per-side`/`bodyweight`/`assisted`), `increment`, `ratio`
`{beginner,intermediate,advanced}` (× bodyweight for the rep-range midpoint),
`alternatives[]` (must resolve). Custom exercises added in the Editor get
`ratio` 0 / `loadType` "total".

**Change a suggestion rule** → `src/suggest.ts` only, then update
`src/suggest.test.ts`. Rules are build-plan section 6.

**Add a new screen** → new file in `screens/`, add a `Route` variant in
`src/router.tsx`, render it in `App.tsx`, add a `NAV` entry if it's a tab.

**Add an AppState field** → add to `types.ts`, default in `defaultState()`,
handle in `migrate()`, bump `SCHEMA_VERSION` only if old data needs
transforming. Add a `storage.test.ts` migration case. Backups carry the whole
AppState, so new fields survive export/import for free.

## Gotchas

- **Service worker** is `registerType: "autoUpdate"`. After a deploy the app
  shows an "Update available" toast; a hard reload / reopen picks up the new
  build. During local QA, unregister SW + clear caches or you'll see stale code.
- `base` in `vite.config.ts` is `/WorksOut/` — must match the repo name exactly
  (Pages path is case-sensitive). Change it if the repo is renamed.
- Line endings: `.gitattributes` forces LF. `preview.out`/`preview.err` are
  git-ignored QA artifacts.
- Tests run in **node** env; `store.test.ts` shims `localStorage`. Store/suggest/
  schedule/migrate are the safety net — keep them green, they're the only
  automated coverage.
- Deploy needs the repo **public** (free plan) and Pages **Source = GitHub
  Actions**.

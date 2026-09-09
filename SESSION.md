# SESSION.md — read this first, then stop

Fast open for Claude Code. Starting a session on WorksOut? This file replaces
re-reading README / NOTES / CHECKLIST and re-running git archaeology at the open.
Pull in the rest only when the task needs it — routing table below.

## Current state — verified 2026-09-08

Baseline: `9704891` (PR #1 merge) plus the 2026-09-08 UX commits on `main`,
all pushed and deployed.

- Branch `main`, clean. `multi-user-onboarding` is **merged** (PR #1) and
  **deployed**: the first-run wizard, per-visitor profiles,
  `navigator.storage.persist()`, install prompt and backup nudges are all live at
  https://asbatty.github.io/WorksOut/ .
- 2026-09-08 UX shipped: done sets fold to a summary line and an exercise card
  auto-collapses after its last set; the rest timer shows only while running and
  sits bottom-right except on an active Today workout; "Skip this workout" and
  "Do a different day" share a row (other secondary actions stay stacked).
- `npm test` → 49 pass. `npm run build` → clean (63 exercises, 3 programs, 10 days).
- **Open:** real-device QA of the onboarding + backup-nudge flow on a real
  Android phone *and* an iPhone (`CHECKLIST.md`, first two sections) — post-ship
  verification, not a merge gate. Also QA the fold / rest-timer changes
  (`CHECKLIST.md` "Log a full workout" + "rest timer").

## Health check — run once, only if you'll change code

```bash
export PATH="/c/Users/andre/AppData/Local/Microsoft/WinGet/Packages/OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe/node-v24.19.0-win-x64:$PATH"
cd "C:/Users/andre/Documents/WorksOut" && npm test && npm run build
```

Expect: 49 tests pass; build ends with `PWA v0.21.x … files generated`. Anything
else → debug that before starting the task.

## Is this file still current?

```bash
git -C "C:/Users/andre/Documents/WorksOut" log --oneline 9704891..HEAD
```

- Only the "Fold done sets…" commit → current. Trust it, don't re-research.
- More commits → skim them, do the task, then refresh the "Current state" block.
- Long / months stale → fall back to `NOTES.md` + full `git log`.

## Routing table — read only what the task touches

| Task | Read |
|---|---|
| Any code change | `CLAUDE.md` — architecture, file map, conventions, gotchas |
| Change a suggestion rule | `src/suggest.ts` + `src/suggest.test.ts` |
| Cycle / scheduling logic | `src/schedule.ts` + `src/schedule.test.ts` |
| Add/edit a split or exercise | `public/routine.json` + `CLAUDE.md` "How to make common changes" |
| Storage / migration / export-import | `src/storage.ts`, `src/store.ts`, `src/types.ts` |
| Onboarding / install / backup nudges | `src/screens/Onboarding.tsx`, `src/components/Reminders.tsx`, `src/platform.ts`, `src/persistence.ts` |
| A screen's UI | that file in `src/screens/` + `src/index.css` |
| On-device QA | `CHECKLIST.md` |
| User-facing wording / feature list | `README.md` |
| Why no cloud sync / decision history | `NOTES.md`, memory `worksout-lift-app` |

## Known minor issues (2026-09-08 review — none blocking)

- `Reminders.tsx`: `canPromptInstall()` isn't reactive — the install bar's "Add"
  button won't appear if `beforeinstallprompt` fires after the bar mounts.
- `platform.ts` `promptInstall()` nulls the deferred prompt before `.prompt()`; a
  dismissed native dialog can't be retried until Chromium re-fires the event.
- No E2E / browser tests by design — `CHECKLIST.md` is the only screen-level gate.

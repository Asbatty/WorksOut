# NOTES — working context

Running log so context survives between machines and Claude Code sessions.
Claude Code session transcripts are stored **locally per machine** and don't
sync, so anything worth carrying forward goes here, gets committed, and is
pulled on the other computer. `CLAUDE.md` is the architecture map; this file is
"where things stand and what's next".

## Status — 2026-09-07

- Tip commit `4bd6980`. Working tree clean, `main` == `origin/main`.
- Everything built in the 2026-09-03/04 session is shipped and was QA'd in
  Chrome at phone width:
  - Set rows: weight and reps each on their own full-width line.
  - No exercise auto-expands (on entry or after switching tabs).
  - Frosted-glass fill on `.ghost` buttons.
  - Paper-plane icon on each exercise in an active workout → detail page.
  - "⋯" exercise-options sheet → Skip; skipped exercise dims/collapses and is
    excluded from the finish summary counts.
  - Rest stopwatch auto-starts on a set ✓, counts up, and lifts above the
    finish-workout confirmation so both are readable.
  - Settings: 3-program picker (blocked mid-workout) + local Profiles card.
  - `CLAUDE.md` dev map added.

## Open items

- None. (Decided against: rewriting the public commit email, and adding a
  medical/training-advice disclaimer — both intentionally skipped.)

## Backlog / ideas (not committed to)

- Capacitor wrapper for a real installable Android build (code is already kept
  WebView-safe per CLAUDE.md).
- No automated browser/E2E coverage — only the node unit tests
  (schedule/suggest/storage/store). `CHECKLIST.md` is the manual gate.

## Carrying context to the other computer

1. `git pull` on that machine — it gets this file + `CLAUDE.md`.
2. To reuse an exact past session instead: copy the `.jsonl` from
   `~/.claude/projects/<matching-folder>/` on the source machine into the same
   path on the target, then `claude --resume`.

## Session log

- **2026-09-03/04** — set-row fix, undo/reopen finished workouts, multi-program
  splits, rest stopwatch, local profile switching, paper-plane detail link,
  skip-exercise, no auto-expand, rest timer z-order, `CLAUDE.md`. Commits
  `97ef9d7`..`4bd6980`.

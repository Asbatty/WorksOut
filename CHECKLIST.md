# Manual verification checklist (run on the phone)

Do this on the Galaxy S24 Ultra after a deploy, one-handed, standing up.

## Install & offline

- [ ] Open the GitHub Pages URL in Chrome. Page loads, dark theme, bottom nav.
- [ ] Chrome ⋮ → Add to Home screen → Install. Icon appears on the home screen.
- [ ] Launch from the home screen: opens full-screen (no browser chrome),
      portrait.
- [ ] Turn on Airplane mode. Kill and relaunch the app. It still opens and
      Today still renders.
- [ ] Back online, relaunch after a new deploy: "Update available" toast
      appears; tapping Reload loads the new build.

## Log a full workout

- [ ] Today shows the correct day name and "Workout N of 4", plus the next-3
      preview strip.
- [ ] First two compounds show "Warm up first".
- [ ] Start the workout. Each exercise shows a suggested weight and a reason
      line.
- [ ] Steppers: +/- change weight by the exercise increment and reps by 1;
      press-and-hold repeats. Tapping a number field opens the numeric keypad.
- [ ] Tick sets done. Reps default from last session's ghost value when you
      tick without typing.
- [ ] Add a note to one exercise.
- [ ] Force-close the app mid-workout, reopen: Today shows the in-progress
      workout with the "In progress" banner and all logged sets intact.
- [ ] Finish workout: confirmation shows the logged set count. After finishing,
      Today rolls to the next day and the cycle number advances.

## Swap an exercise

- [ ] Tap ⇄ on an exercise. The sheet lists alternatives with equipment tags.
- [ ] Pick one without "always": it swaps for this session only, sets reset to
      the new exercise's suggestion, an "swapped" tag shows.
- [ ] Swap again with "Always use this instead" ticked. Finish. Start the same
      day next cycle: the swap is still in place.

## Exercise detail

- [ ] Tap an exercise name. Cue, muscles, equipment show.
- [ ] "Watch on YouTube" opens a new tab searching "<name> form".
- [ ] After 2+ logged sessions, the history list and the weight chart render.

## Progression

- [ ] Log an exercise hitting repMax on every set. Next time it suggests
      +1 increment and "aim for repMin".
- [ ] Log one below repMin. Next time it holds the weight. Do it again: next
      time it suggests −1 increment.

## Calendar & History

- [ ] Calendar shows a dot + day abbreviation on each completed day. Month
      arrows work. Tapping a day opens that session read-only.
- [ ] History lists sessions newest first; expanding shows exercises and sets;
      "Open full view" opens the session.

## Editor

- [ ] Rename a day, reorder a slot, change a rep range, replace an exercise
      via search, add a slot, delete a slot.
- [ ] "Add custom exercise", then use it in a slot.
- [ ] Today reflects all edits. The "editing a local copy" banner shows.

## Export / import

- [ ] Settings → Export data. A `lift-backup-<date>.json` is shared/saved.
- [ ] Change bodyweight, log a session. Settings → Import data → pick the
      backup. Confirmation names the session counts. After Replace, the app
      matches the backup.
- [ ] Settings → Reset routine to file removes editor changes.
- [ ] Settings → Clear all data (double confirm) empties everything.

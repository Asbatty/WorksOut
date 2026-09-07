// App-level nudges that sit just above the bottom nav (same slot as the update
// toast). Two of them, and never both at once:
//
//  • InstallReminder — for someone who skipped "add to home screen" in the
//    wizard. Shown once; "Got it" silences it for good.
//  • BackupNudge — once a few workouts have piled up since the last export,
//    offers a one-tap backup to the phone's own cloud drive via the share sheet.
//
// Backups can't be verified (the share sheet never tells us if the user actually
// saved the file), so noteBackup() is best-effort on a resolved share.

import { useState } from "react";
import { dismissInstallReminder, noteBackup, useAppState } from "../store";
import { exportBackup } from "../storage";
import { workoutsSinceBackup } from "../history";
import {
  canPromptInstall,
  isDesktop,
  isStandalone,
  promptInstall
} from "../platform";

const NUDGE_AFTER = 3; // unsaved finished workouts before we prompt

export function Reminders() {
  const state = useAppState();

  const showInstall =
    state.onboarded &&
    !state.installReminderDismissed &&
    !isStandalone() &&
    !isDesktop();

  if (showInstall) return <InstallReminder />;

  const pending = workoutsSinceBackup(state.sessions, state.lastBackupAt);
  if (pending >= NUDGE_AFTER) return <BackupNudge pending={pending} />;

  return null;
}

function InstallReminder() {
  return (
    <div className="reminder" role="status">
      <span>
        Add Lift to your home screen so a cleared browser can't wipe your
        history.
      </span>
      <div className="reminder-actions">
        {canPromptInstall() && (
          <button
            className="primary small"
            onClick={() => void promptInstall()}
          >
            Add
          </button>
        )}
        <button className="ghost small" onClick={() => dismissInstallReminder()}>
          Got it
        </button>
      </div>
    </div>
  );
}

function BackupNudge({ pending }: { pending: number }) {
  const state = useAppState();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (dismissed) return null;

  return (
    <div className="reminder" role="status">
      <span>
        {pending} workout{pending === 1 ? "" : "s"} logged since your last backup.
        Save a copy to your Files / iCloud / Drive.
      </span>
      <div className="reminder-actions">
        <button
          className="primary small"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await exportBackup(state);
              noteBackup();
              setDismissed(true);
            } catch {
              // Leave the nudge up so they can retry.
            } finally {
              setBusy(false);
            }
          }}
        >
          Back up
        </button>
        <button className="ghost small" onClick={() => setDismissed(true)}>
          Later
        </button>
      </div>
    </div>
  );
}

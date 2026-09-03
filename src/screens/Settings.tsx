import { useRef, useState } from "react";
import { useRoutine } from "../useRoutine";
import {
  activeSession,
  createProfile,
  deleteProfile,
  profileList,
  replaceState,
  setActiveProgram,
  setRoutineOverlay,
  switchProfile,
  updateProfile,
  useAppState
} from "../store";
import {
  defaultState,
  exportBackup,
  readBackupFile,
  SCHEMA_VERSION
} from "../storage";
import { Stepper } from "../components/Stepper";
import type { Experience } from "../types";

const EXPERIENCE: Experience[] = ["beginner", "intermediate", "advanced"];

export function Settings() {
  const state = useAppState();
  const { fileVersion, programs, activeProgramId, routine } = useRoutine();
  const fileInput = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string>();
  const [pendingImport, setPendingImport] = useState<{
    apply: () => void;
    sessionCount: number;
    profileCount: number;
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(0); // 0, 1, 2 (double confirm)
  const [confirmReset, setConfirmReset] = useState(false);
  const [switchTo, setSwitchTo] = useState<string | null>(null);
  const [switchProfileId, setSwitchProfileId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [addingProfile, setAddingProfile] = useState(false);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);

  const hasOverlay = Boolean(state.routineOverlays[activeProgramId]);
  const workoutInProgress = Boolean(activeSession(state));
  const profiles = profileList(state);

  const onFile = async (file: File) => {
    setMsg(undefined);
    try {
      const { state: next, sessionCount, profileCount } = await readBackupFile(file);
      setPendingImport({
        apply: () => replaceState(next),
        sessionCount,
        profileCount
      });
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <>
      <h1>Settings</h1>
      {msg && <div className="edit-banner warn">{msg}</div>}

      <h2>Profiles</h2>
      <div className="card">
        {profiles.map((p) => (
          <div key={p.id} className="profile-row">
            <button
              className={p.active ? "program-opt on" : "program-opt"}
              disabled={p.active}
              onClick={() => setSwitchProfileId(p.id)}
            >
              <span className="program-opt-head">
                <strong>{p.name}</strong>
                <span className="dim small">
                  {p.sessionCount} workout{p.sessionCount === 1 ? "" : "s"}
                </span>
                {p.active && <span className="program-badge">Active</span>}
              </span>
            </button>
            {!p.active &&
              (deleteProfileId === p.id ? (
                <div className="row-btns">
                  <button className="mini" onClick={() => setDeleteProfileId(null)}>
                    Keep
                  </button>
                  <button
                    className="mini danger"
                    onClick={() => {
                      deleteProfile(p.id);
                      setDeleteProfileId(null);
                      setMsg("Profile deleted.");
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <button
                  className="mini danger"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => setDeleteProfileId(p.id)}
                >
                  ✕
                </button>
              ))}
          </div>
        ))}

        {switchProfileId && (
          <div className="confirm-bar">
            <span>
              Switch to{" "}
              <strong>{profiles.find((p) => p.id === switchProfileId)?.name}</strong>?
              Your current data stays saved under{" "}
              <strong>{state.profile.name}</strong>.
            </span>
            <div className="confirm-actions">
              <button className="ghost" onClick={() => setSwitchProfileId(null)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  switchProfile(switchProfileId);
                  setSwitchProfileId(null);
                }}
              >
                Switch
              </button>
            </div>
          </div>
        )}

        {addingProfile ? (
          <div className="confirm-bar">
            <label className="field">
              <span>New profile name</span>
              <input
                autoFocus
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
              />
            </label>
            <div className="confirm-actions">
              <button
                className="ghost"
                onClick={() => {
                  setAddingProfile(false);
                  setNewProfileName("");
                }}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={!newProfileName.trim()}
                onClick={() => {
                  createProfile(newProfileName);
                  setAddingProfile(false);
                  setNewProfileName("");
                  setMsg("Profile created — you're now on it.");
                }}
              >
                Create
              </button>
            </div>
          </div>
        ) : (
          <button className="wide" onClick={() => setAddingProfile(true)}>
            + Add profile
          </button>
        )}
        <p className="dim small">
          Profiles are separate on this device only — separate history, program,
          and swaps. There is no sign-in.
        </p>
      </div>

      <h2>Active profile</h2>
      <div className="card">
        <label className="field">
          <span>Name</span>
          <input
            value={state.profile.name}
            onChange={(e) => updateProfile({ name: e.target.value })}
          />
        </label>

        <div className="field">
          <span>Bodyweight (lb)</span>
          <Stepper
            label="Bodyweight"
            value={state.profile.bodyweightLb}
            step={1}
            min={50}
            onChange={(v) => updateProfile({ bodyweightLb: v })}
          />
        </div>

        <span className="field-label">Experience</span>
        <div className="chip-toggle-grid">
          {EXPERIENCE.map((x) => (
            <button
              key={x}
              className={state.profile.experience === x ? "chip-toggle on" : "chip-toggle"}
              onClick={() => updateProfile({ experience: x })}
            >
              {x}
            </button>
          ))}
        </div>
        <p className="dim small">
          Bodyweight and experience only affect the starting guess for exercises
          you haven't logged yet. Anything with history keeps progressing from
          your real numbers.
        </p>
      </div>

      <h2>Your data</h2>
      <div className="card">
        <button
          className="primary wide"
          onClick={async () => {
            try {
              await exportBackup(state);
              setMsg("Backup exported.");
            } catch (e) {
              setMsg((e as Error).message);
            }
          }}
        >
          Export data (JSON)
        </button>

        <button className="wide" onClick={() => fileInput.current?.click()}>
          Import data…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />

        {pendingImport && (
          <div className="confirm-bar">
            <span>
              Replace <strong>all profiles and data</strong> on this device with
              this backup? It contains <strong>{pendingImport.profileCount}</strong>{" "}
              profile{pendingImport.profileCount === 1 ? "" : "s"} and{" "}
              <strong>{pendingImport.sessionCount}</strong> workout
              {pendingImport.sessionCount === 1 ? "" : "s"}.
            </span>
            <div className="confirm-actions">
              <button className="ghost" onClick={() => setPendingImport(null)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  pendingImport.apply();
                  setPendingImport(null);
                  setMsg("Data imported.");
                }}
              >
                Replace
              </button>
            </div>
          </div>
        )}
      </div>

      <h2>Program</h2>
      <div className="card">
        {programs.map((p) => {
          const current = p.id === activeProgramId;
          return (
            <button
              key={p.id}
              className={current ? "program-opt on" : "program-opt"}
              disabled={workoutInProgress && !current}
              onClick={() => !current && setSwitchTo(p.id)}
            >
              <span className="program-opt-head">
                <strong>{p.name}</strong>
                <span className="dim small">{p.daysPerWeek} days/wk</span>
                {current && <span className="program-badge">Active</span>}
              </span>
              <span className="dim small">{p.description}</span>
            </button>
          );
        })}
        {workoutInProgress && (
          <p className="dim small">Finish your current workout to switch programs.</p>
        )}
        {switchTo && (
          <div className="confirm-bar">
            <span>
              Switch to{" "}
              <strong>{programs.find((p) => p.id === switchTo)?.name}</strong>? You'll
              start at day 1. Your logged history is kept.
            </span>
            <div className="confirm-actions">
              <button className="ghost" onClick={() => setSwitchTo(null)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  setActiveProgram(switchTo);
                  setSwitchTo(null);
                  setMsg("Program switched.");
                }}
              >
                Switch
              </button>
            </div>
          </div>
        )}
      </div>

      <h2>Routine edits</h2>
      <div className="card">
        <p className="dim small">
          {hasOverlay
            ? `You're using a locally edited copy of ${routine?.name ?? "this program"}.`
            : "You're using this program as shipped in routine.json."}
        </p>
        {!confirmReset ? (
          <button
            className="wide"
            disabled={!hasOverlay}
            onClick={() => setConfirmReset(true)}
          >
            Reset this program to file
          </button>
        ) : (
          <div className="confirm-bar">
            <span>Discard your local edits to {routine?.name}?</span>
            <div className="confirm-actions">
              <button className="ghost" onClick={() => setConfirmReset(false)}>
                Keep edits
              </button>
              <button
                className="danger"
                onClick={() => {
                  setRoutineOverlay(activeProgramId, undefined);
                  setConfirmReset(false);
                  setMsg("Routine reset to file.");
                }}
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      <h2>Danger zone</h2>
      <div className="card">
        {confirmClear === 0 && (
          <button className="danger wide" onClick={() => setConfirmClear(1)}>
            Clear all data
          </button>
        )}
        {confirmClear === 1 && (
          <div className="confirm-bar">
            <span>This deletes every session, swap, and routine edit.</span>
            <div className="confirm-actions">
              <button className="ghost" onClick={() => setConfirmClear(0)}>
                Cancel
              </button>
              <button className="danger" onClick={() => setConfirmClear(2)}>
                Continue
              </button>
            </div>
          </div>
        )}
        {confirmClear === 2 && (
          <div className="confirm-bar">
            <span>
              <strong>Really wipe everything?</strong> This can't be undone.
              Export a backup first if you're not sure.
            </span>
            <div className="confirm-actions">
              <button className="ghost" onClick={() => setConfirmClear(0)}>
                Cancel
              </button>
              <button
                className="danger"
                onClick={() => {
                  replaceState(defaultState());
                  setConfirmClear(0);
                  setMsg("All data cleared.");
                }}
              >
                Wipe everything
              </button>
            </div>
          </div>
        )}
      </div>

      <h2>About</h2>
      <div className="card">
        <p className="dim small block">App version {__APP_VERSION__}</p>
        <p className="dim small block">Data schema v{SCHEMA_VERSION}</p>
        <p className="dim small block">
          Program: {routine?.name ?? activeProgramId}
          {hasOverlay ? " (locally edited)" : ""}
        </p>
        <p className="dim small block">
          routine.json version {fileVersion ?? (state.routineFileVersion || "unknown")}
        </p>
      </div>
    </>
  );
}

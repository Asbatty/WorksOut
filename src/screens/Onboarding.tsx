// First-run wizard. Shown by App whenever `state.onboarded` is false — i.e. a
// fresh install opened from the shared link. It does two jobs, in this order:
//
//  1. Get the app onto the home screen. On iOS a home-screen web app is the only
//     way stored data reliably survives (a Safari tab's storage is wiped after a
//     week unused), so installing BEFORE any data is entered is correctness, not
//     polish. Android gets a one-tap prompt; iOS gets pictured instructions.
//  2. Set up the profile: name, bodyweight, experience, training split.
//
// Nothing is written to the store until the final step, so an abandoned wizard
// just starts over. The install step is skippable and, on desktop or when
// already installed, not shown at all.

import { useEffect, useMemo, useState } from "react";
import { useRoutine } from "../useRoutine";
import { setActiveProgram, setOnboarded, updateProfile } from "../store";
import { Stepper } from "../components/Stepper";
import {
  canPromptInstall,
  isDesktop,
  isIOS,
  isStandalone,
  promptInstall
} from "../platform";
import type { Experience } from "../types";

const EXPERIENCE: { value: Experience; blurb: string }[] = [
  { value: "beginner", blurb: "New to lifting, or back after a long break" },
  { value: "intermediate", blurb: "Been training consistently for a year or so" },
  { value: "advanced", blurb: "Years of steady, structured training" }
];

type Step = "install" | "name" | "body" | "experience" | "program";

export function Onboarding() {
  const steps: Step[] = useMemo(() => {
    const skipInstall = isStandalone() || isDesktop();
    return skipInstall
      ? ["name", "body", "experience", "program"]
      : ["install", "name", "body", "experience", "program"];
  }, []);

  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const next = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  // Advance automatically the moment Android reports the install succeeded.
  useEffect(() => {
    const onInstalled = () =>
      setStepIndex((i) => (steps[i] === "install" ? i + 1 : i));
    window.addEventListener("app-installed", onInstalled);
    return () => window.removeEventListener("app-installed", onInstalled);
  }, [steps]);

  const [name, setName] = useState("");
  const [bodyweight, setBodyweight] = useState(160);
  const [experience, setExperience] = useState<Experience>("beginner");
  const [programId, setProgramId] = useState<string>("");

  const finish = () => {
    updateProfile({
      name: name.trim() || "You",
      bodyweightLb: bodyweight,
      experience
    });
    if (programId) setActiveProgram(programId);
    setOnboarded(true);
  };

  return (
    <div className="onboarding">
      <div className="onboarding-inner">
        <Dots count={steps.length} active={stepIndex} />

        {step === "install" && <InstallStep onSkip={next} onDone={next} />}
        {step === "name" && (
          <NameStep value={name} onChange={setName} onNext={next} />
        )}
        {step === "body" && (
          <BodyStep value={bodyweight} onChange={setBodyweight} onNext={next} onBack={back} />
        )}
        {step === "experience" && (
          <ExperienceStep
            value={experience}
            onChange={setExperience}
            onNext={next}
            onBack={back}
          />
        )}
        {step === "program" && (
          <ProgramStep
            value={programId}
            onChange={setProgramId}
            onFinish={finish}
            onBack={back}
          />
        )}
      </div>
    </div>
  );
}

/** iOS Safari's Share control: a box with an up-arrow rising out of it. */
function ShareGlyph() {
  return (
    <svg
      className="ios-share"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 12H4v8h16v-8h-2" />
    </svg>
  );
}

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <div className="onboarding-dots" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={i === active ? "dot on" : "dot"} />
      ))}
    </div>
  );
}

// --- step 1: add to home screen ---------------------------------------------

function InstallStep({ onSkip, onDone }: { onSkip: () => void; onDone: () => void }) {
  // Re-render when Chromium hands us a prompt after mount.
  const [, bump] = useState(0);
  useEffect(() => {
    const onAvail = () => bump((n) => n + 1);
    window.addEventListener("install-available", onAvail);
    return () => window.removeEventListener("install-available", onAvail);
  }, []);

  const ios = isIOS();
  const canPrompt = canPromptInstall();

  return (
    <section className="card onboarding-card">
      <h1>Add Lift to your home screen</h1>
      <p className="dim">
        Everything you log lives on your phone. Adding Lift to your home screen
        makes it open like a real app and keeps your training history safe —
        {ios ? " on iPhone this is the only way it sticks." : " especially important on a phone."}
      </p>

      {ios ? (
        <ol className="install-steps">
          <li>
            Open this page in <strong>Safari</strong> (not another browser).
          </li>
          <li>
            Tap the <strong>Share</strong> button
            <ShareGlyph />
            at the bottom of the screen.
          </li>
          <li>
            Scroll down and tap <strong>Add to Home Screen</strong>, then{" "}
            <strong>Add</strong>.
          </li>
          <li>Open Lift from its new icon and come back here.</li>
        </ol>
      ) : canPrompt ? (
        <button
          className="primary big wide"
          onClick={async () => {
            const outcome = await promptInstall();
            if (outcome === "accepted") onDone();
          }}
        >
          Add to home screen
        </button>
      ) : (
        <ol className="install-steps">
          <li>
            Open your browser menu <strong>(⋮)</strong>.
          </li>
          <li>
            Tap <strong>Add to Home screen</strong> (or <strong>Install app</strong>).
          </li>
          <li>Open Lift from its new icon and come back here.</li>
        </ol>
      )}

      <button className="ghost wide" onClick={onSkip}>
        Skip for now
      </button>
      <p className="dim small">
        You can still use Lift without installing — but clear your browser data
        and your workouts are gone.
      </p>
    </section>
  );
}

// --- step 2: name ----------------------------------------------------------

function NameStep({
  value,
  onChange,
  onNext
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <section className="card onboarding-card">
      <h1>Who's lifting?</h1>
      <p className="dim">
        Just a label for your data on this phone. There's no account and nothing
        leaves the device.
      </p>
      <label className="field">
        <span>Your name</span>
        <input
          autoFocus
          value={value}
          placeholder="You"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onNext()}
        />
      </label>
      <button className="primary big wide" onClick={onNext}>
        Next
      </button>
    </section>
  );
}

// --- step 3: bodyweight --------------------------------------------------------

function BodyStep({
  value,
  onChange,
  onNext,
  onBack
}: {
  value: number;
  onChange: (v: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <section className="card onboarding-card">
      <h1>Your bodyweight</h1>
      <p className="dim">
        Used only to guess a sensible starting weight for lifts you haven't done
        yet. You can change it any time in Settings.
      </p>
      <div className="field">
        <span>Bodyweight (lb)</span>
        <Stepper label="Bodyweight" value={value} step={1} min={50} onChange={onChange} />
      </div>
      <div className="onboarding-nav">
        <button className="ghost" onClick={onBack}>
          Back
        </button>
        <button className="primary big" onClick={onNext}>
          Next
        </button>
      </div>
    </section>
  );
}

// --- step 4: experience -----------------------------------------------------

function ExperienceStep({
  value,
  onChange,
  onNext,
  onBack
}: {
  value: Experience;
  onChange: (v: Experience) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <section className="card onboarding-card">
      <h1>How much lifting experience?</h1>
      <p className="dim">
        Also just tunes the first starting-weight guess. Anything you log
        progresses from your real numbers.
      </p>
      <div className="onboarding-choices">
        {EXPERIENCE.map((x) => (
          <button
            key={x.value}
            className={value === x.value ? "program-opt on" : "program-opt"}
            onClick={() => onChange(x.value)}
          >
            <span className="program-opt-head">
              <strong>{x.value}</strong>
            </span>
            <span className="dim small">{x.blurb}</span>
          </button>
        ))}
      </div>
      <div className="onboarding-nav">
        <button className="ghost" onClick={onBack}>
          Back
        </button>
        <button className="primary big" onClick={onNext}>
          Next
        </button>
      </div>
    </section>
  );
}

// --- step 5: program -----------------------------------------------------------

function ProgramStep({
  value,
  onChange,
  onFinish,
  onBack
}: {
  value: string;
  onChange: (v: string) => void;
  onFinish: () => void;
  onBack: () => void;
}) {
  const { programs, loading, error } = useRoutine();

  // Default to the first program once the list loads.
  const firstId = useMemo(() => programs[0]?.id ?? "", [programs]);
  useEffect(() => {
    if (!value && firstId) onChange(firstId);
  }, [value, firstId, onChange]);

  return (
    <section className="card onboarding-card">
      <h1>Pick a training split</h1>
      <p className="dim">
        Not permanent — switch any time in Settings. Your history carries over.
      </p>

      {loading && programs.length === 0 ? (
        <p className="dim">Loading programs…</p>
      ) : error && programs.length === 0 ? (
        <p className="dim small">
          Couldn't load the program list offline — you'll start on the default
          split and can change it in Settings.
        </p>
      ) : (
        <div className="onboarding-choices">
          {programs.map((p) => (
            <button
              key={p.id}
              className={value === p.id ? "program-opt on" : "program-opt"}
              onClick={() => onChange(p.id)}
            >
              <span className="program-opt-head">
                <strong>{p.name}</strong>
                <span className="dim small">{p.daysPerWeek} days/wk</span>
              </span>
              <span className="dim small">{p.description}</span>
            </button>
          ))}
        </div>
      )}

      <div className="onboarding-nav">
        <button className="ghost" onClick={onBack}>
          Back
        </button>
        <button className="primary big" onClick={onFinish}>
          Start lifting
        </button>
      </div>
    </section>
  );
}

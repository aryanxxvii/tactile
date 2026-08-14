import { useState } from "react";
import "./NativeOnboarding.css";
import {
  IconArrowRight,
  IconCheck,
  IconFolder,
  IconMoon,
  IconSunHigh,
} from "@tabler/icons-react";

const THEME_CHOICES = [
  {
    id: "one-dark",
    label: "Tactile Night",
    icon: IconMoon,
    tone: "dark",
  },
  {
    id: "paper-public",
    label: "Tactile Day",
    icon: IconSunHigh,
    tone: "light",
  },
];

function StepMarker({ active, complete, number, label }) {
  return (
    <div className={`native-guide-step ${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`}>
      <span>{complete ? <IconCheck size={13} stroke={2.2} /> : number}</span>
      <small>{label}</small>
    </div>
  );
}

export function NativeOnboarding({
  activeThemeId,
  workspacePath,
  onChooseTheme,
  onChooseFolder,
  onFinish,
}) {
  const [step, setStep] = useState(0);
  const [stepDirection, setStepDirection] = useState(1);
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [pendingWorkspacePath, setPendingWorkspacePath] = useState(workspacePath || "");
  const [themePulse, setThemePulse] = useState(0);

  const chooseFolder = async () => {
    setBusy(true);
    try {
      const selectedPath = await onChooseFolder?.();
      if (selectedPath) setPendingWorkspacePath(selectedPath);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setFinishing(true);
    try {
      await onFinish?.(pendingWorkspacePath);
    } finally {
      setFinishing(false);
    }
  };

  const goToStep = (nextStep) => {
    setStepDirection(nextStep >= step ? 1 : -1);
    setThemePulse(0);
    setStep(nextStep);
  };
  const next = () => goToStep(Math.min(2, step + 1));
  const chooseTheme = (themeId) => {
    if (themeId === activeThemeId) return;
    setThemePulse((current) => current + 1);
    onChooseTheme(themeId);
  };

  return (
    <div className="native-guide-layer" role="presentation">
      <div className="native-guide-scrim" />
      <section className="native-guide" role="dialog" aria-modal="true" aria-labelledby="native-guide-title">
        <div className="native-guide-steps" aria-label="Guide progress">
          <StepMarker number="1" label="Welcome" active={step === 0} complete={step > 0} />
          <i />
          <StepMarker number="2" label="Appearance" active={step === 1} complete={step > 1} />
          <i />
          <StepMarker number="3" label="Workspace" active={step === 2} />
        </div>

        {step === 0 ? (
          <div key={`step-${step}-${stepDirection}`} className={`native-guide-content ${stepDirection > 0 ? "is-forward" : "is-back"}`}>
            <h1 id="native-guide-title">A workspace that stays yours.</h1>
            <p className="native-guide-lede">Keep your work local, connected, and easy to move.</p>
            <div className="native-guide-actions"><button className="button-primary" type="button" onClick={next}>Continue <IconArrowRight size={15} /></button></div>
          </div>
        ) : null}

        {step === 1 ? (
          <div key={`step-${step}-${stepDirection}`} className={`native-guide-content ${stepDirection > 0 ? "is-forward" : "is-back"}`}>
            {themePulse ? <div key={themePulse} className="native-guide-theme-transition" aria-hidden="true" /> : null}
            <h1 id="native-guide-title">Choose a theme.</h1>
            <p className="native-guide-lede">Start in dark or light. You can change it later in Settings.</p>
            <div className="native-guide-theme-choices" role="radiogroup" aria-label="Choose a Tactile theme">
              {THEME_CHOICES.map(({ id, label, icon: Icon, tone }) => (
                <button key={id} className={`native-guide-theme-choice ${tone} ${activeThemeId === id ? "is-selected" : ""}`} type="button" role="radio" aria-checked={activeThemeId === id} onClick={() => chooseTheme(id)}>
                  <span className="native-guide-theme-preview"><Icon size={20} stroke={1.65} /></span>
                  <span><strong>{label}</strong></span>
                  {activeThemeId === id ? <IconCheck className="native-guide-theme-check" size={17} /> : null}
                </button>
              ))}
            </div>
            <div className="native-guide-actions"><button className="button-quiet" type="button" onClick={() => goToStep(0)}>Back</button><button className="button-primary" type="button" onClick={next}>Continue <IconArrowRight size={15} /></button></div>
          </div>
        ) : null}

        {step === 2 ? (
          <div key={`step-${step}-${stepDirection}`} className={`native-guide-content ${stepDirection > 0 ? "is-forward" : "is-back"}`}>
            <h1 id="native-guide-title">Choose a home folder.</h1>
            <p className="native-guide-lede">Tactile keeps this workspace on your computer.</p>
            <button className={`native-guide-folder ${workspacePath ? "is-selected" : ""}`} type="button" onClick={chooseFolder} disabled={busy}>
              <span className="native-guide-folder-icon"><IconFolder size={20} /></span>
              <span><strong>{pendingWorkspacePath || "Choose a folder"}</strong><small>{busy ? "Opening folder picker…" : pendingWorkspacePath ? "Selected for this workspace." : "An empty folder will start with a Home Tiles page."}</small></span>
              <IconArrowRight size={16} />
            </button>
            <div className="native-guide-actions"><button className="button-quiet" type="button" onClick={() => goToStep(1)} disabled={finishing}>Back</button><button className="button-primary" type="button" onClick={finish} disabled={finishing}><IconCheck size={15} /> {finishing ? "Preparing…" : "Finish setup"}</button></div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

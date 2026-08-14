import { useEffect, useId, useRef, useState } from "react";

const LOADER_STYLE = `
.startup-loader { position: fixed; inset: 0; z-index: 1400; display: grid; place-items: center; background: var(--app-background, #ede9e2); animation: startup-loader-in 180ms ease-out both; }
html[data-startup-theme="dark"] .startup-loader { background: #1f232b; }
html[data-startup-theme="light"] .startup-loader { background: #ede9e2; }
.startup-loader.is-leaving { pointer-events: none; animation: startup-loader-out 260ms ease-in both; }
.startup-loader-mark { display: block; width: 96px; height: 96px; overflow: visible; filter: drop-shadow(0 8px 16px color-mix(in srgb, var(--accent, #b34d35) 18%, transparent)); animation: startup-loader-mark 4800ms cubic-bezier(.45, 0, .25, 1) infinite; }
@keyframes startup-loader-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes startup-loader-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes startup-loader-mark { 0%, 100% { transform: scale(.96) rotate(-1deg); } 50% { transform: scale(1) rotate(1deg); } }
`;

export function StartupLoader({ active = true, holdUntilReady = false, minimumDuration = 1000 }) {
  const filterId = useId().replaceAll(":", "");
  const shownAt = useRef(Date.now());
  const [ready, setReady] = useState(!holdUntilReady && !active);
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!holdUntilReady) {
      setReady(!active);
      return undefined;
    }
    const handleReady = () => setReady(true);
    window.addEventListener("tactile:startup-ready", handleReady, { once: true });
    return () => window.removeEventListener("tactile:startup-ready", handleReady);
  }, [active, holdUntilReady]);

  useEffect(() => {
    if (!ready) return undefined;
    const wait = Math.max(0, minimumDuration - (Date.now() - shownAt.current));
    const leaveTimer = window.setTimeout(() => setLeaving(true), wait);
    const removeTimer = window.setTimeout(() => setVisible(false), wait + 280);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, [minimumDuration, ready]);

  if (!visible) return null;

  return (
    <>
      <style>{LOADER_STYLE}</style>
      <div className={`startup-loader ${leaving ? "is-leaving" : "is-active"}`} role="status" aria-label="Loading Tactile">
        <svg className="startup-loader-mark" viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.018 0.07" numOctaves="1" seed="7" result="wave-noise">
                <animate attributeName="baseFrequency" values="0.018 0.07;0.035 0.035;0.018 0.07" dur="4.8s" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="wave-noise" scale="2.5" xChannelSelector="R" yChannelSelector="G">
                <animate attributeName="scale" values="2.5;5;2.5" dur="4.8s" repeatCount="indefinite" />
              </feDisplacementMap>
            </filter>
          </defs>
          <image href="/tactile-mark.svg" width="64" height="64" filter={`url(#${filterId})`} />
        </svg>
      </div>
    </>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button
      className={`tactile-switch ${checked ? "is-on" : ""}`}
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

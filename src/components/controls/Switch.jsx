export function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      className={`tactile-switch ${checked ? "is-on" : ""}${disabled ? " is-disabled" : ""}`}
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

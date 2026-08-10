function enabledItems(root) {
  return Array.from(root?.querySelectorAll('[role="menuitem"]:not(:disabled)') || []);
}

export function focusFirstMenuItem(root) {
  enabledItems(root)[0]?.focus();
}

export function handleMenuKeyDown(event, { root, onClose, restoreFocus } = {}) {
  const items = enabledItems(root);
  if (!items.length) return;

  const activeIndex = items.indexOf(document.activeElement);
  const focusAt = (index) => {
    const normalized = (index + items.length) % items.length;
    items[normalized]?.focus();
  };

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    event.stopPropagation();
    focusAt(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
    return;
  }

  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    event.stopPropagation();
    focusAt(event.key === "Home" ? 0 : items.length - 1);
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    onClose?.();
    window.requestAnimationFrame(() => restoreFocus?.focus?.({ preventScroll: true }));
    return;
  }

  if (event.key === "Tab") {
    onClose?.();
    return;
  }

  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const query = event.key.toLocaleLowerCase();
    const start = Math.max(0, activeIndex + 1);
    const ordered = [...items.slice(start), ...items.slice(0, start)];
    const match = ordered.find((item) => item.textContent?.trim().toLocaleLowerCase().startsWith(query));
    if (match) {
      event.preventDefault();
      event.stopPropagation();
      match.focus();
    }
  }
}

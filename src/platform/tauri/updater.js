import { resolveTauriInvoke } from "./runtime.ts";

export async function checkForUpdate() {
  const invoke = resolveTauriInvoke();
  if (!invoke) return null;
  try {
    const result = await invoke("check_for_update");
    return result ?? null;
  } catch {
    return null;
  }
}

export async function downloadAndInstallUpdate() {
  const invoke = resolveTauriInvoke();
  if (!invoke) return false;
  try {
    await invoke("download_and_install_update");
    return true;
  } catch {
    return false;
  }
}
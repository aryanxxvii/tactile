import { resolveTauriInvoke } from "./runtime.ts";

function requireInvoke() {
  const invoke = resolveTauriInvoke();
  if (!invoke) throw new Error("Tauri updater is unavailable");
  return invoke;
}

export async function getUpdateChannel() {
  return requireInvoke()("get_update_channel");
}

export async function setUpdateChannel(channel) {
  return requireInvoke()("set_update_channel", { channel });
}

export async function checkForUpdate() {
  const result = await requireInvoke()("check_for_update");
  return result ?? null;
}

export async function downloadAndInstallUpdate() {
  await requireInvoke()("download_and_install_update");
}
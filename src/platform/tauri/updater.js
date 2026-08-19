import { resolveTauriInvoke } from "./runtime.ts";
import { TACTILE_CHANNEL } from "../../buildRevision.js";

function currentChannel() {
  const raw = String(TACTILE_CHANNEL || "").trim().toLowerCase();
  if (!raw || raw === "development") {
    // Development builds follow the stable feed unless explicitly overridden.
    return "stable";
  }
  return raw;
}

function normalizeChannel(value) {
  const channel = String(value ?? currentChannel()).trim().toLowerCase();
  if (!channel || channel === "development") return "stable";
  if (channel === "main" || channel === "release" || channel === "stable") return "stable";
  if (channel === "alpha" || channel === "next" || channel === "prerelease") return "alpha";
  if (channel === "rc") return "alpha";
  // Fallback: treat anything with alpha/rc as prerelease.
  if (channel.includes("alpha") || channel.includes("rc")) return "alpha";
  return "stable";
}

export async function checkForUpdate(channel) {
  const invoke = resolveTauriInvoke();
  if (!invoke) return null;
  const effective = normalizeChannel(channel);
  try {
    const result = await invoke("check_for_update", { channel: effective });
    // Older native builds ignore the channel argument and still respond.
    return result ?? null;
  } catch {
    try {
      const fallback = await invoke("check_for_update");
      return fallback ?? null;
    } catch {
      return null;
    }
  }
}

export async function downloadAndInstallUpdate(channel) {
  const invoke = resolveTauriInvoke();
  if (!invoke) return false;
  const effective = normalizeChannel(channel);
  try {
    await invoke("download_and_install_update", { channel: effective });
    return true;
  } catch {
    try {
      await invoke("download_and_install_update");
      return true;
    } catch {
      return false;
    }
  }
}

export function getUpdateChannel() {
  return normalizeChannel();
}
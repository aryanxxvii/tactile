import { useSitePreview } from "./useSitePreview.js";

/** @deprecated Use `useSitePreview` — the native-overlay webview was replaced
 *  by the in-app fetch proxy rendered through an ordinary iframe. */
export function useEmbeddedWebview(options) {
  return useSitePreview(options);
}
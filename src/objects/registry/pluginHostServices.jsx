import { ObjectGlyph } from "../../components/ObjectGlyph.jsx";
import { ObjectHeader } from "../../components/ObjectHeader.jsx";
import { PaperPortal } from "../../components/PaperPortal.jsx";
import { useLocalDraft } from "../../components/localEditSession.js";
import { codeLanguageForExtension } from "../../model.js";
import { resolveTauriInvoke } from "../../platform/tauri/runtime.ts";
import { objectTypeFor } from "./objectTypes.js";

export const pluginHostServices = Object.freeze({
  ObjectHeader,
  ObjectGlyph,
  PaperPortal,
  useLocalDraft,
  codeLanguageForExtension,
  resolveTauriInvoke,
  objectTypeFor,
});
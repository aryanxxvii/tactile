import { IconCode } from "@tabler/icons-react";
import { createFilePlugin } from "../../sdk/createFilePlugin.js";
import { HtmlObject } from "./HtmlObject.jsx";
const manifest = __TACTILE_PLUGIN_MANIFEST__;
export function activate() { return createFilePlugin(manifest, HtmlObject, IconCode); }

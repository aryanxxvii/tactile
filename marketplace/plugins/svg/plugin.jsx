import { IconVectorBezier } from "@tabler/icons-react";
import { createFilePlugin } from "../../sdk/createFilePlugin.js";
import { SvgObject } from "./SvgObject.jsx";
const manifest = __TACTILE_PLUGIN_MANIFEST__;
export function activate() { return createFilePlugin(manifest, SvgObject, IconVectorBezier); }

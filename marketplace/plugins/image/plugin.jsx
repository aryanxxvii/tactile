import { IconPhoto } from "@tabler/icons-react";
import { createFilePlugin } from "../../sdk/createFilePlugin.js";
import { ImageObject } from "./ImageObject.jsx";
const manifest = __TACTILE_PLUGIN_MANIFEST__;
export function activate() { return createFilePlugin(manifest, ImageObject, IconPhoto); }

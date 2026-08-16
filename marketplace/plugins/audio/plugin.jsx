import { IconMusic } from "@tabler/icons-react";
import { createFilePlugin } from "../../sdk/createFilePlugin.js";
import { AudioObject } from "./AudioObject.jsx";
import "./AudioPlayer.css";
const manifest = __TACTILE_PLUGIN_MANIFEST__;
export function activate() { return createFilePlugin(manifest, AudioObject, IconMusic); }

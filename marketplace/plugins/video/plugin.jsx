import { IconMovie } from "@tabler/icons-react";
import { createFilePlugin } from "../../sdk/createFilePlugin.js";
import { VideoObject } from "./VideoObject.jsx";
import "./VideoPlayer.css";
const manifest = __TACTILE_PLUGIN_MANIFEST__;
export function activate() { return createFilePlugin(manifest, VideoObject, IconMovie); }

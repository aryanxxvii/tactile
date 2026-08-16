import { IconFileTypePdf } from "@tabler/icons-react";
import { createFilePlugin } from "../../sdk/createFilePlugin.js";
import { PdfObject } from "./PdfObject.jsx";
const manifest = __TACTILE_PLUGIN_MANIFEST__;
export function activate() { return createFilePlugin(manifest, PdfObject, IconFileTypePdf); }

import { formatCellValue as formatCellValueRuntime } from "../sheet/formatting.js";
import type { CellStyle } from "./domain.ts";

export function formatCellValue(value: string | number | null | undefined, style: CellStyle = {}): string {
  return formatCellValueRuntime(value, style);
}

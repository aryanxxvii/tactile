import { normalizeRange, rangeContains } from "./ranges.js";

function ruleRange(rule) {
  const [anchor, focus = anchor] = String(rule?.range || "").split(":");
  return normalizeRange(anchor, focus);
}

export function conditionalToneForCell(sheet, cell, calculatedValue) {
  const rules = Array.isArray(sheet?.conditionalFormats) ? sheet.conditionalFormats : [];
  const value = calculatedValue ?? cell?.value ?? "";
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index];
    if (!rangeContains(ruleRange(rule), cell.row, cell.column)) continue;
    if (rule.kind === "sign") {
      const number = Number(String(value).replace(/[,\s%]/g, ""));
      if (!Number.isFinite(number)) return "neutral";
      if (number > 0) return "positive";
      if (number < 0) return "negative";
      return "neutral";
    }
  }
  return null;
}

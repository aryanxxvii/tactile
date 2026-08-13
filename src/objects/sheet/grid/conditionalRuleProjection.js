import { normalizeRange } from "../../../sheet/ranges.js";

function signTone(value) {
  const number = Number(String(value ?? "").replace(/[,\s%]/g, ""));
  if (!Number.isFinite(number)) return "neutral";
  if (number > 0) return "positive";
  if (number < 0) return "negative";
  return "neutral";
}

/**
 * Normalize conditional-format ranges once per sheet revision. Cell slots
 * only run numeric comparisons against this compact projection.
 */
export function compileConditionalRules(rules) {
  if (!Array.isArray(rules)) return [];
  return rules
    .map((rule, order) => {
      const [anchor, focus = anchor] = String(rule?.range || "").split(":");
      const range = normalizeRange(anchor, focus);
      if (!range || !rule?.kind) return null;
      return {
        order,
        kind: String(rule.kind),
        rowStart: range.rowStart,
        rowEnd: range.rowEnd,
        columnStart: range.columnStart,
        columnEnd: range.columnEnd,
      };
    })
    .filter(Boolean);
}

export function conditionalToneForCoordinates(rules, row, column, value) {
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index];
    if (
      row < rule.rowStart
      || row > rule.rowEnd
      || column < rule.columnStart
      || column > rule.columnEnd
    ) continue;
    if (rule.kind === "sign") return signTone(value);
  }
  return null;
}

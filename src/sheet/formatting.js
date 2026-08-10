export function formatCellValue(value, style = {}) {
  const raw = String(value ?? "");
  if (!raw || raw.startsWith("#") || !style?.numberFormat || style.numberFormat === "general") return raw;
  const number = Number(raw.replace(/,/g, "").trim());
  if (!Number.isFinite(number)) return raw;
  if (style.numberFormat === "number") {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  }
  if (style.numberFormat === "percent") {
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(number);
  }
  return raw;
}

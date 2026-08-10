export function columnLabel(index) {
  let current = index + 1;
  let label = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }

  return label;
}

export function cellId(row, column) {
  return `r${row + 1}c${column + 1}`;
}

export function coordinatesFromCellId(id) {
  const match = /^r(\d+)c(\d+)$/i.exec(id || "");
  if (!match) return null;
  const row = Number(match[1]) - 1;
  const column = Number(match[2]) - 1;
  return row >= 0 && column >= 0 ? { row, column } : null;
}

export function cellAddress(row, column) {
  return `${columnLabel(column)}${row + 1}`;
}

export function coordinatesFromAddress(address) {
  const match = /^([A-Z]+)(\d+)$/i.exec(address || "");
  if (!match) return null;

  const column = match[1]
    .toUpperCase()
    .split("")
    .reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0) - 1;
  const row = Number(match[2]) - 1;
  return row >= 0 && column >= 0 ? { row, column } : null;
}

export function moveAddress(address, rowDelta, columnDelta, rows, columns) {
  const coordinates = coordinatesFromAddress(address);
  if (!coordinates) return "A1";

  const row = Math.min(rows - 1, Math.max(0, coordinates.row + rowDelta));
  const column = Math.min(columns - 1, Math.max(0, coordinates.column + columnDelta));
  return cellAddress(row, column);
}

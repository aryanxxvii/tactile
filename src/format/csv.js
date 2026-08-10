import { createCellRecord, materializeCell, usedSheetBounds } from "../model.js";

function escapeLinkTitle(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\]/g, "\\]");
}

function unescapeLinkTitle(value) {
  let result = "";
  let escaped = false;
  for (const character of value) {
    if (escaped) {
      result += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else {
      result += character;
    }
  }
  if (escaped) result += "\\";
  return result;
}

function firstUnescapedPipe(value) {
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === "|") return index;
  }
  return -1;
}

export function createTactileLink(type, objectId, title) {
  return `[[tactile:${type}:${objectId}|${escapeLinkTitle(title)}]]`;
}

export function parseTactileLink(value) {
  if (typeof value !== "string" || !value.startsWith("[[tactile:") || !value.endsWith("]]")) {
    return null;
  }
  const body = value.slice(10, -2);
  const firstColon = body.indexOf(":");
  if (firstColon < 1) return null;
  const type = body.slice(0, firstColon);
  const linkBody = body.slice(firstColon + 1);
  const pipe = firstUnescapedPipe(linkBody);
  if (pipe < 1) return null;
  return {
    type,
    objectId: linkBody.slice(0, pipe),
    title: unescapeLinkTitle(linkBody.slice(pipe + 1)),
  };
}

export function encodeCsvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function stringifyCsv(rows) {
  return rows.map((row) => row.map(encodeCsvField).join(",")).join("\r\n");
}

export function parseCsv(text) {
  if (!text) return [];
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value === "") {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  rows.push(row);
  return rows;
}

export function sheetCellFileValue(cell, workspace) {
  if (cell?.embed) {
    const target = workspace?.objects?.[cell.embed.objectId];
    return createTactileLink(
      cell.embed.type || target?.type || "object",
      cell.embed.objectId,
      target?.title || cell.value || "Untitled",
    );
  }
  if (cell?.formula) return cell.formula;
  return cell?.value || "";
}

export function serializeSheetCsv(sheet, workspace) {
  const bounds = usedSheetBounds(sheet);
  if (!bounds.rows || !bounds.columns) return "";
  const rows = Array.from({ length: bounds.rows }, (_, row) => (
    Array.from({ length: bounds.columns }, (_, column) => (
      sheetCellFileValue(materializeCell(sheet, row, column), workspace)
    ))
  ));
  return stringifyCsv(rows);
}

export function parseSheetCsv(text) {
  const cells = {};
  parseCsv(text).forEach((rowValues, row) => {
    rowValues.forEach((fileValue, column) => {
      if (!fileValue) return;
      const link = parseTactileLink(fileValue);
      const patch = link
        ? {
            value: link.title,
            embed: { objectId: link.objectId, type: link.type },
          }
        : fileValue.startsWith("=")
          ? { formula: fileValue }
          : { value: fileValue };
      const cell = createCellRecord(row, column, patch);
      cells[cell.id] = cell;
    });
  });
  return cells;
}

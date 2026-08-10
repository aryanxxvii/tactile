import { cellAddress, coordinatesFromAddress } from "./coordinates.js";

function rebuiltAddress(address, row, column) {
  const columnAbsolute = address.startsWith("$");
  const rowAbsolute = /\$\d+$/.test(address);
  const normalized = cellAddress(row, column);
  const match = /^([A-Z]+)(\d+)$/.exec(normalized);
  if (!match) return address;
  return `${columnAbsolute ? "$" : ""}${match[1]}${rowAbsolute ? "$" : ""}${match[2]}`;
}

export function adjustFormulaForAxis(formula, axis, index, operation) {
  if (typeof formula !== "string" || !formula) return formula;
  return formula.replace(/\$?[A-Za-z]+\$?\d+/g, (address) => {
    const coordinates = coordinatesFromAddress(address.replace(/\$/g, ""));
    if (!coordinates) return address;
    let { row, column } = coordinates;
    const coordinate = axis === "row" ? row : column;
    if (operation === "insert" && coordinate >= index) {
      if (axis === "row") row += 1;
      else column += 1;
    } else if (operation === "delete" && coordinate > index) {
      if (axis === "row") row -= 1;
      else column -= 1;
    }
    return rebuiltAddress(address, row, column);
  });
}

export function reorderFormulaForAxis(formula, axis, indexMap) {
  if (typeof formula !== "string" || !formula || !indexMap) return formula;
  return formula.replace(/\$?[A-Za-z]+\$?\d+/g, (address) => {
    const coordinates = coordinatesFromAddress(address.replace(/\$/g, ""));
    if (!coordinates) return address;
    const nextIndex = indexMap.get(axis === "row" ? coordinates.row : coordinates.column);
    if (!Number.isInteger(nextIndex)) return address;
    return rebuiltAddress(
      address,
      axis === "row" ? nextIndex : coordinates.row,
      axis === "column" ? nextIndex : coordinates.column,
    );
  });
}

export function adjustAxisGroups(groups, index, operation) {
  return (groups || []).map((group) => {
    let { start, end } = group;
    if (operation === "insert") {
      if (index <= start) {
        start += 1;
        end += 1;
      } else if (index <= end) {
        end += 1;
      }
    } else if (index < start) {
      start = Math.max(0, start - 1);
      end = Math.max(0, end - 1);
    } else if (index <= end) {
      end = Math.max(start, end - 1);
    }
    return { ...group, start, end };
  }).filter((group) => group.end > group.start);
}

export function adjustColumnFilters(filters, index, operation) {
  return (filters || []).flatMap((filter) => {
    if (operation === "delete" && filter.column === index) return [];
    if (operation === "insert" && filter.column >= index) return [{ ...filter, column: filter.column + 1 }];
    if (operation === "delete" && filter.column > index) return [{ ...filter, column: filter.column - 1 }];
    return [filter];
  });
}

export function adjustConditionalFormats(rules, axis, index, operation) {
  return (rules || []).map((rule) => ({
    ...rule,
    range: adjustFormulaForAxis(`=${rule.range}`, axis, index, operation).slice(1),
  }));
}

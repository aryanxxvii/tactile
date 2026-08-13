import { cellAddress, cellId, coordinatesFromAddress, coordinatesFromCellId } from "./coordinates.js";

const ERROR = {
  cycle: "#CYCLE!",
  div0: "#DIV/0!",
  name: "#NAME?",
  ref: "#REF!",
  value: "#VALUE!",
};

const COMPARISON_OPERATORS = ["=", "<>", "<", ">", "<=", ">="];
const MAX_MATERIALIZED_DEPENDENCIES = 100_000;
const MAX_INDEXED_RANGE_ROWS = 1_024;
const AST_CACHE = new Map();
const NUMBER_FORMATTER_CACHE = new Map();

function isError(value) {
  return typeof value === "string" && value.startsWith("#");
}

function scalar(value) {
  if (value && value.__range) return value.values[0] ?? 0;
  return value;
}

function flatten(values) {
  return values.flatMap((value) => (value && value.__range ? value.values : [value]));
}

function numeric(value) {
  const unwrapped = scalar(value);
  if (typeof unwrapped === "number") return unwrapped;
  if (typeof unwrapped === "boolean") return unwrapped ? 1 : 0;
  if (unwrapped == null || unwrapped === "") return 0;
  if (isError(unwrapped)) return unwrapped;
  const normalized = String(unwrapped).replace(/,/g, "").trim();
  if (/^-?\d+(\.\d+)?%$/.test(normalized)) return Number(normalized.slice(0, -1)) / 100;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : ERROR.value;
}

function comparable(value) {
  const number = numeric(value);
  return isError(number) ? String(scalar(value)).toLowerCase() : number;
}

function normalizeAddress(address) {
  const raw = String(address || "").replace(/\$/g, "").toUpperCase();
  const coordinates = coordinatesFromAddress(raw);
  return coordinates ? cellAddress(coordinates.row, coordinates.column) : raw;
}

function cellAddressForCell(cell, fallbackId = "") {
  const addressCoordinates = coordinatesFromAddress(cell?.address);
  if (addressCoordinates) return cellAddress(addressCoordinates.row, addressCoordinates.column);
  const idCoordinates = coordinatesFromCellId(cell?.id || fallbackId);
  if (idCoordinates) return cellAddress(idCoordinates.row, idCoordinates.column);
  if (Number.isInteger(cell?.row) && Number.isInteger(cell?.column)) {
    return cellAddress(cell.row, cell.column);
  }
  return "";
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }
    const string = /^"((?:[^"]|"")*)"/.exec(rest);
    if (string) {
      tokens.push({ type: "string", value: string[1].replace(/""/g, '"') });
      index += string[0].length;
      continue;
    }
    const number = /^(?:\d+\.\d*|\.\d+|\d+)/.exec(rest);
    if (number) {
      tokens.push({ type: "number", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const reference = /^\$?[A-Za-z]+\$?\d+/.exec(rest);
    if (reference) {
      tokens.push({ type: "reference", value: normalizeAddress(reference[0]) });
      index += reference[0].length;
      continue;
    }
    const identifier = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest);
    if (identifier) {
      tokens.push({ type: "identifier", value: identifier[0].toUpperCase() });
      index += identifier[0].length;
      continue;
    }
    const operator = /^(<=|>=|<>|[+\-*/^(),:=<>])/.exec(rest);
    if (operator) {
      tokens.push({ type: "operator", value: operator[1] });
      index += operator[0].length;
      continue;
    }
    throw new Error(ERROR.value);
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

export function tokenizeFormula(formula) {
  const source = String(formula || "").startsWith("=") ? String(formula).slice(1) : String(formula || "");
  return tokenize(source);
}

function rangeCoordinates(startAddress, endAddress) {
  const start = coordinatesFromAddress(startAddress);
  const end = coordinatesFromAddress(endAddress);
  if (!start || !end) return null;
  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startColumn: Math.min(start.column, end.column),
    endColumn: Math.max(start.column, end.column),
  };
}

function rangeDescriptor(startAddress, endAddress) {
  const coordinates = rangeCoordinates(startAddress, endAddress);
  if (!coordinates) return null;
  return {
    ...coordinates,
    startAddress: normalizeAddress(startAddress),
    endAddress: normalizeAddress(endAddress),
  };
}

function rangeValues(startAddress, endAddress, readCell) {
  const range = rangeCoordinates(startAddress, endAddress);
  if (!range) return { __range: true, values: [ERROR.ref] };
  const values = [];
  const matrix = [];
  for (let row = range.startRow; row <= range.endRow; row += 1) {
    const matrixRow = [];
    for (let column = range.startColumn; column <= range.endColumn; column += 1) {
      const value = readCell(cellAddress(row, column));
      values.push(value);
      matrixRow.push(value);
    }
    matrix.push(matrixRow);
  }
  return { __range: true, values, matrix, rows: matrix.length, columns: matrix[0]?.length || 0 };
}

function criteriaMatches(value, criteria) {
  const source = String(scalar(criteria) ?? "");
  const match = /^(<=|>=|<>|=|<|>)(.*)$/.exec(source);
  const operator = match?.[1] || "=";
  const expectedSource = match?.[2] ?? source;
  const actualNumber = numeric(value);
  const expectedNumber = numeric(expectedSource);
  const numericComparison = !isError(actualNumber) && !isError(expectedNumber);
  const actual = numericComparison ? actualNumber : String(scalar(value) ?? "").toLocaleLowerCase();
  const expected = numericComparison ? expectedNumber : expectedSource.toLocaleLowerCase();
  if (operator === "=") return actual === expected;
  if (operator === "<>") return actual !== expected;
  if (operator === "<") return actual < expected;
  if (operator === ">") return actual > expected;
  if (operator === "<=") return actual <= expected;
  return actual >= expected;
}

const FUNCTIONS = {
  SUM: (args) => flatten(args).reduce((total, value) => {
    const number = numeric(value);
    return isError(number) ? total : total + number;
  }, 0),
  AVERAGE: (args) => {
    const values = flatten(args).filter((value) => scalar(value) !== "" && scalar(value) != null).map(numeric).filter((value) => !isError(value));
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : ERROR.div0;
  },
  MIN: (args) => {
    const values = flatten(args).filter((value) => scalar(value) !== "" && scalar(value) != null).map(numeric).filter((value) => !isError(value));
    return values.length ? Math.min(...values) : 0;
  },
  MAX: (args) => {
    const values = flatten(args).filter((value) => scalar(value) !== "" && scalar(value) != null).map(numeric).filter((value) => !isError(value));
    return values.length ? Math.max(...values) : 0;
  },
  COUNT: (args) => flatten(args).filter((value) => scalar(value) !== "" && scalar(value) != null).map(numeric).filter((value) => !isError(value)).length,
  COUNTA: (args) => flatten(args).filter((value) => scalar(value) !== "" && scalar(value) != null).length,
  ABS: (args) => {
    const value = numeric(args[0]);
    return isError(value) ? value : Math.abs(value);
  },
  ROUND: (args) => {
    const value = numeric(args[0]);
    const digits = numeric(args[1] ?? 0);
    if (isError(value) || isError(digits)) return ERROR.value;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  },
  IF: (args) => (scalar(args[0]) ? scalar(args[1]) : scalar(args[2] ?? false)),
  AND: (args) => flatten(args).every((value) => Boolean(scalar(value))),
  OR: (args) => flatten(args).some((value) => Boolean(scalar(value))),
  NOT: (args) => !Boolean(scalar(args[0])),
  IFERROR: (args) => (isError(scalar(args[0])) ? scalar(args[1] ?? "") : scalar(args[0])),
  SUMPRODUCT: (args) => {
    const ranges = args.map((argument) => (argument?.__range ? argument.values : [argument]));
    const length = Math.max(0, ...ranges.map((range) => range.length));
    let total = 0;
    for (let index = 0; index < length; index += 1) {
      let product = 1;
      for (const range of ranges) {
        const value = numeric(range[index] ?? 0);
        if (isError(value)) return value;
        product *= value;
      }
      total += product;
    }
    return total;
  },
  COUNTIF: (args) => {
    const values = flatten([args[0]]);
    return values.filter((value) => criteriaMatches(value, args[1])).length;
  },
  SUMIF: (args) => {
    const values = args[0]?.__range ? args[0].values : [args[0]];
    const totals = args[2]?.__range ? args[2].values : values;
    return values.reduce((total, value, index) => {
      if (!criteriaMatches(value, args[1])) return total;
      const number = numeric(totals[index] ?? 0);
      return isError(number) ? total : total + number;
    }, 0);
  },
  CONCAT: (args) => flatten(args).map((value) => String(scalar(value) ?? "")).join(""),
  LEN: (args) => String(scalar(args[0]) ?? "").length,
  LEFT: (args) => {
    const count = numeric(args[1] ?? 1);
    return isError(count) ? count : String(scalar(args[0]) ?? "").slice(0, Math.max(0, count));
  },
  RIGHT: (args) => {
    const text = String(scalar(args[0]) ?? "");
    const numericCount = numeric(args[1] ?? 1);
    if (isError(numericCount)) return numericCount;
    const count = Math.max(0, numericCount);
    return count ? text.slice(-count) : "";
  },
  INDEX: (args) => {
    const range = args[0];
    if (!range?.__range) return ERROR.value;
    const row = numeric(args[1] ?? 1);
    const column = numeric(args[2] ?? 1);
    if (isError(row) || isError(column)) return ERROR.value;
    return range.matrix?.[row - 1]?.[column - 1] ?? ERROR.ref;
  },
  MATCH: (args) => {
    const values = args[1]?.__range ? args[1].values : [args[1]];
    const expected = comparable(args[0]);
    const index = values.findIndex((value) => comparable(value) === expected);
    return index >= 0 ? index + 1 : "#N/A";
  },
  VLOOKUP: (args) => {
    const range = args[1];
    const column = numeric(args[2] ?? 1);
    if (!range?.__range || isError(column)) return ERROR.value;
    const expected = comparable(args[0]);
    const row = range.matrix?.find((candidate) => comparable(candidate[0]) === expected);
    return row?.[column - 1] ?? "#N/A";
  },
};

export const FORMULA_CATALOG = [
  ["SUM", "SUM(range)", "Add values"],
  ["AVERAGE", "AVERAGE(range)", "Mean of values"],
  ["MIN", "MIN(range)", "Smallest value"],
  ["MAX", "MAX(range)", "Largest value"],
  ["COUNT", "COUNT(range)", "Count numeric values"],
  ["COUNTA", "COUNTA(range)", "Count non-empty values"],
  ["IF", "IF(test, yes, no)", "Conditional result"],
  ["IFERROR", "IFERROR(value, fallback)", "Fallback for errors"],
  ["SUMIF", "SUMIF(range, criteria, sum_range)", "Conditional sum"],
  ["COUNTIF", "COUNTIF(range, criteria)", "Conditional count"],
  ["SUMPRODUCT", "SUMPRODUCT(range, range)", "Weighted products"],
  ["INDEX", "INDEX(range, row, column)", "Value at a position"],
  ["MATCH", "MATCH(value, range, 0)", "Position of a value"],
  ["VLOOKUP", "VLOOKUP(value, range, column)", "Look up by first column"],
  ["ROUND", "ROUND(value, digits)", "Round a number"],
  ["ABS", "ABS(value)", "Absolute value"],
  ["CONCAT", "CONCAT(value, value)", "Join text"],
  ["LEN", "LEN(text)", "Text length"],
  ["LEFT", "LEFT(text, count)", "Characters from the left"],
  ["RIGHT", "RIGHT(text, count)", "Characters from the right"],
  ["AND", "AND(test, test)", "All tests are true"],
  ["OR", "OR(test, test)", "Any test is true"],
  ["NOT", "NOT(test)", "Reverse a boolean"],
].map(([name, signature, description]) => ({ name, signature, description }));

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  current() {
    return this.tokens[this.index];
  }

  take(value) {
    if (this.current().type !== "operator" || this.current().value !== value) return false;
    this.index += 1;
    return true;
  }

  parse() {
    const value = this.comparison();
    if (this.current().type !== "eof") throw new Error(ERROR.value);
    return value;
  }

  comparison() {
    let left = this.additive();
    while (COMPARISON_OPERATORS.includes(this.current().value)) {
      const operator = this.current().value;
      this.index += 1;
      left = { type: "binary", operator, left, right: this.additive() };
    }
    return left;
  }

  additive() {
    let left = this.multiplicative();
    while (["+", "-"].includes(this.current().value)) {
      const operator = this.current().value;
      this.index += 1;
      left = { type: "binary", operator, left, right: this.multiplicative() };
    }
    return left;
  }

  multiplicative() {
    let left = this.power();
    while (["*", "/"].includes(this.current().value)) {
      const operator = this.current().value;
      this.index += 1;
      left = { type: "binary", operator, left, right: this.power() };
    }
    return left;
  }

  power() {
    let left = this.unary();
    while (this.take("^")) {
      left = { type: "binary", operator: "^", left, right: this.unary() };
    }
    return left;
  }

  unary() {
    if (this.take("+")) return { type: "unary", operator: "+", argument: this.unary() };
    if (this.take("-")) return { type: "unary", operator: "-", argument: this.unary() };
    return this.primary();
  }

  primary() {
    const token = this.current();
    if (this.take("(")) {
      const value = this.comparison();
      if (!this.take(")")) throw new Error(ERROR.value);
      return value;
    }
    if (token.type === "number" || token.type === "string") {
      this.index += 1;
      return { type: "literal", value: token.value };
    }
    if (token.type === "reference") {
      this.index += 1;
      if (this.take(":")) {
        const end = this.current();
        if (end.type !== "reference") throw new Error(ERROR.ref);
        this.index += 1;
        return { type: "range", start: token.value, end: end.value };
      }
      return { type: "reference", address: token.value };
    }
    if (token.type === "identifier") {
      this.index += 1;
      if (token.value === "TRUE") return { type: "literal", value: true };
      if (token.value === "FALSE") return { type: "literal", value: false };
      if (!this.take("(")) return { type: "identifier", name: token.value };
      const args = [];
      if (!this.take(")")) {
        do {
          args.push(this.comparison());
        } while (this.take(","));
        if (!this.take(")")) throw new Error(ERROR.value);
      }
      return { type: "call", name: token.value, args };
    }
    throw new Error(ERROR.value);
  }
}

function formulaSource(formula) {
  const text = String(formula || "");
  return text.startsWith("=") ? text.slice(1) : text;
}

export function parseFormula(formula) {
  const key = String(formula || "");
  const cached = AST_CACHE.get(key);
  if (cached) {
    if (cached.error) throw new Error(cached.error);
    return cached.ast;
  }
  try {
    const ast = new Parser(tokenize(formulaSource(key))).parse();
    AST_CACHE.set(key, { ast });
    return ast;
  } catch (error) {
    const message = Object.values(ERROR).includes(error?.message) ? error.message : ERROR.value;
    AST_CACHE.set(key, { error: message });
    throw new Error(message);
  }
}

export function getCachedFormulaAst(formula) {
  return parseFormula(formula);
}

function evaluateAst(ast, readCell) {
  if (!ast) return ERROR.value;
  if (ast.type === "literal") return ast.value;
  if (ast.type === "identifier") return ERROR.name;
  if (ast.type === "reference") return readCell(ast.address);
  if (ast.type === "range") return rangeValues(ast.start, ast.end, readCell);
  if (ast.type === "unary") {
    const value = numeric(evaluateAst(ast.argument, readCell));
    if (ast.operator === "+") return value;
    return isError(value) ? value : -value;
  }
  if (ast.type === "binary") {
    const left = evaluateAst(ast.left, readCell);
    const right = evaluateAst(ast.right, readCell);
    if (COMPARISON_OPERATORS.includes(ast.operator)) {
      const a = comparable(left);
      const b = comparable(right);
      if (ast.operator === "=") return a === b;
      if (ast.operator === "<>") return a !== b;
      if (ast.operator === "<") return a < b;
      if (ast.operator === ">") return a > b;
      if (ast.operator === "<=") return a <= b;
      return a >= b;
    }
    const a = numeric(left);
    const b = numeric(right);
    if (isError(a) || isError(b)) return ERROR.value;
    if (ast.operator === "+") return a + b;
    if (ast.operator === "-") return a - b;
    if (ast.operator === "*") return a * b;
    if (ast.operator === "/") return b === 0 ? ERROR.div0 : a / b;
    return a ** b;
  }
  if (ast.type === "call") {
    const args = ast.args.map((argument) => evaluateAst(argument, readCell));
    return FUNCTIONS[ast.name] ? FUNCTIONS[ast.name](args) : ERROR.name;
  }
  return ERROR.value;
}

function collectAstReferences(ast, result = { cells: new Set(), ranges: [] }) {
  if (!ast) return result;
  if (ast.type === "reference") {
    result.cells.add(normalizeAddress(ast.address));
    return result;
  }
  if (ast.type === "range") {
    const descriptor = rangeDescriptor(ast.start, ast.end);
    if (descriptor) result.ranges.push(descriptor);
    return result;
  }
  if (ast.type === "unary") return collectAstReferences(ast.argument, result);
  if (ast.type === "binary") {
    collectAstReferences(ast.left, result);
    collectAstReferences(ast.right, result);
    return result;
  }
  if (ast.type === "call") {
    ast.args.forEach((argument) => collectAstReferences(argument, result));
  }
  return result;
}

export function collectFormulaReferences(formulaOrAst) {
  const ast = typeof formulaOrAst === "string" ? parseFormula(formulaOrAst) : formulaOrAst;
  return collectAstReferences(ast);
}

function fallbackFormulaReferences(formula) {
  const source = formulaSource(formula);
  const result = { cells: new Set(), ranges: [] };
  let index = 0;
  let inString = false;
  while (index < source.length) {
    const character = source[index];
    if (character === '"') {
      if (inString && source[index + 1] === '"') {
        index += 2;
        continue;
      }
      inString = !inString;
      index += 1;
      continue;
    }
    if (inString) {
      index += 1;
      continue;
    }
    const previous = source[index - 1];
    if (previous && /[A-Za-z0-9_.]/.test(previous)) {
      index += 1;
      continue;
    }
    const match = /^\$?([A-Za-z]+)\$?(\d+)/.exec(source.slice(index));
    if (!match) {
      index += 1;
      continue;
    }
    const start = normalizeAddress(`${match[1]}${match[2]}`);
    const afterStart = source.slice(index + match[0].length);
    const rangeMatch = /^\s*:\s*\$?([A-Za-z]+)\$?(\d+)/.exec(afterStart);
    if (rangeMatch) {
      const descriptor = rangeDescriptor(start, `${rangeMatch[1]}${rangeMatch[2]}`);
      if (descriptor) result.ranges.push(descriptor);
      index += match[0].length + rangeMatch[0].length;
    } else {
      result.cells.add(start);
      index += match[0].length;
    }
  }
  return result;
}

function addSetValue(map, key, value) {
  let values = map.get(key);
  if (!values) {
    values = new Set();
    map.set(key, values);
  }
  values.add(value);
}

function deleteSetValue(map, key, value) {
  const values = map.get(key);
  if (!values) return;
  values.delete(value);
  if (!values.size) map.delete(key);
}

function forEachRangeCell(range, callback) {
  for (let row = range.startRow; row <= range.endRow; row += 1) {
    for (let column = range.startColumn; column <= range.endColumn; column += 1) {
      callback(cellAddress(row, column));
    }
  }
}

export class FormulaDependencyGraph {
  constructor() {
    this.entries = new Map();
    this.dependencies = new Map();
    this.reverseDependencies = new Map();
    this.rangeReverseDependencies = new Map();
    this.wideRanges = new Map();
  }

  clear() {
    this.entries.clear();
    this.dependencies.clear();
    this.reverseDependencies.clear();
    this.rangeReverseDependencies.clear();
    this.wideRanges.clear();
  }

  setFormula(address, descriptors) {
    const formulaAddress = normalizeAddress(address);
    this.removeFormula(formulaAddress);
    const cells = new Set();
    const ranges = [];
    for (const cell of descriptors?.cells || []) {
      const normalized = normalizeAddress(cell);
      if (coordinatesFromAddress(normalized)) cells.add(normalized);
    }
    for (const candidate of descriptors?.ranges || []) {
      const range = rangeDescriptor(candidate.startAddress, candidate.endAddress)
        || (candidate.startRow !== undefined && candidate.endRow !== undefined
          ? {
              ...candidate,
              startAddress: cellAddress(candidate.startRow, candidate.startColumn),
              endAddress: cellAddress(candidate.endRow, candidate.endColumn),
            }
          : null);
      if (!range) continue;
      const size = (range.endRow - range.startRow + 1) * (range.endColumn - range.startColumn + 1);
      const materialized = size <= MAX_MATERIALIZED_DEPENDENCIES;
      const stored = { ...range, materialized };
      ranges.push(stored);
      if (materialized) {
        forEachRangeCell(stored, (cell) => cells.add(cell));
      }
      if (range.endRow - range.startRow + 1 <= MAX_INDEXED_RANGE_ROWS) {
        for (let row = range.startRow; row <= range.endRow; row += 1) {
          addSetValue(this.rangeReverseDependencies, row, formulaAddress);
        }
      } else {
        this.wideRanges.set(formulaAddress, true);
      }
    }
    this.entries.set(formulaAddress, { cells, ranges });
    this.dependencies.set(formulaAddress, cells);
    for (const cell of cells) addSetValue(this.reverseDependencies, cell, formulaAddress);
  }

  removeFormula(address) {
    const formulaAddress = normalizeAddress(address);
    const entry = this.entries.get(formulaAddress);
    if (!entry) return;
    for (const cell of entry.cells) deleteSetValue(this.reverseDependencies, cell, formulaAddress);
    for (const range of entry.ranges) {
      if (range.endRow - range.startRow + 1 <= MAX_INDEXED_RANGE_ROWS) {
        for (let row = range.startRow; row <= range.endRow; row += 1) {
          deleteSetValue(this.rangeReverseDependencies, row, formulaAddress);
        }
      }
    }
    this.wideRanges.delete(formulaAddress);
    this.entries.delete(formulaAddress);
    this.dependencies.delete(formulaAddress);
  }

  hasFormula(address) {
    return this.entries.has(normalizeAddress(address));
  }

  formulaAddresses() {
    return [...this.entries.keys()];
  }

  getDependencyRanges(address) {
    return (this.entries.get(normalizeAddress(address))?.ranges || []).map((range) => ({ ...range }));
  }

  getDependencies(address) {
    const entry = this.entries.get(normalizeAddress(address));
    if (!entry) return new Set();
    const dependencies = new Set(entry.cells);
    for (const range of entry.ranges) {
      if (range.materialized) continue;
      forEachRangeCell(range, (cell) => dependencies.add(cell));
    }
    return dependencies;
  }

  dependentsOf(addresses) {
    const dependents = new Set();
    for (const address of Array.isArray(addresses) || addresses instanceof Set ? addresses : [addresses]) {
      const normalized = normalizeAddress(address);
      for (const formula of this.reverseDependencies.get(normalized) || []) dependents.add(formula);
      const coordinates = coordinatesFromAddress(normalized);
      if (!coordinates) continue;
      const candidates = new Set(this.rangeReverseDependencies.get(coordinates.row) || []);
      for (const formula of this.wideRanges.keys()) candidates.add(formula);
      for (const formula of candidates) {
        const entry = this.entries.get(formula);
        if (entry?.ranges.some((range) => (
          coordinates.row >= range.startRow
          && coordinates.row <= range.endRow
          && coordinates.column >= range.startColumn
          && coordinates.column <= range.endColumn
        ))) {
          dependents.add(formula);
        }
      }
    }
    return dependents;
  }

  transitiveDependentsOf(addresses) {
    const seen = new Set();
    const queue = [...(Array.isArray(addresses) || addresses instanceof Set ? addresses : [addresses])]
      .map(normalizeAddress);
    while (queue.length) {
      const address = queue.shift();
      for (const dependent of this.dependentsOf(address)) {
        if (seen.has(dependent)) continue;
        seen.add(dependent);
        queue.push(dependent);
      }
    }
    return seen;
  }

  snapshot() {
    return {
      dependencies: Object.fromEntries([...this.entries.keys()].map((address) => [address, {
        cells: [...(this.dependencies.get(address) || [])],
        ranges: this.getDependencyRanges(address),
      }])),
      reverseDependencies: Object.fromEntries(
        [...this.reverseDependencies.entries()].map(([address, formulas]) => [address, [...formulas]]),
      ),
    };
  }
}

function rawCellValue(cell) {
  if (!cell) return "";
  if (cell.embed) return cell.value || "";
  return cell.value || "";
}

function errorValue(error) {
  return Object.values(ERROR).includes(error?.message) ? error.message : ERROR.value;
}

function cachedAst(formula, stats) {
  const key = String(formula || "");
  if (AST_CACHE.has(key)) {
    stats.astCacheHits += 1;
    const cached = AST_CACHE.get(key);
    if (cached.error) throw new Error(cached.error);
    return cached.ast;
  }
  stats.astCacheMisses += 1;
  return parseFormula(key);
}

function cellFromSheet(sheet, address) {
  const coordinates = coordinatesFromAddress(address);
  if (!coordinates) return null;
  return sheet?.cells?.[cellId(coordinates.row, coordinates.column)] || null;
}

function normalizeChanges(changes) {
  if (Array.isArray(changes)) return changes;
  if (!changes || typeof changes !== "object") return [];
  if (changes.address || changes.cell || changes.patch || changes.delete) return [changes];
  return Object.entries(changes).map(([address, patch]) => ({ address, patch }));
}

function applyCellChange(sheet, change) {
  const address = normalizeAddress(change?.address || change?.cell?.address || "");
  const coordinates = coordinatesFromAddress(address);
  if (!coordinates) return { address: "", removed: false };
  const id = cellId(coordinates.row, coordinates.column);
  const existing = sheet.cells?.[id];
  const shouldRemove = change?.delete === true || change?.cell === null;
  if (shouldRemove) {
    if (existing) delete sheet.cells[id];
    return { address, removed: true };
  }
  const supplied = change?.patch || change?.cell || Object.fromEntries(
    Object.entries(change || {}).filter(([key]) => !["address", "requestId", "revision", "type"].includes(key)),
  );
  const cell = {
    id,
    address,
    row: coordinates.row,
    column: coordinates.column,
    value: "",
    formula: "",
    embed: null,
    ...(existing || {}),
    ...(supplied || {}),
  };
  cell.id = id;
  cell.address = address;
  cell.row = coordinates.row;
  cell.column = coordinates.column;
  sheet.cells[id] = cell;
  return { address, removed: false, cell };
}

function formulaDescriptors(formula, stats) {
  try {
    return collectAstReferences(cachedAst(formula, stats));
  } catch {
    return fallbackFormulaReferences(formula);
  }
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export class FormulaEngine {
  constructor(sheet = { cells: {} }, options = {}) {
    this.sheet = sheet || { cells: {} };
    if (!this.sheet.cells || typeof this.sheet.cells !== "object") this.sheet.cells = {};
    this.graph = new FormulaDependencyGraph();
    this.values = new Map();
    this.invalidated = new Set();
    this.revision = Number.isInteger(options.revision) ? options.revision : 0;
    this.stats = {
      astCacheHits: 0,
      astCacheMisses: 0,
      totalEvaluatedFormulas: 0,
      fullRecalculations: 0,
      incrementalRecalculations: 0,
    };
    this.lastCalculation = {
      mode: "idle",
      affectedAddresses: [],
      evaluatedAddresses: [],
      durationMs: 0,
      formulaCount: 0,
    };
    this._evaluationTrace = null;
    this.rebuild({ recalculate: options.autoRecalculate !== false });
  }

  rebuild({ recalculate = true } = {}) {
    this.graph.clear();
    this.values.clear();
    this.invalidated.clear();
    for (const [id, cell] of Object.entries(this.sheet.cells || {})) {
      if (!cell?.formula) continue;
      const address = cellAddressForCell(cell, id);
      if (!address) continue;
      this.graph.setFormula(address, formulaDescriptors(cell.formula, this.stats));
    }
    if (recalculate) return this.recalculateAll({ advanceRevision: false });
    return this.lastCalculation;
  }

  getCell(address) {
    return cellFromSheet(this.sheet, normalizeAddress(address));
  }

  evaluateAddress(address, stack = new Set()) {
    const normalizedAddress = normalizeAddress(address);
    if (this.values.has(normalizedAddress) && !this.invalidated.has(normalizedAddress)) {
      return this.values.get(normalizedAddress);
    }
    if (stack.has(normalizedAddress)) return ERROR.cycle;
    const cell = this.getCell(normalizedAddress);
    if (!cell?.formula) return rawCellValue(cell);

    stack.add(normalizedAddress);
    if (this._evaluationTrace && !this._evaluationTrace.includes(normalizedAddress)) {
      this._evaluationTrace.push(normalizedAddress);
    }
    let value;
    try {
      const ast = cachedAst(cell.formula, this.stats);
      value = scalar(evaluateAst(ast, (reference) => this.evaluateAddress(reference, stack)));
    } catch (error) {
      value = errorValue(error);
    }
    stack.delete(normalizedAddress);
    this.values.set(normalizedAddress, value);
    this.invalidated.delete(normalizedAddress);
    return value;
  }

  _runRecalculation(targets, { mode, affectedAddresses = targets, advanceRevision = false } = {}) {
    if (advanceRevision) this.revision += 1;
    const start = now();
    const trace = [];
    const targetSet = new Set(targets.filter((address) => this.graph.hasFormula(address)));
    const previousTrace = this._evaluationTrace;
    this._evaluationTrace = trace;
    try {
      for (const address of this.graph.formulaAddresses()) {
        if (targetSet.has(address)) this.evaluateAddress(address, new Set());
      }
    } finally {
      this._evaluationTrace = previousTrace;
    }
    const values = new Map();
    for (const address of trace) {
      if (this.values.has(address)) values.set(address, this.values.get(address));
    }
    const durationMs = now() - start;
    const calculation = {
      mode,
      affectedAddresses: [...new Set(affectedAddresses.map(normalizeAddress).filter(Boolean))],
      evaluatedAddresses: trace,
      durationMs,
      formulaCount: this.graph.formulaAddresses().length,
      astCacheHits: this.stats.astCacheHits,
      astCacheMisses: this.stats.astCacheMisses,
    };
    this.lastCalculation = calculation;
    this.stats.totalEvaluatedFormulas += trace.length;
    if (mode === "full") this.stats.fullRecalculations += 1;
    if (mode === "incremental") this.stats.incrementalRecalculations += 1;
    return {
      revision: this.revision,
      mode,
      values,
      changedAddresses: calculation.affectedAddresses,
      affectedAddresses: calculation.affectedAddresses,
      evaluatedAddresses: [...trace],
      calculation,
    };
  }

  recalculateAll({ advanceRevision = false } = {}) {
    this.values.clear();
    this.invalidated.clear();
    return this._runRecalculation(this.graph.formulaAddresses(), {
      mode: "full",
      affectedAddresses: this.graph.formulaAddresses(),
      advanceRevision,
    });
  }

  recalculate({ addresses = [], advanceRevision = false } = {}) {
    const targets = addresses.length
      ? addresses.map(normalizeAddress)
      : [...this.invalidated];
    return this._runRecalculation(targets, {
      mode: "incremental",
      affectedAddresses: targets,
      advanceRevision,
    });
  }

  applyChanges(changes, { revision } = {}) {
    if (Number.isInteger(revision) && revision < this.revision) {
      const error = new Error("STALE_REVISION");
      error.code = "STALE_REVISION";
      throw error;
    }
    const normalizedChanges = normalizeChanges(changes);
    const changedAddresses = [];
    const removedAddresses = [];
    for (const change of normalizedChanges) {
      const result = applyCellChange(this.sheet, change);
      if (!result.address) continue;
      changedAddresses.push(result.address);
      if (result.removed) removedAddresses.push(result.address);
    }
    for (const address of changedAddresses) {
      const cell = this.getCell(address);
      if (cell?.formula) this.graph.setFormula(address, formulaDescriptors(cell.formula, this.stats));
      else this.graph.removeFormula(address);
      if (!cell?.formula) {
        this.values.delete(address);
        this.invalidated.delete(address);
      }
    }
    const affected = new Set(this.graph.transitiveDependentsOf(changedAddresses));
    for (const address of changedAddresses) {
      if (this.graph.hasFormula(address)) affected.add(address);
    }
    for (const address of affected) this.invalidated.add(address);
    if (Number.isInteger(revision)) this.revision = revision;
    else this.revision += 1;
    const result = this._runRecalculation([...affected], {
      mode: "incremental",
      affectedAddresses: [...affected],
    });
    result.changedAddresses = changedAddresses;
    result.removedAddresses = removedAddresses;
    return result;
  }

  updateCell(address, patch, options = {}) {
    return this.applyChanges([{ address, patch }], options);
  }

  getFormulaValues() {
    return new Map(this.values);
  }

  getDependencies(address) {
    return this.graph.getDependencies(address);
  }

  getDependents(address) {
    return this.graph.dependentsOf(address);
  }

  getStats() {
    return {
      ...this.stats,
      formulaCount: this.graph.formulaAddresses().length,
      cachedAstCount: AST_CACHE.size,
      cachedFormatterCount: NUMBER_FORMATTER_CACHE.size,
      lastCalculation: { ...this.lastCalculation },
    };
  }

  snapshot() {
    const graph = this.graph.snapshot();
    return {
      revision: this.revision,
      values: Object.fromEntries(this.values),
      ...graph,
      stats: this.getStats(),
    };
  }
}

export function createFormulaEngine(sheet, options) {
  return new FormulaEngine(sheet, options);
}

export function evaluateCell(sheet, address, cache = new Map(), stack = new Set()) {
  const normalizedAddress = normalizeAddress(address);
  if (cache.has(normalizedAddress)) return cache.get(normalizedAddress);
  if (stack.has(normalizedAddress)) return ERROR.cycle;
  const coordinates = coordinatesFromAddress(normalizedAddress);
  if (!coordinates) return ERROR.ref;
  const cell = sheet.cells?.[cellId(coordinates.row, coordinates.column)];
  if (!cell?.formula) return rawCellValue(cell);

  stack.add(normalizedAddress);
  let value;
  try {
    const ast = parseFormula(cell.formula);
    value = scalar(evaluateAst(ast, (reference) => evaluateCell(sheet, reference, cache, stack)));
  } catch (error) {
    value = errorValue(error);
  }
  stack.delete(normalizedAddress);
  cache.set(normalizedAddress, value);
  return value;
}

export function evaluateSheetFormulas(sheet) {
  return new FormulaEngine(sheet).getFormulaValues();
}

function formatterCacheKey(locale, options) {
  const localeKey = Array.isArray(locale) ? locale.join(",") : locale || "default";
  const optionKey = Object.keys(options || {}).sort().map((key) => `${key}:${options[key]}`).join("|");
  return `${localeKey}::${optionKey}`;
}

export function getCachedNumberFormatter(locale, options = {}) {
  const key = formatterCacheKey(locale, options);
  const cached = NUMBER_FORMATTER_CACHE.get(key);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale, options);
  NUMBER_FORMATTER_CACHE.set(key, formatter);
  return formatter;
}

export function formatFormulaResult(value, locale) {
  if (typeof value !== "number") return String(value ?? "");
  if (!Number.isFinite(value)) return ERROR.value;
  const rounded = Math.round((value + Number.EPSILON) * 1e10) / 1e10;
  return getCachedNumberFormatter(locale, { maximumFractionDigits: 10 }).format(rounded);
}

export function getFormulaCacheStats() {
  return {
    astCount: AST_CACHE.size,
    formatterCount: NUMBER_FORMATTER_CACHE.size,
  };
}

export function clearFormulaCaches() {
  AST_CACHE.clear();
  NUMBER_FORMATTER_CACHE.clear();
}

export { ERROR as FORMULA_ERRORS };

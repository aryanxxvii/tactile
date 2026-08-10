import { cellAddress, cellId, coordinatesFromAddress } from "./coordinates.js";

const ERROR = {
  cycle: "#CYCLE!",
  div0: "#DIV/0!",
  name: "#NAME?",
  ref: "#REF!",
  value: "#VALUE!",
};

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

function tokenize(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) { index += whitespace[0].length; continue; }
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
      tokens.push({ type: "reference", value: reference[0].replace(/\$/g, "").toUpperCase() });
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

function rangeValues(sheet, startAddress, endAddress, readCell) {
  const start = coordinatesFromAddress(startAddress);
  const end = coordinatesFromAddress(endAddress);
  if (!start || !end) return { __range: true, values: [ERROR.ref] };
  const values = [];
  const matrix = [];
  for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row += 1) {
    const matrixRow = [];
    for (let column = Math.min(start.column, end.column); column <= Math.max(start.column, end.column); column += 1) {
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
  constructor(tokens, sheet, readCell) {
    this.tokens = tokens;
    this.sheet = sheet;
    this.readCell = readCell;
    this.index = 0;
  }

  current() { return this.tokens[this.index]; }
  take(value) {
    if (this.current().type !== "operator" || this.current().value !== value) return false;
    this.index += 1;
    return true;
  }

  parse() {
    const value = this.comparison();
    if (this.current().type !== "eof") throw new Error(ERROR.value);
    return scalar(value);
  }

  comparison() {
    let left = this.additive();
    while (["=", "<>", "<", ">", "<=", ">="].includes(this.current().value)) {
      const operator = this.current().value;
      this.index += 1;
      const right = this.additive();
      const a = comparable(left);
      const b = comparable(right);
      if (operator === "=") left = a === b;
      else if (operator === "<>") left = a !== b;
      else if (operator === "<") left = a < b;
      else if (operator === ">") left = a > b;
      else if (operator === "<=") left = a <= b;
      else left = a >= b;
    }
    return left;
  }

  additive() {
    let left = this.multiplicative();
    while (["+", "-"].includes(this.current().value)) {
      const operator = this.current().value;
      this.index += 1;
      const right = this.multiplicative();
      const a = numeric(left);
      const b = numeric(right);
      if (isError(a) || isError(b)) return ERROR.value;
      left = operator === "+" ? a + b : a - b;
    }
    return left;
  }

  multiplicative() {
    let left = this.power();
    while (["*", "/"].includes(this.current().value)) {
      const operator = this.current().value;
      this.index += 1;
      const right = this.power();
      const a = numeric(left);
      const b = numeric(right);
      if (isError(a) || isError(b)) return ERROR.value;
      if (operator === "/" && b === 0) return ERROR.div0;
      left = operator === "*" ? a * b : a / b;
    }
    return left;
  }

  power() {
    let left = this.unary();
    while (this.take("^")) {
      const right = this.unary();
      const a = numeric(left);
      const b = numeric(right);
      if (isError(a) || isError(b)) return ERROR.value;
      left = a ** b;
    }
    return left;
  }

  unary() {
    if (this.take("+")) return numeric(this.unary());
    if (this.take("-")) {
      const value = numeric(this.unary());
      return isError(value) ? value : -value;
    }
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
      return token.value;
    }
    if (token.type === "reference") {
      this.index += 1;
      if (this.take(":")) {
        const end = this.current();
        if (end.type !== "reference") throw new Error(ERROR.ref);
        this.index += 1;
        return rangeValues(this.sheet, token.value, end.value, this.readCell);
      }
      return this.readCell(token.value);
    }
    if (token.type === "identifier") {
      this.index += 1;
      if (token.value === "TRUE") return true;
      if (token.value === "FALSE") return false;
      if (!this.take("(")) return ERROR.name;
      const args = [];
      if (!this.take(")")) {
        do { args.push(this.comparison()); } while (this.take(","));
        if (!this.take(")")) throw new Error(ERROR.value);
      }
      const fn = FUNCTIONS[token.value];
      return fn ? fn(args) : ERROR.name;
    }
    throw new Error(ERROR.value);
  }
}

function rawCellValue(cell) {
  if (!cell) return "";
  if (cell.embed) return cell.value || "";
  return cell.value || "";
}

export function evaluateCell(sheet, address, cache = new Map(), stack = new Set()) {
  const normalizedAddress = String(address || "").replace(/\$/g, "").toUpperCase();
  if (cache.has(normalizedAddress)) return cache.get(normalizedAddress);
  if (stack.has(normalizedAddress)) return ERROR.cycle;
  const coordinates = coordinatesFromAddress(normalizedAddress);
  if (!coordinates) return ERROR.ref;
  const cell = sheet.cells?.[cellId(coordinates.row, coordinates.column)];
  if (!cell?.formula) return rawCellValue(cell);

  stack.add(normalizedAddress);
  let value;
  try {
    const source = cell.formula.startsWith("=") ? cell.formula.slice(1) : cell.formula;
    const parser = new Parser(tokenize(source), sheet, (reference) => evaluateCell(sheet, reference, cache, stack));
    value = parser.parse();
  } catch (error) {
    value = Object.values(ERROR).includes(error?.message) ? error.message : ERROR.value;
  }
  stack.delete(normalizedAddress);
  cache.set(normalizedAddress, value);
  return value;
}

export function evaluateSheetFormulas(sheet) {
  const cache = new Map();
  Object.values(sheet.cells || {}).forEach((cell) => {
    if (cell.formula) evaluateCell(sheet, cell.address, cache, new Set());
  });
  return cache;
}

export function formatFormulaResult(value) {
  if (typeof value !== "number") return String(value ?? "");
  if (!Number.isFinite(value)) return ERROR.value;
  const rounded = Math.round((value + Number.EPSILON) * 1e10) / 1e10;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 10 }).format(rounded);
}

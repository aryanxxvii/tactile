function escapedAt(source, index) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function appendText(nodes, value) {
  if (!value) return;
  const previous = nodes.at(-1);
  if (previous?.type === "text") previous.value += value;
  else nodes.push({ type: "text", value });
}

function closingDelimiter(source, delimiter, start, singleDollar = false) {
  let cursor = start;
  while (cursor < source.length) {
    const found = source.indexOf(delimiter, cursor);
    if (found === -1) return -1;
    if (!escapedAt(source, found)) {
      const before = source[found - 1] || "";
      const after = source[found + delimiter.length] || "";
      if (!singleDollar || (before && !/\s/.test(before) && after !== "$")) return found;
    }
    cursor = found + delimiter.length;
  }
  return -1;
}

function mathAt(source, index) {
  const candidates = [
    { open: "$$", close: "$$", type: "math-display" },
    { open: "\\[", close: "\\]", type: "math-display" },
    { open: "\\(", close: "\\)", type: "math-inline" },
    { open: "$", close: "$", type: "math-inline", singleDollar: true },
  ];
  for (const candidate of candidates) {
    if (!source.startsWith(candidate.open, index) || escapedAt(source, index)) continue;
    const expressionStart = index + candidate.open.length;
    if (candidate.singleDollar && (/\s/.test(source[expressionStart] || "") || source[expressionStart] === "$")) continue;
    const end = closingDelimiter(source, candidate.close, expressionStart, candidate.singleDollar);
    if (end === -1 || end === expressionStart) continue;
    const expression = source.slice(expressionStart, end);
    if (candidate.singleDollar && /^\d/.test(expression) && /\s/.test(expression)) continue;
    return {
      node: {
        type: candidate.type,
        value: expression,
        source: source.slice(index, end + candidate.close.length),
      },
      end: end + candidate.close.length,
    };
  }
  return null;
}

const INLINE_TOKENS = [
  { pattern: /^`([^`\n]+)`/, build: (match) => ({ type: "code-inline", value: match[1] }) },
  { pattern: /^!\[([^\]]*)\]\(([^)]+)\)/, build: (match) => ({ type: "image", alt: match[1], src: match[2] }) },
  { pattern: /^\[([^\]]+)\]\(([^)]+)\)/, build: (match) => ({ type: "link", value: match[1], href: match[2] }) },
  { pattern: /^<span\s+style="color:\s*(#[0-9a-fA-F]{6})">(.*?)<\/span>/, build: (match) => ({ type: "color", color: match[1], children: parseInlineMarkdown(match[2]) }) },
  { pattern: /^<mark\s+style="background-color:\s*(#[0-9a-fA-F]{6})">(.*?)<\/mark>/, build: (match) => ({ type: "highlight", color: match[1], children: parseInlineMarkdown(match[2]) }) },
  { pattern: /^<u>(.*?)<\/u>/, build: (match) => ({ type: "underline", children: parseInlineMarkdown(match[1]) }) },
  { pattern: /^==([^=]+)==/, build: (match) => ({ type: "highlight", children: parseInlineMarkdown(match[1]) }) },
  { pattern: /^\*\*([^*]+)\*\*/, build: (match) => ({ type: "strong", children: parseInlineMarkdown(match[1]) }) },
  { pattern: /^~~([^~]+)~~/, build: (match) => ({ type: "delete", children: parseInlineMarkdown(match[1]) }) },
  { pattern: /^_([^_]+)_/, build: (match) => ({ type: "emphasis", children: parseInlineMarkdown(match[1]) }) },
];

export function parseInlineMarkdown(value) {
  const source = String(value || "");
  const nodes = [];
  let index = 0;
  while (index < source.length) {
    let matched = false;
    for (const token of INLINE_TOKENS) {
      const match = token.pattern.exec(source.slice(index));
      if (!match) continue;
      nodes.push(token.build(match));
      index += match[0].length;
      matched = true;
      break;
    }
    if (matched) continue;
    const math = mathAt(source, index);
    if (math) {
      nodes.push(math.node);
      index = math.end;
      continue;
    }
    appendText(nodes, source[index]);
    index += 1;
  }
  return nodes;
}

function standaloneMath(lines, index) {
  const trimmed = lines[index].trim();
  const delimiter = trimmed.startsWith("$$") ? { open: "$$", close: "$$" }
    : trimmed.startsWith("\\[") ? { open: "\\[", close: "\\]" }
      : null;
  if (!delimiter) return null;
  const first = trimmed.slice(delimiter.open.length);
  const sameLineEnd = first.lastIndexOf(delimiter.close);
  if (sameLineEnd >= 0) {
    return {
      node: { type: "math-display", value: first.slice(0, sameLineEnd), source: trimmed },
      next: index + 1,
    };
  }
  const expression = [first];
  let cursor = index + 1;
  while (cursor < lines.length) {
    const closeAt = lines[cursor].indexOf(delimiter.close);
    if (closeAt >= 0) {
      expression.push(lines[cursor].slice(0, closeAt));
      return {
        node: {
          type: "math-display",
          value: expression.join("\n"),
          source: `${delimiter.open}${expression.join("\n")}${delimiter.close}`,
        },
        next: cursor + 1,
      };
    }
    expression.push(lines[cursor]);
    cursor += 1;
  }
  return null;
}

function parseRow(value) {
  return value.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((part) => parseInlineMarkdown(part.trim()));
}

export function parseMarkdownBlocks(content) {
  const lines = String(content || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const displayMath = standaloneMath(lines, index);
    if (displayMath) {
      blocks.push({ ...displayMath.node, key: `block-${index}` });
      index = displayMath.next;
      continue;
    }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code = [];
      const start = index;
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: language.toLowerCase() === "mermaid" ? "diagram" : "code", language, value: code.join("\n"), key: `block-${start}` });
      continue;
    }
    if (/^#{1,6} /.test(line)) {
      const level = line.match(/^#+/)[0].length;
      blocks.push({ type: "heading", level, children: parseInlineMarkdown(line.slice(level + 1)), key: `block-${index}` });
      index += 1;
      continue;
    }
    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const start = index;
      const headings = parseRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|")) {
        rows.push(parseRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", headings, rows, key: `block-${start}` });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push({ type: "separator", key: `block-${index}` });
      index += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      const start = index;
      const quoted = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quoted.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push({ type: "quote", children: parseInlineMarkdown(quoted.join(" ")), key: `block-${start}` });
      continue;
    }
    if (/^- (?:\[[ xX]\] )?/.test(line)) {
      const start = index;
      const items = [];
      while (index < lines.length && /^- (?:\[[ xX]\] )?/.test(lines[index])) {
        const task = /^- \[([ xX])\] (.*)$/.exec(lines[index]);
        items.push({ checked: task ? task[1].toLowerCase() === "x" : null, children: parseInlineMarkdown(task ? task[2] : lines[index].slice(2)) });
        index += 1;
      }
      blocks.push({ type: "list", ordered: false, items, key: `block-${start}` });
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const start = index;
      const items = [];
      while (index < lines.length && /^\d+\. /.test(lines[index])) {
        items.push({ checked: null, children: parseInlineMarkdown(lines[index].replace(/^\d+\. /, "")) });
        index += 1;
      }
      blocks.push({ type: "list", ordered: true, items, key: `block-${start}` });
      continue;
    }
    const start = index;
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6} |```|> |- (?:\[[ xX]\] )?|\d+\. |-{3,}$|\*{3,}$|\$\$|\\\[)/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", children: parseInlineMarkdown(paragraph.join(" ")), key: `block-${start}` });
  }
  return blocks;
}
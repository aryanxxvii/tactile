import assert from "node:assert/strict";
import test from "node:test";

import { mermaidCacheKey, mermaidConfig } from "../src/objects/markdown/capabilities/mermaidRenderer.js";
import { parseInlineMarkdown, parseMarkdownBlocks } from "../src/objects/markdown/markdownParse.js";

test("parses built-in Markdown formatting without interpreting protected math", () => {
  const nodes = parseInlineMarkdown("**Bold** `cost $5$` [math $x$](https://example.test/$x$) and $E=mc^2$");
  assert.deepEqual(
    nodes.map((node) => node.type),
    ["strong", "text", "code-inline", "text", "link", "text", "math-inline"],
  );
  assert.equal(nodes.at(-1).value, "E=mc^2");
});

test("supports dollar and TeX inline delimiters while preserving escapes and currency", () => {
  const nodes = parseInlineMarkdown(String.raw`Price is $5 and tax is $10, but $x+1$, \(y^2\), and \$z stay readable.`);
  assert.deepEqual(
    nodes.filter((node) => node.type === "math-inline").map((node) => node.value),
    ["x+1", "y^2"],
  );
  assert.match(
    nodes
      .filter((node) => node.type === "text")
      .map((node) => node.value)
      .join(""),
    /\$5 and tax is \$10/,
  );
});

test("parses multiline display math and leaves unmatched delimiters as text", () => {
  const blocks = parseMarkdownBlocks(String.raw`Before

$$
\int_0^1 x^2 dx
$$

\[
x + y
\]

Unclosed $math`);
  assert.deepEqual(
    blocks.map((block) => block.type),
    ["paragraph", "math-display", "math-display", "paragraph"],
  );
  assert.equal(blocks[1].value, "\n\\int_0^1 x^2 dx\n");
  assert.deepEqual(blocks[3].children, [{ type: "text", value: "Unclosed $math" }]);
});

test("classifies only exact Mermaid fences as diagrams and never parses their source", () => {
  const blocks = parseMarkdownBlocks(
    "```mermaid\ngraph TD\n A[$x$] --> B\n```\n\n```javascript\nconst value = '$x$';\n```",
  );
  assert.deepEqual(
    blocks.map((block) => block.type),
    ["diagram", "code"],
  );
  assert.equal(blocks[0].value, "graph TD\n A[$x$] --> B");
  assert.equal(blocks[1].language, "javascript");
});

test("uses strict Mermaid configuration and theme-aware normalized cache keys", async () => {
  const light = {
    colorScheme: "light",
    paper: "#ffffff",
    paperElevated: "#fdfdfb",
    tray: "#eeeeea",
    cell: "#fafaf7",
    ink: "#111111",
    defaultInk: "#292925",
    muted: "#666660",
    lineStrong: "#c8c8c0",
    accent: "#aa3300",
    positive: "#447755",
    negative: "#993322",
    uiFont: '"Public Sans Variable", sans-serif',
  };
  const dark = { ...light, colorScheme: "dark", paper: "#111111", ink: "#eeeeee" };
  const config = mermaidConfig(light);
  assert.deepEqual(
    {
      securityLevel: config.securityLevel,
      htmlLabels: config.htmlLabels,
      suppressErrorRendering: config.suppressErrorRendering,
      startOnLoad: config.startOnLoad,
      theme: config.theme,
      fontFamily: config.fontFamily,
    },
    {
      securityLevel: "strict",
      htmlLabels: false,
      suppressErrorRendering: true,
      startOnLoad: false,
      theme: "base",
      fontFamily: light.uiFont,
    },
  );
  assert.equal(config.themeVariables.primaryColor, light.cell);
  assert.equal(config.themeVariables.primaryTextColor, light.ink);
  assert.equal(config.themeVariables.primaryBorderColor, light.accent);
  assert.equal(config.themeVariables.secondaryColor, light.tray);
  assert.equal(config.themeVariables.cScale0, light.accent);
  assert.equal(config.themeVariables.cScale1, light.positive);
  assert.equal(config.themeVariables.cScale2, light.negative);
  assert.deepEqual(config.flowchart, {
    curve: "basis",
    diagramPadding: 18,
    nodeSpacing: 48,
    rankSpacing: 56,
    useMaxWidth: false,
  });
  assert.equal(
    await mermaidCacheKey(" graph TD\r\n A --> B ", light),
    await mermaidCacheKey("graph TD\n A --> B", light),
  );
  assert.notEqual(
    await mermaidCacheKey("graph TD\n A --> B", light),
    await mermaidCacheKey("graph TD\n A --> B", dark),
  );
});

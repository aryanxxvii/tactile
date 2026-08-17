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
  const light = { colorScheme: "light", paper: "#ffffff", ink: "#111111", accent: "#aa3300" };
  const dark = { ...light, colorScheme: "dark", paper: "#111111", ink: "#eeeeee" };
  assert.deepEqual(
    {
      securityLevel: mermaidConfig(light).securityLevel,
      htmlLabels: mermaidConfig(light).htmlLabels,
      suppressErrorRendering: mermaidConfig(light).suppressErrorRendering,
      startOnLoad: mermaidConfig(light).startOnLoad,
    },
    { securityLevel: "strict", htmlLabels: false, suppressErrorRendering: true, startOnLoad: false },
  );
  assert.equal(
    await mermaidCacheKey(" graph TD\r\n A --> B ", light),
    await mermaidCacheKey("graph TD\n A --> B", light),
  );
  assert.notEqual(
    await mermaidCacheKey("graph TD\n A --> B", light),
    await mermaidCacheKey("graph TD\n A --> B", dark),
  );
});

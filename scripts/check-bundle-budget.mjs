import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
const assets = await readdir(assetsDirectory);
const entryJavaScript = assets.find((name) => /^index-.*\.js$/.test(name));
const entryCss = assets.find((name) => /^index-.*\.css$/.test(name));
const katexJavaScript = assets.filter((name) => /^katex-.*\.js$/.test(name));
const mermaidJavaScript = assets.filter((name) => /^mermaid\.core-.*\.js$/.test(name));
const mathCss = assets.filter((name) => /^katex-.*\.css$/.test(name));

if (!entryJavaScript || !entryCss) {
  throw new Error("Bundle budget check could not find the Vite entry assets.");
}

if (katexJavaScript.length !== 1 || mermaidJavaScript.length !== 1 || mathCss.length !== 1) {
  throw new Error(
    `Bundle capability check expected one lazy KaTeX JS, Mermaid core JS, and math CSS asset; found ${katexJavaScript.length}, ${mermaidJavaScript.length}, and ${mathCss.length}.`,
  );
}

const [javaScript, css, katex, mermaid] = await Promise.all([
  readFile(new URL(entryJavaScript, assetsDirectory)),
  readFile(new URL(entryCss, assetsDirectory)),
  readFile(new URL(katexJavaScript[0], assetsDirectory)),
  readFile(new URL(mermaidJavaScript[0], assetsDirectory)),
]);
const sizes = {
  javascript: gzipSync(javaScript).length,
  css: gzipSync(css).length,
  katex: gzipSync(katex).length,
  mermaid: gzipSync(mermaid).length,
};
const budgets = {
  javascript: 110 * 1024,
  // The native onboarding surface and the first-class object surfaces (sheet,
  // markdown, code editor with syntax highlighting) are part of the shipped
  // entry CSS. Keep a compact ceiling while allowing their complete Paper
  // layouts and transitions.
  css: 21 * 1024,
  katex: 80 * 1024,
  mermaid: 170 * 1024,
};

console.log(`Bundle budget: entry JS ${sizes.javascript} / ${budgets.javascript} gzip bytes`);
console.log(`Bundle budget: entry CSS ${sizes.css} / ${budgets.css} gzip bytes`);
console.log(`Bundle budget: lazy KaTeX JS ${sizes.katex} / ${budgets.katex} gzip bytes`);
console.log(`Bundle budget: lazy Mermaid core JS ${sizes.mermaid} / ${budgets.mermaid} gzip bytes`);

const failures = Object.entries(budgets)
  .filter(([kind, budget]) => sizes[kind] > budget)
  .map(([kind, budget]) => `${kind} is ${sizes[kind]} bytes; budget is ${budget}`);

if (failures.length) {
  throw new Error(`Bundle budget exceeded: ${failures.join("; ")}`);
}

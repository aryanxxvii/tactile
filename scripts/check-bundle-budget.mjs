import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
const assets = await readdir(assetsDirectory);
const entryJavaScript = assets.find((name) => /^index-.*\.js$/.test(name));
const entryCss = assets.find((name) => /^index-.*\.css$/.test(name));

if (!entryJavaScript || !entryCss) {
  throw new Error("Bundle budget check could not find the Vite entry assets.");
}

const [javaScript, css] = await Promise.all([
  readFile(new URL(entryJavaScript, assetsDirectory)),
  readFile(new URL(entryCss, assetsDirectory)),
]);
const sizes = {
  javascript: gzipSync(javaScript).length,
  css: gzipSync(css).length,
};
const budgets = {
  javascript: 110 * 1024,
  css: 18 * 1024,
};

console.log(`Bundle budget: entry JS ${sizes.javascript} / ${budgets.javascript} gzip bytes`);
console.log(`Bundle budget: entry CSS ${sizes.css} / ${budgets.css} gzip bytes`);

const failures = Object.entries(budgets)
  .filter(([kind, budget]) => sizes[kind] > budget)
  .map(([kind, budget]) => `${kind} is ${sizes[kind]} bytes; budget is ${budget}`);

if (failures.length) {
  throw new Error(`Bundle budget exceeded: ${failures.join("; ")}`);
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  fixtureFingerprint,
  validatePerformanceWorkspace,
  writePerformanceFixture,
} from "../../benchmarks/generate-fixture.mjs";
import { measureBundle } from "./bundle.mjs";
import { createMeasurementInitScript, PERFORMANCE_SCHEMA_VERSION, summarizeInstrumentation } from "./measurement.mjs";

const ROOT_OBJECT_ID = "perf-root-sheet";
const LAYER_OBJECT_IDS = ["perf-layer-1-sheet", "perf-layer-2-sheet", "perf-layer-3-sheet", "perf-layer-4-sheet"];

function parseArgs(argv) {
  const args = {
    baseUrl: "http://127.0.0.1:5173",
    fixture: "",
    output: "docs/performance/browser-results.json",
    screenshots: "tests/visual/baselines",
    runs: 1,
    headless: true,
    strict: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--base-url") args.baseUrl = argv[++index];
    else if (argument === "--fixture") args.fixture = argv[++index];
    else if (argument === "--output") args.output = argv[++index];
    else if (argument === "--screenshots") args.screenshots = argv[++index];
    else if (argument === "--runs") args.runs = Math.max(1, Number(argv[++index]));
    else if (argument === "--headed") args.headless = false;
    else if (argument === "--no-screenshots") args.screenshots = "";
    else if (argument === "--strict") args.strict = true;
    else if (argument === "--help") args.help = true;
  }
  return args;
}

async function loadPlaywright() {
  const packageNames = ["playwright", "@playwright/test"];
  for (const packageName of packageNames) {
    try {
      const module = await import(packageName);
      if (module.chromium) return { module, packageName };
    } catch {
      // Try the next supported package. The final result is an explicit skip.
    }
  }
  return null;
}

async function readFixture(fixturePath) {
  if (!fixturePath) {
    const tempDirectory = await mkdir(path.join(os.tmpdir(), `tactile-perf-${process.pid}`), { recursive: true }).then(
      () => path.join(os.tmpdir(), `tactile-perf-${process.pid}`),
    );
    const generated = await writePerformanceFixture({ outputDir: tempDirectory, writeAssets: false });
    return { path: path.join(generated.outputDir, "fixture.json"), workspace: generated.workspace, generated: true };
  }
  const resolvedPath = path.resolve(fixturePath);
  const workspace = JSON.parse(await readFile(resolvedPath, "utf8"));
  return { path: resolvedPath, workspace, generated: false };
}

async function waitForImportedFixture(page) {
  await page
    .locator(`[data-object-id="${ROOT_OBJECT_ID}"][data-cell-address="A1"]`)
    .waitFor({ state: "attached", timeout: 120_000 });
  await page.waitForFunction(
    (rootId) =>
      document.querySelector(`[data-object-id="${rootId}"][data-cell-address="A1"]`)?.closest(".base-object-layer"),
    ROOT_OBJECT_ID,
    { timeout: 120_000 },
  );
  await page.waitForTimeout(500);
}

async function importFixture(page, fixturePath) {
  const input = page.locator('input[type="file"][accept*=".json"]');
  await input.setInputFiles(fixturePath);
  await waitForImportedFixture(page);
}

async function ensureBase(page, baseUrl) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const layerCount = await page.locator(".spatial-layer").count();
    if (layerCount === 0) return;
    await page.keyboard.press("[");
    await page.waitForTimeout(950);
  }
  if (await page.locator(".spatial-layer").count()) {
    await page.goto(`${baseUrl}/?perf-reset=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await waitForImportedFixture(page);
  }
}

async function measureScenario(page, label, action, settleMs = 250) {
  await page.evaluate((scenarioLabel) => window.__tactilePerf.start(scenarioLabel), label);
  let actionError = null;
  try {
    await action();
  } catch (error) {
    actionError = error;
  }
  if (settleMs) await page.waitForTimeout(settleMs);
  const raw = await page.evaluate(() => window.__tactilePerf?.stop?.() ?? null);
  const summary = summarizeInstrumentation(
    raw || {
      label,
      longTasksObservable: false,
      inputLatencyObservable: false,
    },
  );
  if (!raw) {
    summary.status = "unmeasurable";
    summary.reason = "The page was replaced during the scenario before instrumentation could stop.";
  }
  if (actionError) summary.actionError = actionError?.message || String(actionError);
  return summary;
}

async function scrollAction(page) {
  await page.evaluate(async () => {
    const scroller = document.querySelector("[data-sheet-scroll]");
    if (!scroller) throw new Error("Sheet scroller was not found.");
    const startTop = scroller.scrollTop;
    const startLeft = scroller.scrollLeft;
    const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    for (let frame = 0; frame < 72; frame += 1) {
      const progress = (frame + 1) / 72;
      scroller.scrollTop = Math.min(maxTop, startTop + Math.max(900, maxTop * progress * 0.12));
      scroller.scrollLeft = Math.min(maxLeft, startLeft + Math.max(500, maxLeft * progress * 0.08));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    scroller.scrollTop = startTop;
    scroller.scrollLeft = startLeft;
  });
}

async function typingAction(page) {
  const cell = page.locator(`[data-object-id="${ROOT_OBJECT_ID}"][data-cell-address="B1"]`);
  await cell.click();
  await page.keyboard.press("F2");
  const editor = cell.locator("input.cell-editor");
  await editor.waitFor({ state: "visible" });
  await editor.press("End");
  await editor.type("9");
  await editor.press("Enter");
}

async function openFloating(page, objectId = ROOT_OBJECT_ID) {
  const cell = page.locator(`[data-object-id="${objectId}"][data-cell-address="A1"]`);
  await cell.click();
  await page.waitForTimeout(220);
  await page
    .locator('.spatial-layer[data-spatial-phase="floating"]')
    .last()
    .waitFor({ state: "attached", timeout: 15_000 });
}

async function expandTop(page) {
  const expand = page.locator(".object-window-expand").last();
  await expand.click();
  await page.waitForTimeout(100);
  await page
    .locator('.spatial-layer[data-spatial-phase="full"]')
    .last()
    .waitFor({ state: "attached", timeout: 15_000 });
}

async function nestedOpen(page, full = false) {
  await openFloating(page, ROOT_OBJECT_ID);
  await expandTop(page);
  for (const objectId of LAYER_OBJECT_IDS) {
    await openFloating(page, objectId);
    if (full) await expandTop(page);
  }
}

async function transitionScenario(page) {
  await ensureBase(page, page.url().split("/").slice(0, 3).join("/"));
  await openFloating(page, ROOT_OBJECT_ID);
  await page.keyboard.press("]");
  await page.waitForTimeout(100);
  await page.keyboard.press("[");
  await page.waitForTimeout(900);
}

async function captureScreenshot(page, directory, name, options = {}) {
  if (!directory) return null;
  await mkdir(directory, { recursive: true });
  const filePath = path.resolve(directory, `${name}.jpg`);
  await page.screenshot({ path: filePath, type: "jpeg", quality: 90, ...options });
  const layers = page.locator(".spatial-layer");
  const layerCount = await layers.count();
  return {
    file: path.relative(process.cwd(), filePath).replaceAll("\\", "/"),
    url: page.url(),
    title: await page.title(),
    phase: layerCount ? await layers.last().getAttribute("data-spatial-phase") : null,
    layerCount,
  };
}

async function captureVisualStates(page, baseUrl, directory) {
  const captures = [];
  await ensureBase(page, baseUrl);
  captures.push(await captureScreenshot(page, directory, "sheet-base"));

  const sourceCell = page.locator(`[data-object-id="${ROOT_OBJECT_ID}"][data-cell-address="A1"]`);
  await sourceCell.click();
  await page.waitForTimeout(10);
  captures.push(await captureScreenshot(page, directory, "in-out-origin"));
  await page.waitForTimeout(220);
  captures.push(await captureScreenshot(page, directory, "in-out-floating"));
  await expandTop(page);
  captures.push(await captureScreenshot(page, directory, "in-out-full"));
  await page.keyboard.press("[");
  await page.waitForTimeout(100);
  captures.push(await captureScreenshot(page, directory, "in-out-closing"));

  await ensureBase(page, baseUrl);
  await nestedOpen(page, false);
  captures.push(await captureScreenshot(page, directory, "in-out-nested-floating"));
  await expandTop(page);
  captures.push(await captureScreenshot(page, directory, "in-out-nested-full"));
  await page.keyboard.press("[");
  await page.waitForTimeout(100);
  captures.push(await captureScreenshot(page, directory, "in-out-nested-closing"));
  await ensureBase(page, baseUrl);
  captures.push(await captureScreenshot(page, directory, "in-out-returned"));
  return captures;
}

async function collectResourceSizes(page) {
  return page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((entry) => /\.(?:js|css)(?:\?|$)/.test(entry.name))
      .map((entry) => ({
        name: entry.name,
        transferSize: entry.transferSize || null,
        encodedBodySize: entry.encodedBodySize || null,
        decodedBodySize: entry.decodedBodySize || null,
      })),
  );
}

async function runMeasuredBrowser(args, fixture) {
  const playwright = await loadPlaywright();
  if (!playwright) {
    return {
      status: "skipped",
      reason:
        "Playwright is not installed. Install the approved browser test dependency during integration; no metrics or screenshots were fabricated.",
      limitations: ["@playwright/test or playwright is absent from package manifests and node_modules."],
    };
  }

  let browser;
  try {
    browser = await playwright.module.chromium.launch({ headless: args.headless });
  } catch (error) {
    return {
      status: "skipped",
      reason: `Playwright Chromium could not launch: ${error?.message || String(error)}`,
      limitations: ["A compatible Chromium executable is unavailable in this environment."],
    };
  }

  const results = [];
  const screenshots = [];
  const baseUrl = args.baseUrl.replace(/\/$/, "");
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: "light",
    });
    await context.addInitScript({ content: createMeasurementInitScript() });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?perf=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const importMeasurement = await measureScenario(
      page,
      "fixture-import-and-render",
      () => importFixture(page, fixture.path),
      500,
    );
    results.push(importMeasurement);

    const scrollMeasurement = await measureScenario(page, "scroll", () => scrollAction(page), 250);
    results.push(scrollMeasurement);

    await ensureBase(page, baseUrl);
    const typingMeasurement = await measureScenario(page, "typing", () => typingAction(page), 250);
    results.push(typingMeasurement);

    await ensureBase(page, baseUrl);
    const inOutMeasurement = await measureScenario(page, "in-out", () => transitionScenario(page), 250);
    results.push(inOutMeasurement);

    await ensureBase(page, baseUrl);
    const nestedMeasurement = await measureScenario(
      page,
      "nested",
      async () => {
        await nestedOpen(page, false);
        await page.keyboard.press("]");
        await page.waitForTimeout(100);
        for (let index = 0; index < 6; index += 1) {
          await page.keyboard.press("[");
          await page.waitForTimeout(900);
        }
      },
      250,
    );
    results.push(nestedMeasurement);

    if (args.screenshots) {
      await ensureBase(page, baseUrl);
      screenshots.push(...(await captureVisualStates(page, baseUrl, args.screenshots)));
    }

    return {
      status: "measured",
      playwright: playwright.packageName,
      browser: "chromium",
      viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      resources: await collectResourceSizes(page),
      scenarios: Object.fromEntries(results.map((result) => [result.label, result])),
      screenshots,
      browserUrl: baseUrl,
    };
  } catch (error) {
    return {
      status: "partial",
      reason: `Browser baseline stopped after a scenario failure: ${error?.message || String(error)}`,
      limitations: ["One or more interaction states were unavailable to the baseline harness."],
      playwright: playwright.packageName,
      browser: "chromium",
      viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      resources: [],
      scenarios: Object.fromEntries(results.map((result) => [result.label, result])),
      screenshots,
      browserUrl: baseUrl,
    };
  } finally {
    await browser.close();
  }
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      "Usage: node tests/performance/run-browser.mjs [--base-url <url>] [--fixture <fixture.json>] [--output <results.json>] [--screenshots <dir>] [--runs <n>] [--headed] [--strict]",
    );
    return;
  }
  const outputPath = path.resolve(args.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  let fixture;
  try {
    fixture = await readFixture(args.fixture);
  } catch (error) {
    const skipped = {
      schemaVersion: PERFORMANCE_SCHEMA_VERSION,
      status: "skipped",
      reason: `Fixture preparation failed: ${error?.message || String(error)}`,
      limitations: ["The deterministic fixture could not be prepared."],
    };
    await writeFile(outputPath, `${JSON.stringify(skipped, null, 2)}\n`, "utf8");
    if (args.strict) process.exitCode = 2;
    console.log(JSON.stringify(skipped, null, 2));
    return;
  }

  const validation = validatePerformanceWorkspace(fixture.workspace);
  const result = {
    schemaVersion: PERFORMANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    status: "skipped",
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuCount: os.cpus().length,
      memoryBytes: os.totalmem(),
      headless: args.headless,
      fixturePath: fixture.path,
      fixtureGeneratedOnRun: fixture.generated,
      fixtureFingerprint: fixtureFingerprint(fixture.workspace),
    },
    fixture: validation,
    bundle: null,
    scenarios: {},
    screenshots: [],
    limitations: [],
  };
  if (!validation.valid) {
    result.reason = "Deterministic fixture validation failed; browser measurements were not attempted.";
    result.limitations.push("Fixture invariants failed.");
  } else {
    try {
      result.bundle = await measureBundle("dist/client");
    } catch (error) {
      result.limitations.push(`Bundle size unavailable: ${error?.message || String(error)}`);
    }
    const browserResult = await runMeasuredBrowser(args, fixture);
    Object.assign(result, browserResult);
    if (browserResult.status !== "measured") {
      result.limitations = [...new Set([...(result.limitations || []), ...(browserResult.limitations || [])])];
    }
  }
  result.runsRequested = args.runs;
  result.measurementNote =
    args.runs > 1
      ? "The runner currently records one deterministic browser pass per invocation; repeat the command externally and aggregate medians/p95s for certification."
      : "Repeat the command three times on pinned reference hardware for certification medians/p95s.";
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        status: result.status,
        output: path.relative(process.cwd(), outputPath).replaceAll("\\", "/"),
        reason: result.reason,
        bundle: result.bundle,
        screenshots: result.screenshots?.length || 0,
        scenarios: Object.keys(result.scenarios || {}),
      },
      null,
      2,
    ),
  );
  if (args.strict && result.status !== "measured") process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

export { main };

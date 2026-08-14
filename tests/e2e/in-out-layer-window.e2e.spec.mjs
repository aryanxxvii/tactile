import { expect, test } from "@playwright/test";

import { createBlankWorkspace, createCellRecord, createSheetObject } from "../../src/model.js";

function nestedWorkspace() {
  const workspace = createBlankWorkspace({ id: "nested-layer-window-e2e", name: "Nested layer window" });
  const root = workspace.objects.home;
  root.title = "Layer one";
  const layerTwo = createSheetObject({ id: "layer-two", title: "Layer two" });
  const layerThree = createSheetObject({ id: "layer-three", title: "Layer three" });
  root.cells.A1 = createCellRecord(0, 0, {
    value: layerTwo.title,
    embed: { objectId: layerTwo.id, type: layerTwo.type },
  });
  layerTwo.cells.A1 = createCellRecord(0, 0, {
    value: layerThree.title,
    embed: { objectId: layerThree.id, type: layerThree.type },
  });
  workspace.objects = { [root.id]: root, [layerTwo.id]: layerTwo, [layerThree.id]: layerThree };
  return workspace;
}

function duplicateTitleNestedWorkspace() {
  const workspace = createBlankWorkspace({
    id: "duplicate-title-layer-window-e2e",
    name: "Duplicate title layer window",
  });
  const root = workspace.objects.home;
  root.title = "Tiles A1";
  const parent = createSheetObject({ id: "duplicate-parent", title: "Tiles A1" });
  const child = createSheetObject({ id: "duplicate-child", title: "Text A1" });
  root.cells.A1 = createCellRecord(0, 0, {
    value: parent.title,
    embed: { objectId: parent.id, type: parent.type },
  });
  parent.cells.A1 = createCellRecord(0, 0, {
    value: child.title,
    embed: { objectId: child.id, type: child.type },
  });
  workspace.objects = { [root.id]: root, [parent.id]: parent, [child.id]: child };
  return workspace;
}

function deepNestedWorkspace() {
  const workspace = createBlankWorkspace({ id: "deep-layer-window-e2e", name: "Deep layer window" });
  const objects = {};
  let parent = workspace.objects.home;
  parent.title = "Home";

  for (let index = 1; index <= 5; index += 1) {
    const child = createSheetObject({ id: `deep-layer-${index}`, title: `Tiles A${index}` });
    parent.cells.A1 = createCellRecord(0, 0, {
      value: child.title,
      embed: { objectId: child.id, type: child.type },
    });
    objects[parent.id] = parent;
    parent = child;
  }
  objects[parent.id] = parent;
  workspace.objects = objects;
  return workspace;
}

const cellLocator = (page, objectId, address) =>
  page.locator(`[data-object-id="${objectId}"][data-cell-address="${address}"]`).first();

async function openingHandoffSnapshot(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        let origin = null;
        const durationInMs = (value) => {
          const duration = Number.parseFloat(value);
          return value.trim().endsWith("ms") ? duration : duration * 1000;
        };
        const startedAt = Date.now();
        const check = () => {
          const originLayer = document.querySelector(".phase-origin:not(.is-closing)");
          if (!origin && originLayer) {
            const windowElement = originLayer.querySelector(".object-window");
            const sourceCue = originLayer.querySelector(".source-echo");
            const style = getComputedStyle(windowElement);
            origin = {
              background: style.backgroundColor,
              border: style.borderColor,
              sourceText:
                document
                  .querySelector('.base-object-layer .sheet-cell[data-cell-address="A1"] .cell-value')
                  ?.textContent?.trim() || null,
              sourceCue: sourceCue
                ? {
                    childCount: sourceCue.childElementCount,
                    hasAddress: sourceCue.hasAttribute("data-address"),
                    border: getComputedStyle(sourceCue).borderColor,
                  }
                : null,
              contourCount: originLayer.querySelectorAll(".memory-contours").length,
            };
          }
          const floatingLayer = document.querySelector(".phase-floating:not(.is-closing)");
          if (origin && floatingLayer) {
            const windowElement = floatingLayer.querySelector(".object-window");
            const windowBackground = getComputedStyle(windowElement).backgroundColor;
            const colorParts = windowBackground.match(/[\d.]+/g)?.map(Number) || [];
            resolve({
              origin,
              floating: {
                backgroundAlpha: windowBackground.startsWith("rgba(") && colorParts.length >= 4 ? colorParts[3] : 1,
                contentOpacity: Number.parseFloat(
                  getComputedStyle(floatingLayer.querySelector(".object-window-content")).opacity,
                ),
                transitionDurationMs: durationInMs(getComputedStyle(windowElement).transitionDuration),
              },
            });
            return;
          }
          if (Date.now() - startedAt >= 1000) {
            resolve({ origin, floating: null });
            return;
          }
          window.requestAnimationFrame(check);
        };
        check();
      }),
  );
}

async function nestedAdvanceDelay(page, parentObjectId, childObjectId) {
  return page.evaluate(
    ({ parentObjectId: parentId, childObjectId: childId }) =>
      new Promise((resolve) => {
        let promotedAt = null;
        const startedAt = performance.now();
        const observer = new MutationObserver(() => {
          const parent = document.querySelector(`[data-layer-object="${parentId}"]`);
          if (promotedAt === null && parent?.getAttribute("data-spatial-phase") === "full") {
            promotedAt = performance.now();
          }
          if (promotedAt !== null && document.querySelector(`[data-layer-object="${childId}"]`)) {
            observer.disconnect();
            resolve(performance.now() - promotedAt);
          }
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-spatial-phase"],
          childList: true,
          subtree: true,
        });
        window.setTimeout(
          () => {
            observer.disconnect();
            resolve(promotedAt === null ? null : performance.now() - promotedAt);
          },
          Math.max(0, 1500 - (performance.now() - startedAt)),
        );
      }),
    { parentObjectId, childObjectId },
  );
}

async function importWorkspace(page, workspace = nestedWorkspace()) {
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "nested-layer-window.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(workspace)),
  });
  await expect(cellLocator(page, "home", "A1")).toBeVisible();
  await expect(cellLocator(page, "home", "A1")).toHaveClass(/is-embedded/);
}

test("renders only the active parent and child during nested In & Out navigation", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "home", "A1").click();
  await expect(page.locator('[data-layer-object="layer-two"]')).toHaveAttribute("data-spatial-phase", "floating");
  await expect(page.locator(".tactile-app")).toHaveClass(/has-floating-layer/);
  await expect(page.locator(".app-bottom-bar")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".app-bottom-bar")).toHaveCSS("pointer-events", "auto");
  await expect(page.locator(".base-object-layer .object-header-parent")).toHaveCount(0);
  await expect(page.locator(".object-header-parent")).toHaveCount(1);
  await expect
    .poll(() => page.locator(".app-dock-path").evaluate((element) => getComputedStyle(element).cursor))
    .toBe("pointer");

  const advanceDelay = nestedAdvanceDelay(page, "layer-two", "layer-three");
  await cellLocator(page, "layer-two", "A1").click();
  await expect(page.locator('[data-layer-object="layer-two"]')).toHaveAttribute("data-spatial-phase", "full");

  await expect(page.locator('[data-layer-object="layer-three"]')).toHaveAttribute("data-spatial-phase", "floating", {
    timeout: 4_000,
  });
  const measuredAdvanceDelay = await advanceDelay;
  expect(measuredAdvanceDelay).toBeGreaterThanOrEqual(180);
  expect(measuredAdvanceDelay).toBeLessThanOrEqual(420);
  await expect(page.locator(".workspace-shell")).toHaveAttribute("data-logical-layer-count", "3");
  await expect(page.locator(".workspace-shell")).toHaveAttribute("data-rendered-layer-count", "2");
  await expect(page.locator(".spatial-layer")).toHaveCount(1);
  await expect(page.locator(".object-header-parent")).toHaveCount(2);
  await expect(page.locator(".base-object-layer .object-header-parent")).toBeVisible();
  await expect(page.locator(".base-object-layer")).toHaveAttribute("inert", "");
  await expect(page.locator('[data-layer-object="layer-three"]')).toHaveAttribute("data-spatial-depth", "1");
  await expect(page.locator('.base-object-layer [data-object-id="layer-two"]')).not.toHaveCount(0);
  await expect(page.locator('.base-object-layer [data-object-id="home"]')).toHaveCount(0);

  await page.keyboard.press("[");
  await expect(page.locator('[data-layer-object="layer-three"]')).toHaveCount(0, { timeout: 4_000 });
  await expect(page.locator('[data-layer-object="layer-two"]')).toHaveAttribute("data-spatial-phase", "full");
  await expect(page.locator('.base-object-layer [data-object-id="home"]')).not.toHaveCount(0);
});

test("opens an embedded tile with Enter just like the In & Out shortcut", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  const source = cellLocator(page, "home", "A1");
  await source.click();
  await source.press("Enter");

  await expect(page.locator('[data-layer-object="layer-two"]')).toHaveAttribute("data-spatial-phase", "floating");
  await expect(page.locator(".tactile-app")).toHaveClass(/has-floating-layer/);
});

test("renders the opened tile sheet instead of an empty lazy surface", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "home", "A1").click();
  const child = page.locator('[data-layer-object="layer-two"]');
  await expect(child).toHaveAttribute("data-spatial-phase", "floating");
  await expect(child.locator('[data-cell-address="A1"]')).toBeVisible();
  await expect(child.locator(".sheet-cell")).not.toHaveCount(0);
});

test("keeps the bottom dock available while a child floats", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "home", "A1").click();
  const floatingChild = page.locator('[data-layer-object="layer-two"]');
  await expect(floatingChild).toHaveAttribute("data-spatial-phase", "floating");

  const dockState = await page.locator(".app-bottom-bar").evaluate((bar) => {
    const style = getComputedStyle(bar);
    const dock = bar.querySelector(".app-dock");
    const dockStyle = dock ? getComputedStyle(dock) : null;
    const parentStatusbar = document.querySelector(".base-object-layer .object-statusbar");
    return {
      background: style.backgroundColor,
      parentStatusbarBackground: parentStatusbar ? getComputedStyle(parentStatusbar).backgroundColor : null,
      pointerEvents: style.pointerEvents,
      cursor: style.cursor,
      dockBackground: dockStyle?.backgroundColor || null,
      dockOpacity: dockStyle?.opacity || null,
      dockFilter: dockStyle?.filter || null,
    };
  });
  expect(dockState.background).toBe(dockState.parentStatusbarBackground);
  expect(dockState).toMatchObject({
    pointerEvents: "auto",
    cursor: "auto",
    dockBackground: "rgba(0, 0, 0, 0)",
    dockOpacity: "1",
    dockFilter: "none",
  });
  await expect(page.locator(".app-bottom-bar")).not.toHaveAttribute("inert", "");

  const backdrop = page.locator('[data-layer-object="layer-two"] .transition-backdrop');
  const backdropBox = await backdrop.boundingBox();
  if (!backdropBox) throw new Error("The floating dismissal surface is not measurable");
  await page.mouse.click(backdropBox.x + 4, backdropBox.y + 4);
  await expect(floatingChild).toHaveClass(/is-closing/);
  await expect(floatingChild).toHaveCount(0, { timeout: 4_000 });
});

test("keeps the returning parent sheet fully populated while the child contracts", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "home", "A1").click();
  await expect(page.locator('[data-layer-object="layer-two"]')).toHaveAttribute("data-spatial-phase", "floating");
  await cellLocator(page, "layer-two", "A1").click();
  await expect(page.locator('[data-layer-object="layer-three"]')).toHaveAttribute("data-spatial-phase", "floating", {
    timeout: 4_000,
  });

  const parentSnapshot = () =>
    page.evaluate(() => {
      const cell = document.querySelector('[data-object-id="layer-two"][data-cell-address="A1"]');
      const surface = cell?.closest(".sheet-object");
      const grid = surface?.querySelector(".sheet-grid-shell");
      const scroll = surface?.querySelector(".sheet-scroll");
      return {
        present: Boolean(surface),
        owner: cell?.closest(".base-object-layer") ? "base" : cell?.closest(".spatial-layer") ? "spatial" : null,
        rows: surface?.querySelectorAll(".row-header").length || 0,
        scrollHeight: scroll?.clientHeight || 0,
        gridHeight: grid?.getBoundingClientRect().height || 0,
      };
    });
  const before = await parentSnapshot();
  expect(before.present).toBe(true);
  expect(before.rows).toBeGreaterThan(24);
  expect(before.scrollHeight).toBeGreaterThan(500);

  const samplesPromise = page.evaluate(async () => {
    const samples = [];
    const read = () => {
      const cell = document.querySelector('[data-object-id="layer-two"][data-cell-address="A1"]');
      const surface = cell?.closest(".sheet-object");
      const grid = surface?.querySelector(".sheet-grid-shell");
      const scroll = surface?.querySelector(".sheet-scroll");
      return {
        present: Boolean(surface),
        owner: cell?.closest(".base-object-layer") ? "base" : cell?.closest(".spatial-layer") ? "spatial" : null,
        rows: surface?.querySelectorAll(".row-header").length || 0,
        scrollHeight: scroll?.clientHeight || 0,
        gridHeight: grid?.getBoundingClientRect().height || 0,
      };
    };
    const deadline = performance.now() + 700;
    while (performance.now() < deadline) {
      samples.push(read());
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return samples;
  });
  const backdrop = page.locator('[data-layer-object="layer-three"] .transition-backdrop');
  const backdropBox = await backdrop.boundingBox();
  expect(backdropBox).not.toBeNull();
  await page.mouse.click((backdropBox?.x || 0) + 4, (backdropBox?.y || 0) + 4);
  await page.waitForTimeout(365);
  await page.screenshot({ path: "test-results-source-handoff-365.png" });
  const samples = await samplesPromise;

  await expect(page.locator('[data-layer-object="layer-three"]')).toHaveCount(0, { timeout: 4_000 });
  const populatedSamples = samples.filter((sample) => sample.present);
  expect(populatedSamples.length).toBeGreaterThanOrEqual(10);
  expect(Math.min(...populatedSamples.map((sample) => sample.rows))).toBeGreaterThanOrEqual(before.rows - 2);
  expect(Math.min(...populatedSamples.map((sample) => sample.scrollHeight))).toBeGreaterThan(500);
  expect(populatedSamples.at(-1)).toMatchObject({ present: true });
  expect(["base", "spatial"]).toContain(populatedSamples.at(-1).owner);
});

test("keeps the source tile corners rounded through the final collapse frame", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "home", "A1").click();
  await expect(page.locator('[data-layer-object="layer-two"]')).toHaveAttribute("data-spatial-phase", "floating");
  await cellLocator(page, "layer-two", "A1").click();
  await expect(page.locator('[data-layer-object="layer-three"]')).toHaveAttribute("data-spatial-phase", "floating", {
    timeout: 4_000,
  });
  const samplesPromise = page.evaluate(async () => {
    const samples = [];
    const read = () => {
      const layer = document.querySelector('[data-layer-object="layer-three"]');
      const windowElement = layer?.querySelector(".object-window");
      const source = document.querySelector('[data-object-id="layer-two"][data-cell-address="A1"]');
      const sourceAfter = source ? getComputedStyle(source, "::after") : null;
      const sourceBefore = source ? getComputedStyle(source, "::before") : null;
      const windowStyle = windowElement ? getComputedStyle(windowElement) : null;
      const sourceStyle = source ? getComputedStyle(source) : null;
      const sourceRect = source?.getBoundingClientRect();
      return {
        t: Math.round(performance.now()),
        phase: layer?.getAttribute("data-spatial-phase") || null,
        closing: layer?.classList.contains("is-closing") || false,
        windowRadius: windowStyle?.borderRadius || null,
        windowBorder: windowStyle?.borderColor || null,
        windowBg: windowStyle?.backgroundColor || null,
        windowTransform: windowStyle?.transform || null,
        windowRect: windowElement
          ? (() => {
              const rect = windowElement.getBoundingClientRect();
              return {
                left: Math.round(rect.left),
                top: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              };
            })()
          : null,
        sourceRadius: Number.parseFloat(sourceStyle?.borderTopLeftRadius) || 0,
        sourceRect: sourceRect ? { width: sourceRect.width, height: sourceRect.height } : null,
        sourceBorder: sourceStyle?.borderColor || null,
        sourceBg: sourceStyle?.backgroundColor || null,
        sourceAfterBorder: sourceAfter?.borderColor || null,
        sourceAfterRadius: sourceAfter?.borderRadius || null,
        sourceBeforeBorder: sourceBefore?.borderColor || null,
        sourceBeforeRadius: sourceBefore?.borderRadius || null,
      };
    };
    const deadline = performance.now() + 900;
    while (performance.now() < deadline) {
      samples.push(read());
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return samples;
  });
  const backdrop = page.locator('[data-layer-object="layer-three"] .transition-backdrop');
  const backdropBox = await backdrop.boundingBox();
  expect(backdropBox).not.toBeNull();
  await page.mouse.click((backdropBox?.x || 0) + 4, (backdropBox?.y || 0) + 4);
  const samples = await samplesPromise;
  const originSamples = samples.filter((sample) => sample.phase === "origin" && sample.windowRect);
  expect(originSamples.length).toBeGreaterThan(0);
  const visibleOriginSamples = originSamples.filter((sample) => sample.windowRect.width > 100);
  expect(visibleOriginSamples.length).toBeGreaterThan(0);
  expect(visibleOriginSamples.every((sample) => !sample.windowRadius?.includes("/"))).toBe(true);
  const finalFrame = originSamples.at(-1);
  expect(finalFrame.sourceRadius).toBeGreaterThan(0);
  expect(Math.min(...originSamples.map((sample) => sample.sourceRadius))).toBeGreaterThan(0);
  await expect(page.locator('[data-layer-object="layer-three"]')).toHaveCount(0, { timeout: 4_000 });
});

test("uses the reverse expand curve when a full child collapses", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "home", "A1").click();
  await expect(page.locator('[data-layer-object="layer-two"]')).toHaveAttribute("data-spatial-phase", "floating");
  await cellLocator(page, "layer-two", "A1").click();
  const child = page.locator('[data-layer-object="layer-three"]');
  await expect(child).toHaveAttribute("data-spatial-phase", "floating", { timeout: 4_000 });
  await child.locator(".object-window-expand").click();
  await expect(child).toHaveAttribute("data-spatial-phase", "full");

  await page.keyboard.press("[");
  await expect(child).toHaveClass(/is-closing/);
  const reverseTransition = await child.locator(".object-window").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      duration: style.transitionDuration,
      easing: style.transitionTimingFunction,
    };
  });
  expect(reverseTransition.duration).toContain("0.26s");
  expect(reverseTransition.easing).toContain("cubic-bezier(0.7, 0, 0.84, 0)");
  await expect(child).toHaveCount(0, { timeout: 4_000 });
});

test("keeps full-view chrome stable during the expanded-to-floating handoff", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "home", "A1").click();
  await expect(page.locator('[data-layer-object="layer-two"]')).toHaveAttribute("data-spatial-phase", "floating");
  await cellLocator(page, "layer-two", "A1").click();
  const child = page.locator('[data-layer-object="layer-three"]');
  await expect(child).toHaveAttribute("data-spatial-phase", "floating", { timeout: 4_000 });
  await child.locator(".object-window-expand").click();
  await expect(child).toHaveAttribute("data-spatial-phase", "full");

  const fullChrome = await child.locator(".object-window").evaluate((element) => {
    const content = element.querySelector(".object-window-content");
    const header = content?.querySelector(".object-header");
    const statusbar = content?.querySelector(".object-statusbar");
    return {
      contentPaddingTop: content ? getComputedStyle(content).paddingTop : null,
      headerPaddingRight: header ? getComputedStyle(header).paddingRight : null,
      statusbarDisplay: statusbar ? getComputedStyle(statusbar).display : null,
    };
  });

  await page.keyboard.press("[");
  await expect(child).toHaveClass(/is-closing/);
  const samples = await page.evaluate(async () => {
    const result = [];
    const deadline = Date.now() + 300;
    while (Date.now() < deadline) {
      const layer = document.querySelector('[data-layer-object="layer-three"]');
      const windowElement = layer?.querySelector(".object-window");
      const content = windowElement?.querySelector(".object-window-content");
      const header = content?.querySelector(".object-header");
      const statusbar = content?.querySelector(".object-statusbar");
      const windowStyle = windowElement ? getComputedStyle(windowElement) : null;
      result.push({
        phase: layer?.getAttribute("data-spatial-phase") || null,
        closing: layer?.classList.contains("is-closing") || false,
        borderRadius: windowStyle?.borderRadius || null,
        contentPaddingTop: content ? getComputedStyle(content).paddingTop : null,
        headerPaddingRight: header ? getComputedStyle(header).paddingRight : null,
        statusbarDisplay: statusbar ? getComputedStyle(statusbar).display : null,
      });
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return result;
  });

  expect(samples.length).toBeGreaterThan(6);
  expect(samples.every((sample) => sample.phase === "floating" && sample.closing)).toBe(true);
  expect(samples.every((sample) => sample.contentPaddingTop === fullChrome.contentPaddingTop)).toBe(true);
  expect(samples.every((sample) => sample.headerPaddingRight === fullChrome.headerPaddingRight)).toBe(true);
  expect(samples.every((sample) => sample.statusbarDisplay === fullChrome.statusbarDisplay)).toBe(true);
  expect(samples.every((sample) => !sample.borderRadius.includes("/"))).toBe(true);
  await expect(child).toHaveCount(0, { timeout: 4_000 });
});

test("outside-clicking a floating layer closes exactly one history entry when titles repeat", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page, duplicateTitleNestedWorkspace());

  await cellLocator(page, "home", "A1").click();
  await expect(page.locator('[data-layer-object="duplicate-parent"]')).toHaveAttribute(
    "data-spatial-phase",
    "floating",
  );
  await cellLocator(page, "duplicate-parent", "A1").click();
  await expect(page.locator('[data-layer-object="duplicate-child"]')).toHaveAttribute(
    "data-spatial-phase",
    "floating",
    {
      timeout: 4_000,
    },
  );

  const parentSurface = page.locator(".base-object-layer");
  const underlyingParent = parentSurface.locator(".object-header-parent");
  await expect(parentSurface).toHaveAttribute("inert", "");
  await expect(underlyingParent).toBeVisible();
  await expect(page.locator(".object-header-parent")).toHaveCount(2);
  expect(
    await underlyingParent.evaluate((button) => {
      button.focus();
      return document.activeElement === button;
    }),
  ).toBe(false);

  const backdrop = page.locator('[data-layer-object="duplicate-child"] .transition-backdrop');
  const backdropBox = await backdrop.boundingBox();
  expect(backdropBox).not.toBeNull();
  await page.mouse.click((backdropBox?.x || 0) + 4, (backdropBox?.y || 0) + 4);

  await expect(page.locator('[data-layer-object="duplicate-child"]')).toHaveClass(/is-closing/);
  await expect(parentSurface).toHaveAttribute("inert", "");
  await expect(page.locator('[data-layer-object="duplicate-child"]')).toHaveCount(0, { timeout: 4_000 });
  await expect(page.locator('[data-layer-object="duplicate-parent"]')).toHaveAttribute("data-spatial-phase", "full", {
    timeout: 4_000,
  });
  await expect(page.locator(".workspace-shell")).toHaveAttribute("data-logical-layer-count", "2");
  await expect(page.locator(".spatial-layer")).toHaveCount(1);
  await expect(page).toHaveURL(/in=duplicate-parent/);
});

test("changing home preserves the active parent chain and dock ordering", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "home", "A1").click();
  await expect(page.locator('[data-layer-object="layer-two"]')).toHaveAttribute("data-spatial-phase", "floating");

  await page.locator(".spatial-layer .workspace-menu-trigger").click();
  await page.getByRole("menuitem", { name: "Set as start" }).click();

  await expect(page.locator(".workspace-shell")).toHaveAttribute("data-logical-layer-count", "2");
  await expect(page.locator(".spatial-layer .object-header-parent")).toHaveCount(1);
  await expect(page.locator('.app-dock [aria-label="Object path"]')).toContainText("Layer one");
  await expect(page.locator('.app-dock [aria-label="Object path"]')).toContainText("Layer two");
  await expect(page.locator(".spatial-layer .workspace-menu-trigger")).toHaveAttribute("aria-label", "Workspace menu");

  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator(".workspace-shell")).toHaveAttribute("data-logical-layer-count", "2");
  await expect(page.locator(".spatial-layer .object-header-parent")).toHaveCount(1);
  await expect(page.locator('.app-dock [aria-label="Object path"]')).toContainText("Layer one");
  await expect(page.locator('.app-dock [aria-label="Object path"]')).toContainText("Layer two");

  await page.locator(".spatial-layer .object-header-parent").click();
  await expect(page.locator(".spatial-layer")).toHaveCount(0, { timeout: 4_000 });
  await expect(page.locator('.base-object-layer [data-object-id="home"]')).not.toHaveCount(0);
});

test("a fresh page restores the parent chain for a nested home", async ({ page, context }) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "home", "A1").click();
  await expect(page.locator('[data-layer-object="layer-two"]')).toHaveAttribute("data-spatial-phase", "floating");
  await page.locator(".spatial-layer .workspace-menu-trigger").click();
  await page.getByRole("menuitem", { name: "Set as start" }).click();
  await page.waitForTimeout(300);

  const reopened = await context.newPage();
  await reopened.goto("/");
  await expect(reopened.locator(".workspace-shell")).toHaveAttribute("data-logical-layer-count", "2", {
    timeout: 4_000,
  });
  await expect(reopened.locator(".spatial-layer .object-header-parent")).toHaveCount(1);
  await expect(reopened.locator('.app-dock [aria-label="Object path"]')).toContainText("Layer one");
  await expect(reopened.locator('.app-dock [aria-label="Object path"]')).toContainText("Layer two");

  await reopened.locator(".spatial-layer .object-header-parent").click();
  await expect(reopened.locator(".spatial-layer")).toHaveCount(0, { timeout: 4_000 });
  await expect(reopened.getByRole("textbox", { name: "Object title" })).toHaveValue("Layer one");
  await reopened.close();
});

test("keeps parent navigation unique through a deep nested stack", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page, deepNestedWorkspace());

  for (let index = 1; index <= 5; index += 1) {
    await cellLocator(page, index === 1 ? "home" : `deep-layer-${index - 1}`, "A1").click();
    await expect(page.locator(".spatial-layer .object-header-parent")).toHaveCount(1, { timeout: 4_000 });
  }

  await expect(page.locator(".workspace-shell")).toHaveAttribute("data-logical-layer-count", "6");
  await expect(page.locator(".workspace-shell")).toHaveAttribute("data-rendered-layer-count", "2");

  for (let index = 5; index >= 1; index -= 1) {
    await page.locator(".spatial-layer .object-header-parent").click();
    await page.waitForTimeout(900);
    await expect(page.locator(".spatial-layer .object-header-parent")).toHaveCount(index === 1 ? 0 : 1, {
      timeout: 4_000,
    });
  }

  await expect(page.locator(".spatial-layer")).toHaveCount(0);
  await expect(page.locator('.base-object-layer [data-object-id="home"][data-cell-address="A1"]')).toHaveCount(1);
  await expect(page).toHaveURL(/\/$/);
});

test("opens a deep start route at its leaf without replaying the ancestor animation", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page, deepNestedWorkspace());

  for (let index = 1; index <= 5; index += 1) {
    await cellLocator(page, index === 1 ? "home" : `deep-layer-${index - 1}`, "A1").click();
    await expect(page.locator(".spatial-layer .object-header-parent")).toHaveCount(1, { timeout: 4_000 });
  }

  await expect(page.locator(".workspace-shell")).toHaveAttribute("data-logical-layer-count", "6");
  await expect(page.locator(".workspace-shell")).toHaveAttribute("data-rendered-layer-count", "2");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".workspace-shell")).toHaveAttribute("data-logical-layer-count", "6", {
    timeout: 1_500,
  });
  await expect(page.locator('[data-layer-object="deep-layer-5"]')).toHaveAttribute("data-spatial-phase", "full", {
    timeout: 1_500,
  });

  const restored = await page.evaluate(() => ({
    logical: document.querySelector(".workspace-shell")?.dataset.logicalLayerCount,
    rendered: document.querySelector(".workspace-shell")?.dataset.renderedLayerCount,
    spatial: [...document.querySelectorAll(".spatial-layer")].map((layer) => ({
      objectId: layer.dataset.layerObject,
      phase: layer.dataset.spatialPhase,
    })),
  }));
  expect(restored).toMatchObject({ logical: "6", rendered: "2" });
  expect(restored.spatial).toEqual(expect.arrayContaining([{ objectId: "deep-layer-5", phase: "full" }]));
  expect(restored.spatial.some(({ phase }) => phase === "origin" || phase === "floating")).toBe(false);
});

test("dock breadcrumbs jump directly and reveal the complete path from the ellipsis", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page, deepNestedWorkspace());

  for (let index = 1; index <= 5; index += 1) {
    await cellLocator(page, index === 1 ? "home" : `deep-layer-${index - 1}`, "A1").click();
    await expect(page.locator(".spatial-layer .object-header-parent")).toHaveCount(1, { timeout: 4_000 });
  }

  const compactSegment = page.locator('.app-dock-path-button[data-path-object-id="deep-layer-4"]');
  await expect(compactSegment).toBeVisible();
  await compactSegment.hover();
  await expect
    .poll(() =>
      compactSegment.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        borderTopWidth: getComputedStyle(element).borderTopWidth,
        decoration: getComputedStyle(element).textDecorationLine,
      })),
    )
    .toMatchObject({ background: "rgba(0, 0, 0, 0)", borderTopWidth: "0px", decoration: "underline" });

  const overflow = page.locator(".app-dock-path-overflow");
  await overflow.hover();
  const fullPath = page.locator('.app-dock-path-popover[aria-label="Full object path"]');
  await expect(fullPath).toBeVisible();
  const ancestryGeometry = await page.evaluate(() => {
    const anchor = document.querySelector(".app-dock-path-overflow");
    const panel = document.querySelector(".app-dock-path-popover");
    const button = document.querySelector(".app-dock-path-overflow > .app-dock-path-button");
    if (!anchor || !panel || !button) return null;
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const buttonStyle = getComputedStyle(button);
    const panelStyle = getComputedStyle(panel);
    return {
      anchorCenter: (anchorRect.left + anchorRect.right) / 2,
      panelCenter: (panelRect.left + panelRect.right) / 2,
      panelWidth: panelRect.width,
      background: buttonStyle.backgroundColor,
      borderLeft: buttonStyle.borderLeftColor,
      boxShadow: buttonStyle.boxShadow,
      panelBackground: panelStyle.backgroundColor,
      panelBorderLeft: panelStyle.borderLeftColor,
    };
  });
  expect(ancestryGeometry).not.toBeNull();
  expect(Math.abs(ancestryGeometry.panelCenter - ancestryGeometry.anchorCenter)).toBeLessThan(1);
  expect(ancestryGeometry.panelWidth).toBeLessThanOrEqual(240);
  expect(ancestryGeometry).toMatchObject({
    background: "rgba(0, 0, 0, 0)",
    borderLeft: "rgba(0, 0, 0, 0)",
    boxShadow: "none",
  });
  expect(ancestryGeometry.panelBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(ancestryGeometry.panelBorderLeft).not.toBe("rgba(0, 0, 0, 0)");
  expect(await fullPath.getByRole("menuitem").allTextContents()).toEqual([
    "Tiles A5",
    "Tiles A4",
    "Tiles A3",
    "Tiles A2",
    "Tiles A1",
    "Home",
  ]);
  await expect
    .poll(() =>
      fullPath.locator(".app-dock-path-popover-row").evaluate((element) => ({
        overflowY: getComputedStyle(element).overflowY,
        scrollable: element.scrollHeight > element.clientHeight,
      })),
    )
    .toMatchObject({ overflowY: "auto", scrollable: false });
  const hoveredPathLink = fullPath.getByRole("menuitem", { name: "Go to Tiles A2" });
  await hoveredPathLink.hover();
  await expect
    .poll(() =>
      hoveredPathLink.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        border: getComputedStyle(element).border,
        cursor: getComputedStyle(element).cursor,
        decoration: getComputedStyle(element).textDecorationLine,
      })),
    )
    .toMatchObject({ background: "rgba(0, 0, 0, 0)", cursor: "pointer", decoration: "underline" });
  await expect(fullPath.getByRole("menuitem", { name: "Go to Tiles A1" })).toBeVisible();
  await expect(fullPath.getByRole("menuitem", { name: "Go to Tiles A5" })).toBeVisible();
  expect(await fullPath.getByRole("menuitem").count()).toBeGreaterThan(4);

  await fullPath.getByRole("menuitem", { name: "Go to Tiles A2" }).click();
  await expect(page.locator('[data-layer-object="deep-layer-2"]')).toHaveAttribute("data-spatial-phase", "full", {
    timeout: 5_000,
  });
  await expect(page.locator('[data-layer-object="deep-layer-5"]')).toHaveCount(0, { timeout: 5_000 });
  await expect(page).toHaveURL(/in=deep-layer-2/);
});

test("keeps one clean source cue while the child surface opens", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  const source = page.locator('.base-object-layer [data-object-id="home"][data-cell-address="A1"]');
  const handoffSnapshot = openingHandoffSnapshot(page);
  await source.click();

  const snapshot = await handoffSnapshot;
  expect(snapshot.origin).toMatchObject({
    background: "rgba(0, 0, 0, 0)",
    border: "rgba(0, 0, 0, 0)",
    sourceCue: {
      childCount: 0,
      hasAddress: false,
    },
    contourCount: 0,
  });
  expect(snapshot.origin?.sourceText).toBeTruthy();
  expect(snapshot.origin?.sourceCue?.border).not.toBe("rgba(0, 0, 0, 0)");
  expect(snapshot.floating?.backgroundAlpha).toBeLessThan(1);
  expect(snapshot.floating?.contentOpacity).toBeLessThanOrEqual(0.01);
  expect(snapshot.floating?.transitionDurationMs).toBeLessThanOrEqual(320);
});

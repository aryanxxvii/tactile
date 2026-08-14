import { expect, test } from "@playwright/test";

const baseCell = (page, address) => page.locator(`.base-object-layer .sheet-cell[data-cell-address="${address}"]`);

async function sheetState(page) {
  return page.evaluate(() => {
    const base = document.querySelector(".base-object-layer");
    const active = base?.querySelector('.sheet-cell[aria-selected="true"]');
    const scroller = base?.querySelector("[data-sheet-scroll]");
    const activeSlot = active?.closest(".virtual-cell-slot");
    const scrollerBox = scroller?.getBoundingClientRect();
    const activeBox = active?.getBoundingClientRect();
    const headerHeight = base?.querySelector(".column-header")?.getBoundingClientRect().height || 0;
    const rowHeaderWidth = base?.querySelector(".row-header")?.getBoundingClientRect().width || 0;
    const slotLeft = Number.parseFloat(activeSlot?.style.left || "NaN");
    const slotTop = Number.parseFloat(activeSlot?.style.top || "NaN");
    const slotWidth = Number.parseFloat(activeSlot?.style.width || "NaN");
    const slotHeight = Number.parseFloat(activeSlot?.style.height || "NaN");
    return {
      active: active?.dataset.cellAddress || null,
      focused: document.activeElement?.dataset.cellAddress || null,
      focusedInSheet: Boolean(document.activeElement?.closest(".sheet-grid-shell")),
      status: base?.querySelector(".active-cell-status code")?.textContent?.trim() || null,
      inRangeCount: base?.querySelectorAll(".sheet-cell.is-in-range").length || 0,
      windowScrollTop: window.scrollY,
      scrollTop: scroller?.scrollTop || 0,
      scrollLeft: scroller?.scrollLeft || 0,
      expectedScrollTop:
        Number.isFinite(slotTop) && Number.isFinite(slotHeight) && scroller
          ? Math.max(0, slotTop + slotHeight - scroller.clientHeight)
          : null,
      expectedScrollLeft:
        Number.isFinite(slotLeft) && Number.isFinite(slotWidth) && scroller
          ? Math.max(0, slotLeft + slotWidth - scroller.clientWidth)
          : null,
      activeBox: activeBox
        ? { top: activeBox.top, bottom: activeBox.bottom, left: activeBox.left, right: activeBox.right }
        : null,
      bodyBox: scrollerBox
        ? {
            top: scrollerBox.top + headerHeight,
            bottom: scrollerBox.bottom,
            left: scrollerBox.left + rowHeaderWidth,
            right: scrollerBox.right,
          }
        : null,
    };
  });
}

test("walks one cell at a time and extends the range only with Shift", async ({ page }) => {
  await page.goto("/");

  await baseCell(page, "B2").click();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => sheetState(page))
    .toMatchObject({
      active: "C2",
      focused: "C2",
      focusedInSheet: true,
      status: "C2",
      inRangeCount: 0,
      windowScrollTop: 0,
    });

  await page.keyboard.press("Shift+ArrowDown");
  await expect
    .poll(() => sheetState(page))
    .toMatchObject({
      active: "C3",
      focused: "C3",
      focusedInSheet: true,
      status: "C2:C3",
      inRangeCount: 1,
    });

  await page.keyboard.press("Shift+ArrowRight");
  await expect
    .poll(() => sheetState(page))
    .toMatchObject({
      active: "D3",
      focused: "D3",
      focusedInSheet: true,
      status: "C2:D3",
      inRangeCount: 3,
    });

  await page.keyboard.press("ArrowUp");
  await expect
    .poll(() => sheetState(page))
    .toMatchObject({
      active: "D2",
      focused: "D2",
      focusedInSheet: true,
      status: "D2",
      inRangeCount: 0,
      windowScrollTop: 0,
  });
});

test("Ctrl-click adds and removes individual tiles from the selection", async ({ page }) => {
  await page.goto("/");

  await baseCell(page, "A1").click();
  await baseCell(page, "C3").click({ modifiers: ["Control"] });

  await expect(baseCell(page, "A1")).toHaveClass(/is-multi-selected/);
  await expect(baseCell(page, "C3")).toHaveClass(/is-selected/);
  await expect(baseCell(page, "C3")).toHaveClass(/is-multi-selected/);

  await baseCell(page, "C3").click({ modifiers: ["Control"] });
  await expect(baseCell(page, "A1")).toHaveClass(/is-selected/);
  await expect(baseCell(page, "C3")).not.toHaveClass(/is-multi-selected/);
});

test("keeps rapid arrow walking lossless and scrolls only to the active cell", async ({ page }) => {
  await page.goto("/");

  await baseCell(page, "B2").click();
  for (let index = 0; index < 24; index += 1) await page.keyboard.press("ArrowDown");
  for (let index = 0; index < 14; index += 1) await page.keyboard.press("ArrowRight");

  await expect
    .poll(() => sheetState(page))
    .toMatchObject({
      active: "P26",
      focused: "P26",
      focusedInSheet: true,
      windowScrollTop: 0,
    });

  const state = await sheetState(page);
  expect(state.activeBox.top).toBeGreaterThanOrEqual(state.bodyBox.top - 2);
  expect(state.activeBox.bottom).toBeLessThanOrEqual(state.bodyBox.bottom + 2);
  expect(state.activeBox.left).toBeGreaterThanOrEqual(state.bodyBox.left - 2);
  expect(state.activeBox.right).toBeLessThanOrEqual(state.bodyBox.right + 2);
  expect(Math.abs(state.scrollTop - state.expectedScrollTop)).toBeLessThanOrEqual(2);
  expect(Math.abs(state.scrollLeft - state.expectedScrollLeft)).toBeLessThanOrEqual(2);
});

import { expect, test } from "@playwright/test";

test("keeps the column label lane intact on the first few scroll pixels", async ({ page }) => {
  await page.goto("/");

  const state = await page.locator("[data-sheet-scroll]").evaluate((element) => {
    const column = document.querySelector(".column-header");
    const scrollTop = element.getBoundingClientRect().top;
    element.scrollTo(0, 0);
    element.scrollTo(0, 3);
    const columnBox = column?.getBoundingClientRect();
    return {
      scrollTop,
      headerTop: columnBox?.top ?? null,
      headerBottom: columnBox?.bottom ?? null,
      headerHeight: columnBox?.height ?? null,
    };
  });

  expect(state.headerTop).toBeCloseTo(state.scrollTop, 1);
  expect(state.headerBottom).toBeCloseTo(state.scrollTop + state.headerHeight, 1);
});

test("keeps the bounded window and both sticky rails aligned on the first frame of a fast wheel jump", async ({
  page,
}) => {
  await page.goto("/");

  const scroll = page.locator("[data-sheet-scroll]");
  await expect(scroll).toBeVisible();
  const scrollBox = await scroll.boundingBox();
  if (!scrollBox) throw new Error("The sheet scroll surface has no layout box.");
  await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2);
  await page.mouse.wheel(420, 2400);

  const state = await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          const scroller = document.querySelector("[data-sheet-scroll]");
          const scrollerBox = scroller.getBoundingClientRect();
          const corner = document.querySelector(".sheet-corner");
          const columnHeader = document.querySelector(".column-header");
          const headerHeight = columnHeader?.getBoundingClientRect().height ?? 25;
          const rowHeaderWidth = corner?.getBoundingClientRect().width ?? 34;
          const bodyTop = scrollerBox.top + headerHeight;
          const bodyLeft = scrollerBox.left + rowHeaderWidth;
          const bodyBottom = scrollerBox.bottom;
          const bodyRight = scrollerBox.right;
          const slots = [...document.querySelectorAll(".virtual-cell-slot")].map((node) => ({
            box: node.getBoundingClientRect(),
          }));
          const visibleSlots = slots.filter(
            ({ box }) => box.bottom > bodyTop && box.top < bodyBottom && box.right > bodyLeft && box.left < bodyRight,
          );
          const rowTop = visibleSlots.length ? Math.min(...visibleSlots.map(({ box }) => box.top)) : null;
          const rowBottom = visibleSlots.length ? Math.max(...visibleSlots.map(({ box }) => box.bottom)) : null;
          const columnLeft = visibleSlots.length ? Math.min(...visibleSlots.map(({ box }) => box.left)) : null;
          const columnRight = visibleSlots.length ? Math.max(...visibleSlots.map(({ box }) => box.right)) : null;
          const columnRail = [...document.querySelectorAll(".column-header")]
            .map((node) => node.getBoundingClientRect())
            .find((box) => box.right > bodyLeft && box.left < bodyRight);
          const rowRail = [...document.querySelectorAll(".row-header")]
            .map((node) => node.getBoundingClientRect())
            .find((box) => box.bottom > bodyTop && box.top < bodyBottom);
          resolve({
            scrollTop: scroller.scrollTop,
            scrollLeft: scroller.scrollLeft,
            mountedCells: slots.length,
            rowCoverage: rowTop <= bodyTop + 1 && rowBottom >= bodyBottom - 1,
            columnCoverage: columnLeft <= bodyLeft + 1 && columnRight >= bodyRight - 1,
            columnRailOffset: columnRail ? Math.abs(columnRail.top - scrollerBox.top) : null,
            rowRailOffset: rowRail ? Math.abs(rowRail.left - scrollerBox.left) : null,
          });
        });
      }),
  );

  expect(state).toMatchObject({
    rowCoverage: true,
    columnCoverage: true,
    columnRailOffset: 0,
    rowRailOffset: 0,
  });
  expect(state.scrollTop).toBeGreaterThan(0);
  expect(state.scrollLeft).toBeGreaterThan(0);
  expect(state.mountedCells).toBeLessThan(1000);
});

test("refreshes the virtual slice before the first frame after a direct large offset jump", async ({ page }) => {
  await page.goto("/");

  const state = await page.locator("[data-sheet-scroll]").evaluate(async (element) => {
    element.scrollTop = Math.min(2400, element.scrollHeight - element.clientHeight);
    element.scrollLeft = Math.min(420, element.scrollWidth - element.clientWidth);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const scrollerBox = element.getBoundingClientRect();
    const headerHeight = document.querySelector(".column-header")?.getBoundingClientRect().height ?? 25;
    const bodyTop = scrollerBox.top + headerHeight;
    const visibleSlots = [...document.querySelectorAll(".virtual-cell-slot")]
      .map((node) => node.getBoundingClientRect())
      .filter((box) => box.bottom > bodyTop && box.top < scrollerBox.bottom);
    const columnRail = [...document.querySelectorAll(".column-header")]
      .map((node) => node.getBoundingClientRect())
      .find((box) => box.right > scrollerBox.left + 34 && box.left < scrollerBox.right);
    return {
      scrollTop: element.scrollTop,
      hasVisibleRows: visibleSlots.length > 0,
      columnRailOffset: columnRail ? Math.abs(columnRail.top - scrollerBox.top) : null,
    };
  });

  expect(state).toMatchObject({
    hasVisibleRows: true,
    columnRailOffset: 0,
  });
  expect(state.scrollTop).toBeGreaterThan(0);
});

test("keeps a horizontally rebased virtual window bounded at the sheet edge", async ({ page }) => {
  await page.goto("/");

  const state = await page
    .locator("[data-sheet-scroll]")
    .last()
    .evaluate(async (element) => {
      element.scrollLeft = element.scrollWidth - element.clientWidth;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const canvas = element.querySelector(".virtual-sheet-canvas");
      const canvasBox = canvas?.getBoundingClientRect();
      const slots = [...element.querySelectorAll(".virtual-cell-slot")];
      const columns = slots.map((slot) => Number(slot.dataset.column));
      const rows = slots.map((slot) => Number(slot.dataset.row));
      return {
        scrollLeft: element.scrollLeft,
        maxScrollLeft: Math.max(0, element.scrollWidth - element.clientWidth),
        mountedCells: slots.length,
        minColumn: Math.min(...columns),
        maxColumn: Math.max(...columns),
        minRow: Math.min(...rows),
        maxRow: Math.max(...rows),
        inCanvasBounds: slots.every((slot) => {
          const style = getComputedStyle(slot);
          const left = Number.parseFloat(style.left);
          const top = Number.parseFloat(style.top);
          const width = Number.parseFloat(style.width);
          const height = Number.parseFloat(style.height);
          return (
            left >= 0 &&
            top >= 0 &&
            left + width <= (canvasBox?.width || 0) + 0.01 &&
            top + height <= (canvasBox?.height || 0) + 0.01
          );
        }),
      };
    });

  expect(state).toMatchObject({
    minColumn: 0,
    maxColumn: 63,
    minRow: 0,
    inCanvasBounds: true,
  });
  expect(state.scrollLeft).toBeGreaterThanOrEqual(state.maxScrollLeft - 20);
  expect(state.maxRow).toBeLessThan(256);
  expect(state.mountedCells).toBeLessThan(1000);
});

test("keeps the active cell and formula bar coherent through a coalesced native jump", async ({ page }) => {
  await page.goto("/");

  const scroll = page.locator("[data-sheet-scroll]").last();
  const activeCell = scroll.locator('.sheet-cell[data-cell-address="B2"]').first();
  await expect(activeCell).toBeVisible();
  await activeCell.click();

  const formulaEditor = page.locator(".formula-editor");
  await formulaEditor.fill("=1+1");
  await expect(formulaEditor).toHaveValue("=1+1");

  const target = await scroll.evaluate((element) => ({
    top: Math.max(0, element.scrollHeight - element.clientHeight),
    left: Math.max(0, element.scrollWidth - element.clientWidth),
  }));
  const state = await scroll.evaluate(async (element, destination) => {
    const readState = () => {
      const scrollerBox = element.getBoundingClientRect();
      const columnHeader = element.querySelector(".column-header");
      const corner = element.querySelector(".sheet-corner");
      const headerHeight = columnHeader?.getBoundingClientRect().height ?? 25;
      const rowHeaderWidth = corner?.getBoundingClientRect().width ?? 34;
      const bodyTop = scrollerBox.top + headerHeight;
      const bodyLeft = scrollerBox.left + rowHeaderWidth;
      const visibleSlots = [...element.querySelectorAll(".virtual-cell-slot")]
        .map((node) => node.getBoundingClientRect())
        .filter(
          (box) =>
            box.bottom > bodyTop &&
            box.top < scrollerBox.bottom &&
            box.right > bodyLeft &&
            box.left < scrollerBox.right,
        );
      const allSlots = [...element.querySelectorAll(".virtual-cell-slot")];
      const columnRail = [...element.querySelectorAll(".column-header")]
        .map((node) => node.getBoundingClientRect())
        .find((box) => box.right > bodyLeft && box.left < scrollerBox.right);
      const rowRail = [...element.querySelectorAll(".row-header")]
        .map((node) => node.getBoundingClientRect())
        .find((box) => box.bottom > bodyTop && box.top < scrollerBox.bottom);
      const canvas = element.querySelector(".virtual-sheet-canvas");
      const rowCount = Number(canvas?.getAttribute("aria-rowcount")) || 0;
      const columnCount = Number(canvas?.getAttribute("aria-colcount")) || 0;
      const active = document.querySelector('.sheet-cell[aria-selected="true"]');
      const formula = document.querySelector(".formula-editor");
      const status = document.querySelector(".active-cell-status code");
      const styles = getComputedStyle(element);
      return {
        scrollTop: element.scrollTop,
        scrollLeft: element.scrollLeft,
        scrollX: Number.parseFloat(styles.getPropertyValue("--sheet-scroll-x")),
        scrollY: Number.parseFloat(styles.getPropertyValue("--sheet-scroll-y")),
        mountedCells: allSlots.length,
        visibleCells: visibleSlots.length,
        rowCoverage:
          visibleSlots.length > 0 &&
          Math.min(...visibleSlots.map((box) => box.top)) <= bodyTop + 1 &&
          Math.max(...visibleSlots.map((box) => box.bottom)) >= scrollerBox.bottom - 1,
        columnCoverage:
          visibleSlots.length > 0 &&
          Math.min(...visibleSlots.map((box) => box.left)) <= bodyLeft + 1 &&
          Math.max(...visibleSlots.map((box) => box.right)) >= scrollerBox.right - 1,
        columnRailOffset: columnRail ? Math.abs(columnRail.top - scrollerBox.top) : null,
        rowRailOffset: rowRail ? Math.abs(rowRail.left - scrollerBox.left) : null,
        allSlotsInBounds: allSlots.every((node) => {
          const row = Number(node.dataset.row);
          const column = Number(node.dataset.column);
          return row >= 0 && row < rowCount && column >= 0 && column < columnCount;
        }),
        activeAddress: active?.dataset.cellAddress || null,
        formulaValue: formula?.value || "",
        formulaAddress: formula?.getAttribute("aria-label") || null,
        statusAddress: status?.textContent?.trim() || null,
      };
    };

    element.scrollTo({ top: destination.top / 3, left: destination.left / 3, behavior: "auto" });
    element.scrollTo({ top: destination.top, left: destination.left, behavior: "auto" });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return readState();
  }, target);

  expect(state).toMatchObject({
    rowCoverage: true,
    columnCoverage: true,
    columnRailOffset: 0,
    rowRailOffset: 0,
    allSlotsInBounds: true,
    activeAddress: "B2",
    formulaValue: "=1+1",
    formulaAddress: "Formula or value for B2",
    statusAddress: "B2",
  });
  expect(state.visibleCells).toBeGreaterThan(0);
  expect(state.mountedCells).toBeLessThan(1_000);
  expect(state.scrollTop).toBeGreaterThanOrEqual(target.top - 20);
  expect(state.scrollLeft).toBeGreaterThanOrEqual(target.left - 20);
  expect(state.scrollX).toBeCloseTo(state.scrollLeft, 1);
  expect(state.scrollY).toBeCloseTo(state.scrollTop, 1);

  await expect
    .poll(() =>
      scroll.evaluate((element) => ({
        scrollTop: element.scrollTop,
        scrollLeft: element.scrollLeft,
      })),
    )
    .toEqual({ scrollTop: state.scrollTop, scrollLeft: state.scrollLeft });
});

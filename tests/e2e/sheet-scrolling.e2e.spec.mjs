import { expect, test } from "@playwright/test";

test("mounts a bounded tile window over a viewport-sized fallback", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator("[data-sheet-scroll]").last();
  await expect(sheet).toBeVisible();
  await expect
    .poll(() =>
      sheet.evaluate((element) => {
        const columnHeader = element.querySelector(".column-header");
        const scrollerBox = element.getBoundingClientRect();
        const bodyTop = scrollerBox.top + (columnHeader?.getBoundingClientRect().height || 25);
        const bodyBottom = scrollerBox.bottom;
        const fallback = element.querySelector(".sheet-scroll-fallback");
        const fallbackBox = fallback?.getBoundingClientRect();
        const visibleSlots = [...element.querySelectorAll(".virtual-cell-slot")]
          .map((slot) => slot.getBoundingClientRect())
          .filter((box) => box.bottom > bodyTop && box.top < bodyBottom);
        return {
          mountedCells: element.querySelectorAll(".virtual-cell-slot").length,
          coversViewport:
            visibleSlots.length > 0 && Math.max(...visibleSlots.map((box) => box.bottom)) >= bodyBottom - 1,
          fallbackIsSticky: fallback ? getComputedStyle(fallback).position === "sticky" : false,
          fallbackIsViewportBounded:
            Boolean(fallbackBox) && fallbackBox.width <= scrollerBox.width && fallbackBox.height <= scrollerBox.height,
        };
      }),
    )
    .toMatchObject({
      coversViewport: true,
      fallbackIsSticky: true,
      fallbackIsViewportBounded: true,
    });

  const mountedCells = await sheet.locator(".virtual-cell-slot").count();
  expect(mountedCells).toBeGreaterThan(0);
  expect(mountedCells).toBeLessThan(2_048);
});

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

test("keeps the selector corner above scrolled row identifiers and closes the rail seam", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator("[data-sheet-scroll]").last();
  await expect(sheet).toBeVisible();

  const state = await sheet.evaluate(async (element) => {
    const samples = [];
    for (const scrollTop of [0, 12, 480]) {
      element.scrollTo({ top: scrollTop, left: 0, behavior: "auto" });
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const corner = element.querySelector(".sheet-corner");
      const columnRail = element.querySelector(".sheet-column-header-rail");
      const rowRail = element.querySelector(".sheet-row-header-rail");
      const cornerBox = corner?.getBoundingClientRect();
      const columnRailBox = columnRail?.getBoundingClientRect();
      const rowRailBox = rowRail?.getBoundingClientRect();
      if (!corner || !columnRail || !rowRail || !cornerBox || !columnRailBox || !rowRailBox) {
        throw new Error("The sheet rail fixture is not measurable.");
      }

      const overlapRows = [...element.querySelectorAll(".row-header")]
        .map((node) => ({ node, box: node.getBoundingClientRect() }))
        .filter(({ box }) => box.bottom > cornerBox.top && box.top < cornerBox.bottom);
      const cornerHit = document.elementFromPoint(
        cornerBox.left + cornerBox.width / 2,
        cornerBox.top + cornerBox.height / 2,
      );

      samples.push({
        scrollTop: element.scrollTop,
        cornerHit: cornerHit?.closest(".sheet-corner") ? "corner" : cornerHit?.className || "",
        overlapRows: overlapRows.map(({ node }) => node.dataset.axisIndex),
        columnRailZ: getComputedStyle(columnRail).zIndex,
        rowRailZ: getComputedStyle(rowRail).zIndex,
        columnBoundary: {
          style: getComputedStyle(columnRail).borderBottomStyle,
          width: getComputedStyle(columnRail).borderBottomWidth,
        },
        rowBoundary: {
          style: getComputedStyle(rowRail).borderRightStyle,
          width: getComputedStyle(rowRail).borderRightWidth,
        },
        cornerRightDelta: Math.abs(cornerBox.right - rowRailBox.right),
        cornerBottomDelta: Math.abs(cornerBox.bottom - columnRailBox.bottom),
      });
    }

    element.scrollTo({ top: 0, left: 0, behavior: "auto" });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const cell = element.querySelector('.sheet-cell[data-cell-address="A1"]');
    const cellBox = cell?.getBoundingClientRect();
    const corner = element.querySelector(".sheet-corner")?.getBoundingClientRect();
    const rowRail = element.querySelector(".sheet-row-header-rail")?.getBoundingClientRect();
    const columnRail = element.querySelector(".sheet-column-header-rail")?.getBoundingClientRect();
    return {
      samples,
      railToCell: {
        horizontal: cellBox && rowRail ? cellBox.left - rowRail.right : null,
        vertical: cellBox && columnRail ? cellBox.top - columnRail.bottom : null,
        cornerRight: corner && rowRail ? Math.abs(corner.right - rowRail.right) : null,
        cornerBottom: corner && columnRail ? Math.abs(corner.bottom - columnRail.bottom) : null,
      },
    };
  });

  expect(state.samples).toHaveLength(3);
  expect(state.samples[2]).toMatchObject({
    cornerHit: "corner",
    columnRailZ: "25",
    rowRailZ: "15",
    columnBoundary: { style: "solid", width: expect.stringMatching(/^(1|0\.\d+)px$/) },
    rowBoundary: { style: "solid", width: expect.stringMatching(/^(1|0\.\d+)px$/) },
  });
  expect(state.samples[2].overlapRows.length).toBeGreaterThan(0);
  for (const sample of state.samples) {
    expect(sample.cornerHit).toBe("corner");
    expect(sample.cornerRightDelta).toBeLessThan(0.5);
    expect(sample.cornerBottomDelta).toBeLessThan(0.5);
  }
  expect(state.railToCell).toMatchObject({ horizontal: 3, vertical: 3, cornerRight: 0, cornerBottom: 0 });
});

test("keeps active, hovered, and selected cells below the sticky column identifiers", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator("[data-sheet-scroll]").last();
  await expect(sheet).toBeVisible();
  await sheet.evaluate((element) => element.scrollTo({ top: 12, left: 0, behavior: "auto" }));

  const inspectPaint = (address) =>
    sheet.evaluate((element, targetAddress) => {
      const rail = element.querySelector(".sheet-column-header-rail");
      const cell = [...element.querySelectorAll(".sheet-cell")].find(
        (node) => node.dataset.cellAddress === targetAddress,
      );
      const slot = cell?.closest(".virtual-cell-slot");
      if (!rail || !cell || !slot) throw new Error(`The ${targetAddress} paint fixture is not mounted.`);

      const railBox = rail.getBoundingClientRect();
      const cellBox = cell.getBoundingClientRect();
      const overlapTop = Math.max(railBox.top, cellBox.top);
      const overlapBottom = Math.min(railBox.bottom, cellBox.bottom);
      const overlapExists = overlapBottom > overlapTop;
      const overlapX = cellBox.left + cellBox.width / 2;
      const overlapY = (overlapTop + overlapBottom) / 2;
      const paintedKinds = overlapExists
        ? document
            .elementsFromPoint(overlapX, overlapY)
            .map((node) =>
              node.closest?.(".column-header") ? "column-header" : node.closest?.(".sheet-cell") ? "sheet-cell" : null,
            )
        : [];
      const zIndex = (node) => Number.parseInt(getComputedStyle(node).zIndex || "0", 10);
      const dataSlotZs = [...element.querySelectorAll(".virtual-cell-slot")].map(zIndex);

      return {
        address: targetAddress,
        overlapExists,
        topmostSheetPaint: paintedKinds.find(Boolean) || null,
        railZ: zIndex(rail),
        slotZ: zIndex(slot),
        maxDataSlotZ: Math.max(0, ...dataSlotZs),
        selectionInset: getComputedStyle(cell, "::after").inset,
      };
    }, address);

  await sheet.locator('.sheet-cell[data-cell-address="B1"]').hover();
  await expect
    .poll(() => inspectPaint("B1"))
    .toMatchObject({
      overlapExists: true,
      topmostSheetPaint: "column-header",
    });
  const firstRowHover = await inspectPaint("B1");
  expect(firstRowHover.maxDataSlotZ).toBeLessThan(firstRowHover.railZ);
  expect(firstRowHover.slotZ).toBeLessThan(firstRowHover.railZ);

  await sheet.locator('.sheet-cell[data-cell-address="B1"]').click();
  await sheet.evaluate((element) => element.scrollTo({ top: 12, left: 0, behavior: "auto" }));
  await expect.poll(() => sheet.evaluate((element) => element.scrollTop)).toBe(12);
  await expect
    .poll(() => inspectPaint("B1"))
    .toMatchObject({
      overlapExists: true,
      topmostSheetPaint: "column-header",
      // The active perimeter is painted one pixel outside the tile slot so it
      // follows the full molded tile boundary without disappearing at seams.
      selectionInset: "-1px",
    });
  const firstRowSelection = await inspectPaint("B1");
  expect(firstRowSelection.slotZ).toBeLessThan(firstRowSelection.railZ);

  const deepAddress = "B140";
  const deepScrollTop = 31 * 139 + 12;
  await sheet.evaluate((element, target) => {
    element.scrollTo({ top: Math.min(target, element.scrollHeight - element.clientHeight), left: 0, behavior: "auto" });
  }, deepScrollTop);
  await expect.poll(() => sheet.evaluate((element) => element.scrollTop)).toBeGreaterThan(3000);

  const deepCell = sheet.locator(`.sheet-cell[data-cell-address="${deepAddress}"]`);
  await expect(deepCell).toBeVisible();
  await deepCell.click();
  await sheet.evaluate((element, target) => {
    element.scrollTo({ top: Math.min(target, element.scrollHeight - element.clientHeight), left: 0, behavior: "auto" });
  }, deepScrollTop);
  await expect.poll(() => sheet.evaluate((element) => element.scrollTop)).toBeGreaterThan(3000);
  await expect
    .poll(() => inspectPaint(deepAddress))
    .toMatchObject({
      overlapExists: true,
      topmostSheetPaint: "column-header",
      selectionInset: "-1px",
    });
  const deepSelection = await inspectPaint(deepAddress);
  expect(deepSelection.maxDataSlotZ).toBeLessThan(deepSelection.railZ);
  expect(deepSelection.slotZ).toBeLessThan(deepSelection.railZ);

  const deepHover = sheet.locator('.sheet-cell[data-cell-address="B141"]');
  await expect(deepHover).toBeVisible();
  await deepHover.hover();
  const deepHoverPaint = await inspectPaint("B141");
  expect(deepHoverPaint.slotZ).toBeLessThan(deepHoverPaint.railZ);
  expect(deepHoverPaint.maxDataSlotZ).toBeLessThan(deepHoverPaint.railZ);
});

test("keeps a bounded tile window and both sticky rails aligned after a fast wheel jump", async ({ page }) => {
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
  expect(state.mountedCells).toBeGreaterThan(0);
  expect(state.mountedCells).toBeLessThan(2_048);
});

test("coalesces a burst into one bounded destination range", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator("[data-sheet-scroll]").last();
  await expect(sheet).toBeVisible();

  const state = await sheet.evaluate(async (element) => {
    const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
    const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const steps = 140;
    for (let index = 1; index <= steps; index += 1) {
      element.scrollTop = Math.min(maxTop, index * 31);
      element.scrollLeft = Math.min(maxLeft, index * 24);
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const scrollerBox = element.getBoundingClientRect();
    const columnHeader = element.querySelector(".column-header");
    const corner = element.querySelector(".sheet-corner");
    const bodyTop = scrollerBox.top + (columnHeader?.getBoundingClientRect().height ?? 25);
    const bodyLeft = scrollerBox.left + (corner?.getBoundingClientRect().width ?? 34);
    const visibleSlots = [...element.querySelectorAll(".virtual-cell-slot")]
      .map((slot) => slot.getBoundingClientRect())
      .filter(
        (box) =>
          box.bottom > bodyTop && box.top < scrollerBox.bottom && box.right > bodyLeft && box.left < scrollerBox.right,
      );
    return {
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
      mountedCells: element.querySelectorAll(".virtual-cell-slot").length,
      visibleCells: visibleSlots.length,
      rowCoverage:
        visibleSlots.length > 0 &&
        Math.min(...visibleSlots.map((box) => box.top)) <= bodyTop + 1 &&
        Math.max(...visibleSlots.map((box) => box.bottom)) >= scrollerBox.bottom - 1,
      columnCoverage:
        visibleSlots.length > 0 &&
        Math.min(...visibleSlots.map((box) => box.left)) <= bodyLeft + 1 &&
        Math.max(...visibleSlots.map((box) => box.right)) >= scrollerBox.right - 1,
    };
  });

  expect(state).toMatchObject({
    rowCoverage: true,
    columnCoverage: true,
  });
  expect(state.scrollTop).toBeGreaterThan(3000);
  expect(state.scrollLeft).toBeGreaterThan(2000);
  expect(state.visibleCells).toBeGreaterThan(0);
  expect(state.mountedCells).toBeLessThan(2_048);
});

test("keeps the fallback isolated from the virtual cell tree", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator("[data-sheet-scroll]").last();
  await expect(sheet).toBeVisible();
  const state = await sheet.evaluate((element) => {
    const fallback = element.querySelector(".sheet-scroll-fallback");
    return {
      fallbackParent: fallback?.parentElement?.className || "",
      fallbackContain: fallback ? getComputedStyle(fallback).contain : "",
      cellDescendants: fallback?.querySelectorAll(".sheet-cell").length ?? -1,
      inheritedScrollX: element.style.getPropertyValue("--sheet-scroll-x"),
      inheritedScrollY: element.style.getPropertyValue("--sheet-scroll-y"),
    };
  });

  expect(state).toEqual({
    fallbackParent: "sheet-scroll-fallback-layer",
    fallbackContain: "strict",
    cellDescendants: 0,
    inheritedScrollX: "",
    inheritedScrollY: "",
  });
});

test("keeps active and hovered first-column cells behind the row rail after deep jumps", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator("[data-sheet-scroll]").last();
  await expect(sheet).toBeVisible();

  for (const row of [64, 192]) {
    await sheet.evaluate((element, targetRow) => {
      const cellHeight = Number.parseFloat(getComputedStyle(element).getPropertyValue("--cell-height")) || 30;
      const cellGap = Number.parseFloat(getComputedStyle(element).getPropertyValue("--cell-gap")) || 1;
      element.scrollTo({ top: targetRow * (cellHeight + cellGap), left: 0, behavior: "auto" });
    }, row);

    const activeCell = sheet.locator(`[data-cell-address="A${row + 1}"]`).first();
    const hoveredCell = sheet.locator(`[data-cell-address="A${row + 2}"]`).first();
    await expect(activeCell).toBeVisible();
    await expect(hoveredCell).toBeVisible();
    await activeCell.click();
    await hoveredCell.hover();

    const state = await page.evaluate(
      ({ activeAddress, hoveredAddress }) => {
        const numericZIndex = (element) => {
          const value = getComputedStyle(element).zIndex;
          return value === "auto" ? 0 : Number(value);
        };
        const railFor = (cell) =>
          document.querySelector(`.row-header[data-axis-index="${cell.closest(".virtual-cell-slot")?.dataset.row}"]`);
        const seamState = (address) => {
          const cell = document.querySelector(`[data-cell-address="${address}"]`);
          const rail = cell ? railFor(cell) : null;
          if (!cell || !rail) return null;
          const cellBox = cell.getBoundingClientRect();
          const railBox = rail.getBoundingClientRect();
          const sampleX = Math.min(railBox.right - 0.25, cellBox.left - 0.25);
          const sampleY = cellBox.top + cellBox.height / 2;
          const hit =
            sampleX >= railBox.left && sampleX <= railBox.right ? document.elementFromPoint(sampleX, sampleY) : null;
          return {
            railZIndex: numericZIndex(rail),
            slotZIndex: numericZIndex(cell.closest(".virtual-cell-slot")),
            outlineLeft: getComputedStyle(cell, "::after").left,
            railHit: hit?.closest(".row-header")?.dataset.axisIndex || null,
            row: cell.closest(".virtual-cell-slot")?.dataset.row || null,
          };
        };
        return {
          active: seamState(activeAddress),
          hovered: seamState(hoveredAddress),
        };
      },
      { activeAddress: `A${row + 1}`, hoveredAddress: `A${row + 2}` },
    );
    expect(state.active).toMatchObject({
      railZIndex: expect.any(Number),
      slotZIndex: expect.any(Number),
      outlineLeft: "-1px",
      railHit: String(row),
      row: String(row),
    });
    expect(state.hovered).toMatchObject({
      railZIndex: expect.any(Number),
      slotZIndex: expect.any(Number),
      railHit: String(row + 1),
      row: String(row + 1),
    });
    expect(state.active.railZIndex).toBeGreaterThan(state.active.slotZIndex);
    expect(state.hovered.railZIndex).toBeGreaterThan(state.hovered.slotZIndex);
  }
});

test("refreshes the virtual slice before a jump crosses its overscan edge", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator("[data-sheet-scroll]").last();
  await expect(sheet).toBeVisible();
  await expect
    .poll(() =>
      sheet.evaluate((element) => {
        const scrollerBox = element.getBoundingClientRect();
        const headerHeight = element.querySelector(".column-header")?.getBoundingClientRect().height ?? 25;
        const bodyTop = scrollerBox.top + headerHeight;
        const visibleSlots = [...element.querySelectorAll(".virtual-cell-slot")]
          .map((slot) => slot.getBoundingClientRect())
          .filter((box) => box.bottom > bodyTop && box.top < scrollerBox.bottom);
        return {
          rowCoverage:
            visibleSlots.length > 0 &&
            Math.min(...visibleSlots.map((box) => box.top)) <= bodyTop + 4 &&
            Math.max(...visibleSlots.map((box) => box.bottom)) >= scrollerBox.bottom - 1,
        };
      }),
    )
    .toMatchObject({ rowCoverage: true });

  const state = await sheet.evaluate(async (element) => {
    const scrollerBox = element.getBoundingClientRect();
    const headerHeight = element.querySelector(".column-header")?.getBoundingClientRect().height ?? 25;
    const bodyTop = scrollerBox.top + headerHeight;
    element.scrollTo({ top: 800, left: 0, behavior: "auto" });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const visibleSlots = [...element.querySelectorAll(".virtual-cell-slot")]
      .map((slot) => slot.getBoundingClientRect())
      .filter((box) => box.bottom > bodyTop && box.top < scrollerBox.bottom);
    return {
      scrollTop: element.scrollTop,
      visibleCells: visibleSlots.length,
      rowCoverage:
        visibleSlots.length > 0 &&
        Math.min(...visibleSlots.map((box) => box.top)) <= bodyTop + 4 &&
        Math.max(...visibleSlots.map((box) => box.bottom)) >= scrollerBox.bottom - 1,
    };
  });

  expect(state).toMatchObject({ rowCoverage: true });
  expect(state.scrollTop).toBeGreaterThan(0);
  expect(state.visibleCells).toBeGreaterThan(0);
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

test("keeps an overlapping first-frame handoff close to the visible band", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator("[data-sheet-scroll]").last();
  await expect(sheet).toBeVisible();
  await expect.poll(() => sheet.locator(".virtual-cell-slot").count()).toBeGreaterThan(0);

  const state = await sheet.evaluate(async (element) => {
    const scrollerBox = element.getBoundingClientRect();
    const headerHeight = element.querySelector(".column-header")?.getBoundingClientRect().height ?? 25;
    const rowHeaderWidth = element.querySelector(".sheet-corner")?.getBoundingClientRect().width ?? 34;
    const bodyTop = scrollerBox.top + headerHeight;
    const bodyLeft = scrollerBox.left + rowHeaderWidth;
    element.scrollTo({ top: 800, left: 0, behavior: "auto" });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const slots = [...element.querySelectorAll(".virtual-cell-slot")].map((slot) => slot.getBoundingClientRect());
    const visibleSlots = slots.filter(
      (box) =>
        box.bottom > bodyTop && box.top < scrollerBox.bottom && box.right > bodyLeft && box.left < scrollerBox.right,
    );
    return {
      mountedCells: slots.length,
      visibleCells: visibleSlots.length,
      rowCoverage:
        visibleSlots.length > 0 &&
        Math.min(...visibleSlots.map((box) => box.top)) <= bodyTop + 1 &&
        Math.max(...visibleSlots.map((box) => box.bottom)) >= scrollerBox.bottom - 1,
    };
  });

  expect(state).toMatchObject({ rowCoverage: true });
  expect(state.mountedCells).toBeLessThan(500);
  expect(state.mountedCells).toBeGreaterThanOrEqual(state.visibleCells);
});

test("keeps the bounded tile window aligned at the horizontal sheet edge", async ({ page }) => {
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
  expect(state.maxRow).toBeLessThan(255);
  expect(state.mountedCells).toBeGreaterThan(0);
  expect(state.mountedCells).toBeLessThan(2_048);
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
      return {
        scrollTop: element.scrollTop,
        scrollLeft: element.scrollLeft,
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
  expect(state.mountedCells).toBeLessThan(2_048);
  expect(state.scrollTop).toBeGreaterThanOrEqual(target.top - 20);
  expect(state.scrollLeft).toBeGreaterThanOrEqual(target.left - 20);
  await expect
    .poll(() =>
      scroll.evaluate((element) => ({
        scrollTop: element.scrollTop,
        scrollLeft: element.scrollLeft,
      })),
    )
    .toEqual({ scrollTop: state.scrollTop, scrollLeft: state.scrollLeft });
});

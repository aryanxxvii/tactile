import { expect, test } from "@playwright/test";

const cellLocator = (page, address) => page.locator(`[data-cell-address="${address}"]`).first();

async function cellCenter(page, address) {
  const cell = cellLocator(page, address);
  await expect(cell).toBeVisible();
  const box = await cell.boundingBox();
  expect(box).not.toBeNull();
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

async function selectionSnapshot(page) {
  return page.evaluate(() => ({
    active: document.querySelector('.sheet-cell[aria-selected="true"]')?.dataset.cellAddress || null,
    focused: document.activeElement?.dataset.cellAddress || null,
    inRangeCount: document.querySelectorAll(".sheet-cell.is-in-range").length,
    status: document.querySelector(".active-cell-status code")?.textContent?.trim() || null,
    rangeStatus: document.querySelector(".range-status")?.textContent?.trim() || null,
  }));
}

test("uses the pointer-up geometry when press and release have no move event", async ({ page }) => {
  await page.goto("/");

  const start = await cellCenter(page, "D7");
  const end = await cellCenter(page, "C5");
  const session = await page.context().newCDPSession(page);

  await session.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...start });
  await session.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...start,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });

  await session.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...end,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });

  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "C5",
      focused: "C5",
      inRangeCount: 5,
      status: "C5:D7",
    });
});

test("keeps a one-event pointer jump through a virtual-cell seam", async ({ page }) => {
  await page.goto("/");

  const start = await cellCenter(page, "D7");
  const endCell = cellLocator(page, "C5");
  const endBox = await endCell.boundingBox();
  const slotBox = await endCell.locator("..").boundingBox();
  expect(endBox).not.toBeNull();
  expect(slotBox).not.toBeNull();
  expect(slotBox.x + slotBox.width).toBeGreaterThan(endBox.x + endBox.width);
  const end = {
    x: endBox.x + endBox.width + 0.25,
    y: endBox.y + endBox.height / 2,
  };
  const session = await page.context().newCDPSession(page);

  await session.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...start });
  await session.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...start,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await Promise.all([
    session.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      ...end,
      button: "left",
      buttons: 1,
    }),
    session.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...end,
      button: "left",
      buttons: 0,
      clickCount: 1,
    }),
  ]);

  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "C5",
      focused: "C5",
      inRangeCount: 5,
      status: "C5:D7",
    });
});

test("keeps a long horizontal range anchored while the virtual window scrolls", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator("[data-sheet-scroll]").last();
  const anchorCell = sheet.locator('[data-cell-address="A2"]').first();
  await expect(anchorCell).toBeVisible();
  const anchorBox = await anchorCell.boundingBox();
  expect(anchorBox).not.toBeNull();
  const start = {
    x: anchorBox.x + anchorBox.width / 2,
    y: anchorBox.y + anchorBox.height / 2,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const maxScrollLeft = await sheet.evaluate((element) => {
    const next = Math.max(0, element.scrollWidth - element.clientWidth);
    element.scrollLeft = next;
    return next;
  });
  await page.waitForTimeout(40);

  const endpointCell = sheet.locator('[data-cell-address="BL2"]').first();
  await expect(endpointCell).toBeVisible();
  const endpointBox = await endpointCell.boundingBox();
  expect(endpointBox).not.toBeNull();
  const end = {
    x: endpointBox.x + endpointBox.width + 0.25,
    y: endpointBox.y + endpointBox.height / 2,
  };
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...end,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  await page.mouse.up();

  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "BL2",
      focused: "BL2",
      status: "A2:BL2",
      rangeStatus: "· 64 cells",
    });
  expect((await selectionSnapshot(page)).inRangeCount).toBeGreaterThan(0);
  await expect.poll(() => sheet.evaluate((element) => element.scrollLeft)).toBeGreaterThanOrEqual(maxScrollLeft - 20);
  await expect
    .poll(() =>
      sheet.evaluate((element) => {
        const canvas = element.querySelector(".virtual-sheet-canvas");
        const width = canvas?.getBoundingClientRect().width || 0;
        const height = canvas?.getBoundingClientRect().height || 0;
        return [...element.querySelectorAll(".virtual-cell-slot")].every((slot) => {
          const style = getComputedStyle(slot);
          const left = Number.parseFloat(style.left);
          const top = Number.parseFloat(style.top);
          const slotWidth = Number.parseFloat(style.width);
          const slotHeight = Number.parseFloat(style.height);
          return left >= 0 && top >= 0 && left + slotWidth <= width + 0.01 && top + slotHeight <= height + 0.01;
        });
      }),
    )
    .toBe(true);
});

test("auto-scrolls only the active range drag at the horizontal sheet edge", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator("[data-sheet-scroll]").last();
  const anchorCell = sheet.locator('[data-cell-address="B2"]').first();
  await expect(anchorCell).toBeVisible();
  const anchorBox = await anchorCell.boundingBox();
  expect(anchorBox).not.toBeNull();
  const edge = await sheet.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const scale = element.clientWidth > 0 ? bounds.width / element.clientWidth : 1;
    element.scrollLeft = 0;
    return {
      right: bounds.left + element.clientWidth * scale,
      maxScrollLeft: Math.max(0, element.scrollWidth - element.clientWidth),
    };
  });
  const start = {
    x: anchorBox.x + anchorBox.width / 2,
    y: anchorBox.y + anchorBox.height / 2,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(edge.right - 2, start.y, { steps: 4 });
  await page.waitForTimeout(160);
  const scrollLeft = await sheet.evaluate((element) => element.scrollLeft);
  await page.mouse.up();

  expect(scrollLeft).toBeGreaterThan(0);
  expect(scrollLeft).toBeLessThanOrEqual(edge.maxScrollLeft);
});

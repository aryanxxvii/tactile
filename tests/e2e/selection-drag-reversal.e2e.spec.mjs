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
  return page.evaluate(() => {
    const selected = document.querySelector('.sheet-cell[aria-selected="true"]');
    const rangeCells = document.querySelectorAll(".sheet-cell.is-in-range");
    const activeCellStatus = document.querySelector(".active-cell-status code");
    const rangeStatus = document.querySelector(".range-status");
    return {
      active: selected?.dataset.cellAddress || null,
      focused: document.activeElement?.dataset.cellAddress || null,
      inRangeCount: rangeCells.length,
      status: activeCellStatus?.textContent?.trim() || null,
      rangeStatus: rangeStatus?.textContent?.trim() || null,
    };
  });
}

test("keeps the reversed drag endpoint stable while the pointer remains down", async ({ page }) => {
  await page.goto("/");

  const path = ["D7", "D8", "D9", "E9", "E8", "E7", "D7", "D6", "D5", "C5"];
  const points = new Map();
  for (const address of path) points.set(address, await cellCenter(page, address));

  await page.mouse.move(points.get("D7").x, points.get("D7").y);
  await page.mouse.down();
  for (const address of path.slice(1)) {
    const point = points.get(address);
    await page.mouse.move(point.x, point.y, { steps: 8 });
    await page.waitForTimeout(80);
  }

  const heldSnapshots = [];
  for (let index = 0; index < 20; index += 1) {
    heldSnapshots.push(await selectionSnapshot(page));
    await page.waitForTimeout(20);
  }

  expect(new Set(heldSnapshots.map((snapshot) => snapshot.active))).toEqual(new Set(["C5"]));
  expect(new Set(heldSnapshots.map((snapshot) => snapshot.status))).toEqual(new Set(["C5:D7"]));
  expect(new Set(heldSnapshots.map((snapshot) => snapshot.rangeStatus))).toEqual(new Set(["C5:D7 · 6 cells"]));
  expect(new Set(heldSnapshots.map((snapshot) => snapshot.focused))).toEqual(new Set(["D7"]));

  await page.mouse.up();
  await page.waitForTimeout(100);
  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "C5",
      focused: "C5",
      inRangeCount: 5,
      status: "C5:D7",
      rangeStatus: "C5:D7 · 6 cells",
    });
});

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

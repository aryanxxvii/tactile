import { expect, test } from "@playwright/test";

const cellLocator = (page, address) => page.locator(`[data-cell-address="${address}"]`).first();

async function cellCenter(page, address) {
  const cell = cellLocator(page, address);
  await expect(cell).toBeVisible();
  const box = await cell.boundingBox();
  expect(box).not.toBeNull();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function selectionSnapshot(page) {
  return page.evaluate(() => ({
    active: document.querySelector('.sheet-cell[aria-selected="true"]')?.dataset.cellAddress || null,
    focused: document.activeElement?.dataset.cellAddress || null,
    formulaLabel: document.querySelector(".name-box span")?.textContent?.trim() || null,
    status: document.querySelector(".active-cell-status code")?.textContent?.trim() || null,
    rangeStatus: document.querySelector(".range-status")?.textContent?.trim() || null,
    selectedRows: [...document.querySelectorAll('[role="rowheader"][aria-selected="true"]')].map(
      (node) => node.dataset.axisIndex,
    ),
    selectedColumns: [...document.querySelectorAll('[role="columnheader"][aria-selected="true"]')].map(
      (node) => node.dataset.axisIndex,
    ),
  }));
}

test("headers, range, active cell, and formula-bar label share one selection", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("columnheader", { name: "Select column C", exact: true }).click();
  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "C1",
      formulaLabel: "C1:C256",
      status: "C1:C256",
      selectedRows: [],
      selectedColumns: ["2"],
    });

  await page.getByRole("rowheader", { name: "Select row 7", exact: true }).click();
  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "C7",
      formulaLabel: "A7:BL7",
      status: "A7:BL7",
      selectedRows: ["6"],
      selectedColumns: [],
    });
  await expect(page.locator('.sheet-cell[data-cell-address="A7"]')).toHaveClass(/is-in-range/);
  await expect(page.locator('.sheet-cell[data-cell-address="C7"]')).toHaveClass(/is-selected/);
});

test("the first row uses the same tile geometry and range paint as later rows", async ({ page }) => {
  await page.goto("/");

  const geometry = async (address) =>
    page.locator(`[data-cell-address="${address}"]`).evaluate((cell) => {
      const slot = cell.parentElement;
      const slotRect = slot.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      return {
        slot: { width: slotRect.width, height: slotRect.height },
        cell: { width: cellRect.width, height: cellRect.height },
        range: cell.classList.contains("is-in-range"),
        selected: cell.getAttribute("aria-selected") === "true",
        outOfBounds: Number(slot.dataset.row) < 0 || Number(slot.dataset.column) < 0,
      };
    });

  await page.getByRole("rowheader", { name: "Select row 1", exact: true }).click();
  await expect.poll(() => geometry("A1")).toMatchObject({ range: false, selected: true, outOfBounds: false });
  await expect.poll(() => geometry("B1")).toMatchObject({ range: true, selected: false, outOfBounds: false });
  const rowOneA = await geometry("A1");
  const rowOneB = await geometry("B1");

  await page.getByRole("rowheader", { name: "Select row 2", exact: true }).click();
  await expect.poll(() => geometry("A2")).toMatchObject({ range: false, selected: true, outOfBounds: false });
  await expect.poll(() => geometry("B2")).toMatchObject({ range: true, selected: false, outOfBounds: false });
  const rowTwoA = await geometry("A2");
  const rowTwoB = await geometry("B2");

  expect(rowOneA.slot).toEqual(rowTwoA.slot);
  expect(rowOneB.slot).toEqual(rowTwoB.slot);
  expect(rowOneA.cell.width).toBe(rowTwoA.cell.width);
  expect(rowOneB.cell.width).toBe(rowTwoB.cell.width);
});

test("pointer-up outside the sheet keeps a long horizontal range at the endpoint", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator("[data-sheet-scroll]").last();
  const start = await cellCenter(page, "A2");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();

  const scrollState = await sheet.evaluate((element) => {
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    element.scrollLeft = maxScrollLeft;
    const bounds = element.getBoundingClientRect();
    return {
      maxScrollLeft,
      releaseX: Math.min(window.innerWidth - 2, bounds.right + 16),
    };
  });
  const releasePoint = { x: scrollState.releaseX, y: start.y };
  await page.waitForTimeout(40);
  await page.evaluate(({ x, y }) => {
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        buttons: 0,
      }),
    );
  }, releasePoint);
  await page.mouse.up();

  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "BL2",
      focused: "BL2",
      formulaLabel: "A2:BL2",
      status: "A2:BL2",
      rangeStatus: "· 64 cells",
    });
  await expect
    .poll(() => sheet.evaluate((element) => element.scrollLeft))
    .toBeGreaterThanOrEqual(scrollState.maxScrollLeft - 20);
  await expect
    .poll(() =>
      sheet.evaluate((element) => {
        const canvas = element.querySelector(".virtual-sheet-canvas");
        const width = canvas?.getBoundingClientRect().width || 0;
        const height = canvas?.getBoundingClientRect().height || 0;
        return [...element.querySelectorAll(".virtual-cell-slot")].every((slot) => {
          const left = Number.parseFloat(getComputedStyle(slot).left);
          const top = Number.parseFloat(getComputedStyle(slot).top);
          const slotWidth = Number.parseFloat(getComputedStyle(slot).width);
          const slotHeight = Number.parseFloat(getComputedStyle(slot).height);
          return left >= 0 && top >= 0 && left + slotWidth <= width + 0.01 && top + slotHeight <= height + 0.01;
        });
      }),
    )
    .toBe(true);
});

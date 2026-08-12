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
  expect(new Set(heldSnapshots.map((snapshot) => snapshot.rangeStatus))).toEqual(new Set(["· 6 cells"]));
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
      rangeStatus: "· 6 cells",
    });
});

test("registers a range drag even when the pointer jumps between cells", async ({ page }) => {
  await page.goto("/");

  const start = await cellCenter(page, "D7");
  const end = await cellCenter(page, "C5");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();

  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "C5",
      focused: "C5",
      inRangeCount: 5,
      status: "C5:D7",
      rangeStatus: "· 6 cells",
    });
});

test("applies the pointer-up endpoint when no intermediate move is delivered", async ({ page }) => {
  await page.goto("/");

  const start = await cellCenter(page, "D7");
  const end = await cellCenter(page, "C5");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
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
  }, end);
  await page.mouse.up();

  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "C5",
      focused: "C5",
      inRangeCount: 5,
      status: "C5:D7",
    });
});

test("keeps a fast drag endpoint when it lands in a virtual-cell seam", async ({ page }) => {
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

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();

  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "C5",
      focused: "C5",
      inRangeCount: 5,
      status: "C5:D7",
    });
});

test("does not tint the perpendicular axis for whole-row or whole-column selection", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("columnheader", { name: "Select column C" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        activeColumn: document
          .querySelector('[role="columnheader"][aria-label="Select column C"]')
          ?.classList.contains("is-active"),
        activeRow: document
          .querySelector('[role="rowheader"][aria-label="Select row 1"]')
          ?.classList.contains("is-active"),
        perpendicularCell: document.querySelector('[data-cell-address="B1"]')?.classList.contains("is-selected-row"),
        selectedColumnCell: document
          .querySelector('[data-cell-address="C1"]')
          ?.classList.contains("is-selected-column"),
      })),
    )
    .toEqual({ activeColumn: true, activeRow: false, perpendicularCell: false, selectedColumnCell: true });

  await page.getByRole("rowheader", { name: "Select row 7" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        activeColumn: document
          .querySelector('[role="columnheader"][aria-label="Select column C"]')
          ?.classList.contains("is-active"),
        activeRow: document
          .querySelector('[role="rowheader"][aria-label="Select row 7"]')
          ?.classList.contains("is-active"),
        selectedRowCell: document.querySelector('[data-cell-address="B7"]')?.classList.contains("is-selected-row"),
        perpendicularCell: document.querySelector('[data-cell-address="C7"]')?.classList.contains("is-selected-column"),
      })),
    )
    .toEqual({ activeColumn: false, activeRow: true, selectedRowCell: true, perpendicularCell: false });
});

test("uses Paper selection colors in the go-to-tile address field", async ({ page }) => {
  await page.goto("/");

  await page.locator(".base-object-layer .name-box").first().click();
  await expect(page.getByRole("dialog", { name: "Go to tile" })).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".base-object-layer .address-popover input").evaluate((input) => {
        const selection = getComputedStyle(input, "::selection");
        return { background: selection.backgroundColor, color: selection.color };
      }),
    )
    .toMatchObject({ color: "rgb(24, 24, 22)" });
  await expect
    .poll(() =>
      page
        .locator(".base-object-layer .address-popover input")
        .evaluate((input) => getComputedStyle(input, "::selection").backgroundColor),
    )
    .not.toBe("rgba(0, 0, 0, 0)");
});

test("double-clicking a value cell enters editing with one active outline", async ({ page }) => {
  await page.goto("/");

  const cell = cellLocator(page, "B2");
  await cell.click();
  await cell.press("x");
  const editor = page.locator('input[aria-label="Edit B2"]');
  await expect(editor).toBeVisible();
  await editor.press("Enter");
  await expect(editor).toBeHidden();

  await cell.dblclick();
  await expect(editor).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const active = document.querySelector('.sheet-cell[data-cell-address="B2"]');
        const after = getComputedStyle(active, "::after");
        const before = getComputedStyle(active, "::before");
        return {
          editing: Boolean(active?.querySelector("input.cell-editor")),
          outlineStyle: getComputedStyle(active).outlineStyle,
          afterDisplay: after.display,
          beforeDisplay: before.display,
        };
      }),
    )
    .toEqual({ editing: true, outlineStyle: "none", afterDisplay: "none", beforeDisplay: "none" });

  await editor.press("Enter");
  await expect(editor).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const active = document.querySelector('.sheet-cell[data-cell-address="B2"]');
        const after = getComputedStyle(active, "::after");
        const before = getComputedStyle(active, "::before");
        return {
          outlineStyle: getComputedStyle(active).outlineStyle,
          afterDisplay: after.display,
          beforeDisplay: before.display,
        };
      }),
    )
    .toEqual({ outlineStyle: "none", afterDisplay: "block", beforeDisplay: "none" });
});

test("repeats a constant selected block when filled downward", async ({ page }) => {
  await page.goto("/");

  for (const address of ["B1", "B2", "B3"]) {
    const cell = cellLocator(page, address);
    await cell.click();
    await cell.press("1");
    const editor = page.locator(`input[aria-label="Edit ${address}"]`);
    await expect(editor).toBeVisible();
    await editor.press("Enter");
  }

  const start = await cellCenter(page, "B1");
  const end = await cellCenter(page, "B3");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();

  const handle = page.getByRole("button", { name: "Fill from B3" });
  await expect(handle).toBeVisible();
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  const target = await cellCenter(page, "B6");
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(() =>
        ["B1", "B2", "B3", "B4", "B5", "B6"].map(
          (address) =>
            document.querySelector(`[data-cell-address="${address}"] .cell-value`)?.textContent?.trim() || "",
        ),
      ),
    )
    .toEqual(["1", "1", "1", "1", "1", "1"]);
});

test("continues matching numeric columns when a rectangular selection is filled downward", async ({ page }) => {
  await page.goto("/");

  for (let row = 1; row <= 6; row += 1) {
    for (const column of ["B", "C"]) {
      const address = `${column}${row}`;
      const cell = cellLocator(page, address);
      await cell.click();
      await cell.press(String(row));
      const editor = page.locator(`input[aria-label="Edit ${address}"]`);
      await expect(editor).toBeVisible();
      await editor.press("Enter");
    }
  }

  const start = await cellCenter(page, "B1");
  const end = await cellCenter(page, "C6");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.mouse.up();

  const handle = page.getByRole("button", { name: "Fill from C6" });
  await expect(handle).toBeVisible();
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  const target = await cellCenter(page, "C9");
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(() =>
        ["B7", "C7", "B8", "C8", "B9", "C9"].map(
          (address) =>
            document.querySelector(`[data-cell-address="${address}"] .cell-value`)?.textContent?.trim() || "",
        ),
      ),
    )
    .toEqual(["7", "7", "8", "8", "9", "9"]);
});

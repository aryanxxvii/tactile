import { expect, test } from "@playwright/test";

test("previews column resizing before the pointer is released", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator("[data-sheet-scroll]").last();
  await expect(sheet).toBeVisible();

  const columnCell = sheet.locator('.sheet-cell[data-cell-address="A1"]').first();
  const columnBefore = await columnCell.boundingBox();
  const columnHandle = sheet.getByRole("separator", { name: "Resize column A" });
  const columnHandleBox = await columnHandle.boundingBox();
  if (!columnBefore || !columnHandleBox) throw new Error("Column resize fixture is not measurable.");

  await page.mouse.move(
    columnHandleBox.x + columnHandleBox.width / 2,
    columnHandleBox.y + columnHandleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    columnHandleBox.x + columnHandleBox.width / 2 + 48,
    columnHandleBox.y + columnHandleBox.height / 2,
    { steps: 4 },
  );
  await expect
    .poll(async () => (await columnCell.boundingBox())?.width || 0)
    .toBeGreaterThan(columnBefore.width + 20);
  await page.mouse.up();
});

test("previews row resizing before the pointer is released", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator("[data-sheet-scroll]").last();
  await expect(sheet).toBeVisible();

  const rowCell = sheet.locator('.sheet-cell[data-cell-address="A1"]').first();
  const rowBefore = await rowCell.boundingBox();
  const rowHandle = sheet.getByRole("separator", { name: "Resize row 1", exact: true });
  const rowHandleBox = await rowHandle.boundingBox();
  if (!rowBefore || !rowHandleBox) throw new Error("Row resize fixture is not measurable.");

  await page.mouse.move(
    rowHandleBox.x + rowHandleBox.width / 2,
    rowHandleBox.y + rowHandleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    rowHandleBox.x + rowHandleBox.width / 2,
    rowHandleBox.y + rowHandleBox.height / 2 + 24,
    { steps: 4 },
  );
  await expect
    .poll(async () => (await rowCell.boundingBox())?.height || 0)
    .toBeGreaterThan(rowBefore.height + 10);
  await page.mouse.up();
});

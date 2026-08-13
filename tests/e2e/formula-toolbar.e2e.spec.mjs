import { expect, test } from "@playwright/test";

async function toolbarGeometry(page) {
  return page.locator(".formula-toolbar-row").evaluate((row) => {
    const rowBox = row.getBoundingClientRect();
    const toolbar = row.querySelector(".cell-format-toolbar");
    const toolbarBox = toolbar?.getBoundingClientRect();
    if (!toolbarBox) throw new Error("The cell formatting toolbar has no layout box.");
    return {
      leftSpace: toolbarBox.left - rowBox.left,
      rightSpace: rowBox.right - toolbarBox.right,
      rowWidth: rowBox.width,
      toolbarWidth: toolbarBox.width,
    };
  });
}

test("centers the compact formatting controls without a visible section label", async ({ page }) => {
  await page.goto("/");

  const row = page.locator(".formula-toolbar-row");
  const toolbar = page.locator(".cell-format-toolbar");
  await expect(row).toBeVisible();
  await expect(toolbar).toBeVisible();
  await expect(page.locator(".formula-toolbar-label")).toHaveCount(0);
  await expect(page.getByText("Cell format", { exact: true })).toHaveCount(0);
  await expect(row).toHaveCSS("justify-content", "center");
  await expect(toolbar.locator("select, input, [role='combobox']")).toHaveCount(0);

  const geometry = await toolbarGeometry(page);
  expect(Math.abs(geometry.leftSpace - geometry.rightSpace)).toBeLessThanOrEqual(1);
  expect(geometry.toolbarWidth).toBeLessThan(geometry.rowWidth);

  const bold = page.getByRole("button", { name: "Bold", exact: true });
  await bold.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Remove bold", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("keeps cells selection-only and routes deliberate edits through the formula bar", async ({ page }) => {
  await page.goto("/");

  const cell = page.locator('.sheet-cell[data-cell-address="B2"]');
  const editor = page.locator(".formula-editor");
  await cell.click();
  await cell.dblclick();

  await expect(page.locator(".cell-editor")).toHaveCount(0);
  await expect(editor).toBeFocused();
  await expect(cell).toHaveAttribute("aria-selected", "true");

  await editor.fill("Edited from the formula bar");
  await expect(cell.locator(".cell-value")).toHaveText("Edited from the formula bar");

  const emptyCell = page.locator('.sheet-cell[data-cell-address="C20"]');
  await emptyCell.click();
  await emptyCell.press("x");
  await expect(page.locator(".cell-editor")).toHaveCount(0);
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("x");
});

test("shows formula hints in the formula bar and inserts a clicked cell reference", async ({ page }) => {
  await page.goto("/");

  const source = page.locator('.sheet-cell[data-cell-address="A4"]');
  await source.click();
  const editor = page.locator(".formula-editor");
  await editor.click();
  await editor.fill("=SUM");

  const hints = page.getByRole("listbox", { name: "Formula suggestions" });
  await expect(hints).toBeVisible();
  await expect(hints.getByRole("option").first()).toContainText("SUM");
  await hints.getByRole("option").first().click();
  await expect(editor).toHaveValue("=SUM(");

  await page.locator('.sheet-cell[data-cell-address="A2"]').click();
  await expect(editor).toHaveValue("=SUM(A2,");
  await expect(source).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".cell-editor")).toHaveCount(0);
  await expect(page.locator('.sheet-cell[data-cell-address="A2"]')).toHaveCSS("border-color", /rgb/);
  const clickedReferenceOutline = page.locator('.sheet-cell[data-cell-address="A2"] .formula-reference-outline');
  await expect(clickedReferenceOutline).toHaveCount(1);
  await expect(clickedReferenceOutline.locator("rect")).toHaveCSS("stroke-dasharray", "3px, 3px");
  await expect(clickedReferenceOutline.locator("rect")).toHaveCSS("animation-duration", "7.5s");
});

test("inserts a selected cell range into a formula-bar formula", async ({ page }) => {
  await page.goto("/");

  const source = page.locator('.sheet-cell[data-cell-address="A4"]');
  await source.click();
  const editor = page.locator(".formula-editor");
  await editor.click();
  await editor.fill("=SUM");
  await page.getByRole("listbox", { name: "Formula suggestions" }).getByRole("option").first().click();

  const start = await page.locator('.sheet-cell[data-cell-address="A2"]').boundingBox();
  const end = await page.locator('.sheet-cell[data-cell-address="A4"]').boundingBox();
  if (!start || !end) throw new Error("Formula reference cells are not measurable");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 4 });
  await page.mouse.up();

  await expect(editor).toHaveValue("=SUM(A2:A4,");
  await expect(page.locator('.sheet-cell[data-cell-address="A4"]')).toHaveClass(/is-formula-reference/);
  const rangeReferenceOutline = page.locator('.sheet-cell[data-cell-address="A4"] .formula-reference-outline');
  await expect(rangeReferenceOutline).toHaveCount(1);
  await expect(rangeReferenceOutline.locator("rect")).toHaveCSS("animation-duration", "7.5s");
});

test("applies top, middle, and bottom vertical alignment to the active tile", async ({ page }) => {
  await page.goto("/");

  const cell = page.locator('.sheet-cell[data-cell-address="A1"]');
  const top = page.getByRole("button", { name: "Align top", exact: true });
  const middle = page.getByRole("button", { name: "Align middle", exact: true });
  const bottom = page.getByRole("button", { name: "Align bottom", exact: true });

  await top.click();
  await expect(cell).toHaveClass(/align-top/);
  await expect(top).toHaveAttribute("aria-pressed", "true");

  await middle.click();
  await expect(cell).toHaveClass(/align-middle/);
  await expect(middle).toHaveAttribute("aria-pressed", "true");

  await bottom.click();
  await expect(cell).toHaveClass(/align-bottom/);
  await expect(bottom).toHaveAttribute("aria-pressed", "true");
});

test("uses the same default ink color for both formatting erasers", async ({ page }) => {
  await page.goto("/");

  const fillEraser = page.getByRole("button", { name: "No fill", exact: true });
  const textEraser = page.getByRole("button", { name: "Default ink", exact: true });
  await expect(fillEraser).toHaveCSS("color", await textEraser.evaluate((element) => getComputedStyle(element).color));
});

test("keeps the formatting strip centered when the sheet narrows", async ({ page }) => {
  for (const width of [620, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const geometry = await toolbarGeometry(page);
    expect(Math.abs(geometry.leftSpace - geometry.rightSpace)).toBeLessThanOrEqual(1);
    expect(geometry.toolbarWidth).toBeLessThanOrEqual(geometry.rowWidth + 1);
  }
});

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

test("keeps the formatting strip centered when the sheet narrows", async ({ page }) => {
  for (const width of [620, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const geometry = await toolbarGeometry(page);
    expect(Math.abs(geometry.leftSpace - geometry.rightSpace)).toBeLessThanOrEqual(1);
    expect(geometry.toolbarWidth).toBeLessThanOrEqual(geometry.rowWidth + 1);
  }
});

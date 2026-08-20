import { expect, test } from "@playwright/test";

import { createBlankWorkspace, createCellRecord } from "../../src/model.js";

function linkWorkspace() {
  const workspace = createBlankWorkspace({ id: "link-cell-e2e", name: "Link cell" });
  const root = workspace.objects.home;
  root.title = "Link home";
  root.cells.A1 = createCellRecord(0, 0, { value: "https://example.com/docs" });
  return workspace;
}

const cellLocator = (page, objectId, address) =>
  page.locator(`[data-object-id="${objectId}"][data-cell-address="${address}"]`).first();

async function importWorkspace(page, workspace = linkWorkspace()) {
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "link-cell.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(workspace)),
  });
  await expect(cellLocator(page, "home", "A1")).toBeVisible();
}

test("a bare-URL tile opens as a floating link window and materializes a link object", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "home", "A1").click();
  const linkLayer = page.locator('.spatial-layer [data-object-type="link"]');
  await expect(linkLayer).toBeVisible();
  await expect(page.locator(".tactile-app")).toHaveClass(/has-floating-layer/);
  await expect(linkLayer).toHaveAttribute("data-spatial-phase", "floating");
  await expect(page.locator(".link-toolbar input")).toHaveValue("https://example.com/docs");
  await expect(linkLayer.getByRole("button", { name: "Open in browser", exact: true })).toBeVisible();
  await expect(linkLayer.locator(".link-stage iframe")).toHaveAttribute("src", "https://example.com/docs");

  await page.keyboard.press("[");
  await expect(linkLayer).toHaveCount(0, { timeout: 4_000 });
  await expect(cellLocator(page, "home", "A1")).toHaveClass(/is-embedded/);
  await expect(page.locator('.spatial-layer [data-object-type="link"]')).toHaveCount(0);
});

test("] opens the focused bare-URL tile as an embedded link", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "home", "A1").click();
  await page.keyboard.press("]");
  const linkLayer = page.locator('.spatial-layer [data-object-type="link"]');
  await expect(linkLayer).toBeVisible();
  await expect(page.locator(".link-toolbar input")).toHaveValue("https://example.com/docs");
});
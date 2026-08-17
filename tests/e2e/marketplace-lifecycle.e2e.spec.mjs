import { expect, test } from "@playwright/test";

test("Marketplace owns install, version updates, and delete while Cell Objects owns enablement", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".sheet-cell").first()).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Plugins" }).click();

  const cellObjects = page.getByRole("region", { name: "Cell Objects" });
  const marketplace = page.getByRole("region", { name: "Marketplace" });

  await marketplace.getByRole("button", { name: "Install Code" }).click();
  await expect(cellObjects.getByRole("switch", { name: "Disable Code" })).toBeVisible();
  await expect(marketplace.getByRole("switch", { name: /Code/ })).toHaveCount(0);
  await expect(marketplace.getByRole("button", { name: "Delete Code" })).toBeVisible();
  await expect(marketplace.getByRole("button", { name: "Update Code" })).toHaveCount(0);

  await cellObjects.getByRole("switch", { name: "Disable Code" }).click();
  await expect(cellObjects.getByRole("switch", { name: "Enable Code" })).toBeVisible();
  await expect(marketplace.getByRole("switch", { name: /Code/ })).toHaveCount(0);
  await expect(marketplace.getByRole("button", { name: "Delete Code" })).toBeVisible();

  const catalog = await page.evaluate(async () => (await fetch("/marketplace/catalog.json")).json());
  catalog.plugins = catalog.plugins.map((entry) => (
    entry.packageId === "tactile.code" ? { ...entry, version: "1.0.1" } : entry
  ));
  await page.route("**/marketplace/catalog.json", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(catalog),
  }));
  await marketplace.locator(".plugins-section-heading > button").click();

  await expect(marketplace.getByRole("button", { name: "Update Code" })).toBeVisible();
  await expect(marketplace.getByText("1.0.0 → 1.0.1")).toBeVisible();
  await expect(marketplace.getByRole("switch", { name: /Code/ })).toHaveCount(0);
  await expect(cellObjects.getByRole("switch", { name: "Enable Code" })).toBeVisible();
  const updateBox = await marketplace.getByRole("button", { name: "Update Code" }).boundingBox();
  const deleteBox = await marketplace.getByRole("button", { name: "Delete Code" }).boundingBox();
  expect(Math.abs(updateBox.y - deleteBox.y)).toBeLessThanOrEqual(1);
  expect(deleteBox.x).toBeGreaterThan(updateBox.x + updateBox.width);

  await marketplace.getByRole("button", { name: "Delete Code" }).click();
  await expect(marketplace.getByRole("button", { name: "Install Code" })).toBeVisible();
  await expect(cellObjects.getByText("Code", { exact: true })).toHaveCount(0);
});

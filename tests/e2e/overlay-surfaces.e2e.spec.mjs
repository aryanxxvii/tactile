import { expect, test } from "@playwright/test";

async function surfaceGeometry(locator) {
  return locator.evaluate((node) => {
    const root = node.parentElement;
    const style = getComputedStyle(node);
    const rootStyle = root ? getComputedStyle(root) : null;
    const rect = node.getBoundingClientRect();
    const dock = document.querySelector(".app-bottom-bar");
    return {
      background: style.backgroundColor,
      opacity: style.opacity,
      position: style.position,
      parentOverlay: root?.dataset.overlayLayer || null,
      insideClippedPanel: Boolean(node.closest(".sheet-grid-shell, .files-panel")),
      overlayZ: Number.parseInt(rootStyle?.zIndex || "0", 10),
      dockZ: Number.parseInt(getComputedStyle(dock).zIndex || "0", 10),
      staysInsideViewport:
        rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
    };
  });
}

test("Paper formatting, context, and tooltip surfaces stay opaque and above clipping", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".cell-size-trigger")).toBeVisible();

  await page.locator(".cell-size-trigger").click();
  const formatMenu = page.getByRole("listbox", { name: "Text size" });
  await expect(formatMenu).toBeVisible();
  expect(await surfaceGeometry(formatMenu)).toMatchObject({
    background: "rgb(255, 254, 250)",
    opacity: "1",
    position: "fixed",
    parentOverlay: "true",
    insideClippedPanel: false,
    staysInsideViewport: true,
  });

  await page.locator('[role="gridcell"][data-cell-address="A1"]').click({ button: "right" });
  const cellMenu = page.getByRole("menu", { name: "Commands for A1" });
  await expect(cellMenu).toBeVisible();
  await expect.poll(() => cellMenu.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  expect(await surfaceGeometry(cellMenu)).toMatchObject({
    background: "rgb(255, 254, 250)",
    opacity: "1",
    position: "fixed",
    parentOverlay: "true",
    insideClippedPanel: false,
    staysInsideViewport: true,
  });
  expect((await surfaceGeometry(cellMenu)).overlayZ).toBeGreaterThan((await surfaceGeometry(cellMenu)).dockZ);

  await cellMenu.getByRole("menuitem", { name: "Rows & columns" }).click();
  const submenu = cellMenu.locator(".cell-menu-submenu");
  await expect(submenu).toBeVisible();
  await expect.poll(() => submenu.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  expect(await surfaceGeometry(submenu)).toMatchObject({
    background: "rgb(255, 254, 250)",
    opacity: "1",
    insideClippedPanel: false,
  });

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(cellMenu).toHaveCount(0);

  const filesButton = page.getByRole("button", { name: "Browse files", exact: true });
  await filesButton.click();
  const filesPanel = page.getByRole("dialog", { name: "Files" });
  await expect(filesPanel).toBeVisible();
  const fileRow = page.locator(".files-tree-row").first();
  await fileRow.click({ button: "right" });
  const filesMenu = page.locator(".files-context-menu");
  await expect(filesMenu).toBeVisible();
  await expect.poll(() => filesMenu.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  const filesMenuGeometry = await surfaceGeometry(filesMenu);
  expect(filesMenuGeometry).toMatchObject({
    background: "rgb(255, 254, 250)",
    opacity: "1",
    position: "fixed",
    parentOverlay: "true",
    insideClippedPanel: false,
    staysInsideViewport: true,
  });
  expect(filesMenuGeometry.overlayZ).toBeGreaterThan(filesMenuGeometry.dockZ);

  await filesPanel.getByRole("button", { name: "Close Files" }).click();
  await filesButton.hover();
  await expect(page.locator('[role="tooltip"]')).toBeVisible();
  const tooltipGeometry = await surfaceGeometry(page.locator('[role="tooltip"]'));
  expect(tooltipGeometry).toMatchObject({
    background: "rgb(255, 254, 250)",
    opacity: "1",
    position: "absolute",
    parentOverlay: "true",
    insideClippedPanel: false,
    staysInsideViewport: true,
  });
  expect(tooltipGeometry.overlayZ).toBeGreaterThan(tooltipGeometry.dockZ);
});

test("cell menus stay close to lower cells and keep submenus inside the viewport", async ({ page }) => {
  await page.goto("/");

  await page.locator("[data-sheet-scroll]").evaluate((element) => element.scrollTo(0, 1600));
  const cell = page.locator('[role="gridcell"][data-cell-address="A68"]');
  await expect(cell).toBeVisible();
  await cell.click({ button: "right" });

  const menu = page.getByRole("menu", { name: "Commands for A68" });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS("animation-name", "tactile-menu-in");

  const placement = await page.evaluate(() => {
    const cellBox = document.querySelector('[role="gridcell"][data-cell-address="A68"]')?.getBoundingClientRect();
    const menuBox = document.querySelector(".cell-context-menu")?.getBoundingClientRect();
    if (!cellBox || !menuBox) return null;
    const verticalGap = menuBox.top >= cellBox.bottom ? menuBox.top - cellBox.bottom : cellBox.top - menuBox.bottom;
    return {
      verticalGap,
      menuInsideViewport:
        menuBox.left >= 0 && menuBox.right <= innerWidth && menuBox.top >= 0 && menuBox.bottom <= innerHeight,
    };
  });
  expect(placement).toMatchObject({ menuInsideViewport: true });
  expect(placement?.verticalGap).toBeLessThan(14);

  await menu.getByRole("menuitem", { name: "Rows & columns", exact: true }).click();
  const submenu = page.locator(".cell-menu-submenu");
  await expect(submenu).toBeVisible();
  const submenuBox = await submenu.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    };
  });
  expect(submenuBox).not.toBeNull();
  expect(submenuBox.left).toBeGreaterThanOrEqual(0);
  expect(submenuBox.right).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect(submenuBox.top).toBeGreaterThanOrEqual(0);
  expect(submenuBox.bottom).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
});

test("Settings keeps the workspace sharp behind its panel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.locator(".settings-scrim")).toHaveCSS("backdrop-filter", "none");
});

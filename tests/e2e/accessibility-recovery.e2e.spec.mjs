import { expect, test } from "@playwright/test";

async function openWorkspace(page) {
  await page.goto("/");
  await expect(page.locator(".sheet-cell").first()).toBeVisible();
}

test("Paper workspace controls expose accessible names and keyboard roles", async ({ page }) => {
  await openWorkspace(page);

  const unnamedButtons = await page.locator('button:visible:not([aria-hidden="true"])').evaluateAll((buttons) =>
    buttons
      .map((button) => ({
        className: button.className,
        name: button.getAttribute("aria-label")?.trim() || button.textContent?.trim() || "",
      }))
      .filter(({ name }) => !name),
  );
  expect(unnamedButtons, "every visible button should have an accessible name").toEqual([]);

  await expect(page.getByRole("textbox", { name: "Object title" })).toHaveCount(1);
  await expect(page.getByRole("combobox", { name: /^Formula or value for / })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Workspace menu" })).toHaveAttribute("aria-haspopup", "menu");
  await expect(page.getByRole("button", { name: "Browse files" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('.sheet-cell[aria-selected="true"]')).toHaveCount(1);
});

test("keyboard-opened Paper surfaces return cleanly without losing the sheet", async ({ page }) => {
  await openWorkspace(page);

  const workspaceMenuButton = page.getByRole("button", { name: "Workspace menu" });
  await workspaceMenuButton.focus();
  await page.keyboard.press("Enter");

  const workspaceMenu = page.getByRole("menu", { name: "Workspace commands" });
  await expect(workspaceMenu).toBeVisible();
  await expect(workspaceMenu.locator('[role="menuitem"]:not(:disabled)').first()).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(workspaceMenu).toHaveCount(0);
  await expect(workspaceMenuButton).toBeFocused();

  await page.keyboard.press("Control+P");
  const filesPanel = page.getByRole("dialog", { name: "Files" });
  await expect(filesPanel).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search files" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(filesPanel).toHaveCount(0);
  await expect(page.locator(".base-object-layer")).toBeVisible();
  await expect(page.locator('.sheet-cell[aria-selected="true"]')).toHaveCount(1);
});

test("Files search and context menus preserve their list/menu semantics", async ({ page }) => {
  await openWorkspace(page);

  await page.keyboard.press("Control+P");
  const filesPanel = page.getByRole("dialog", { name: "Files" });
  await expect(filesPanel).toBeVisible();

  const search = page.getByRole("textbox", { name: "Search files" });
  await search.fill("Home");
  const option = page.getByRole("option").first();
  await expect(option).toBeVisible();
  await expect(option).toHaveAttribute("aria-selected", "true");

  await search.press("ArrowDown");
  await expect(option).toBeFocused();
  await option.press("Enter");
  await expect(filesPanel).toHaveCount(0);

  await page.keyboard.press("Control+P");
  await expect(filesPanel).toBeVisible();
  const treeItem = page.getByRole("treeitem").first();
  await treeItem.press("Shift+F10");

  const contextMenu = page.getByRole("menu", { name: /Actions for Home/ });
  await expect(contextMenu).toBeVisible();
  const firstMenuItem = contextMenu.locator('[role="menuitem"]:not(:disabled)').first();
  const secondMenuItem = contextMenu.locator('[role="menuitem"]:not(:disabled)').nth(1);
  await firstMenuItem.focus();
  await expect(firstMenuItem).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(secondMenuItem).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(contextMenu).toHaveCount(0);
  await expect(filesPanel).toBeVisible();
});

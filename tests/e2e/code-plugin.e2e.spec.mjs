import { expect, test } from "@playwright/test";

test("Code plugin opens, applies its styles, and runs JavaScript", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.locator(".sheet-cell").first()).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Plugins" }).click();
  await page.getByRole("region", { name: "Marketplace" }).getByRole("button", { name: "Install Code" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();

  const firstCell = page.locator('.sheet-cell[data-cell-address="A1"]');
  await firstCell.click({ button: "right" });
  await page.getByRole("menuitem", { name: "In: Code" }).click();
  await expect(firstCell).toContainText("Code A1");

  await expect(page.locator(".code-object")).toBeVisible();
  await expect(page.locator(".code-codemirror .cm-editor")).toBeVisible();
  const runButton = page.getByRole("button", { name: "Run" });
  await expect(runButton).toHaveCSS("font-size", "9.5px");

  await page.locator(".code-codemirror .cm-content").click();
  await page.keyboard.type('console.log("Tactile code smoke")');
  await runButton.click();
  await expect(page.locator(".code-output-body")).toContainText("Tactile code smoke");

  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("option", { name: "Python" }).click();
  await runButton.click();
  await expect(page.locator(".code-output-body")).toContainText("Python cannot run in the browser preview");
  await expect(page.locator(".code-output-body")).toContainText("Open Tactile Desktop");

  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("option", { name: "JSON" }).click();
  await expect(runButton).toBeDisabled();
  await expect(runButton).toHaveAttribute("data-tooltip", "JSON is editor only");
  expect(pageErrors).toEqual([]);
});

test("HTML object can use an HTML Code cell as a live source", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".sheet-cell").first()).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Plugins" }).click();
  const marketplace = page.getByRole("region", { name: "Marketplace" });
  await marketplace.getByRole("button", { name: "Install Code" }).click();
  await marketplace.getByRole("button", { name: "Install HTML" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();

  const codeCell = page.locator('.sheet-cell[data-cell-address="A1"]');
  await codeCell.click({ button: "right" });
  await page.getByRole("menuitem", { name: "In: Code" }).click();
  await expect(codeCell).toContainText("Code A1");
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("option", { name: "HTML" }).click();
  await page.locator(".code-codemirror .cm-content").click();
  await page.keyboard.type("<h1>Linked preview one</h1>");
  await page.getByRole("button", { name: "Parent" }).click();

  const htmlCell = page.locator('.sheet-cell[data-cell-address="B1"]');
  await htmlCell.click({ button: "right" });
  await page.getByRole("menuitem", { name: "In: HTML" }).click();
  await expect(htmlCell).toContainText("HTML B1");
  const sourceSelect = page.getByRole("combobox", { name: "HTML source cell" });
  await sourceSelect.selectOption({ label: "A1 · Code A1" });
  await expect(page.locator(".file-stage iframe")).toHaveAttribute("srcdoc", /Linked preview one/);
  await page.getByRole("button", { name: "Parent" }).click();

  await codeCell.click();
  const editor = page.locator(".code-codemirror .cm-content");
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("<h1>Linked preview two</h1>");
  await page.getByRole("button", { name: "Parent" }).click();

  await htmlCell.click();
  await expect(page.locator(".file-stage iframe")).toHaveAttribute("srcdoc", /Linked preview two/);
  expect(await sourceSelect.inputValue()).not.toBe("");
  await page.getByRole("button", { name: "Parent" }).click();
  await expect(codeCell).toContainText("Code A1");
  await expect(htmlCell).toContainText("HTML B1");
});

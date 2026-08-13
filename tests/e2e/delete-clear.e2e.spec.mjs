import { expect, test } from "@playwright/test";

import { createBlankWorkspace, createCellRecord, createMarkdownObject } from "../../src/model.js";

const cellLocator = (page, address) => page.locator(`[data-object-id="home"][data-cell-address="${address}"]`).first();

function deleteClearWorkspace() {
  const workspace = createBlankWorkspace({ id: "delete-clear-e2e", name: "Delete clear test" });
  const home = workspace.objects.home;
  home.title = "Home";
  const notes = createMarkdownObject({
    id: "notes",
    title: "Notes",
    content: "The linked object remains after its source cell is cleared.",
    parent: {
      linkId: "home-notes",
      parentObjectId: home.id,
      parentCellId: "r3c1",
      sourceAddress: "A3",
    },
  });
  home.cells = {
    r1c1: createCellRecord(0, 0, { value: "alpha" }),
    r1c2: createCellRecord(0, 1, { value: "bravo" }),
    r2c1: createCellRecord(1, 0, { value: "charlie" }),
    r2c2: createCellRecord(1, 1, { value: "delta" }),
    r3c1: createCellRecord(2, 0, {
      value: notes.title,
      embed: {
        objectId: notes.id,
        type: notes.type,
        linkId: "home-notes",
        relation: "containment",
      },
    }),
  };
  workspace.objects = { [home.id]: home, [notes.id]: notes };
  workspace.settings.reduceMotion = true;
  return workspace;
}

async function importWorkspace(page) {
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "delete-clear.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(deleteClearWorkspace())),
  });
  await expect(cellLocator(page, "A1")).toBeVisible();
}

async function cellValue(page, address) {
  return (await cellLocator(page, address).locator(".cell-value").textContent()).trim();
}

test("Delete clears a selected range, including an embedded source cell, without deleting its object", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "A1").click();
  await cellLocator(page, "B3").click({ modifiers: ["Shift"] });
  await expect(page.locator(".active-cell-status code")).toHaveText("A1:B3");

  await page.keyboard.press("Delete");

  for (const address of ["A1", "B1", "A2", "B2", "A3"]) {
    await expect.poll(() => cellValue(page, address)).toBe("");
  }
  await page.getByRole("button", { name: "Browse files", exact: true }).click();
  await expect(page.locator('.files-tree-row[data-object-id="notes"]')).toBeVisible();
});

test("Backspace clears a focused cell and a selected range", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "B1").click();
  await page.keyboard.press("Backspace");

  await expect.poll(() => cellValue(page, "B1")).toBe("");
  await expect.poll(() => cellValue(page, "A1")).toBe("alpha");

  await cellLocator(page, "A1").click();
  await cellLocator(page, "B2").click({ modifiers: ["Shift"] });
  await expect(page.locator(".active-cell-status code")).toHaveText("A1:B2");
  await page.keyboard.press("Backspace");

  for (const address of ["A1", "B1", "A2", "B2"]) {
    await expect.poll(() => cellValue(page, address)).toBe("");
  }
});

test("Delete and Backspace retain native behavior while the cell editor is active", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  const cell = cellLocator(page, "A1");
  await cell.click();
  await cell.press("Enter");
  const editor = cell.locator(".cell-editor");
  await expect(editor).toHaveValue("alpha");

  await editor.press("End");
  await editor.press("Backspace");
  await expect(editor).toHaveValue("alph");
  await editor.press("Home");
  await editor.press("Delete");
  await expect(editor).toHaveValue("lph");
  await expect(editor).toBeFocused();

  await editor.press("Enter");
  await expect.poll(() => cellValue(page, "A1")).toBe("lph");
});

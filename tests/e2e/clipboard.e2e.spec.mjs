import { expect, test } from "@playwright/test";

const cellLocator = (page, address) => page.locator(`[data-cell-address="${address}"]`).first();
const clipboardImageBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function clipboardWorkspace() {
  const now = new Date().toISOString();
  return {
    format: "tactile",
    version: 4,
    id: "clipboard-e2e",
    name: "Clipboard test",
    homeObjectId: "home",
    homePath: [],
    createdAt: now,
    updatedAt: now,
    objects: {
      home: {
        id: "home",
        type: "sheet",
        title: "Home",
        description: "",
        parent: null,
        rows: 256,
        columns: 64,
        cells: {
          r1c1: {
            id: "r1c1",
            address: "A1",
            row: 0,
            column: 0,
            value: "Notes",
            formula: "",
            embed: {
              objectId: "notes",
              type: "markdown",
              linkId: "home-notes",
              relation: "containment",
            },
          },
          r1c2: { id: "r1c2", address: "B1", row: 0, column: 1, value: "B1", formula: "" },
          r2c2: { id: "r2c2", address: "B2", row: 1, column: 1, value: "B2", formula: "" },
          r256c2: { id: "r256c2", address: "B256", row: 255, column: 1, value: "B256", formula: "" },
          r4c4: { id: "r4c4", address: "D4", row: 3, column: 3, value: "seed", formula: "" },
        },
      },
      notes: {
        id: "notes",
        type: "markdown",
        title: "Notes",
        description: "",
        content: "The object survives clearing its source cell.",
        parent: {
          linkId: "home-notes",
          parentObjectId: "home",
          parentCellId: "r1c1",
          sourceAddress: "A1",
        },
      },
    },
    assets: {},
    themes: {},
    activeThemeId: "paper-public",
    settings: {
      reduceMotion: true,
      openSingleClick: "floating",
      openDoubleClick: "full",
      filesPinned: false,
      filesWidth: 360,
    },
  };
}

async function importClipboardWorkspace(page) {
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "clipboard.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(clipboardWorkspace())),
  });
  await expect(page.locator('[data-object-id="home"][data-cell-address="A1"]')).toBeVisible();
}

async function installMarketplacePlugin(page, name) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Plugins" }).click();
  const marketplace = page.getByRole("region", { name: "Marketplace" });
  await marketplace.getByRole("button", { name: `Install ${name}` }).click();
  await expect(page.getByRole("region", { name: "Cell Objects" }).getByRole("switch", { name: `Disable ${name}` })).toBeVisible();
  await page.getByRole("button", { name: "Close settings" }).click();
}

async function grantClipboard(page) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
}

async function setClipboard(page, text) {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
}

async function setClipboardImage(page) {
  await page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([bytes], { type: "image/png" }) })]);
  }, clipboardImageBase64);
}

async function pasteClipboardImage(page, address = "B2") {
  await page.evaluate(
    ({ cellAddress, encoded }) => {
      const cell = document.querySelector(`[data-cell-address="${cellAddress}"]`);
      const transfer = new DataTransfer();
      const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      transfer.items.add(new File([bytes], "clipboard-image.png", { type: "image/png" }));
      cell.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: transfer,
        }),
      );
    },
    {
      cellAddress: address,
      encoded: clipboardImageBase64,
    },
  );
}

async function selectionSnapshot(page) {
  return page.evaluate(() => ({
    active: document.querySelector('.sheet-cell[aria-selected="true"]')?.dataset.cellAddress || null,
    focused: document.activeElement?.dataset.cellAddress || null,
    editing: Boolean(document.querySelector(".cell-editor")),
    inRangeCount: document.querySelectorAll(".sheet-cell.is-in-range").length,
    status: document.querySelector(".active-cell-status code")?.textContent?.trim() || null,
  }));
}

async function cellValue(page, address) {
  return (await cellLocator(page, address).locator(".cell-value").textContent()).trim();
}

async function pressControlShortcut(page, key) {
  await page.keyboard.down("Control");
  await page.keyboard.press(key);
  await page.keyboard.up("Control");
}

test("copies Hello from B4 and pastes it directly into selected C4", async ({ page }) => {
  await page.goto("/");
  await grantClipboard(page);
  await importClipboardWorkspace(page);

  await cellLocator(page, "B4").dblclick();
  const editor = page.locator(".formula-editor");
  await editor.fill("Hello");
  await editor.press("Enter");
  await expect.poll(() => cellValue(page, "B4")).toBe("Hello");

  await cellLocator(page, "B4").click();
  await pressControlShortcut(page, "C");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("Hello");

  await cellLocator(page, "C4").click();
  await pressControlShortcut(page, "V");

  await expect.poll(() => cellValue(page, "C4")).toBe("Hello");
  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({ active: "C4", focused: "C4", editing: false, status: "C4" });
});

test("pastes a single value directly into the selected cell without opening its editor", async ({ page }) => {
  await page.goto("/");
  await grantClipboard(page);
  await importClipboardWorkspace(page);
  await setClipboard(page, "single value");

  await cellLocator(page, "C6").click();
  await pressControlShortcut(page, "V");

  await expect.poll(() => cellValue(page, "C6")).toBe("single value");
  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "C6",
      focused: "C6",
      editing: false,
      inRangeCount: 0,
      status: "C6",
    });
});

test("falls back to the clipboard API when a native paste event does not reach the app", async ({ page }) => {
  await page.goto("/");
  await grantClipboard(page);
  await importClipboardWorkspace(page);
  await setClipboard(page, "fallback value");

  await cellLocator(page, "D6").click();
  await page.locator('[data-tactile-paste-proxy="true"]').evaluate((element) => {
    element.addEventListener("paste", (event) => event.stopPropagation(), { once: true });
  });
  await pressControlShortcut(page, "V");

  await expect.poll(() => cellValue(page, "D6")).toBe("fallback value");
  await expect.poll(() => selectionSnapshot(page)).toMatchObject({ active: "D6", focused: "D6" });
});

test("pastes a rectangular TSV from the keyboard and selects that rectangle", async ({ page }) => {
  await page.goto("/");
  await grantClipboard(page);
  await importClipboardWorkspace(page);
  await setClipboard(page, "one\ttwo\nthree\tfour");

  await cellLocator(page, "B2").click();
  await page.keyboard.press("Control+V");

  await expect.poll(() => cellValue(page, "B2")).toBe("one");
  await expect.poll(() => cellValue(page, "C2")).toBe("two");
  await expect.poll(() => cellValue(page, "B3")).toBe("three");
  await expect.poll(() => cellValue(page, "C3")).toBe("four");
  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "B2",
      focused: "B2",
      editing: false,
      inRangeCount: 3,
      status: "B2:C3",
    });
});

test("pastes a clipboard image into the selected cell as a linked local image object", async ({ page }) => {
  await page.goto("/");
  await installMarketplacePlugin(page, "Image");
  await importClipboardWorkspace(page);

  await cellLocator(page, "B2").click();
  await pasteClipboardImage(page);

  await expect.poll(() => cellValue(page, "B2")).toBe("clipboard-image");
  await expect
    .poll(async () => page.locator('[data-cell-address="B2"]').getAttribute("aria-label"))
    .toContain("embedded object");

  await page.getByRole("button", { name: "Browse files", exact: true }).click();
  const imageRow = page.locator(".files-tree-row[data-object-id]").filter({ hasText: "clipboard-image" });
  await expect(imageRow).toBeVisible();
  await imageRow.locator(".files-tree-open").click();

  await expect(page.locator('[data-object-type="image"]')).toBeVisible();
  await expect(page.locator('[data-object-type="image"] img')).toHaveAttribute("src", /^data:image\/png;base64,/);
});

test("pastes an image from the clipboard with Control+V as a linked local image object", async ({ page }) => {
  await page.goto("/");
  await installMarketplacePlugin(page, "Image");
  await grantClipboard(page);
  await importClipboardWorkspace(page);
  await setClipboardImage(page);

  await cellLocator(page, "B2").click();
  await pressControlShortcut(page, "V");

  await expect.poll(() => cellValue(page, "B2")).toBe("image");
  await expect
    .poll(async () => page.locator('[data-cell-address="B2"]').getAttribute("aria-label"))
    .toContain("embedded object");

  await page.getByRole("button", { name: "Browse files", exact: true }).click();
  const imageRow = page.locator(".files-tree-row[data-object-id]").filter({ hasText: "image" });
  await expect(imageRow).toBeVisible();
  await imageRow.locator(".files-tree-open").click();
  await expect(page.locator('[data-object-type="image"] img')).toHaveAttribute("src", /^data:image\/png;base64,/);
});

test("pastes TSV through the cell context menu and selects the pasted shape", async ({ page }) => {
  await page.goto("/");
  await grantClipboard(page);
  await importClipboardWorkspace(page);
  await setClipboard(page, "north\teast\nsouth\twest");

  await cellLocator(page, "D4").click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Commands for D4" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Paste", exact: true })).toBeEnabled();
  await menu.getByRole("menuitem", { name: "Paste", exact: true }).click();

  await expect.poll(() => cellValue(page, "D4")).toBe("north");
  await expect.poll(() => cellValue(page, "E4")).toBe("east");
  await expect.poll(() => cellValue(page, "D5")).toBe("south");
  await expect.poll(() => cellValue(page, "E5")).toBe("west");
  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "D4",
      status: "D4:E5",
    });
});

test("pasting a copied whole column preserves all 256 rows", async ({ page }) => {
  await page.goto("/");
  await grantClipboard(page);
  await importClipboardWorkspace(page);

  await page.getByRole("columnheader", { name: "Select column B" }).click();
  await page.keyboard.press("Control+C");
  await expect
    .poll(async () => (await page.evaluate(() => navigator.clipboard.readText())).split("\n").length)
    .toBe(256);

  await cellLocator(page, "D1").click();
  await page.keyboard.press("Control+V");

  await expect.poll(() => cellValue(page, "D1")).toBe("B1");
  await expect.poll(() => cellValue(page, "D2")).toBe("B2");
  await page.locator("[data-sheet-scroll]").evaluate((element) => element.scrollTo({ top: 7600, left: 0 }));
  await expect.poll(() => cellValue(page, "D256")).toBe("B256");
  await expect
    .poll(() => selectionSnapshot(page))
    .toMatchObject({
      active: "D1",
      editing: false,
      status: "D1:D256",
    });
});

test("double-click edits in the active cell instead of the formula bar", async ({ page }) => {
  await page.goto("/");
  await importClipboardWorkspace(page);

  const cell = cellLocator(page, "B2");
  await cell.dblclick();
  await expect(cell.locator(".cell-inline-editor")).toBeFocused();
  await expect(page.locator(".formula-editor")).not.toBeFocused();
});

test("square brackets can be entered in a tile and Ctrl+] opens its active-cell menu", async ({ page }) => {
  await page.goto("/");
  await importClipboardWorkspace(page);

  const cell = cellLocator(page, "C3");
  await cell.click();
  await cell.press("[");
  await cell.press("]");
  await expect.poll(() => cellValue(page, "C3")).toBe("");
  await cell.press("Enter");
  await page.locator(".formula-editor").press("[");
  await page.locator(".formula-editor").press("]");
  await expect(page.locator(".formula-editor")).toHaveValue("[]");
  await page.locator(".formula-editor").press("Escape");

  await cell.press("Control+]");
  const menu = page.getByRole("menu", { name: "Commands for C3" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "In: Tiles" })).toBeVisible();
});

test("keeps native text-entry paste behavior when the formula editor is active", async ({ page }) => {
  await page.goto("/");
  await grantClipboard(page);
  await importClipboardWorkspace(page);

  const editor = page.locator(".formula-editor");
  await editor.click();
  await editor.fill("existing value");
  await setClipboard(page, " pasted while editing");

  await editor.press("Control+V");

  await expect(editor).toHaveValue("existing value pasted while editing");
});

test("pastes a clipboard image while the formula editor is active into the selected cell", async ({ page }) => {
  await page.goto("/");
  await installMarketplacePlugin(page, "Image");
  await grantClipboard(page);
  await importClipboardWorkspace(page);
  await cellLocator(page, "B2").click();
  const editor = page.locator(".formula-editor");
  await editor.click();
  await setClipboardImage(page);

  await pressControlShortcut(page, "V");

  await expect.poll(() => cellValue(page, "B2")).toBe("image");
  await expect(page.locator('[data-cell-address="B2"]')).toHaveAttribute("aria-label", /embedded object/);
});

test("Delete clears a selected embedded cell without deleting the embedded object", async ({ page }) => {
  await page.goto("/");
  await importClipboardWorkspace(page);

  await cellLocator(page, "A1").click();
  await page.keyboard.press("Delete");
  await expect.poll(() => cellValue(page, "A1")).toBe("");

  await page.getByRole("button", { name: "Browse files", exact: true }).click();
  await expect(page.locator('.files-tree-row[data-object-id="notes"]')).toBeVisible();
});

test("clear contents is enabled only for used cells in a dark Paper theme", async ({ page }) => {
  await page.goto("/");
  await grantClipboard(page);
  await importClipboardWorkspace(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog", { name: "Settings" }).locator(".theme-card", { hasText: "GitHub Dark" }).click();
  await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Close settings" }).click();

  await cellLocator(page, "C6").click({ button: "right" });
  const blankMenu = page.getByRole("menu", { name: "Commands for C6" });
  await expect(blankMenu.getByRole("menuitem", { name: "Copy", exact: true })).toBeEnabled();
  await expect(blankMenu.getByRole("menuitem", { name: "Paste", exact: true })).toBeEnabled();
  await expect(blankMenu.getByRole("menuitem", { name: "Clear contents", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");

  await cellLocator(page, "B2").click({ button: "right" });
  const usedMenu = page.getByRole("menu", { name: "Commands for B2" });
  await expect(usedMenu.getByRole("menuitem", { name: "Clear contents", exact: true })).toBeEnabled();
  await usedMenu.getByRole("menuitem", { name: "Clear contents", exact: true }).click();
  await expect.poll(() => cellValue(page, "B2")).toBe("");
});

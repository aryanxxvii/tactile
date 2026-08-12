import { expect, test } from "@playwright/test";

const selectionTokens = {
  ink: "#192234",
  accent: "#75507a",
  accentSoft: "#f8d56b",
  selectionForeground: "#192234",
  selectionBackground: "#f8d56b",
};

function selectionWorkspace() {
  const now = new Date().toISOString();
  return {
    format: "tactile",
    version: 4,
    id: "text-selection-e2e",
    name: "Text selection",
    homeObjectId: "home",
    homePath: [],
    createdAt: now,
    updatedAt: now,
    objects: {
      home: {
        id: "home",
        type: "sheet",
        title: "Home",
        rows: 256,
        columns: 64,
        cells: {
          r1c1: {
            id: "r1c1",
            address: "A1",
            row: 0,
            column: 0,
            value: "Reading notes",
            formula: "",
            embed: {
              objectId: "notes",
              type: "markdown",
              linkId: "home-notes",
              relation: "containment",
            },
          },
          r2c2: { id: "r2c2", address: "B2", row: 1, column: 1, value: "B2", formula: "" },
          r2c3: { id: "r2c3", address: "C2", row: 1, column: 2, value: "C2", formula: "" },
          r3c2: { id: "r3c2", address: "B3", row: 2, column: 1, value: "B3", formula: "" },
          r3c3: { id: "r3c3", address: "C3", row: 2, column: 2, value: "C3", formula: "" },
        },
      },
      notes: {
        id: "notes",
        type: "markdown",
        title: "Reading notes",
        content: "A quiet document surface should use the active theme when its text is selected.",
        parent: {
          linkId: "home-notes",
          parentObjectId: "home",
          parentCellId: "r1c1",
          sourceAddress: "A1",
        },
      },
    },
    assets: {},
    themes: {
      selection: {
        id: "selection",
        name: "Selection test",
        tokens: selectionTokens,
      },
    },
    activeThemeId: "selection",
    settings: { reduceMotion: true, openSingleClick: "floating", openDoubleClick: "full" },
  };
}

async function importWorkspace(page) {
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "text-selection.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(selectionWorkspace())),
  });
  await expect(page.locator('[data-object-id="home"][data-cell-address="A1"]')).toBeVisible();
}

async function selectionStyle(page, selector) {
  return page.locator(selector).evaluate((element) => {
    const selection = getComputedStyle(element, "::selection");
    return {
      color: selection.color,
      background: selection.backgroundColor,
    };
  });
}

async function cellCenter(page, address) {
  const cell = page.locator(`[data-cell-address="${address}"]`).first();
  await expect(cell).toBeVisible();
  const box = await cell.boundingBox();
  expect(box).not.toBeNull();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("uses active theme selection tokens across controls and document text", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  await page.locator(".base-object-layer .name-box").first().click();
  const addressInput = page.locator(".base-object-layer .address-popover input");
  await expect(addressInput).toBeVisible();
  await expect
    .poll(() => selectionStyle(page, ".base-object-layer .address-popover input"))
    .toEqual({
      color: "rgb(25, 34, 52)",
      background: "rgb(248, 213, 107)",
    });
  await page.keyboard.press("Escape");

  await page.locator('[data-cell-address="A1"]').dblclick();
  const editor = page.locator(".markdown-editor");
  await expect(editor).toBeVisible();
  await expect
    .poll(() => selectionStyle(page, ".markdown-editor"))
    .toEqual({
      color: "rgb(25, 34, 52)",
      background: "rgb(248, 213, 107)",
    });
  await expect
    .poll(() => selectionStyle(page, ".spatial-layer .object-title-field input"))
    .toEqual({
      color: "rgb(25, 34, 52)",
      background: "rgb(248, 213, 107)",
    });

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".markdown-preview")).toBeVisible();
  await expect
    .poll(() => selectionStyle(page, ".markdown-preview"))
    .toEqual({
      color: "rgb(25, 34, 52)",
      background: "rgb(248, 213, 107)",
    });
});

test("keeps cell and range selection visuals distinct from text selection", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  const start = await cellCenter(page, "B2");
  const end = await cellCenter(page, "C3");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const active = document.querySelector('.sheet-cell[aria-selected="true"]');
        const range = document.querySelector(".sheet-cell.is-in-range");
        const outline = active ? getComputedStyle(active, "::after") : null;
        const selectedText = active ? getComputedStyle(active, "::selection") : null;
        return {
          activeAddress: active?.dataset.cellAddress || null,
          inRangeCount: document.querySelectorAll(".sheet-cell.is-in-range").length,
          outlineStyle: outline?.borderTopStyle || null,
          outlineColor: outline?.borderTopColor || null,
          rangeBackgroundImage: range ? getComputedStyle(range).backgroundImage : "none",
          selectedTextBackground: selectedText?.backgroundColor || null,
        };
      }),
    )
    .toEqual({
      activeAddress: "C3",
      inRangeCount: 3,
      outlineStyle: "solid",
      outlineColor: "rgb(117, 80, 122)",
      rangeBackgroundImage: expect.stringContaining("linear-gradient"),
      selectedTextBackground: "rgb(248, 213, 107)",
    });
});

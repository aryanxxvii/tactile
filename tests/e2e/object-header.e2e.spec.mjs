import { expect, test } from "@playwright/test";

import { createBlankWorkspace, createCellRecord, createSheetObject } from "../../src/model.js";

function objectHeaderWorkspace() {
  const workspace = createBlankWorkspace({ id: "object-header-e2e", name: "Object header" });
  const root = workspace.objects.home;
  root.title = "Home";
  const child = createSheetObject({ id: "child", title: "Child tiles" });
  root.cells.A1 = createCellRecord(0, 0, {
    value: child.title,
    embed: { objectId: child.id, type: child.type },
  });
  workspace.objects = { [root.id]: root, [child.id]: child };
  workspace.settings.reduceMotion = true;
  return workspace;
}

async function importWorkspace(page) {
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "object-header.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(objectHeaderWorkspace())),
  });
  await expect(page.locator('[data-object-id="home"][data-cell-address="A1"]')).toHaveClass(/is-embedded/);
}

async function openChild(page) {
  await page.locator('[data-object-id="home"][data-cell-address="A1"]').click();
  const layer = page.locator('[data-layer-object="child"]');
  await expect(layer).toHaveAttribute("data-spatial-phase", "floating");
  return layer;
}

async function headerSpacing(layer) {
  return layer.locator(".object-header").evaluate((header) => {
    const parent = header.querySelector(".object-header-parent");
    const glyph = header.querySelector(".object-type-glyph");
    const title = header.querySelector(".object-title-field input");
    const row = header.querySelector(".object-title-row");
    if (!parent || !glyph || !title || !row) throw new Error("The embedded object header is incomplete.");

    const parentBox = parent.getBoundingClientRect();
    const glyphBox = glyph.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    const titlePaddingLeft = Number.parseFloat(getComputedStyle(title).paddingLeft) || 0;

    return {
      parentToGlyph: glyphBox.left - parentBox.right,
      glyphToTitleText: titleBox.left + titlePaddingLeft - glyphBox.right,
      rowColumnGap: getComputedStyle(row).columnGap,
      parentMarginRight: getComputedStyle(parent).marginRight,
      titlePaddingLeft: getComputedStyle(title).paddingLeft,
    };
  });
}

test("balances Parent, icon, and title spacing across responsive header widths", async ({ page }) => {
  for (const width of [1440, 620, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await importWorkspace(page);

    const layer = await openChild(page);
    const spacing = await headerSpacing(layer);

    expect(spacing.rowColumnGap).toBe("4px");
    expect(spacing.parentMarginRight).toBe("8px");
    expect(spacing.titlePaddingLeft).toBe("8px");
    expect(Math.abs(spacing.parentToGlyph - spacing.glyphToTitleText)).toBeLessThanOrEqual(1);
    expect(spacing.parentToGlyph).toBeGreaterThan(8);
    expect(spacing.glyphToTitleText).toBeGreaterThan(8);

    const title = layer.getByRole("textbox", { name: "Object title" });
    await title.focus();
    await expect(title).toBeFocused();
    await title.fill(`Child tiles ${width}`);
    await expect(title).toHaveValue(`Child tiles ${width}`);

    await layer.getByRole("button", { name: "Parent", exact: true }).click();
    await expect(page.locator('[data-layer-object="child"]')).toHaveCount(0, { timeout: 4_000 });
  }
});

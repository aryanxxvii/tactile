import { expect, test } from "@playwright/test";

import { createBlankWorkspace, createCellRecord, createMarkdownObject } from "../../src/model.js";

function markdownWorkspace() {
  const workspace = createBlankWorkspace({ id: "markdown-object-e2e", name: "Markdown object" });
  const root = workspace.objects.home;
  root.title = "Home";
  const note = createMarkdownObject({
    id: "meeting-notes",
    title: "Meeting notes",
    content: "# Draft\n\nKeep this linked note local.",
    parent: {
      linkId: "home-meeting-notes",
      parentObjectId: root.id,
      parentCellId: "r1c1",
      sourceAddress: "A1",
    },
  });
  root.cells.A1 = createCellRecord(0, 0, {
    value: note.title,
    embed: {
      objectId: note.id,
      type: note.type,
      linkId: "home-meeting-notes",
      relation: "containment",
    },
  });
  workspace.objects = { [root.id]: root, [note.id]: note };
  workspace.settings.reduceMotion = true;
  return workspace;
}

async function importWorkspace(page) {
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "markdown-object.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(markdownWorkspace())),
  });
  await expect(page.locator('[data-object-id="home"][data-cell-address="A1"]')).toHaveClass(/is-embedded/);
}

async function openMarkdownObject(page) {
  const cell = page.locator('[data-object-id="home"][data-cell-address="A1"]');
  await cell.click();
  const layer = page.locator('[data-layer-object="meeting-notes"]');
  await expect(layer).toHaveAttribute("data-spatial-phase", "floating");
  await layer.getByRole("button", { name: "Expand embedded object" }).click();
  await expect(layer).toHaveAttribute("data-spatial-phase", "full");
  return layer;
}

async function openMarkdownFloating(page) {
  const cell = page.locator('[data-object-id="home"][data-cell-address="A1"]');
  await expect(cell).toHaveClass(/is-embedded/);
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  const layer = page.locator('[data-layer-object="meeting-notes"]');
  await expect(layer).toHaveAttribute("data-spatial-phase", "floating");
  return layer;
}

test("portaled Markdown color menus stay inside a floating child", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  const layer = await openMarkdownFloating(page);
  const surface = layer.locator(".markdown-object");

  await surface.getByRole("button", { name: "Text color" }).click();
  await expect(page.getByRole("menu", { name: "Text color" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Text color: Rust" }).click();
  await expect(layer).toHaveAttribute("data-spatial-phase", "floating");
  await expect(layer).toHaveCount(1);

  await surface.getByRole("button", { name: "Highlight color" }).click();
  await expect(page.getByRole("menu", { name: "Highlight color" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Highlight color: Yellow" }).click();
  await expect(layer).toHaveAttribute("data-spatial-phase", "floating");
  await expect(layer).toHaveCount(1);
});

test("Markdown surfaces hide file metadata while linked editing and navigation still work", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  const layer = await openMarkdownObject(page);
  const surface = layer.locator(".markdown-object");
  const editor = surface.getByRole("textbox", { name: "Meeting notes Markdown editor" });

  await expect(surface.getByText("Markdown · separate local file", { exact: true })).toHaveCount(0);
  await expect(surface.locator(".markdown-file-kind")).toHaveCount(0);
  await expect(surface.locator(".object-statusbar")).not.toContainText(".md");
  await expect(surface.getByRole("textbox", { name: "Object title" })).toHaveValue("Meeting notes");
  await expect(editor).toHaveValue("# Draft\n\nKeep this linked note local.");
  const placeholder = await editor.getAttribute("placeholder");
  expect(placeholder).not.toContain("saved as its own Markdown file");
  expect(placeholder).toMatch(/^# /);
  expect(placeholder?.trim().replace(/^#\s+/, "").split(/\s+/).length).toBeLessThanOrEqual(3);

  const toolbarGeometry = await surface.locator(".markdown-toolbar").evaluate((toolbar) => {
    const toolbarBox = toolbar.getBoundingClientRect();
    const firstGroup = toolbar.querySelector(".markdown-mode-switch");
    const lastGroup = toolbar.querySelector(".markdown-insert-group");
    const modeBox = firstGroup?.getBoundingClientRect();
    const lastBox = lastGroup?.getBoundingClientRect();
    const action = toolbar.querySelector(".markdown-style-group > button");
    const actionBox = action?.getBoundingClientRect();
    return {
      centered:
        modeBox && lastBox
          ? Math.abs((toolbarBox.left + toolbarBox.right) / 2 - (modeBox.left + lastBox.right) / 2) < 1
          : false,
      contained: Boolean(modeBox && lastBox && modeBox.left >= toolbarBox.left && lastBox.right <= toolbarBox.right),
      modeBorder: firstGroup ? getComputedStyle(firstGroup).borderStyle : "none",
      groupHeight: modeBox?.height || 0,
      actionHeight: actionBox?.height || 0,
      colorControlCount: toolbar.querySelectorAll(".markdown-color-control").length || 0,
      hasInnerRail: Boolean(toolbar.querySelector(".markdown-toolbar-inner")),
    };
  });
  expect(toolbarGeometry).toMatchObject({
    centered: true,
    contained: true,
    modeBorder: "solid",
    colorControlCount: 2,
    hasInnerRail: false,
  });
  expect(toolbarGeometry.groupHeight).toBeGreaterThan(24);
  expect(toolbarGeometry.groupHeight).toBeLessThan(29);
  expect(toolbarGeometry.actionHeight).toBeGreaterThan(21);
  expect(toolbarGeometry.actionHeight).toBeLessThan(23);
  await expect(surface.locator('[data-tooltip="Heading"]')).toHaveCount(0);
  await expect(surface.locator('[data-tooltip="Subheading"]')).toHaveCount(0);

  await surface.locator(".workspace-menu-trigger").click();
  const workspaceMenu = surface.locator(".workspace-menu");
  await expect(workspaceMenu).toBeVisible();
  await expect(
    workspaceMenu.getByText("Sheets stay CSV. Text and media stay separate files.", { exact: true }),
  ).toHaveCount(0);
  await expect(workspaceMenu).toHaveCSS("animation-name", "tactile-menu-in");

  await editor.fill("# Updated\n\nThe linked Markdown object still edits normally.");
  await surface.getByRole("button", { name: "Preview" }).click();
  await expect(surface.locator(".markdown-preview")).toContainText("Updated");
  await expect(surface.getByText("Markdown · separate local file", { exact: true })).toHaveCount(0);

  await surface.getByRole("button", { name: "Parent", exact: true }).click();
  await expect(page.locator('[data-layer-object="meeting-notes"]')).toHaveCount(0, { timeout: 4_000 });
  await expect(page.locator('[data-object-id="home"][data-cell-address="A1"]')).toHaveClass(/is-embedded/);

  const reopened = await openMarkdownObject(page);
  const reopenedSurface = reopened.locator(".markdown-object");
  await expect(reopenedSurface.getByRole("textbox", { name: "Meeting notes Markdown editor" })).toHaveValue(
    "# Updated\n\nThe linked Markdown object still edits normally.",
  );
  await expect(page).toHaveURL(/route=home-meeting-notes/);
});

test("continues Markdown lists intelligently when Enter is pressed", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  const layer = await openMarkdownObject(page);
  const editor = layer.getByRole("textbox", { name: "Meeting notes Markdown editor" });
  const cases = [
    ["- [ ] First task", "- [ ] First task\n- [ ] "],
    ["- [x] Completed task", "- [x] Completed task\n- [ ] "],
    ["* First bullet", "* First bullet\n* "],
    ["1. First item", "1. First item\n2. "],
    ["3) First item", "3) First item\n4) "],
    ["> Quoted line", "> Quoted line\n> "],
  ];

  for (const [initial, expected] of cases) {
    await editor.fill(initial);
    await editor.evaluate((element) => element.setSelectionRange(element.value.length, element.value.length));
    await editor.press("Enter");
    await expect(editor).toHaveValue(expected);
  }

  await editor.fill("- [ ] First task\n- [ ] ");
  await editor.evaluate((element) => element.setSelectionRange(element.value.length, element.value.length));
  await editor.press("Enter");
  await expect(editor).toHaveValue("- [ ] First task\n\n");
});

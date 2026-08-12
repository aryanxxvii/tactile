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

test("Markdown surfaces hide file metadata while linked editing and navigation still work", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  const layer = await openMarkdownObject(page);
  const surface = layer.locator(".markdown-object");
  const editor = surface.getByRole("textbox", { name: "Meeting notes Markdown editor" });

  await expect(surface.getByText("Markdown · separate local file", { exact: true })).toHaveCount(0);
  await expect(surface.locator(".markdown-file-kind")).toHaveCount(0);
  await expect(surface.getByRole("textbox", { name: "Object title" })).toHaveValue("Meeting notes");
  await expect(editor).toHaveValue("# Draft\n\nKeep this linked note local.");

  const toolbarGeometry = await surface.locator(".markdown-toolbar").evaluate((toolbar) => {
    const inner = toolbar.querySelector(".markdown-toolbar-inner");
    const toolbarBox = toolbar.getBoundingClientRect();
    const innerBox = inner?.getBoundingClientRect();
    return {
      centered: innerBox
        ? Math.abs((toolbarBox.left + toolbarBox.right) / 2 - (innerBox.left + innerBox.right) / 2) < 1
        : false,
      contained: Boolean(innerBox && innerBox.left >= toolbarBox.left && innerBox.right <= toolbarBox.right),
      modeBorder: inner ? getComputedStyle(inner.querySelector(".markdown-mode-switch")).borderStyle : "none",
      colorControlCount: inner?.querySelectorAll(".markdown-color-control").length || 0,
    };
  });
  expect(toolbarGeometry).toMatchObject({ centered: true, contained: true, modeBorder: "solid", colorControlCount: 2 });

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

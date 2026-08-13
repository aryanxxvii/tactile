import { expect, test } from "@playwright/test";

const cellLocator = (page, address) => page.locator(`[data-cell-address="${address}"]`).first();

function reparentWorkspace() {
  const now = new Date().toISOString();
  return {
    format: "tactile",
    version: 4,
    id: "reparent-e2e",
    name: "Reparenting",
    homeObjectId: "home",
    homePath: [],
    createdAt: now,
    updatedAt: now,
    objects: {
      home: {
        id: "home",
        type: "sheet",
        title: "Home",
        parent: null,
        rows: 256,
        columns: 64,
        cells: {
          r1c1: {
            id: "r1c1",
            address: "A1",
            row: 0,
            column: 0,
            value: "Child",
            formula: "",
            embed: {
              objectId: "child",
              type: "sheet",
              linkId: "home-child",
              relation: "containment",
            },
          },
        },
      },
      destination: {
        id: "destination",
        type: "sheet",
        title: "Destination",
        parent: null,
        rows: 256,
        columns: 64,
        cells: {},
      },
      child: {
        id: "child",
        type: "sheet",
        title: "Child",
        parent: {
          linkId: "home-child",
          parentObjectId: "home",
          parentCellId: "r1c1",
          sourceAddress: "A1",
        },
        rows: 256,
        columns: 64,
        cells: {
          r1c1: {
            id: "r1c1",
            address: "A1",
            row: 0,
            column: 0,
            value: "Nested leaf",
            formula: "",
            embed: {
              objectId: "leaf",
              type: "markdown",
              linkId: "child-leaf",
              relation: "containment",
            },
          },
        },
      },
      leaf: {
        id: "leaf",
        type: "markdown",
        title: "Nested leaf",
        parent: {
          linkId: "child-leaf",
          parentObjectId: "child",
          parentCellId: "r1c1",
          sourceAddress: "A1",
        },
        content: "The descendant remains attached.",
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

async function importWorkspace(page) {
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "reparent.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(reparentWorkspace())),
  });
  await expect(page.locator('[data-object-id="home"][data-cell-address="A1"]')).toBeVisible();
}

async function cellValue(page, address) {
  return (await cellLocator(page, address).locator(".cell-value").textContent()).trim();
}

test("dragging an embedded cell to another sheet position preserves the child route and descendants", async ({
  page,
}) => {
  await page.goto("/");
  await importWorkspace(page);

  await cellLocator(page, "A1").dragTo(cellLocator(page, "B1"));
  await expect.poll(() => cellValue(page, "A1")).toBe("");
  await expect.poll(() => cellValue(page, "B1")).toBe("Child");

  await cellLocator(page, "B1").dblclick();
  await expect.poll(() => new URL(page.url()).searchParams.get("in")).toBe("child");
  await expect.poll(() => new URL(page.url()).searchParams.get("cell")).toBe("B1");
  await expect(page.getByRole("region", { name: "Child window" }).getByLabel("Object title")).toHaveValue("Child");

  await page.getByRole("button", { name: "Parent", exact: true }).click();
  await expect(page.locator(".object-title-field input").first()).toHaveValue("Home");
  await expect(cellLocator(page, "B1")).toHaveAttribute("aria-selected", "true");
});

test("dragging a Files object row onto another object creates a new hierarchy location", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);
  await page.getByRole("button", { name: "Browse files" }).click();

  const source = page.locator('.files-tree-row[data-object-id="child"] .files-tree-open');
  const destination = page.locator('.files-tree-row[data-object-id="destination"]');
  await expect(source).toBeVisible();
  await expect(destination).toBeVisible();
  await source.dragTo(destination);

  await expect.poll(() => cellValue(page, "A1")).toBe("");
  await expect(page.locator(".app-notice")).toContainText("Child moved to Destination A1");

  await destination.locator('.files-tree-disclosure[aria-label="Expand Destination"]').click();
  await expect(page.locator('.files-tree-row[data-object-id="child"]')).toBeVisible();
  await page.locator('.files-tree-row[data-object-id="child"] .files-tree-open').click();
  await expect.poll(() => new URL(page.url()).searchParams.get("root")).toBe("destination");
  await expect.poll(() => new URL(page.url()).searchParams.get("cell")).toBe("A1");
  await expect(page.getByRole("region", { name: "Child window" }).getByLabel("Object title")).toHaveValue("Child");

  await page.getByRole("button", { name: "Parent", exact: true }).click();
  await expect(page.locator(".object-title-field input").first()).toHaveValue("Destination");
});

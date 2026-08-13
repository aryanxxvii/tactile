import { expect, test } from "@playwright/test";

function filesWorkspace() {
  const now = new Date().toISOString();
  return {
    format: "tactile",
    version: 4,
    id: "files-view-e2e",
    name: "Files view",
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
            value: "Child sheet",
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
      child: {
        id: "child",
        type: "sheet",
        title: "Child sheet",
        parent: {
          linkId: "home-child",
          parentObjectId: "home",
          parentCellId: "r1c1",
          sourceAddress: "A1",
        },
        rows: 256,
        columns: 64,
        cells: {},
      },
      standalone: {
        id: "standalone",
        type: "markdown",
        title: "Loose notes",
        content: "Available from Files even when it is not Home.",
      },
    },
    assets: {},
    themes: {},
    activeThemeId: "paper-public",
    settings: { reduceMotion: true, openSingleClick: "floating", openDoubleClick: "full" },
  };
}

function deepFilesWorkspace() {
  const now = new Date().toISOString();
  const objects = {};
  let parent = {
    id: "home",
    type: "sheet",
    title: "Home",
    rows: 256,
    columns: 64,
    cells: {},
  };
  objects[parent.id] = parent;

  for (let index = 1; index <= 5; index += 1) {
    const childId = `deep-${index}`;
    const linkId = `${parent.id}-${childId}`;
    const child = {
      id: childId,
      type: "sheet",
      title: index === 5 ? "Deep target" : `Ancestor ${index}`,
      parent: {
        linkId,
        parentObjectId: parent.id,
        parentCellId: `cell-${linkId}`,
        sourceAddress: "A1",
      },
      rows: 256,
      columns: 64,
      cells: {},
    };
    parent.cells.A1 = {
      id: `cell-${linkId}`,
      address: "A1",
      row: 0,
      column: 0,
      value: child.title,
      formula: "",
      embed: {
        objectId: child.id,
        type: child.type,
        linkId,
        relation: "containment",
      },
    };
    objects[parent.id] = parent;
    objects[child.id] = child;
    parent = child;
  }

  return {
    format: "tactile",
    version: 4,
    id: "files-deep-route-e2e",
    name: "Files deep route",
    homeObjectId: "home",
    homePath: [],
    createdAt: now,
    updatedAt: now,
    objects,
    assets: {},
    themes: {},
    activeThemeId: "paper-public",
    settings: { reduceMotion: true, openSingleClick: "floating", openDoubleClick: "full" },
  };
}

async function importWorkspace(page, workspace = filesWorkspace()) {
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "files-view.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(workspace)),
  });
  await expect(page.locator('[data-object-id="home"][data-cell-address="A1"]')).toBeVisible();
}

test("Files drawer searches and directly opens a nested object", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  const filesButton = page.getByRole("button", { name: "Browse files", exact: true });
  await expect(filesButton).toHaveCount(1);
  await page.keyboard.press("Control+P");
  await expect(page.getByRole("dialog", { name: "Files" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search files" })).toBeFocused();

  await page.getByRole("textbox", { name: "Search files" }).fill("Child sheet");
  await expect(page.getByRole("option").first()).toContainText("Child sheet");
  await page.getByRole("textbox", { name: "Search files" }).press("Enter");

  await expect(page.getByRole("dialog", { name: "Files" })).toHaveCount(0);
  await expect(page.locator(".spatial-layer").getByRole("textbox", { name: "Object title" })).toHaveValue(
    "Child sheet",
  );
  await expect(page.locator(".app-dock-path")).toContainText("Home");
  await expect(page.locator(".app-dock-path")).toContainText("Child sheet");
  await expect(page).toHaveURL(/root=home/);
  await expect(page).toHaveURL(/route=home-child/);
});

test("Files opens deep routes directly without replaying every ancestor transition", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page, deepFilesWorkspace());

  const filesButton = page.getByRole("button", { name: "Browse files", exact: true });
  await filesButton.click();
  const search = page.getByRole("textbox", { name: "Search files" });
  await search.fill("Deep target");
  await expect(page.getByRole("option").first()).toContainText("Deep target");
  await search.press("Enter");

  await expect(page.locator(".spatial-layer .object-header-parent")).toHaveCount(1);
  await expect(page.locator(".spatial-layer").getByRole("textbox", { name: "Object title" })).toHaveValue(
    "Deep target",
  );
  await expect(page.locator(".workspace-shell")).toHaveAttribute("data-logical-layer-count", "6");
  await expect(page.locator(".workspace-shell")).toHaveAttribute("data-rendered-layer-count", "2");
  await expect(page.locator('[data-spatial-phase="origin"], [data-spatial-phase="floating"]')).toHaveCount(0);
  await expect(page.locator(".spatial-layer")).toHaveAttribute("data-spatial-phase", "full");
  expect(
    await page.evaluate(() => {
      const state = window.history.state;
      return {
        root: state?.tactileRootObjectId,
        stack: state?.tactileStack?.map(({ objectId, linkId, sourceObjectId, sourceAddress, mode }) => ({
          objectId,
          linkId,
          sourceObjectId,
          sourceAddress,
          mode,
        })),
        dockPath: [...document.querySelectorAll(".app-dock-path .app-dock-path-button")].map(
          (button) => button.dataset.pathObjectId,
        ),
        route: new URL(window.location.href).searchParams.get("route"),
      };
    }),
  ).toEqual({
    root: "home",
    stack: [
      { objectId: "deep-1", linkId: "home-deep-1", sourceObjectId: "home", sourceAddress: "A1", mode: "full" },
      { objectId: "deep-2", linkId: "deep-1-deep-2", sourceObjectId: "deep-1", sourceAddress: "A1", mode: "full" },
      { objectId: "deep-3", linkId: "deep-2-deep-3", sourceObjectId: "deep-2", sourceAddress: "A1", mode: "full" },
      { objectId: "deep-4", linkId: "deep-3-deep-4", sourceObjectId: "deep-3", sourceAddress: "A1", mode: "full" },
      { objectId: "deep-5", linkId: "deep-4-deep-5", sourceObjectId: "deep-4", sourceAddress: "A1", mode: "full" },
    ],
    dockPath: ["home", "deep-1", "ellipsis", "deep-4", "deep-5"],
    route: "home-deep-1,deep-1-deep-2,deep-2-deep-3,deep-3-deep-4,deep-4-deep-5",
  });

  await filesButton.click();
  await search.fill("Ancestor 2");
  await expect(page.getByRole("option").first()).toContainText("Ancestor 2");
  await search.press("Enter");

  await expect(page.locator(".spatial-layer").getByRole("textbox", { name: "Object title" })).toHaveValue("Ancestor 2");
  await expect(page.locator(".workspace-shell")).toHaveAttribute("data-logical-layer-count", "3");
  await expect(page.locator('[data-spatial-phase="origin"], [data-spatial-phase="floating"]')).toHaveCount(0);
  await expect(page.locator(".spatial-layer")).toHaveAttribute("data-spatial-phase", "full");
  expect(
    await page.evaluate(() => {
      const state = window.history.state;
      return {
        stack: state?.tactileStack?.map(({ objectId, linkId, sourceObjectId, sourceAddress, mode }) => ({
          objectId,
          linkId,
          sourceObjectId,
          sourceAddress,
          mode,
        })),
        dockPath: [...document.querySelectorAll(".app-dock-path .app-dock-path-button")].map(
          (button) => button.dataset.pathObjectId,
        ),
        route: new URL(window.location.href).searchParams.get("route"),
      };
    }),
  ).toEqual({
    stack: [
      { objectId: "deep-1", linkId: "home-deep-1", sourceObjectId: "home", sourceAddress: "A1", mode: "full" },
      { objectId: "deep-2", linkId: "deep-1-deep-2", sourceObjectId: "deep-1", sourceAddress: "A1", mode: "full" },
    ],
    dockPath: ["home", "deep-1", "deep-2"],
    route: "home-deep-1,deep-1-deep-2",
  });

  // Direct Files opening settles at the leaf; ordinary embedded-cell opening
  // must still use the staged In & Out floating state.
  await page.locator('[data-object-id="deep-2"][data-cell-address="A1"]').click();
  const interactiveChild = page.locator('[data-layer-object="deep-3"]');
  await expect(interactiveChild).toHaveAttribute("data-spatial-phase", "floating", { timeout: 4_000 });
  await expect(interactiveChild.locator(".object-header-parent")).toHaveCount(1);
  expect(await page.evaluate(() => window.history.state?.tactileStack?.at(-1)?.mode)).toBe("floating");
});

test("Files closes with Escape without changing the active object", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);
  await page.getByRole("button", { name: "Browse files", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Files" })).toBeVisible();
  await page.getByRole("textbox", { name: "Search files" }).press("Escape");
  await expect(page.getByRole("dialog", { name: "Files" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Object title" }).first()).toHaveValue("Home");
});

test("clicking the Files dock button again closes the temporary panel", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);
  const filesButton = page.getByRole("button", { name: "Browse files", exact: true });
  await filesButton.click();
  await expect(page.getByRole("dialog", { name: "Files" })).toBeVisible();
  await filesButton.click();
  await expect(page.getByRole("dialog", { name: "Files" })).toHaveCount(0);
});

test("bottom-bar controls keep rounded corners and the Files hint uses readable text", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);

  const filesButton = page.getByRole("button", { name: "Browse files", exact: true });
  await expect(filesButton).toHaveAttribute("data-tooltip", "Browse files · Ctrl+P");
  await filesButton.hover();
  await expect(page.getByRole("tooltip", { name: "Browse files · Ctrl+P" })).toBeVisible();

  const dockControlRadii = await page
    .locator(".app-dock")
    .evaluate((dock) =>
      [...dock.querySelectorAll(":scope > button, .app-dock-history button")].map(
        (control) => getComputedStyle(control).borderRadius,
      ),
    );
  expect(dockControlRadii.length).toBeGreaterThan(0);
  expect(new Set(dockControlRadii)).toEqual(new Set(["5px"]));

  const separatorState = await page.locator(".app-dock").evaluate((dock) => {
    const settings = dock.querySelector(".app-dock-settings");
    const brand = dock.querySelector(".app-dock-brand");
    const history = dock.querySelector(".app-dock-history");
    const overflow = dock.querySelector(".app-dock-path-overflow > .app-dock-path-button");
    const brandSeparator = brand ? getComputedStyle(brand, "::after") : null;
    const historySeparator = history ? getComputedStyle(history, "::before") : null;
    const settingsSeparator = settings ? getComputedStyle(settings, "::before") : null;
    const read = (element) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        borderLeftWidth: style.borderLeftWidth,
        borderRadius: style.borderRadius,
      };
    };
    return {
      settings: read(settings),
      brandSeparator: brandSeparator
        ? {
            content: brandSeparator.content,
            borderRadius: brandSeparator.borderRadius,
            borderLeftStyle: brandSeparator.borderLeftStyle,
            width: brandSeparator.width,
          }
        : null,
      historySeparator: historySeparator
        ? {
            content: historySeparator.content,
            borderRadius: historySeparator.borderRadius,
            borderLeftStyle: historySeparator.borderLeftStyle,
            width: historySeparator.width,
          }
        : null,
      settingsSeparator: settingsSeparator
        ? {
            content: settingsSeparator.content,
            borderRadius: settingsSeparator.borderRadius,
            borderLeftStyle: settingsSeparator.borderLeftStyle,
            width: settingsSeparator.width,
            height: settingsSeparator.height,
          }
        : null,
      overflow: read(overflow),
    };
  });
  expect(separatorState.settings).toMatchObject({ borderLeftWidth: "0px", borderRadius: "5px" });
  expect(separatorState.brandSeparator).toMatchObject({
    content: '""',
    borderRadius: "0px",
    borderLeftStyle: "solid",
    width: "0px",
  });
  expect(separatorState.historySeparator).toMatchObject({
    content: '""',
    borderRadius: "0px",
    borderLeftStyle: "solid",
    width: "0px",
  });
  expect(separatorState.settingsSeparator).toMatchObject({
    content: '""',
    borderRadius: "0px",
    borderLeftStyle: "solid",
    width: "0px",
  });
  if (separatorState.overflow) {
    expect(separatorState.overflow).toMatchObject({ borderLeftWidth: "0px", borderRadius: "0px" });
  }
});

test("hover tips render outside clipped panels", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);
  await page.getByRole("button", { name: "Browse files", exact: true }).click();
  const closeButton = page.getByRole("dialog", { name: "Files" }).getByRole("button", { name: "Close Files" });
  await closeButton.hover();
  const tooltip = page.getByRole("tooltip", { name: "Close Files · Esc" });
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveCSS("position", "absolute");
  expect(await tooltip.evaluate((node) => node.parentElement?.dataset.tooltipLayer)).toBe("true");
  expect(await tooltip.evaluate((node) => getComputedStyle(node.parentElement).zIndex)).toBe("2147483647");
});

test("Files uses a custom context menu for workspace object actions", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);
  await page.getByRole("button", { name: "Browse files", exact: true }).click();

  const homeRow = page.locator('.files-tree-row[data-object-id="home"]');
  const childRow = page.locator('.files-tree-row[data-object-id="child"]');
  await childRow.click({ button: "right" });
  const childMenu = page.getByRole("menu", { name: "Actions for Child sheet" });
  await expect(childMenu).toBeVisible();
  await expect(childMenu.getByRole("menuitem", { name: "Open", exact: true })).toBeVisible();
  await expect(childMenu.getByRole("menuitem", { name: "Set as start", exact: true })).toBeVisible();
  await expect(childMenu.getByRole("menuitem", { name: "Open parent", exact: true })).toBeVisible();
  await expect(childMenu.getByRole("menuitem", { name: "Customize icon", exact: true })).toBeVisible();
  await expect(childMenu.getByRole("menuitem", { name: "Copy path", exact: true })).toBeVisible();

  await childMenu.getByRole("menuitem", { name: "Set as start", exact: true }).click();
  await expect(childRow.locator(".files-home-icon")).toBeVisible();
  await expect(page.locator('.files-tree-row[data-object-id="home"] .files-home-icon')).toHaveCount(0);

  await homeRow.click({ button: "right" });
  const homeMenu = page.getByRole("menu", { name: "Actions for Home" });
  await expect(homeMenu.getByRole("menuitem", { name: "Collapse children", exact: true })).toBeVisible();
  await homeMenu.getByRole("menuitem", { name: "Collapse children", exact: true }).click();
  await expect(childRow).toHaveCount(0);

  await homeRow.click({ button: "right" });
  await page
    .getByRole("menu", { name: "Actions for Home" })
    .getByRole("menuitem", { name: "Expand children", exact: true })
    .click();
  await expect(childRow).toBeVisible();

  await childRow.focus();
  await childRow.press("Shift+F10");
  await expect(page.getByRole("menu", { name: "Actions for Child sheet" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Actions for Child sheet" })).toHaveCount(0);

  await childRow.click({ button: "right" });
  await page
    .getByRole("menu", { name: "Actions for Child sheet" })
    .getByRole("menuitem", { name: "Open", exact: true })
    .click();
  await expect(page.locator(".spatial-layer").getByRole("textbox", { name: "Object title" })).toHaveValue(
    "Child sheet",
  );
  await expect(page).toHaveURL(/route=home-child/);
});

test("Files lets users recolor a default icon or replace it with emoji", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);
  await page.getByRole("button", { name: "Browse files", exact: true }).click();

  const homeRow = page.locator('.files-tree-row[data-object-id="home"]');
  const iconButton = homeRow.locator(".files-tree-icon-button");
  await iconButton.hover();
  await expect(iconButton).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await iconButton.click();
  await expect(page.getByRole("dialog", { name: "Customize icon for Home" })).toHaveCount(0);

  await page.getByRole("button", { name: "Browse files", exact: true }).click();
  const reopenedHomeRow = page.locator('.files-tree-row[data-object-id="home"]');

  const homeRowBox = await reopenedHomeRow.boundingBox();
  const homeCustomizeBox = await reopenedHomeRow.locator(".files-tree-customize").boundingBox();
  if (!homeRowBox || !homeCustomizeBox) throw new Error("Home Files row is not measurable");
  expect(homeCustomizeBox.y + homeCustomizeBox.height / 2).toBeCloseTo(homeRowBox.y + homeRowBox.height / 2, 1);
  await reopenedHomeRow.locator(".files-tree-customize").click();
  const iconDialog = page.getByRole("dialog", { name: "Customize icon for Home" });
  await expect(iconDialog).toBeVisible();
  await iconDialog.getByRole("option", { name: "Blue" }).click();
  await expect(reopenedHomeRow.locator(".files-tree-icon")).toHaveCSS("color", "rgb(65, 107, 134)");

  await iconDialog.getByRole("button", { name: "Emoji", exact: true }).click();
  await iconDialog.getByLabel("Custom emoji").fill("🧠");
  await iconDialog.getByRole("button", { name: "Use", exact: true }).click();
  await expect(homeRow.locator(".files-tree-icon.object-glyph-emoji")).toHaveText("🧠");
});

test("embedded sheet icons use the linked object's Files color", async ({ page }) => {
  await page.goto("/");
  const workspace = filesWorkspace();
  workspace.objects.child.iconColor = "amber";
  await importWorkspace(page, workspace);

  await expect(page.locator('.sheet-cell[data-cell-address="A1"] .embed-icon')).toHaveCSS("color", "rgb(169, 121, 45)");
});

test("Files applies hover and focus feedback to the full nested row while keeping palette actions intact", async ({
  page,
}) => {
  await page.goto("/");
  await importWorkspace(page);
  await page.getByRole("button", { name: "Browse files", exact: true }).click();

  const homeRow = page.locator('.files-tree-row[data-object-id="home"]');
  const childRow = page.locator('.files-tree-row[data-object-id="child"]');
  const childRowBefore = await childRow.boundingBox();
  if (!childRowBefore) throw new Error("Child Files row is not measurable");

  const defaultRowStyle = await childRow.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow };
  });

  await childRow.locator(".files-tree-open").hover();
  const titleHoverStyle = await childRow.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow };
  });
  expect(titleHoverStyle.backgroundColor).not.toBe(defaultRowStyle.backgroundColor);
  expect(titleHoverStyle.boxShadow).not.toBe("none");

  const iconButton = childRow.locator(".files-tree-icon-button");
  await iconButton.hover();
  const iconHoverStyle = await childRow.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow };
  });
  expect(iconHoverStyle).toEqual(titleHoverStyle);
  await expect(iconButton).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(iconButton).toHaveCSS("transform", "none");

  await childRow.focus();
  const focusedRowStyle = await childRow.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow };
  });
  expect(focusedRowStyle).toEqual(titleHoverStyle);

  const childRowAfter = await childRow.boundingBox();
  if (!childRowAfter) throw new Error("Child Files row disappeared after focus");
  expect(childRowAfter.x).toBeCloseTo(childRowBefore.x, 1);
  expect(childRowAfter.y).toBeCloseTo(childRowBefore.y, 1);
  expect(childRowAfter.width).toBeCloseTo(childRowBefore.width, 1);
  expect(childRowAfter.height).toBeCloseTo(childRowBefore.height, 1);
  expect(await homeRow.locator(".files-tree-customize").count()).toBe(1);

  await childRow.locator(".files-tree-customize").click();
  await expect(page.getByRole("dialog", { name: "Customize icon for Child sheet" })).toBeVisible();
});

test("Files rows stay separated and show the start marker before the type label", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);
  await page.getByRole("button", { name: "Browse files", exact: true }).click();

  const childRow = page.locator('.files-tree-row[data-object-id="child"]');
  const rowGeometry = await page.locator(".files-tree").evaluate((tree) => {
    const rows = [...tree.querySelectorAll(":scope > .files-tree-row")];
    return rows.map((row) => {
      const box = row.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    });
  });
  expect(rowGeometry.length).toBeGreaterThanOrEqual(2);
  expect(rowGeometry[1].top - rowGeometry[0].bottom).toBeGreaterThanOrEqual(3);

  await childRow.click({ button: "right" });
  await page
    .getByRole("menu", { name: "Actions for Child sheet" })
    .getByRole("menuitem", { name: "Set as start", exact: true })
    .click();
  await expect(childRow.locator(".files-home-icon")).toBeVisible();

  const order = await childRow
    .locator(".files-tree-open > *")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("class") || ""));
  const homeIconIndex = order.findIndex((className) => className.includes("files-home-icon"));
  const kindIndex = order.findIndex((className) => className.includes("files-tree-kind"));
  expect(homeIconIndex).toBeGreaterThan(-1);
  expect(homeIconIndex).toBeLessThan(kindIndex);
  await expect(childRow.locator(".files-tree-kind")).toHaveText("Tiles");
});

test("Files can stay pinned as a sidebar while the workspace remains usable", async ({ page }) => {
  await page.goto("/");
  await importWorkspace(page);
  await page.getByRole("button", { name: "Browse files", exact: true }).click();

  const drawer = page.getByRole("dialog", { name: "Files" });
  const pinButton = drawer.getByRole("button", { name: "Pin Files sidebar" });
  await pinButton.hover();
  await expect(page.getByRole("tooltip", { name: "Pin Files as sidebar" })).toBeVisible();
  const tooltipGeometry = await page.evaluate(() => {
    const tooltip = document.querySelector('[role="tooltip"]');
    const tooltipBox = tooltip?.getBoundingClientRect();
    return {
      parent: tooltip?.parentElement?.dataset.tooltipLayer || null,
      zIndex: tooltip ? getComputedStyle(tooltip.parentElement).zIndex : null,
      staysInsideViewport: Boolean(
        tooltipBox &&
          tooltipBox.left >= 0 &&
          tooltipBox.right <= window.innerWidth &&
          tooltipBox.top >= 0 &&
          tooltipBox.bottom <= window.innerHeight,
      ),
    };
  });
  expect(tooltipGeometry).toMatchObject({ parent: "true", zIndex: "2147483647", staysInsideViewport: true });
  await pinButton.click();

  await expect(page.locator(".files-layer.is-pinned")).toBeVisible();
  await expect(page.locator(".files-scrim")).toHaveCSS("opacity", "0");
  await expect(page.locator(".files-scrim")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".tactile-app")).toHaveAttribute("data-files-pinned", "true");
  await expect(page.locator(".workspace-shell")).toHaveCSS("left", "360px");
  await expect(page.getByRole("complementary", { name: "Files" })).toBeVisible();

  const filesDockButton = page.getByRole("button", { name: "Browse files", exact: true });
  await filesDockButton.click();
  await expect(page.getByRole("complementary", { name: "Files" })).toHaveCount(0);
  await expect(page.locator(".workspace-shell")).toHaveCSS("left", "0px");
  await filesDockButton.click();
  await expect(page.getByRole("complementary", { name: "Files" })).toBeVisible();
  await expect(page.locator(".workspace-shell")).toHaveCSS("left", "360px");

  await page.getByRole("textbox", { name: "Search files" }).fill("Child sheet");
  await page.getByRole("textbox", { name: "Search files" }).press("Enter");
  await expect(page.getByRole("complementary", { name: "Files" })).toBeVisible();
  await expect(page).toHaveURL(/route=home-child/);
  await expect(page.locator(".spatial-layer")).toHaveAttribute("data-spatial-phase", "full", { timeout: 4_000 });

  const pinnedGeometry = await page.evaluate(() => {
    const read = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { left: rect.left, right: rect.right, width: rect.width } : null;
    };
    return {
      viewportWidth: window.innerWidth,
      sidebar: read(".files-panel"),
      workspace: read(".workspace-shell"),
      layer: read(".spatial-layer"),
      window: read(".spatial-layer .object-window"),
    };
  });
  expect(pinnedGeometry.sidebar).not.toBeNull();
  expect(pinnedGeometry.workspace.left).toBeCloseTo(pinnedGeometry.sidebar.width, 1);
  expect(pinnedGeometry.layer.left).toBeCloseTo(pinnedGeometry.sidebar.width, 1);
  expect(pinnedGeometry.window.left).toBeCloseTo(pinnedGeometry.sidebar.width, 1);
  expect(pinnedGeometry.window.width).toBeCloseTo(pinnedGeometry.viewportWidth - pinnedGeometry.sidebar.width, 1);

  const resizeHandle = page.getByRole("separator", { name: "Resize Files sidebar" });
  const widthBeforeResize = pinnedGeometry.sidebar.width;
  await resizeHandle.focus();
  await resizeHandle.press("ArrowRight");
  await expect(resizeHandle).toHaveAttribute("aria-valuenow", String(Math.round(widthBeforeResize) + 16));
  const widthAfterKeyboardResize = await page
    .locator(".files-panel")
    .evaluate((node) => node.getBoundingClientRect().width);
  expect(widthAfterKeyboardResize).toBeGreaterThan(widthBeforeResize);

  const resizeBox = await resizeHandle.boundingBox();
  if (!resizeBox) throw new Error("Files resize handle is not measurable");
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + 180);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 40, resizeBox.y + 180);
  await page.mouse.up();
  const widthAfterPointerResize = await page
    .locator(".files-panel")
    .evaluate((node) => node.getBoundingClientRect().width);
  expect(widthAfterPointerResize).toBeGreaterThan(widthAfterKeyboardResize);
  const persistedWidth = Math.round(widthAfterPointerResize);

  await page.reload();
  await expect(page.getByRole("complementary", { name: "Files" })).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize Files sidebar" })).toHaveAttribute(
    "aria-valuenow",
    String(persistedWidth),
  );

  await page.getByRole("button", { name: "Unpin Files sidebar" }).click();
  await expect(page.getByRole("dialog", { name: "Files" })).toBeVisible();
  await expect(page.locator('[data-files-pinned="true"]')).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search files" }).press("Escape");
  await expect(page.getByRole("dialog", { name: "Files" })).toHaveCount(0);
});

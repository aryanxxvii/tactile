import { expect, test } from "@playwright/test";

test("bottom dock separators keep equal control spacing and one thin square rule", async ({ page }) => {
  await page.goto("/");

  const dock = page.locator(".app-dock");
  await expect(dock).toBeVisible();

  const state = await dock.evaluate((element) => {
    const find = (selector) => element.querySelector(selector);
    const iconLeft = (selector) => find(selector).querySelector("svg").getBoundingClientRect().left;
    const separator = (selector, pseudo) => {
      const target = find(selector);
      const targetRect = target.getBoundingClientRect();
      const style = getComputedStyle(target, pseudo);
      const offset = Number.parseFloat(style.left);
      const thickness = Number.parseFloat(style.borderLeftWidth);
      return {
        end: targetRect.left + offset + thickness,
        borderLeftStyle: style.borderLeftStyle,
        borderRadius: style.borderRadius,
        borderTopStyle: style.borderTopStyle,
        content: style.content,
        thickness,
        display: style.display,
      };
    };

    const lines = {
      beforeFiles: separator(".app-dock-brand", "::after"),
      afterFiles: separator(".app-dock-files", "::before"),
      settings: separator(".app-dock-settings", "::before"),
    };
    const controls = {
      files: iconLeft(".app-dock-files"),
      undo: iconLeft(".app-dock-history button[aria-label='Undo']"),
      settings: iconLeft(".app-dock-settings"),
    };

    return {
      lines,
      spacing: {
        files: controls.files - lines.beforeFiles.end,
        undo: controls.undo - lines.afterFiles.end,
        settings: controls.settings - lines.settings.end,
      },
      historySeparator: separator(".app-dock-history", "::before"),
      directControlBorders: [
        getComputedStyle(find(".app-dock-files")).borderLeftColor,
        getComputedStyle(find(".app-dock-history button[aria-label='Undo']")).borderLeftWidth,
        getComputedStyle(find(".app-dock-settings")).borderLeftWidth,
      ],
      radii: [
        getComputedStyle(find(".app-dock-files")).borderRadius,
        getComputedStyle(find(".app-dock-history button[aria-label='Undo']")).borderRadius,
        getComputedStyle(find(".app-dock-settings")).borderRadius,
      ],
    };
  });

  const separatorStyles = Object.values(state.lines);
  expect(new Set(separatorStyles.map((line) => line.borderLeftStyle))).toEqual(new Set(["solid"]));
  expect(new Set(separatorStyles.map((line) => line.borderTopStyle))).toEqual(new Set(["none"]));
  expect(new Set(separatorStyles.map((line) => line.borderRadius))).toEqual(new Set(["0px"]));
  expect(new Set(separatorStyles.map((line) => line.content))).toEqual(new Set(['""']));
  expect(new Set(separatorStyles.map((line) => line.thickness)).size).toBe(1);
  expect(Math.max(...Object.values(state.spacing)) - Math.min(...Object.values(state.spacing))).toBeLessThan(1);
  expect(state.historySeparator.display).toBe("none");

  expect(state.directControlBorders[0]).toBe("rgba(0, 0, 0, 0)");
  expect(state.directControlBorders.slice(1)).toEqual(["0px", "0px"]);
  expect(new Set(state.radii)).toEqual(new Set(["5px"]));
});

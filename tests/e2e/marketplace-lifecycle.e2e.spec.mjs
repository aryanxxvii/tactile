import { expect, test } from "@playwright/test";

test("Marketplace owns install, version updates, and delete while Cell Objects owns enablement", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".sheet-cell").first()).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Plugins" }).click();

  const cellObjects = page.getByRole("region", { name: "Cell Objects" });
  const marketplace = page.getByRole("region", { name: "Marketplace" });
  const codeMarketplaceRow = marketplace.locator(".marketplace-plugin-row").filter({ hasText: "Code" });
  const codeMarketplaceMeta = codeMarketplaceRow.locator(".marketplace-plugin-meta > span");
  await expect(codeMarketplaceMeta.nth(0)).toHaveText("1.0.2");
  await expect(codeMarketplaceMeta.nth(1)).toHaveText(/\d+(?:\.\d+)? (?:KB|MB)/);
  await expect(codeMarketplaceRow).not.toContainText("install");
  await page.locator(".tactile-app").evaluate((element) => {
    element.dataset.pluginLifecycleProbe = "mounted";
  });

  await page.route(
    "**/plugins/tactile.code/*/plugin.js",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    },
    { times: 1 },
  );
  const installCode = marketplace.getByRole("button", { name: "Install Code" });
  await installCode.click();
  await expect(codeMarketplaceRow.getByRole("progressbar", { name: "Downloading Code" })).toBeVisible();
  await expect(codeMarketplaceRow.locator(".plugin-install-meta")).toContainText("Downloading");
  await expect(installCode).toBeDisabled();
  await expect(page.locator('.tactile-app[data-plugin-lifecycle-probe="mounted"]')).toHaveCount(1);
  await expect(cellObjects.getByRole("switch", { name: "Disable Code" })).toBeVisible();
  const codeRuntimesTab = page.getByRole("tab", { name: "Code runtimes" });
  await expect(codeRuntimesTab).toBeVisible();
  await page.evaluate(() => {
    window.__pluginSettingsLoadingText = [];
    window.__pluginSettingsLoadingCenterDelta = [];
    const target = document.querySelector(".settings-content");
    const observer = new MutationObserver(() => {
      const loading = document.querySelector(".plugin-settings-loading");
      if (loading) {
        window.__pluginSettingsLoadingText.push(loading.textContent || "");
        const targetRect = target.getBoundingClientRect();
        const loadingRect = loading.getBoundingClientRect();
        window.__pluginSettingsLoadingCenterDelta.push(
          Math.abs(targetRect.top + targetRect.height / 2 - (loadingRect.top + loadingRect.height / 2)),
        );
      }
    });
    observer.observe(target, { childList: true, subtree: true });
    window.__pluginSettingsLoadingObserver = observer;
  });
  await codeRuntimesTab.click();
  await expect(page.getByRole("heading", { name: "Code runtimes" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => window.__pluginSettingsLoadingText.some((text) => text.includes("Cooking code runtimes"))),
    )
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => Math.min(...window.__pluginSettingsLoadingCenterDelta)))
    .toBeLessThanOrEqual(2);
  await page.evaluate(() => window.__pluginSettingsLoadingObserver?.disconnect());
  await expect(page.locator(".code-runtime-settings")).toHaveCSS("display", "grid");
  await expect(page.getByText("The browser cannot access programs installed on your device.")).toBeVisible();
  await expect(page.getByText("Desktop app required")).toBeVisible();
  await expect(page.getByText("Browser worker")).toBeVisible();
  await expect(page.getByText("Device toolchains", { exact: true })).toBeVisible();
  await expect(page.getByText("Python · C · C++ · Java · Rust · Go · Ruby · Bash")).toBeVisible();
  await expect(page.getByText("JSON · SQL · HTML · CSS · Plain text")).toBeVisible();
  await expect(page.getByText("Not checked here")).toBeVisible();
  await expect(page.getByText("No Run action")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Python executable path" })).toHaveCount(0);
  const themedRuntimePanel = await page.locator(".code-runtime-settings").evaluate((element) => {
    const resolvedColor = (variable) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${variable})`;
      element.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    const heading = getComputedStyle(element.querySelector("h3"));
    const eyebrow = getComputedStyle(element.querySelector(".code-runtime-section-heading span"));
    return {
      heading: heading.color,
      ink: resolvedColor("--ink"),
      faintText: eyebrow.color,
      faint: resolvedColor("--faint"),
    };
  });
  expect(themedRuntimePanel.heading).toBe(themedRuntimePanel.ink);
  expect(themedRuntimePanel.faintText).toBe(themedRuntimePanel.faint);
  expect(pageErrors).toEqual([]);
  await page.getByRole("tab", { name: "Plugins" }).click();
  await expect(marketplace.getByRole("switch", { name: /Code/ })).toHaveCount(0);
  await expect(marketplace.getByRole("button", { name: "Delete Code" })).toBeVisible();
  await expect(marketplace.getByRole("button", { name: "Update Code" })).toHaveCount(0);

  await cellObjects.getByRole("switch", { name: "Disable Code" }).click();
  await expect(page.locator('.tactile-app[data-plugin-lifecycle-probe="mounted"]')).toHaveCount(1);
  await expect(cellObjects.getByRole("switch", { name: "Enable Code" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Code runtimes" })).toHaveCount(0);
  await expect(marketplace.getByRole("switch", { name: /Code/ })).toHaveCount(0);
  await expect(marketplace.getByRole("button", { name: "Delete Code" })).toBeVisible();

  const catalog = await page.evaluate(async () => (await fetch("/marketplace/catalog.json")).json());
  catalog.plugins = catalog.plugins.map((entry) =>
    entry.packageId === "tactile.code" ? { ...entry, version: "1.0.3" } : entry,
  );
  await page.route("**/marketplace/catalog.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(catalog),
    }),
  );
  await marketplace.locator(".plugins-section-heading > button").click();

  await expect(marketplace.getByRole("button", { name: "Update Code" })).toBeVisible();
  await expect(marketplace.getByText(/1\.0\.2.*1\.0\.3/)).toBeVisible();
  await expect(marketplace.getByRole("switch", { name: /Code/ })).toHaveCount(0);
  await expect(cellObjects.getByRole("switch", { name: "Enable Code" })).toBeVisible();
  const updateBox = await marketplace.getByRole("button", { name: "Update Code" }).boundingBox();
  const deleteBox = await marketplace.getByRole("button", { name: "Delete Code" }).boundingBox();
  expect(Math.abs(updateBox.y - deleteBox.y)).toBeLessThanOrEqual(1);
  expect(deleteBox.x).toBeGreaterThan(updateBox.x + updateBox.width);

  await marketplace.getByRole("button", { name: "Delete Code" }).click();
  await expect(marketplace.getByRole("button", { name: "Install Code" })).toBeVisible();
  await expect(cellObjects.getByText("Code", { exact: true })).toHaveCount(0);
});

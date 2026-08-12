import { expect, test } from "@playwright/test";

test("hover tips activate on pointer boundary entry without restarting inside the anchor", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Browse files", exact: true }).click();

  const closeButton = page.getByRole("dialog", { name: "Files" }).getByRole("button", { name: "Close Files" });
  const tooltip = page.locator(".tactile-tooltip");

  await closeButton.hover();
  await expect(tooltip).toBeVisible();
  const originalText = await tooltip.textContent();
  if (!originalText) throw new Error("Close Files tooltip did not render text");

  // A pointerover from a child while relatedTarget is still inside the
  // anchor must not re-read or restart the active tooltip.
  await closeButton.evaluate((button) => {
    const icon = button.querySelector("svg");
    if (!icon) throw new Error("Close Files icon is missing");
    button.dataset.tooltip = "Changed during internal movement";
    icon.dispatchEvent(
      new PointerEvent("pointerover", {
        bubbles: true,
        pointerType: "mouse",
        relatedTarget: button,
      }),
    );
  });
  await expect(tooltip).toHaveText(originalText);

  // Touch has no hover boundary to expose, so a touch pointerover stays quiet.
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);
  await closeButton.evaluate((button) => {
    button.dataset.tooltip = "Touch hover should stay hidden";
    button.dispatchEvent(
      new PointerEvent("pointerover", {
        bubbles: true,
        pointerType: "touch",
        relatedTarget: document.body,
      }),
    );
  });
  await expect(tooltip).toHaveCount(0);

  // Leaving and entering again is a new boundary entry and reads the current
  // label, while keyboard focus remains an independent accessible trigger.
  await closeButton.evaluate((button) => {
    button.dataset.tooltip = "Close Files again";
  });
  await closeButton.hover();
  await expect(tooltip).toHaveText("Close Files again");
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);

  await closeButton.evaluate((button) => {
    button.dataset.tooltip = "Keyboard focus help";
  });
  await closeButton.focus();
  await expect(tooltip).toHaveText("Keyboard focus help");
});

import { expect, test } from "@playwright/test";

test("keeps the column label lane intact on the first few scroll pixels", async ({ page }) => {
  await page.goto("/");

  const state = await page.locator("[data-sheet-scroll]").evaluate((element) => {
    const column = document.querySelector(".column-header");
    const scrollTop = element.getBoundingClientRect().top;
    element.scrollTo(0, 0);
    element.scrollTo(0, 3);
    const columnBox = column?.getBoundingClientRect();
    return {
      scrollTop,
      headerTop: columnBox?.top ?? null,
      headerBottom: columnBox?.bottom ?? null,
      headerHeight: columnBox?.height ?? null,
    };
  });

  expect(state.headerTop).toBeCloseTo(state.scrollTop, 1);
  expect(state.headerBottom).toBeCloseTo(state.scrollTop + state.headerHeight, 1);
});

test("keeps the bounded window and both sticky rails aligned on the first frame of a fast wheel jump", async ({
  page,
}) => {
  await page.goto("/");

  const scroll = page.locator("[data-sheet-scroll]");
  await expect(scroll).toBeVisible();
  const scrollBox = await scroll.boundingBox();
  if (!scrollBox) throw new Error("The sheet scroll surface has no layout box.");
  await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2);
  await page.mouse.wheel(420, 2400);

  const state = await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          const scroller = document.querySelector("[data-sheet-scroll]");
          const scrollerBox = scroller.getBoundingClientRect();
          const corner = document.querySelector(".sheet-corner");
          const columnHeader = document.querySelector(".column-header");
          const headerHeight = columnHeader?.getBoundingClientRect().height ?? 25;
          const rowHeaderWidth = corner?.getBoundingClientRect().width ?? 34;
          const bodyTop = scrollerBox.top + headerHeight;
          const bodyLeft = scrollerBox.left + rowHeaderWidth;
          const bodyBottom = scrollerBox.bottom;
          const bodyRight = scrollerBox.right;
          const slots = [...document.querySelectorAll(".virtual-cell-slot")].map((node) => ({
            box: node.getBoundingClientRect(),
          }));
          const visibleSlots = slots.filter(
            ({ box }) => box.bottom > bodyTop && box.top < bodyBottom && box.right > bodyLeft && box.left < bodyRight,
          );
          const rowTop = visibleSlots.length ? Math.min(...visibleSlots.map(({ box }) => box.top)) : null;
          const rowBottom = visibleSlots.length ? Math.max(...visibleSlots.map(({ box }) => box.bottom)) : null;
          const columnLeft = visibleSlots.length ? Math.min(...visibleSlots.map(({ box }) => box.left)) : null;
          const columnRight = visibleSlots.length ? Math.max(...visibleSlots.map(({ box }) => box.right)) : null;
          const columnRail = [...document.querySelectorAll(".column-header")]
            .map((node) => node.getBoundingClientRect())
            .find((box) => box.right > bodyLeft && box.left < bodyRight);
          const rowRail = [...document.querySelectorAll(".row-header")]
            .map((node) => node.getBoundingClientRect())
            .find((box) => box.bottom > bodyTop && box.top < bodyBottom);
          resolve({
            scrollTop: scroller.scrollTop,
            scrollLeft: scroller.scrollLeft,
            mountedCells: slots.length,
            rowCoverage: rowTop <= bodyTop + 1 && rowBottom >= bodyBottom - 1,
            columnCoverage: columnLeft <= bodyLeft + 1 && columnRight >= bodyRight - 1,
            columnRailOffset: columnRail ? Math.abs(columnRail.top - scrollerBox.top) : null,
            rowRailOffset: rowRail ? Math.abs(rowRail.left - scrollerBox.left) : null,
          });
        });
      }),
  );

  expect(state).toMatchObject({
    rowCoverage: true,
    columnCoverage: true,
    columnRailOffset: 0,
    rowRailOffset: 0,
  });
  expect(state.scrollTop).toBeGreaterThan(0);
  expect(state.scrollLeft).toBeGreaterThan(0);
  expect(state.mountedCells).toBeLessThan(1000);
});

test("refreshes the virtual slice before the first frame after a direct large offset jump", async ({ page }) => {
  await page.goto("/");

  const state = await page.locator("[data-sheet-scroll]").evaluate(async (element) => {
    element.scrollTop = Math.min(2400, element.scrollHeight - element.clientHeight);
    element.scrollLeft = Math.min(420, element.scrollWidth - element.clientWidth);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const scrollerBox = element.getBoundingClientRect();
    const headerHeight = document.querySelector(".column-header")?.getBoundingClientRect().height ?? 25;
    const bodyTop = scrollerBox.top + headerHeight;
    const visibleSlots = [...document.querySelectorAll(".virtual-cell-slot")]
      .map((node) => node.getBoundingClientRect())
      .filter((box) => box.bottom > bodyTop && box.top < scrollerBox.bottom);
    const columnRail = [...document.querySelectorAll(".column-header")]
      .map((node) => node.getBoundingClientRect())
      .find((box) => box.right > scrollerBox.left + 34 && box.left < scrollerBox.right);
    return {
      scrollTop: element.scrollTop,
      hasVisibleRows: visibleSlots.length > 0,
      columnRailOffset: columnRail ? Math.abs(columnRail.top - scrollerBox.top) : null,
    };
  });

  expect(state).toMatchObject({
    hasVisibleRows: true,
    columnRailOffset: 0,
  });
  expect(state.scrollTop).toBeGreaterThan(0);
});

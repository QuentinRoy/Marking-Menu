import type { Page } from '@playwright/test';
import { expect, test } from '../helpers/fixtures.js';
import {
  moveTo,
  offset,
  pressAt,
  releaseAt,
  surfaceCenter,
  TOP_LEVEL_ITEMS,
  waitForMenuOpen,
} from '../helpers/gestures.js';

const ACTIVE_RADIUS = 100;

const openMenu = async (page: Page) => {
  const center = await surfaceCenter(page);
  await pressAt(page, center);
  await waitForMenuOpen(page);
  return center;
};

const setTheme = async (page: Page) => {
  await page.locator('#surface').evaluate((surface) => {
    surface.style.setProperty('--mm-wedge-fill', '#2d6a4f');
    surface.style.setProperty('--mm-wedge-fill-active', '#d00000');
    surface.style.setProperty('--mm-inner-connector-color', '#ffb703');
    surface.style.setProperty('--mm-outer-connector-color', '#023e8a');
    surface.style.setProperty('--mm-plate-background', '#9b2226');
    surface.style.setProperty('--mm-plate-background-active', '#f8c8dc');
    surface.style.setProperty('--mm-plate-color', '#f8f9fa');
    surface.style.setProperty('--mm-plate-color-active', '#22223b');
    surface.style.setProperty('--mm-stroke-color', '#5a189a');
    surface.style.setProperty('--mm-stroke-width', '10px');
    surface.style.setProperty('--mm-wedge-thickness', '60px');
  });
};

test('visual: default menu open', async ({ page }) => {
  await openMenu(page);
  await expect(page.locator('#snapshot-area')).toHaveScreenshot(
    'menu-default-open.png',
  );
});

for (const [id, item] of Object.entries(TOP_LEVEL_ITEMS)) {
  test(`visual: active ${id} item`, async ({ page }) => {
    const center = await openMenu(page);
    await moveTo(page, offset(center, item.angle, ACTIVE_RADIUS));
    await expect(page.locator('#snapshot-area')).toHaveScreenshot(
      `menu-active-${id}.png`,
    );
  });
}

test('visual: themed menu open', async ({ page }) => {
  await setTheme(page);
  await openMenu(page);
  await expect(page.locator('#snapshot-area')).toHaveScreenshot(
    'menu-themed-open.png',
  );
});

test('visual: themed active right item', async ({ page }) => {
  await setTheme(page);
  const center = await openMenu(page);
  await moveTo(
    page,
    offset(center, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS),
  );
  await expect(page.locator('#snapshot-area')).toHaveScreenshot(
    'menu-themed-active-right.png',
  );
});

test('visual: novice stroke and origin marker', async ({ page }) => {
  const center = await openMenu(page);
  await moveTo(
    page,
    offset(center, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS),
  );
  await expect(page.locator('#snapshot-area')).toHaveScreenshot(
    'stroke-novice-origin.png',
  );
});

test('visual: stroke parts override presentation defaults', async ({
  page,
}) => {
  await page.addStyleTag({
    content:
      '.marking-menu::part(stroke--upper) { fill: #d00000; stroke: #d00000; stroke-width: 12px; }',
  });
  const center = await openMenu(page);
  await moveTo(
    page,
    offset(center, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS),
  );
  await expect(page.locator('#snapshot-area')).toHaveScreenshot(
    'stroke-part-themed.png',
  );
});

test('visual: concurrent normal and canceled feedback', async ({ page }) => {
  const center = await surfaceCenter(page);
  await pressAt(page, center);
  await moveTo(
    page,
    offset(center, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS),
    1,
  );
  await releaseAt(page);
  await pressAt(page, offset(center, 0, 30));
  await releaseAt(page);

  await expect(page.locator('#snapshot-area')).toHaveScreenshot(
    'stroke-feedback-concurrent.png',
  );
});

test('visual: playground recognizer shows every corner', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/playground/');
  await page.getByText('Recognizer breakdown', { exact: true }).click();

  const surface = page.locator('div.cursor-crosshair');
  const box = await surface.boundingBox();
  expect(box, 'The playground gesture surface is visible').not.toBeNull();
  const visibleBox = box as NonNullable<typeof box>;

  const start = {
    x: visibleBox.x + 60,
    y: visibleBox.y + visibleBox.height / 2,
  };
  await pressAt(page, start);
  await moveTo(page, { x: start.x + 100, y: start.y }, 8);
  await moveTo(page, { x: start.x + 100, y: start.y + 100 }, 8);
  await releaseAt(page, { x: start.x + 200, y: start.y + 100 });

  await expect(surface).toHaveScreenshot('stroke-playground-corners.png');
});

test('visual: 64px dead zone menu open', async ({ page }) => {
  await page.goto('/?deadZoneRadius=64');
  await openMenu(page);
  await expect(page.locator('#snapshot-area')).toHaveScreenshot(
    'menu-dead-zone-64-open.png',
  );
});

test('visual: 64px dead zone active right item', async ({ page }) => {
  await page.goto('/?deadZoneRadius=64');
  const center = await openMenu(page);
  await moveTo(
    page,
    offset(center, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS),
  );
  await expect(page.locator('#snapshot-area')).toHaveScreenshot(
    'menu-dead-zone-64-active-right.png',
  );
});

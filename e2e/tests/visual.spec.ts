import type { Page } from '@playwright/test';
import { expect, test } from '../helpers/fixtures.js';
import {
  moveTo,
  offset,
  pressAt,
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

import { expect, test } from '../helpers/fixtures.js';
import {
  moveTo,
  offset,
  pressAt,
  releaseAt,
  surfaceCenter,
  TOP_LEVEL_ITEMS,
} from '../helpers/gestures.js';

// Regression coverage for #361: the upper stroke is now purely CSS-themed,
// so a `--mm-stroke-color` change must repaint an already-drawn stroke
// immediately, without the renderer tearing it down and recreating it (see
// `setStrokeTheme` in renderer.ts, which used to rebuild every stroke layer
// on each new menu and no longer does).
const SELECT_RADIUS = 100;

test('a CSS custom property change repaints an open stroke without recreating it', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  await pressAt(page, center);
  await moveTo(page, offset(center, TOP_LEVEL_ITEMS.others.angle, SELECT_RADIUS), 3);

  const path = page
    .locator('svg:not(.marking-menu-stroke--lower) > .marking-menu-stroke-path')
    .first();
  await path.evaluate((element) => {
    (element as unknown as { testMarker?: boolean }).testMarker = true;
  });
  const before = await path.evaluate((element) => getComputedStyle(element).stroke);

  await page.addStyleTag({
    content: ':root { --mm-stroke-color: rgb(1, 2, 3); }',
  });

  const after = await path.evaluate((element) => getComputedStyle(element).stroke);
  const wasNotRecreated = await path.evaluate(
    (element) => (element as unknown as { testMarker?: boolean }).testMarker === true,
  );

  await releaseAt(page);

  expect(after).toBe('rgb(1, 2, 3)');
  expect(after).not.toBe(before);
  expect(wasNotRecreated).toBe(true);
});

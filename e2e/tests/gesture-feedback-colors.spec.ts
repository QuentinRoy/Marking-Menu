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
import { waitForLogEntry } from '../helpers/log.js';

// Regression coverage for the completed/canceled feedback traces sharing one
// SVG surface class (see `createStrokeLayers` in renderer.ts): a completed
// trace gets `marking-menu-stroke--feedback`, a canceled one gets that class
// plus `marking-menu-stroke--canceled`, both assigned in one object literal
// per call. If either class were dropped, the trace would silently fall
// back to the plain upper-stroke color instead of its own.
const SELECT_RADIUS = 100;

test('completed and canceled gesture-feedback traces use their own themed colors', async ({
  page,
}) => {
  await page.addStyleTag({
    content: `:root {
      --mm-stroke-color-feedback: rgb(0, 255, 0);
      --mm-stroke-color-canceled: rgb(255, 0, 0);
    }`,
  });

  const center = await surfaceCenter(page);

  await pressAt(page, center);
  await waitForMenuOpen(page);
  await moveTo(page, offset(center, TOP_LEVEL_ITEMS.right.angle, SELECT_RADIUS));
  await releaseAt(page);
  await waitForLogEntry(page, (entry) => entry.type === 'select');

  const completedColor = await page
    .locator(
      'svg.marking-menu-stroke--feedback:not(.marking-menu-stroke--canceled) .marking-menu-stroke-path',
    )
    .first()
    .evaluate((element) => getComputedStyle(element).stroke);

  await pressAt(page, center);
  await waitForMenuOpen(page);
  await releaseAt(page);
  await waitForLogEntry(page, (entry) => entry.type === 'cancel');

  const canceledColor = await page
    .locator(
      'svg.marking-menu-stroke--feedback.marking-menu-stroke--canceled .marking-menu-stroke-path',
    )
    .first()
    .evaluate((element) => getComputedStyle(element).stroke);

  expect(completedColor).toBe('rgb(0, 255, 0)');
  expect(canceledColor).toBe('rgb(255, 0, 0)');
});

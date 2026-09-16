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

// Issue #361's "to check": `r` as a CSS property on `<circle>` (the stroke's
// origin marker) needs WebKit support, since the geometry stays in JS
// otherwise. A custom radius set on the document root must reach the
// shadow-rooted marker at exactly that value; run across every configured
// browser, WebKit included (`.cross-browser.spec.ts`).
const SELECT_RADIUS = 100;

test("the stroke's origin marker resolves its CSS-set radius", async ({
  page,
}) => {
  await page.addStyleTag({
    content: ':root { --mm-stroke-start-point-radius: 12px; }',
  });

  const center = await surfaceCenter(page);
  const pauseAt = offset(center, TOP_LEVEL_ITEMS.others.angle, SELECT_RADIUS);
  await pressAt(page, center);
  await moveTo(page, pauseAt, 3);
  await waitForMenuOpen(page);

  const radius = await page
    .locator('.marking-menu-stroke-point')
    .first()
    .evaluate((element) => getComputedStyle(element).r);

  await releaseAt(page);
  expect(radius).toBe('12px');
});

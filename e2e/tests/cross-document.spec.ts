import { expect, test } from '../helpers/fixtures.js';
import {
  boundingBoxOfIn,
  moveTo,
  offset,
  pressAt,
  releaseAt,
} from '../helpers/gestures.js';
import { waitForLogEntry } from '../helpers/log.js';

// Regression coverage for #330: the menu is created from the top document's
// script, but its `parent` element lives inside an iframe — a different
// document, with its own `HTMLElement` and `CSSStyleSheet` constructors, and
// its own CSS custom properties. The fixture gives the two documents
// different `--mm-stroke-color` values (see cross-document.html and
// cross-document.ts); the stroke the menu draws must come from the iframe's
// value, not the top document's or the library's own default.
test('a menu whose parent lives in a different document reads that document, opens, and selects', async ({
  page,
}) => {
  await page.goto('/cross-document.html');

  const frame = page.frameLocator('iframe');
  const box = await boundingBoxOfIn(frame, '#surface');
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await pressAt(page, center);
  await expect(frame.locator('.marking-menu-label').first()).toBeVisible();

  await moveTo(page, offset(center, 0, 100));
  await expect(frame.locator('svg path[stroke="rgb(0, 0, 255)"]')).toHaveCount(
    1,
  );

  await releaseAt(page);
  const log = await waitForLogEntry(page, (entry) => entry.type === 'select');
  expect(log.at(-1)).toMatchObject({ selectionId: 'right', type: 'select' });
});

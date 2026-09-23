import { expect, test } from '../helpers/fixtures.js';
import { boundingBoxOf, surfaceCenter } from '../helpers/gestures.js';

// Connector hit-testing relies on `width`/`height` being CSS-stylable on
// `<rect>` (SVG2): worth its own cross-browser coverage, unlike the rest of
// `layout-pointer-target.spec.ts`.

test('the inner connector, zero-thickness by default, is not a hit target', async ({
  page,
}) => {
  await page.goto('/layout.html');

  const center = await surfaceCenter(page);
  const hitItemId = page.locator('html');

  // Inside the dead zone, along "right"'s own angle: nothing paints there by
  // default, since the inner connector's thickness defaults to 0.
  await page.mouse.click(center.x + 20, center.y);
  await expect(hitItemId).toHaveAttribute('data-hit-item-id', '');
});

test('the outer connector, beyond the wedge ring, is its own hit target', async ({
  page,
}) => {
  await page.goto('/layout.html');

  const hitItemId = page.locator('html');
  const box = await boundingBoxOf(
    page,
    '.marking-menu-item[data-item-id="right"] .marking-menu-outer-connector rect',
  );

  // Near the ring end of the connector, clear of both the wedge and the
  // plate.
  await page.mouse.click(box.x + 1, box.y + box.height / 2);
  await expect(hitItemId).toHaveAttribute('data-hit-item-id', 'right');
});

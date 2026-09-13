import { expect, test } from '../helpers/fixtures.js';
import { surfaceCenter } from '../helpers/gestures.js';

test('pointer-target menu exposes painted item regions without blocking gaps', async ({
  page,
}) => {
  await page.goto('/layout.html');

  const center = await surfaceCenter(page);
  const hitItemId = page.locator('html');

  await page.mouse.click(center.x + 60, center.y);
  await expect(hitItemId).toHaveAttribute('data-hit-item-id', 'right');

  await page
    .locator('.marking-menu-item[data-item-id="right"] .marking-menu-plate')
    .click();
  await expect(hitItemId).toHaveAttribute('data-hit-item-id', 'right');

  await page.mouse.click(center.x + 45, center.y + 45);
  await expect(hitItemId).toHaveAttribute('data-hit-item-id', '');
});

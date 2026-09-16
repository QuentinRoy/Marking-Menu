import { expect, test } from '../helpers/fixtures.js';
import {
  boundingBoxOf,
  moveTo,
  offset,
  pressAt,
  releaseAt,
  TOP_LEVEL_ITEMS,
  waitForMenuOpen,
} from '../helpers/gestures.js';

// Exercises the assembled demo site itself (`yarn demo:build`'s output), not
// the library: it's the only check that the import map and the `lib`
// symlink into `dist/` actually resolve for a real browser, since neither
// failure mode throws anywhere `yarn typecheck` or the unit suite would
// catch it.
test('the deployed demo opens the menu and selects an item', async ({
  page,
}) => {
  const box = await boundingBoxOf(page, '#main');
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await pressAt(page, center);
  await waitForMenuOpen(page);
  await moveTo(page, offset(center, TOP_LEVEL_ITEMS.right.angle, 100));
  await releaseAt(page);

  await expect(page.locator('#toast')).toHaveText('Right');
});

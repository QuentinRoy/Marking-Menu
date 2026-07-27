import { expect, test } from '../helpers/fixtures.js';
import { offset, surfaceCenter, TOP_LEVEL_ITEMS } from '../helpers/gestures.js';
import { waitForLogEntry } from '../helpers/log.js';
import { CdpTouchDrag } from '../helpers/touch.js';

// Same margin-from-thresholds rationale as mouse.spec.ts.
const SELECT_RADIUS = 100;

test('touch: a rightward expert stroke selects without opening a menu, on a surface with touch-action: none', async ({
  page,
}) => {
  const touchAction = await page
    .locator('#surface')
    .evaluate((element) => getComputedStyle(element).touchAction);
  expect(touchAction).toBe('none');

  const center = await surfaceCenter(page);
  const target = offset(center, TOP_LEVEL_ITEMS.right.angle, SELECT_RADIUS);

  const drag = await CdpTouchDrag.start(page, center);
  await drag.moveTo(target);
  await drag.end();

  const log = await waitForLogEntry(page, (entry) => entry.type === 'select');
  expect(log.at(-1)).toMatchObject({
    mode: 'expert',
    selectionId: 'right',
    type: 'select',
  });
  expect(log.some((entry) => entry.type === 'open')).toBe(false);
});

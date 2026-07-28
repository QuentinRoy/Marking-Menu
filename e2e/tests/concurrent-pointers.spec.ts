import { expect, test } from '../helpers/fixtures.js';
import {
  offset,
  surfaceCenter,
  TOP_LEVEL_ITEMS,
  waitForMenuOpen,
} from '../helpers/gestures.js';
import { readLog, waitForLogEntry, waitForLogGrowth } from '../helpers/log.js';
import { CdpMultiTouchDrag, CdpTouchDrag } from '../helpers/touch.js';

// Same margin-from-thresholds rationale as mouse.spec.ts.
const SELECT_RADIUS = 100;

test('concurrent pointers: a second touch cannot move, select or cancel the owning gesture, and a fresh gesture works once it finishes', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  const target = offset(center, TOP_LEVEL_ITEMS.right.angle, SELECT_RADIUS);
  const decoyStart = offset(center, TOP_LEVEL_ITEMS.left.angle, SELECT_RADIUS);
  const decoyMoved = offset(center, TOP_LEVEL_ITEMS.up.angle, SELECT_RADIUS);

  const drag = await CdpMultiTouchDrag.start(page, center);
  await waitForMenuOpen(page);
  const logBeforeDecoy = await readLog(page);

  // A second finger touches down, drags across the menu, and lifts while
  // the first finger (the gesture's owner) stays put. None of it should
  // produce a single notification.
  await drag.addSecondary(decoyStart);
  await drag.moveSecondary(decoyMoved);
  await drag.liftSecondary();
  expect(await readLog(page)).toEqual(logBeforeDecoy);

  // The owner finishes normally, as if the decoy had never happened.
  await drag.movePrimary(target);
  await drag.endPrimary();

  const log = await waitForLogEntry(page, (entry) => entry.type === 'select');
  expect(log.at(-1)).toMatchObject({
    mode: 'novice',
    selectionId: 'right',
    type: 'select',
  });

  // A fresh gesture afterward still works: the owner's release fully freed
  // the surface for a new primary pointer. The log already holds a `select`
  // entry from the first gesture, so wait on log growth rather than
  // `waitForLogEntry`, which would resolve on that stale entry immediately.
  const freshDrag = await CdpTouchDrag.start(page, center);
  await freshDrag.moveTo(target);
  await freshDrag.end();

  const freshLog = await waitForLogGrowth(page, log.length);
  expect(freshLog.at(-1)).toMatchObject({
    mode: 'expert',
    selectionId: 'right',
    type: 'select',
  });
});

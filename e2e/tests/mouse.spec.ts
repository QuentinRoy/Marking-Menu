import { expect, test } from '../helpers/fixtures.js';
import {
  expectApproximateOctants,
  moveTo,
  offset,
  pressAt,
  releaseAt,
  SUBMENU_ITEMS,
  surfaceBoundingBox,
  surfaceCenter,
  TOP_LEVEL_ITEMS,
  waitForMenuOpen,
} from '../helpers/gestures.js';
import { waitForLogEntry } from '../helpers/log.js';

// The fixture uses the library's defaults: minSelectionDist 40,
// minMenuSelectionDist 80, movementsThreshold 5, noviceDwellingTime ~333ms.
// Radii below are chosen with enough margin from those thresholds to be
// unambiguous rather than to probe the thresholds themselves (that's the
// unit suites' job).
const SELECT_RADIUS = 100;
const NON_LEAF_HOVER_RADIUS = 60; // Between 40 (selection) and 80 (submenu).
const TINY_RADIUS = 3; // Below the 5px movements threshold.

test('novice mode: dwelling opens the menu, lays out every item, and a release selects', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  await pressAt(page, center);
  await waitForMenuOpen(page);
  await expectApproximateOctants(page, center, TOP_LEVEL_ITEMS);

  await moveTo(
    page,
    offset(center, TOP_LEVEL_ITEMS.right.angle, SELECT_RADIUS),
  );
  await releaseAt(page);

  const log = await waitForLogEntry(page, (entry) => entry.type === 'select');
  expect(log.at(-1)).toMatchObject({
    mode: 'novice',
    selectionId: 'right',
    type: 'select',
  });
});

test('expert mode: a quick decisive stroke selects without ever opening a menu', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  await pressAt(page, center);
  await moveTo(
    page,
    offset(center, TOP_LEVEL_ITEMS.right.angle, SELECT_RADIUS),
    1,
  );

  // Still held: the expert path never renders a menu.
  await expect(page.locator('.marking-menu')).toHaveCount(0);

  await releaseAt(page);

  const log = await waitForLogEntry(page, (entry) => entry.type === 'select');
  expect(log.at(-1)).toMatchObject({
    mode: 'expert',
    selectionId: 'right',
    type: 'select',
  });
  expect(log.some((entry) => entry.type === 'open')).toBe(false);
});

test('startup select: a sub-threshold directional flick resolves before confirmation', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  await pressAt(page, center);
  await moveTo(
    page,
    offset(center, TOP_LEVEL_ITEMS.right.angle, TINY_RADIUS),
    1,
  );
  await releaseAt(page);

  const log = await waitForLogEntry(
    page,
    (entry) => entry.type === 'select' || entry.type === 'cancel',
  );

  expect(log.at(-1)).toMatchObject({ mode: 'startup', type: 'select' });
});

test('startup cancel: a zero-length gesture resolves before confirmation', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  await pressAt(page, center);
  await releaseAt(page);

  const log = await waitForLogEntry(page, (entry) => entry.type === 'cancel');
  expect(log.at(-1)).toMatchObject({ mode: 'startup', type: 'cancel' });
});

test('multi-level expert: an uninterrupted down-then-right stroke selects a submenu leaf', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  const corner = offset(center, TOP_LEVEL_ITEMS.others.angle, SELECT_RADIUS);
  const target = offset(
    corner,
    SUBMENU_ITEMS['sub-right'].angle,
    SELECT_RADIUS,
  );

  await pressAt(page, center);
  await moveTo(page, corner, 3);
  await moveTo(page, target, 3);
  await releaseAt(page);

  const log = await waitForLogEntry(page, (entry) => entry.type === 'select');
  expect(log.at(-1)).toMatchObject({
    mode: 'expert',
    selectionId: 'sub-right',
    type: 'select',
  });
});

test('dwelling handoff: pausing an expert stroke on a submenu opens it in novice mode', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  const pauseAt = offset(center, TOP_LEVEL_ITEMS.others.angle, SELECT_RADIUS);

  await pressAt(page, center);
  await moveTo(page, pauseAt, 3);
  // Hold still: the expert-to-novice dwell should open `Others...`'s submenu
  // centered on the pause position.
  await waitForMenuOpen(page);
  await expectApproximateOctants(page, pauseAt, SUBMENU_ITEMS);

  const openLog = await waitForLogEntry(page, (entry) => entry.type === 'open');
  expect(openLog.at(-1)).toMatchObject({ menuId: 'others', mode: 'novice' });

  await moveTo(
    page,
    offset(pauseAt, SUBMENU_ITEMS['sub-right'].angle, SELECT_RADIUS),
  );
  await releaseAt(page);

  const log = await waitForLogEntry(page, (entry) => entry.type === 'select');
  expect(log.at(-1)).toMatchObject({
    mode: 'novice',
    selectionId: 'sub-right',
    type: 'select',
  });
});

test('novice center cancellation: releasing at the center cancels without selecting', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  await pressAt(page, center);
  await waitForMenuOpen(page);
  await releaseAt(page);

  const log = await waitForLogEntry(page, (entry) => entry.type === 'cancel');
  const last = log.at(-1);
  expect(last).toMatchObject({ mode: 'novice', type: 'cancel' });
  expect(last?.selectionId).toBeUndefined();
  expect(log.some((entry) => entry.type === 'select')).toBe(false);
});

test('novice non-leaf cancellation: releasing over a submenu item (not far enough to open it) cancels', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  await pressAt(page, center);
  await waitForMenuOpen(page);

  // Between the 40px selection radius and the 80px submenu-opening radius:
  // far enough to be "active" over `Others...`, not far enough to open it.
  await moveTo(
    page,
    offset(center, TOP_LEVEL_ITEMS.others.angle, NON_LEAF_HOVER_RADIUS),
  );
  await releaseAt(page);

  const log = await waitForLogEntry(page, (entry) => entry.type === 'cancel');
  expect(log.at(-1)).toMatchObject({
    activeId: 'others',
    mode: 'novice',
    selectionId: 'others',
    type: 'cancel',
  });
  expect(log.some((entry) => entry.type === 'select')).toBe(false);
});

test('pointer capture: releasing outside the gesture surface still completes recognition', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  const surfaceBox = await surfaceBoundingBox(page);
  const outsideParent = {
    x: surfaceBox.x + surfaceBox.width + 100,
    y: center.y,
  };

  await pressAt(page, center);
  await waitForMenuOpen(page);
  await moveTo(page, outsideParent);
  await releaseAt(page);

  const log = await waitForLogEntry(page, (entry) => entry.type === 'select');
  expect(log.at(-1)).toMatchObject({
    mode: 'novice',
    selectionId: 'right',
    type: 'select',
  });
});

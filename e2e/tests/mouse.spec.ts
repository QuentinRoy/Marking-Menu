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

// The fixture uses the library's defaults: deadZoneRadius 40,
// movementsThreshold 5, noviceDwellingTime and submenuOpeningDelay ~333ms.
// Radii below are chosen with enough margin from those thresholds to be
// unambiguous rather than to probe the thresholds themselves (that's the
// unit suites' job). Tests that must resolve before a pause elapses race
// the delay itself, the way the startup cases below do.
const SELECT_RADIUS = 100;
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
  expect(
    log.every(
      (entry) =>
        Array.isArray(entry.position) &&
        entry.position.length === 2 &&
        entry.position.every((coordinate) => typeof coordinate === 'number'),
    ),
  ).toBe(true);
});

test('label plates size to their content within the configured bounds', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  await pressAt(page, center);
  await waitForMenuOpen(page);

  const menu = page.locator('.marking-menu');
  const defaultSize = await menu.evaluate((host) => {
    const plate = host.shadowRoot?.querySelector<HTMLElement>(
      '.marking-menu-plate',
    );
    if (plate === null || plate === undefined) {
      throw new Error('Menu plate is missing.');
    }

    const style = getComputedStyle(plate);
    return {
      maxWidth: style.maxWidth,
      minWidth: style.minWidth,
      transform: style.transform,
      width: plate.getBoundingClientRect().width,
    };
  });
  expect(defaultSize).toMatchObject({
    maxWidth: 'none',
    minWidth: '0px',
    transform: 'none',
  });
  expect(defaultSize.width).toBeLessThan(120);

  const clampedSize = await menu.evaluate((host) => {
    host.style.setProperty('--mm-label-min-width', '120px');
    host.style.setProperty('--mm-label-max-width', '120px');
    const plate = host.shadowRoot?.querySelector<HTMLElement>(
      '.marking-menu-plate',
    );
    const label = host.shadowRoot?.querySelector<HTMLElement>(
      '.marking-menu-label',
    );
    if (
      plate === null ||
      plate === undefined ||
      label === null ||
      label === undefined
    ) {
      throw new Error('Menu plate is incomplete.');
    }

    label.textContent = 'A label longer than the configured width';
    return {
      labelClientWidth: label.clientWidth,
      labelScrollWidth: label.scrollWidth,
      overflow: getComputedStyle(label).overflow,
      textOverflow: getComputedStyle(label).textOverflow,
      whiteSpace: getComputedStyle(label).whiteSpace,
      width: plate.getBoundingClientRect().width,
    };
  });
  expect(clampedSize.width).toBe(128);
  expect(clampedSize.labelScrollWidth).toBeGreaterThan(
    clampedSize.labelClientWidth,
  );
  expect(clampedSize).toMatchObject({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  await releaseAt(page);
});

test('novice mode: wedges and connector parts follow the menu directions', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  await pressAt(page, center);
  await waitForMenuOpen(page);

  const menu = page.locator('.marking-menu');
  const geometry = await menu.evaluate((host) => {
    const root = host.shadowRoot;
    const wedge = (index: number): { height: number; y: number } => {
      const path = root?.querySelectorAll<SVGPathElement>(
        '.marking-menu-wedge',
      )[index];
      if (path === null || path === undefined) {
        throw new Error(`Missing wedge at index ${index}.`);
      }

      const { height, y } = path.getBBox();
      return { height, y };
    };

    const innerConnector = root?.querySelector<HTMLElement>(
      '.marking-menu-inner-connector',
    );
    const outerConnector = root?.querySelector<HTMLElement>(
      '.marking-menu-outer-connector',
    );
    if (
      innerConnector === null ||
      innerConnector === undefined ||
      outerConnector === null ||
      outerConnector === undefined
    ) {
      throw new Error('Menu connector is missing.');
    }

    return {
      down: wedge(2),
      innerColor: getComputedStyle(innerConnector).backgroundColor,
      innerPart: innerConnector.getAttribute('part'),
      innerWidth: innerConnector.getBoundingClientRect().width,
      outerOffset:
        outerConnector.getBoundingClientRect().x -
        innerConnector.getBoundingClientRect().x,
      outerPart: outerConnector.getAttribute('part'),
      up: wedge(6),
    };
  });

  expect(geometry.down.y + geometry.down.height / 2).toBeGreaterThan(0);
  expect(geometry.up.y + geometry.up.height / 2).toBeLessThan(0);
  expect(geometry.innerColor).toBe('rgba(0, 0, 0, 0)');
  expect(geometry.innerPart).toBe('inner-connector');
  expect(geometry.innerWidth).toBe(40);
  expect(geometry.outerOffset).toBe(80);
  expect(geometry.outerPart).toBe('outer-connector');

  await moveTo(page, offset(center, TOP_LEVEL_ITEMS.up.angle, SELECT_RADIUS));
  const activeWedge = await menu.evaluate((host) => {
    const wedges = host.shadowRoot?.querySelectorAll<SVGPathElement>(
      '.marking-menu-wedge',
    );
    return [...(wedges ?? [])].findIndex((wedge) =>
      wedge.classList.contains('marking-menu-wedge--active'),
    );
  });
  expect(activeWedge).toBe(6);

  await menu.evaluate((host) => {
    host.style.setProperty('--mm-inner-connector-color', 'rgb(1, 2, 3)');
    host.style.setProperty('--mm-outer-connector-color', 'rgb(4, 5, 6)');
  });
  const colors = await menu.evaluate((host) => {
    const root = host.shadowRoot;
    const innerConnector = root?.querySelector<HTMLElement>(
      '.marking-menu-inner-connector',
    );
    const outerConnector = root?.querySelector<HTMLElement>(
      '.marking-menu-outer-connector',
    );
    if (
      innerConnector === null ||
      innerConnector === undefined ||
      outerConnector === null ||
      outerConnector === undefined
    ) {
      throw new Error('Menu connector is missing.');
    }

    return {
      inner: getComputedStyle(innerConnector).backgroundColor,
      outer: getComputedStyle(outerConnector).backgroundColor,
    };
  });
  expect(colors).toEqual({ inner: 'rgb(1, 2, 3)', outer: 'rgb(4, 5, 6)' });

  await releaseAt(page);
});

test('novice mode: a gesture prevents the browser pointer default', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  await page.evaluate(() => {
    document.addEventListener(
      'pointerdown',
      (event) => {
        document.documentElement.dataset.pointerDefaultPrevented = String(
          event.defaultPrevented,
        );
      },
      { once: true },
    );
  });

  await pressAt(page, center);
  await expect(page.locator('html')).toHaveAttribute(
    'data-pointer-default-prevented',
    'true',
  );
  await waitForMenuOpen(page);
  await releaseAt(page);
});

test('novice mode: drawing does not select incidental text', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  await page.locator('#surface').evaluate((surface) => {
    const text = document.createElement('span');
    text.textContent = 'Incidental text';
    Object.assign(text.style, {
      left: '130px',
      position: 'absolute',
      top: '140px',
    });
    surface.append(text);
  });

  await pressAt(page, center);
  await waitForMenuOpen(page);
  await moveTo(
    page,
    offset(center, TOP_LEVEL_ITEMS.right.angle, SELECT_RADIUS),
  );
  await releaseAt(page);

  await expect
    .poll(async () =>
      page.evaluate(() => globalThis.getSelection()?.toString() ?? ''),
    )
    .toBe('');
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

test('novice non-leaf cancellation: releasing over a submenu item before the dwell opens it cancels', async ({
  page,
}) => {
  const center = await surfaceCenter(page);
  await pressAt(page, center);
  await waitForMenuOpen(page);

  // `Others...` becomes active, and the release lands well inside the
  // submenu-opening delay, so the menu never advances.
  await moveTo(
    page,
    offset(center, TOP_LEVEL_ITEMS.others.angle, SELECT_RADIUS),
  );
  await releaseAt(page);

  const log = await waitForLogEntry(page, (entry) => entry.type === 'cancel');
  const last = log.at(-1);
  expect(last).toMatchObject({
    activeId: 'others',
    mode: 'novice',
    type: 'cancel',
  });
  expect(last?.selectionId).toBeUndefined();
  expect(log.some((entry) => entry.type === 'select')).toBe(false);
  // Only the root menu opened: had the release lost its race with the
  // submenu delay, `Others...` would have opened too.
  expect(log.filter((entry) => entry.type === 'open')).toHaveLength(1);
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

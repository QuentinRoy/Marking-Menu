import { userEvent } from 'vitest/browser';
import {
  centerOf,
  mountMenu,
  offset,
  press,
  TOP_LEVEL_ITEMS,
  waitForMenuClosed,
  waitForMenuOpen,
  type Drag,
} from './__fixtures__/browser-menu.js';
import { fakeTimers } from './__fixtures__/timers.js';

const GESTURE_FEEDBACK_DURATION = 1000;

// A touch left active (see `press`) would carry into whichever test runs
// next, but every press here is scoped with `await using`. Only the hover
// state, which isn't tied to any single press, needs a blanket reset.
afterEach(async () => {
  await userEvent.unhover(document.body);
});

// Mirrors `e2e/fixture/main.ts`'s eight-direction topology, with stable ids:
// tests key off `id`, not display order or label text.
const items = [
  { id: 'right', label: 'Right' },
  { id: 'down-right', label: 'Down-Right' },
  {
    id: 'others',
    label: 'Others...',
    items: [
      { id: 'sub-right', label: 'Sub Right' },
      { id: 'sub-down', label: 'Sub Down' },
      { id: 'sub-left', label: 'Sub Left' },
      { id: 'sub-up', label: 'Sub Up' },
    ],
  },
  { id: 'down-left', label: 'Down-Left' },
  { id: 'left', label: 'Left' },
  { id: 'up-left', label: 'Up-Left' },
  { id: 'up', label: 'Up' },
  { id: 'up-right', label: 'Up-Right' },
] as const;

const ACTIVE_RADIUS = 100;

const openMenu = async (surface: Element): Promise<Drag> => {
  const drag = await press(centerOf(surface));
  await waitForMenuOpen(surface);
  return drag;
};

const setTheme = (surface: HTMLElement): void => {
  surface.style.setProperty('--mm-wedge-fill', '#2d6a4f');
  surface.style.setProperty('--mm-wedge-fill-active', '#d00000');
  surface.style.setProperty('--mm-inner-connector-color', '#ffb703');
  surface.style.setProperty('--mm-outer-connector-color', '#023e8a');
  surface.style.setProperty('--mm-plate-background', '#9b2226');
  surface.style.setProperty('--mm-plate-background-active', '#f8c8dc');
  surface.style.setProperty('--mm-plate-color', '#f8f9fa');
  surface.style.setProperty('--mm-plate-color-active', '#22223b');
  surface.style.setProperty('--mm-stroke-color', '#5a189a');
  surface.style.setProperty('--mm-stroke-width', '10px');
  surface.style.setProperty('--mm-wedge-thickness', '60px');
};

test('default menu open', async () => {
  using menu = mountMenu({ items });
  await using _drag = await openMenu(menu.surface);
  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('menu-default-open');
});

test('menu and stroke escape a visible-overflow parent', async () => {
  using menu = mountMenu({ items });
  await using drag = await openMenu(menu.surface);
  await drag.moveTo(offset(drag.at, 0, 200));

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('stroke-overflow-visible');
});

test('overflow hidden clips an escaping menu and stroke', async () => {
  using menu = mountMenu({ items });
  menu.surface.style.overflow = 'hidden';
  await using drag = await openMenu(menu.surface);
  await drag.moveTo(offset(drag.at, 0, 200));

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('stroke-overflow-hidden');
});

for (const [id, item] of Object.entries(TOP_LEVEL_ITEMS)) {
  test(`active ${id} item`, async () => {
    using menu = mountMenu({ items });
    await using drag = await openMenu(menu.surface);
    await drag.moveTo(offset(drag.at, item.angle, ACTIVE_RADIUS));
    await expect
      .element(menu.snapshotArea)
      .toMatchScreenshot(`menu-active-${id}`);
  });
}

test('themed menu open', async () => {
  using menu = mountMenu({ items });
  setTheme(menu.surface);
  await using _drag = await openMenu(menu.surface);
  await expect.element(menu.snapshotArea).toMatchScreenshot('menu-themed-open');
});

test('themed active right item', async () => {
  using menu = mountMenu({ items });
  setTheme(menu.surface);
  await using drag = await openMenu(menu.surface);
  await drag.moveTo(
    offset(drag.at, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS),
  );

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('menu-themed-active-right');
});

test('novice stroke and origin marker', async () => {
  using menu = mountMenu({ items });
  await using drag = await openMenu(menu.surface);
  await drag.moveTo(
    offset(drag.at, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS),
  );

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('stroke-novice-origin');
});

test('concurrent normal and canceled feedback', async () => {
  using menu = mountMenu({ items });
  const center = centerOf(menu.surface);
  await using drag = await press(center);
  await drag.moveTo(
    offset(center, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS),
    1,
  );
  await drag.release();

  await using drag2 = await press(offset(center, 0, 30));
  await drag2.release();

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('stroke-feedback-concurrent');
});

test('menu closes on release', async () => {
  using menu = mountMenu({ items });
  await using drag = await openMenu(menu.surface);
  await drag.release();
  await waitForMenuClosed(menu.surface);
});

test('gesture feedback fades after its duration', async () => {
  using menu = mountMenu({
    items,
    gestureFeedbackDuration: GESTURE_FEEDBACK_DURATION,
  });
  using _timers = fakeTimers();
  const center = centerOf(menu.surface);
  await using drag = await press(center);
  await drag.moveTo(
    offset(center, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS),
    1,
  );
  await drag.release();

  await vi.advanceTimersByTimeAsync(GESTURE_FEEDBACK_DURATION);

  expect(
    menu.surface
      .querySelector('.marking-menu')
      ?.shadowRoot?.querySelector('svg'),
  ).toBeNull();
});

test('growing opening indicator mid-dwell, before novice mode opens', async () => {
  using menu = mountMenu({ items });
  using _timers = fakeTimers();
  const center = centerOf(menu.surface);
  await using _drag = await press(center);

  // Half of the default novice dwelling time (1000 / 3 ms): far enough
  // along to show a partial sector, short enough to stay well clear of
  // the dwell actually firing and opening the menu.
  await vi.advanceTimersByTimeAsync(1000 / 6);

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('opening-indicator-mid-dwell');
});

test('64px dead zone menu open', async () => {
  using menu = mountMenu({ items, deadZoneRadius: 64 });
  await using _drag = await openMenu(menu.surface);
  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('menu-dead-zone-64-open');
});

test('64px dead zone active right item', async () => {
  using menu = mountMenu({ items, deadZoneRadius: 64 });
  await using drag = await openMenu(menu.surface);
  await drag.moveTo(
    offset(drag.at, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS),
  );

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('menu-dead-zone-64-active-right');
});

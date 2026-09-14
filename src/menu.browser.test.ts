import {
  centerOf,
  mountMenu,
  moveTo,
  offset,
  pressAt,
  releaseAt,
  TOP_LEVEL_ITEMS,
  waitForMenuOpen,
  type Point,
} from './__fixtures__/browser-menu.js';

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

const openMenu = async (surface: Element): Promise<Point> => {
  const center = centerOf(surface);
  await pressAt(center);
  await waitForMenuOpen(surface);
  return center;
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
  await openMenu(menu.surface);
  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('menu-default-open');
});

test('menu and stroke escape a visible-overflow parent', async () => {
  using menu = mountMenu({ items });
  const center = await openMenu(menu.surface);
  await moveTo(offset(center, 0, 200));

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('stroke-overflow-visible');
});

test('overflow hidden clips an escaping menu and stroke', async () => {
  using menu = mountMenu({ items });
  menu.surface.style.overflow = 'hidden';
  const center = await openMenu(menu.surface);
  await moveTo(offset(center, 0, 200));

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('stroke-overflow-hidden');
});

for (const [id, item] of Object.entries(TOP_LEVEL_ITEMS)) {
  test(`active ${id} item`, async () => {
    using menu = mountMenu({ items });
    const center = await openMenu(menu.surface);
    await moveTo(offset(center, item.angle, ACTIVE_RADIUS));
    await expect
      .element(menu.snapshotArea)
      .toMatchScreenshot(`menu-active-${id}`);
  });
}

test('themed menu open', async () => {
  using menu = mountMenu({ items });
  setTheme(menu.surface);
  await openMenu(menu.surface);
  await expect.element(menu.snapshotArea).toMatchScreenshot('menu-themed-open');
});

test('themed active right item', async () => {
  using menu = mountMenu({ items });
  setTheme(menu.surface);
  const center = await openMenu(menu.surface);
  await moveTo(offset(center, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS));

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('menu-themed-active-right');
});

test('novice stroke and origin marker', async () => {
  using menu = mountMenu({ items });
  const center = await openMenu(menu.surface);
  await moveTo(offset(center, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS));

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('stroke-novice-origin');
});

test('concurrent normal and canceled feedback', async () => {
  using menu = mountMenu({ items });
  const center = centerOf(menu.surface);
  await pressAt(center);
  await moveTo(offset(center, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS), 1);
  await releaseAt();
  await pressAt(offset(center, 0, 30));
  await releaseAt();

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('stroke-feedback-concurrent');
});

test('64px dead zone menu open', async () => {
  using menu = mountMenu({ items, deadZoneRadius: 64 });
  await openMenu(menu.surface);
  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('menu-dead-zone-64-open');
});

test('64px dead zone active right item', async () => {
  using menu = mountMenu({ items, deadZoneRadius: 64 });
  const center = await openMenu(menu.surface);
  await moveTo(offset(center, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS));

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('menu-dead-zone-64-active-right');
});

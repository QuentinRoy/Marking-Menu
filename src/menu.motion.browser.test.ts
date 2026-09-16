import { commands } from 'vitest/browser';
import {
  centerOf,
  mountMenu,
  offset,
  openMenu,
  press,
  TOP_LEVEL_ITEMS,
} from './__fixtures__/browser-menu.js';
import { fakeTimers } from './__fixtures__/timers.js';

const items = [
  { id: 'right', label: 'Right' },
  { id: 'down-right', label: 'Down-Right' },
  { id: 'down-left', label: 'Down-Left' },
  { id: 'left', label: 'Left' },
] as const;

const ACTIVE_RADIUS = 100;

afterEach(async () => {
  await commands.emulateMedia({
    reducedMotion: 'no-preference',
    forcedColors: 'none',
  });
});

test('opening indicator stays a fixed size and fades in under reduced motion', async () => {
  await commands.emulateMedia({ reducedMotion: 'reduce' });
  using menu = mountMenu({ items: [{ id: 'right', label: 'Right' }] });
  using _timers = fakeTimers();
  const center = centerOf(menu.surface);
  await using _drag = await press(center);

  // Half of the default novice dwelling time (1000 / 3 ms), same margin
  // `menu.browser.test.ts`'s equivalent full-motion test uses.
  await vi.advanceTimersByTimeAsync(1000 / 6);

  const root = menu.surface.querySelector('.marking-menu')?.shadowRoot;
  const dot = root?.querySelector('.marking-menu-indicator-dot');
  const background = root?.querySelector('.marking-menu-indicator-background');
  expect(dot?.getAttribute('r')).toBe(background?.getAttribute('r'));
  const opacity = Number(getComputedStyle(dot as Element).opacity);
  expect(opacity).toBeGreaterThan(0);
  expect(opacity).toBeLessThan(1);
});

test('opening indicator mid-dwell under reduced motion', async () => {
  await commands.emulateMedia({ reducedMotion: 'reduce' });
  using menu = mountMenu({ items: [{ id: 'right', label: 'Right' }] });
  using _timers = fakeTimers();
  const center = centerOf(menu.surface);
  await using _drag = await press(center);
  await vi.advanceTimersByTimeAsync(1000 / 6);

  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('opening-indicator-mid-dwell-reduced-motion');
});

test('wedge and plate colors switch to system colors under forced colors', async () => {
  using menu = mountMenu({ items });
  await using _drag = await openMenu(menu.surface);

  const root = menu.surface.querySelector('.marking-menu')?.shadowRoot;
  const wedge = root?.querySelector('.marking-menu-wedge') as Element;
  const defaultFill = getComputedStyle(wedge).fill;

  await commands.emulateMedia({ forcedColors: 'active' });
  await expect.poll(() => getComputedStyle(wedge).fill).not.toBe(defaultFill);

  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  probe.style.fill = 'ButtonFace';
  document.body.append(probe);
  const expectedFill = getComputedStyle(probe).fill;
  probe.remove();

  expect(getComputedStyle(wedge).fill).toBe(expectedFill);
});

test('wedge and plate outlines use a system color and are not suppressed under forced colors', async () => {
  using menu = mountMenu({ items });
  menu.surface.style.setProperty('--mm-wedge-outline-width', '3px');
  menu.surface.style.setProperty('--mm-plate-outline-width', '3px');
  await commands.emulateMedia({ forcedColors: 'active' });
  await using _drag = await openMenu(menu.surface);

  const probe = document.createElement('div');
  probe.style.color = 'ButtonText';
  document.body.append(probe);
  const buttonText = getComputedStyle(probe).color;
  probe.remove();

  const root = menu.surface.querySelector('.marking-menu')?.shadowRoot;
  const wedgeOutline = root?.querySelector(
    '.marking-menu-wedge-outline',
  ) as Element;
  expect(getComputedStyle(wedgeOutline).stroke).toBe(buttonText);
  expect(getComputedStyle(wedgeOutline).strokeWidth).toBe('6px');

  const plate = root?.querySelector('.marking-menu-plate') as Element;
  expect(getComputedStyle(plate).boxShadow).toBe(
    `${buttonText} 0px 0px 0px 3px inset`,
  );
});

test('the outer connector switches from a system color to another when active, under forced colors', async () => {
  await commands.emulateMedia({ forcedColors: 'active' });
  using menu = mountMenu({ items });
  await using drag = await openMenu(menu.surface);

  const root = menu.surface.querySelector('.marking-menu')?.shadowRoot;
  const connector = root?.querySelector(
    '.marking-menu-outer-connector',
  ) as Element;
  const restingColor = getComputedStyle(connector).backgroundColor;

  await drag.moveTo(
    offset(drag.at, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS),
  );
  const activeColor = getComputedStyle(connector).backgroundColor;

  expect(activeColor).not.toBe(restingColor);
  expect(activeColor).not.toBe('rgba(0, 0, 0, 0)');
});

test('menu open with no active item under forced colors', async () => {
  await commands.emulateMedia({ forcedColors: 'active' });
  using menu = mountMenu({ items });
  await using _drag = await openMenu(menu.surface);
  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('menu-forced-colors-open');
});

test('menu open with an active item under forced colors', async () => {
  await commands.emulateMedia({ forcedColors: 'active' });
  using menu = mountMenu({ items });
  await using drag = await openMenu(menu.surface);
  await drag.moveTo(
    offset(drag.at, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS),
  );
  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('menu-forced-colors-active-right');
});

test('a stroke mid-draw under forced colors', async () => {
  await commands.emulateMedia({ forcedColors: 'active' });
  using menu = mountMenu({ items });
  const center = centerOf(menu.surface);
  await using drag = await press(center);
  await drag.moveTo(offset(center, TOP_LEVEL_ITEMS.right.angle, ACTIVE_RADIUS));
  await expect
    .element(menu.snapshotArea)
    .toMatchScreenshot('stroke-forced-colors-mid-draw');
});

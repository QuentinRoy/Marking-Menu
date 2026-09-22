import axe from 'axe-core';
import { page, userEvent } from 'vitest/browser';
import {
  centerOf,
  expectFocused,
  mountMenu,
  offset,
  openMenu,
  press,
} from './__fixtures__/browser-menu.js';
import { fakeTimers } from './__fixtures__/timers.js';

// Angles are stated explicitly so each label keeps sitting at its own name's
// direction, matching the `offset(..., angle, ...)` gestures below regardless
// of the model's default spread for unstated angles.
const items = [
  { id: 'right', label: 'Right', angle: 0 },
  {
    id: 'others',
    label: 'Others...',
    angle: 90,
    items: [{ label: 'Sub Right' }],
  },
  { id: 'left', label: 'Left', angle: 180 },
  { id: 'up', label: 'Up', angle: 270 },
] as const;

const ACTIVE_RADIUS = 100;

const expectNoViolations = async (surface: Element): Promise<void> => {
  const { violations } = await axe.run(surface, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] },
  });
  expect(violations).toEqual([]);
};

test('closed menu has no axe violations', async () => {
  using menu = mountMenu({ items });
  await expectNoViolations(menu.surface);
});

test('open menu has no axe violations', async () => {
  using menu = mountMenu({ items });
  await using _drag = await openMenu(menu.surface);
  await expectNoViolations(menu.surface);
});

test.for([
  ['leaf', 0],
  ['non-leaf', 90],
] as const)(
  'open menu with an active %s item has no axe violations',
  async ([, angle]) => {
    using menu = mountMenu({ items });
    await using drag = await openMenu(menu.surface);
    await drag.moveTo(offset(drag.at, angle, ACTIVE_RADIUS));
    await expect
      .poll(() =>
        menu.surface
          .querySelector('.marking-menu')
          ?.shadowRoot?.querySelector('.marking-menu-item.active'),
      )
      .not.toBeNull();
    await expectNoViolations(menu.surface);
  },
);

test('items are menuitems named by their labels', async () => {
  using menu = mountMenu({ items });
  await using _drag = await openMenu(menu.surface);
  await expect.element(page.getByRole('menu')).toBeInTheDocument();
  for (const { label } of items) {
    // eslint-disable-next-line no-await-in-loop
    await expect
      .element(page.getByRole('menuitem', { name: label, exact: true }))
      .toBeInTheDocument();
  }
});

test('only non-leaf items announce a submenu', async () => {
  using menu = mountMenu({ items });
  await using _drag = await openMenu(menu.surface);
  await expect
    .element(page.getByRole('menuitem', { name: 'Others...' }))
    .toHaveAttribute('aria-haspopup', 'menu');
  await expect
    .element(page.getByRole('menuitem', { name: 'Right' }))
    .not.toHaveAttribute('aria-haspopup');
});

test('menu and items take focus from script only', async () => {
  using menu = mountMenu({ items });
  const after = document.createElement('button');
  menu.snapshotArea.append(after);
  await using _drag = await openMenu(menu.surface);

  const menuElement = page.getByRole('menu');
  await expect.element(menuElement).toHaveAttribute('tabindex', '-1');
  for (const item of page.getByRole('menuitem').elements()) {
    expect(item).toHaveAttribute('tabindex', '-1');
  }

  // `activeElement` is a DOM API and can be `null`, not `undefined`.
  // eslint-disable-next-line @typescript-eslint/no-restricted-types
  (document.activeElement as HTMLElement | null)?.blur();
  await userEvent.tab();
  expect(after).toHaveFocus();
});

test('decorative surfaces stay out of the accessibility tree', async () => {
  using menu = mountMenu({ items, gestureFeedbackDuration: 10_000 });
  const root = menu.surface.querySelector('.marking-menu')?.shadowRoot;
  await using first = await press(centerOf(menu.surface));
  await first.moveTo(offset(first.at, 0, ACTIVE_RADIUS));
  await first.release();
  await using drag = await openMenu(menu.surface);
  // Lingering on the non-leaf item shows the opening indicator.
  await drag.moveTo(offset(drag.at, 90, ACTIVE_RADIUS));
  await expect
    .poll(() => root?.querySelector('.marking-menu-indicator-background'))
    .not.toBeNull();

  const decorations = root?.querySelectorAll(
    'svg, .marking-menu-inner-connector, .marking-menu-outer-connector',
  );
  // 4 wedges, 8 connectors, 2 strokes, 2 indicator layers, 1 feedback.
  expect(decorations).toHaveLength(17);
  for (const element of decorations ?? []) {
    expect(element.closest('[aria-hidden="true"]')).not.toBeNull();
  }
});

test('the menu container takes focus on open', async () => {
  using menu = mountMenu({ items });
  await using _drag = await openMenu(menu.surface);
  await expectFocused('menu');
});

test('the active item takes focus only once it has stayed active for 50ms', async () => {
  using menu = mountMenu({ items });
  await using drag = await openMenu(menu.surface);

  using _timers = fakeTimers();
  await drag.moveTo(offset(drag.at, 0, ACTIVE_RADIUS));
  await vi.advanceTimersByTimeAsync(49);
  await expectFocused('menu');

  await vi.advanceTimersByTimeAsync(1);
  await expectFocused('menuitem', { name: 'Right' });
});

test("changing the active item before 50ms cancels the earlier item's pending focus move", async () => {
  using menu = mountMenu({ items });
  await using drag = await openMenu(menu.surface);

  using _timers = fakeTimers();
  await drag.moveTo(offset(drag.at, 0, ACTIVE_RADIUS));
  await vi.advanceTimersByTimeAsync(30);
  await drag.moveTo(offset(drag.at, 180, ACTIVE_RADIUS));
  // "Right"'s own 50ms move, scheduled at the 0ms mark, would fire around
  // now were it not canceled.
  await vi.advanceTimersByTimeAsync(21);
  await expectFocused('menu');

  await vi.advanceTimersByTimeAsync(29);
  await expectFocused('menuitem', { name: 'Left' });
});

test('focus follows the active item as it changes', async () => {
  using menu = mountMenu({ items });
  await using drag = await openMenu(menu.surface);
  await drag.moveTo(offset(drag.at, 0, ACTIVE_RADIUS));
  await expectFocused('menuitem', { name: 'Right' });
  await drag.moveTo(offset(drag.at, 180, ACTIVE_RADIUS));
  await expectFocused('menuitem', { name: 'Left' });
});

test('the submenu container takes focus when it opens', async () => {
  using menu = mountMenu({ items });
  await using drag = await openMenu(menu.surface);
  await drag.moveTo(offset(drag.at, 90, ACTIVE_RADIUS));
  await expect
    .element(page.getByRole('menuitem', { name: 'Sub Right' }))
    .toBeInTheDocument();
  await expectFocused('menu');
});

test("selecting an item restores the host's previously focused element", async () => {
  using menu = mountMenu({ items });
  const before = document.createElement('button');
  before.textContent = 'Before';
  menu.snapshotArea.append(before);
  before.focus();

  await using drag = await openMenu(menu.surface);
  await drag.moveTo(offset(drag.at, 0, ACTIVE_RADIUS));
  await expectFocused('menuitem', { name: 'Right' });
  await drag.release();

  await expect
    .element(page.getByRole('button', { name: 'Before' }))
    .toHaveFocus();
});

test("selecting before an item's own 50ms focus move fires still restores the host's focus", async () => {
  using menu = mountMenu({ items });
  const before = document.createElement('button');
  before.textContent = 'Before';
  menu.snapshotArea.append(before);
  before.focus();

  await using drag = await openMenu(menu.surface);
  using _timers = fakeTimers();
  await drag.moveTo(offset(drag.at, 0, ACTIVE_RADIUS));
  await drag.release();
  // The item's own pending focus move would fire around now, stealing focus
  // back from `before`, were `select` not canceling it.
  await vi.advanceTimersByTimeAsync(50);

  await expect
    .element(page.getByRole('button', { name: 'Before' }))
    .toHaveFocus();
});

test('pressing the menu surface does not move focus by itself', async () => {
  using menu = mountMenu({ items });
  const sibling = document.createElement('button');
  sibling.textContent = 'Sibling';
  menu.snapshotArea.append(sibling);
  sibling.focus();

  await using _drag = await press(centerOf(menu.surface));
  await expect
    .element(page.getByRole('button', { name: 'Sibling' }))
    .toHaveFocus();
});

test('an expert-mode gesture never moves focus', async () => {
  using menu = mountMenu({ items });
  const sibling = document.createElement('button');
  sibling.textContent = 'Sibling';
  menu.snapshotArea.append(sibling);
  sibling.focus();

  // Past the default `movementsThreshold` (5px) before any dwell: straight
  // into expert mode, where no menu ever opens.
  await using _drag = await press(centerOf(menu.surface));
  await _drag.moveTo(offset(centerOf(menu.surface), 0, ACTIVE_RADIUS));
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });

  await expect
    .element(page.getByRole('button', { name: 'Sibling' }))
    .toHaveFocus();
});

test("canceling a gesture restores the host's previously focused element", async () => {
  using menu = mountMenu({ items });
  const before = document.createElement('button');
  before.textContent = 'Before';
  menu.snapshotArea.append(before);
  before.focus();

  await using drag = await openMenu(menu.surface);
  await drag.moveTo(offset(drag.at, 0, ACTIVE_RADIUS));
  await expectFocused('menuitem', { name: 'Right' });
  await drag.moveTo(centerOf(menu.surface));
  await drag.release();

  await expect
    .element(page.getByRole('button', { name: 'Before' }))
    .toHaveFocus();
});

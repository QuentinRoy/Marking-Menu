import { commands, page, userEvent } from 'vitest/browser';
import {
  centerOf,
  expectFocused,
  mountMenu,
  press,
} from './__fixtures__/browser-menu.js';

afterEach(async () => {
  await commands.emulateMedia({ forcedColors: 'none' });
});

// "Right" is pinned to the right, so the labels match the ring whatever the
// default start is.
const items = [
  { id: 'right', label: 'Right', angle: 0 },
  {
    id: 'others',
    label: 'Others...',
    items: [
      { id: 'sub-right', label: 'Sub Right', angle: 0 },
      { label: 'Sub Left' },
    ],
  },
  { id: 'left', label: 'Left' },
  { id: 'up', label: 'Up' },
] as const;

/**
 The item's own container is a zero-size positioning anchor (see
 `browser-menu.ts`'s `waitForMenuOpen` comment), which Playwright refuses to
 hover or click as not visible. Its plate is the item's real, visibly sized
 hit target; a pointer landing on it still resolves to the item, since the
 source walks up from wherever the event actually lands.
 */
const plateOf = (name: string): Element => {
  const plate =
    page
      .getByRole('menuitem', { name })
      .element()
      .querySelector('.marking-menu-plate') ?? undefined;
  if (plate === undefined) {
    throw new Error(`No plate found for the "${name}" item.`);
  }

  return plate;
};

/**
 A menu between two buttons: one holding focus before it opens, and one
 following it in the tab order.
 */
const mountBetweenButtons = () => {
  const menu = mountMenu({ items });
  const before = document.createElement('button');
  before.textContent = 'Before';
  const after = document.createElement('button');
  after.textContent = 'After';
  menu.snapshotArea.prepend(before);
  menu.snapshotArea.append(after);
  before.focus();

  const events: string[] = [];
  const cancellationReasons: string[] = [];
  for (const type of ['open', 'change', 'select', 'cancel'] as const) {
    menu.mm.on(type, (event) => {
      events.push(`${type}:${event.mode}`);
      if (event.type === 'cancel') {
        cancellationReasons.push(event.reason);
      }
    });
  }

  return Object.assign(menu, { before, after, events, cancellationReasons });
};

test('taking focus puts it on the first item, and the item becomes active', async () => {
  using menu = mountBetweenButtons();

  menu.mm.open();

  await expectFocused('menuitem', { name: 'Right' });
  expect(menu.events).toEqual(['open:standalone', 'change:standalone']);
});

test('each arrow key moves focus that way around the ring', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await expectFocused('menuitem', { name: 'Right' });

  await userEvent.keyboard('{ArrowDown}');
  await expectFocused('menuitem', { name: 'Others...' });
  await userEvent.keyboard('{ArrowLeft}');
  await expectFocused('menuitem', { name: 'Left' });
  await userEvent.keyboard('{ArrowUp}');
  await expectFocused('menuitem', { name: 'Up' });
  await userEvent.keyboard('{ArrowRight}');
  await expectFocused('menuitem', { name: 'Right' });
  expect(menu.events).toEqual([
    'open:standalone',
    ...Array.from({ length: 5 }, () => 'change:standalone'),
  ]);
});

test('Enter on a leaf selects it, and focus goes back to where it was', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await userEvent.keyboard('{ArrowDown}{ArrowLeft}');
  await expectFocused('menuitem', { name: 'Left' });

  await userEvent.keyboard('{Enter}');

  await expect.poll(() => menu.before === document.activeElement).toBe(true);
  expect(menu.events.at(-1)).toBe('select:standalone');
});

test('Escape backs out of a submenu, then cancels from the root and gives focus back', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await userEvent.keyboard('{ArrowDown}{Enter}');
  await expectFocused('menuitem', { name: 'Sub Right' });

  await userEvent.keyboard('{Escape}');
  await expectFocused('menuitem', { name: 'Others...' });
  expect(menu.events).not.toContain('cancel:standalone');

  await userEvent.keyboard('{Escape}');
  await expect.poll(() => menu.before === document.activeElement).toBe(true);
  expect(menu.events.at(-1)).toBe('cancel:standalone');
});

test('Tab closes the menu and moves on to the next element', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await expectFocused('menuitem', { name: 'Right' });

  await userEvent.tab();

  await expect.poll(() => menu.after === document.activeElement).toBe(true);
  expect(menu.events.at(-1)).toBe('cancel:standalone');
});

test('a menu opened without autofocus leaves focus alone, and stays reachable with Tab', async () => {
  using menu = mountBetweenButtons();

  menu.mm.open({ autoFocus: false });

  expect(document.activeElement).toBe(menu.before);
  expect(menu.events).toEqual(['open:standalone']);

  await userEvent.tab();
  await expectFocused('menuitem', { name: 'Right' });
  await expect
    .poll(() => menu.events)
    .toEqual(['open:standalone', 'change:standalone']);
});

test('a menu opened without autofocus still restores focus to its trigger when closed', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open({ autoFocus: false });
  menu.after.focus();

  menu.mm.close();

  expect(document.activeElement).toBe(menu.before);
  expect(menu.events.at(-1)).toBe('cancel:standalone');
});

test('losing focus cancels a standalone menu without moving it back', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await expectFocused('menuitem', { name: 'Right' });

  menu.after.focus();

  await expect.poll(() => menu.after === document.activeElement).toBe(true);
  expect(menu.events.at(-1)).toBe('cancel:standalone');
  expect(menu.cancellationReasons).toEqual(['dismissed']);
});

test('a menu opened without autofocus closes on focus loss only after focus enters it', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open({ autoFocus: false });

  menu.after.focus();
  expect(menu.events).toEqual(['open:standalone']);

  menu.before.focus();
  await userEvent.tab();
  await expectFocused('menuitem', { name: 'Right' });
  menu.after.focus();

  await expect.poll(() => menu.after === document.activeElement).toBe(true);
  expect(menu.events.at(-1)).toBe('cancel:standalone');
});

test('hovering an item with the mouse makes it active, without moving focus', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await expectFocused('menuitem', { name: 'Right' });

  await userEvent.hover(plateOf('Left'));

  await expect
    .element(page.getByRole('menuitem', { name: 'Left' }))
    .toHaveClass('active');
  await expectFocused('menuitem', { name: 'Right' });
  expect(menu.events.at(-1)).toBe('change:standalone');
});

test('clicking a leaf selects it and gives focus back to where it was', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();

  await userEvent.click(plateOf('Left'));

  await expect.poll(() => menu.before === document.activeElement).toBe(true);
  expect(menu.events.at(-1)).toBe('select:standalone');
});

test('clicking a submenu item opens it and focuses the new level, not any item', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();

  await userEvent.click(plateOf('Others...'));

  await expect
    .element(page.getByRole('menuitem', { name: 'Sub Right' }))
    .toBeInTheDocument();
  await expectFocused('menu');
  expect(menu.events).toContain('change:standalone');
  expect(menu.events).not.toContain('select:standalone');
});

test('a canceled touch contact clears the active item and leaves the menu open', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  const drag = await press(centerOf(plateOf('Left')));
  await expect
    .element(page.getByRole('menuitem', { name: 'Left' }))
    .toHaveClass('active');

  await drag.cancel();

  await expect
    .element(page.getByRole('menuitem', { name: 'Left' }))
    .not.toHaveClass('active');
  expect(menu.events.at(-1)).toBe('change:standalone');
  await expect.element(page.getByRole('menu')).toBeInTheDocument();
});

// With `touch-action: none`, the browser keeps a touch drag instead of
// canceling it to pan, and routes every event of that drag to the item
// first pressed unless the menu lets go of it.
test('a touch drag under touch-action: none follows the finger onto another item', async () => {
  using menu = mountBetweenButtons();
  menu.surface.style.touchAction = 'none';
  const selections: Array<string | undefined> = [];
  menu.mm.on('select', (event) => {
    selections.push(event.selection.id);
  });
  menu.mm.open();
  await expectFocused('menuitem', { name: 'Right' });

  await using drag = await press(centerOf(plateOf('Left')));
  await drag.moveTo(centerOf(plateOf('Up')));
  await expect
    .element(page.getByRole('menuitem', { name: 'Up' }))
    .toHaveClass('active');
  await drag.release();

  await expect.poll(() => selections).toEqual(['up']);
});

test('a touch drag under touch-action: none released off the menu cancels it', async () => {
  using menu = mountBetweenButtons();
  menu.surface.style.touchAction = 'none';
  menu.mm.open();
  await expectFocused('menuitem', { name: 'Right' });

  await using drag = await press(centerOf(plateOf('Left')));
  const surfaceBox = menu.surface.getBoundingClientRect();
  await drag.moveTo({ x: surfaceBox.x + 5, y: surfaceBox.y + 5 });
  await drag.release();

  await expect.poll(() => menu.events.at(-1)).toBe('cancel:standalone');
  expect(menu.events).not.toContain('select:standalone');
});

test('clicking outside the menu dismisses it without restoring focus', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await expectFocused('menuitem', { name: 'Right' });

  await userEvent.click(menu.after);

  await expect.poll(() => menu.after === document.activeElement).toBe(true);
  expect(menu.events.at(-1)).toBe('cancel:standalone');
  expect(menu.cancellationReasons).toEqual(['dismissed']);
});

test('the page pointer draws a gesture again right after an outside press dismisses the menu', async () => {
  using menu = mountBetweenButtons();
  const started: string[] = [];
  menu.mm.on('start', () => {
    started.push('start');
  });
  menu.mm.open();

  // The very outside press that dismisses the menu must not itself also be
  // read as the start of a new gesture on the now-resumed surface.
  await userEvent.click(menu.after);
  expect(started).toEqual([]);

  // A later, independent press does start one.
  await userEvent.click(menu.surface);
  expect(started).toEqual(['start']);
});

test('a standalone menu is a pointer target, with items showing a pointer cursor', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await expectFocused('menuitem', { name: 'Right' });

  const root = menu.surface.querySelector('.marking-menu')?.shadowRoot;
  const layer = root?.querySelector('.marking-menu-layer');
  expect(layer?.classList.contains('marking-menu--pointer-target')).toBe(true);

  const item = root?.querySelector('.marking-menu-item');
  expect(getComputedStyle(item as Element).cursor).toBe('pointer');
});

test('in a standalone menu, the outer connector switches from a system color to another when active, under forced colors', async () => {
  await commands.emulateMedia({ forcedColors: 'active' });
  using menu = mountBetweenButtons();
  menu.mm.open();
  await expectFocused('menuitem', { name: 'Right' });

  const root = menu.surface.querySelector('.marking-menu')?.shadowRoot;
  // `:scope` doesn't resolve against a bare `ShadowRoot`, only an `Element`.
  // eslint-disable-next-line unicorn/prefer-scoped-selector
  const connector = root?.querySelector(
    '.marking-menu-item.active .marking-menu-outer-connector rect',
  ) as Element;
  const activeColor = getComputedStyle(connector).fill;

  await userEvent.keyboard('{ArrowDown}');
  const restingColor = getComputedStyle(connector).fill;

  expect(activeColor).not.toBe(restingColor);
  expect(activeColor).not.toBe('none');
});

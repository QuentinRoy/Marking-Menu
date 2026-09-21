import { userEvent } from 'vitest/browser';
import { expectFocused, mountMenu } from './__fixtures__/browser-menu.js';

const items = [
  { id: 'right', label: 'Right' },
  {
    id: 'others',
    label: 'Others...',
    items: [{ id: 'sub-right', label: 'Sub Right' }, { label: 'Sub Down' }],
  },
  { id: 'left', label: 'Left' },
  { id: 'up', label: 'Up' },
] as const;

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
  for (const type of ['open', 'change', 'select', 'cancel'] as const) {
    menu.mm.on(type, (event) => {
      events.push(`${type}:${event.mode}`);
    });
  }

  return Object.assign(menu, { before, after, events });
};

test('taking focus puts it on the first item, and the item becomes active', async () => {
  using menu = mountBetweenButtons();

  menu.mm.open();

  await expectFocused('menuitem', { name: 'Right' });
  expect(menu.events).toEqual(['open:standalone', 'change:standalone']);
});

test('the arrow keys, Home and End move focus around the ring', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await expectFocused('menuitem', { name: 'Right' });

  await userEvent.keyboard('{ArrowDown}');
  await expectFocused('menuitem', { name: 'Others...' });
  await userEvent.keyboard('{End}');
  await expectFocused('menuitem', { name: 'Up' });
  await userEvent.keyboard('{ArrowDown}');
  await expectFocused('menuitem', { name: 'Right' });
  await userEvent.keyboard('{ArrowUp}');
  await expectFocused('menuitem', { name: 'Up' });
  await userEvent.keyboard('{Home}');
  await expectFocused('menuitem', { name: 'Right' });
});

test('ArrowRight goes into a submenu and ArrowLeft comes back to its item', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await userEvent.keyboard('{ArrowDown}');
  await expectFocused('menuitem', { name: 'Others...' });

  await userEvent.keyboard('{ArrowRight}');
  await expectFocused('menuitem', { name: 'Sub Right' });

  await userEvent.keyboard('{ArrowLeft}');
  await expectFocused('menuitem', { name: 'Others...' });
});

test('Enter on a leaf selects it, and focus goes back to where it was', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await userEvent.keyboard('{ArrowDown}{ArrowDown}');
  await expectFocused('menuitem', { name: 'Left' });

  await userEvent.keyboard('{Enter}');

  await expect.poll(() => menu.before === document.activeElement).toBe(true);
  expect(menu.events.at(-1)).toBe('select:standalone');
});

test('Enter on a submenu item opens it instead of selecting', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await userEvent.keyboard('{ArrowDown}{Enter}');

  await expectFocused('menuitem', { name: 'Sub Right' });
  expect(menu.events).not.toContain('select:standalone');
});

test('Escape backs out of a submenu, then cancels from the root and gives focus back', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await userEvent.keyboard('{ArrowDown}{ArrowRight}');
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

test('a menu only displayed leaves focus alone, and stays reachable with Tab', async () => {
  using menu = mountBetweenButtons();

  menu.mm.open({ focus: false });

  expect(document.activeElement).toBe(menu.before);
  expect(menu.events).toEqual(['open:standalone']);

  await userEvent.tab();
  await expectFocused('menuitem', { name: 'Right' });
  await expect
    .poll(() => menu.events)
    .toEqual(['open:standalone', 'change:standalone']);
});

test('a menu only displayed hands no focus back when it closes', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open({ focus: false });
  menu.after.focus();

  menu.mm.close();

  expect(document.activeElement).toBe(menu.after);
  expect(menu.events.at(-1)).toBe('cancel:standalone');
});

test('close() cancels an open menu and gives focus back', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await expectFocused('menuitem', { name: 'Right' });

  menu.mm.close();

  expect(document.activeElement).toBe(menu.before);
  expect(menu.events.at(-1)).toBe('cancel:standalone');
});

import { commands, page, userEvent } from 'vitest/browser';
import { createMarkingMenu } from '../create-marking-menu.js';
import {
  centerOf,
  expectFocused,
  mountMenu,
  mouseMoveTo,
  mousePressAt,
  mouseReleaseAt,
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

const createNestedMenu = (nesting: 'shadow' | 'iframe') => {
  const iframe =
    nesting === 'iframe' ? document.createElement('iframe') : undefined;
  if (iframe) {
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '20px',
      top: '20px',
      width: '400px',
      height: '400px',
      border: '0',
    });
    document.body.append(iframe);
  }

  const doc = iframe?.contentDocument ?? document;
  const shadowHost =
    nesting === 'shadow' ? doc.createElement('div') : undefined;
  if (shadowHost) {
    shadowHost.style.cssText =
      'position:fixed;left:20px;top:20px;width:300px;height:300px;';
    doc.body.append(shadowHost);
  }

  const root = shadowHost?.attachShadow({ mode: 'open' }) ?? doc.body;
  const trigger = doc.createElement('button');
  trigger.textContent = 'Open';
  const surface = doc.createElement('div');
  surface.style.cssText =
    'position:fixed;left:20px;top:20px;width:300px;height:300px;';
  root.append(trigger, surface);

  const mm = createMarkingMenu({ parent: surface, items });
  const events: string[] = [];
  for (const type of ['select', 'cancel'] as const) {
    mm.on(type, () => {
      events.push(type);
    });
  }

  const itemCenter = (label: string) => {
    const host = surface.querySelector('.marking-menu');
    const target = [
      ...(host?.shadowRoot?.querySelectorAll<HTMLElement>(
        '.marking-menu-label',
      ) ?? []),
    ].find((element) => element.textContent === label);
    if (!target) {
      throw new Error(`The ${label} label is missing.`);
    }

    const box = target.getBoundingClientRect();
    const frameBox = iframe?.getBoundingClientRect();
    return {
      x: (frameBox?.left ?? 0) + box.x + box.width / 2,
      y: (frameBox?.top ?? 0) + box.y + box.height / 2,
    };
  };

  return {
    events,
    iframe,
    itemCenter,
    mm,
    surface,
    [Symbol.dispose]() {
      mm.dispose();
      iframe?.remove();
      shadowHost?.remove();
    },
  };
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
  if (!item) {
    throw new Error('The menu item is missing.');
  }

  expect(getComputedStyle(item).cursor).toBe('pointer');
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
  );
  if (!connector) {
    throw new Error('The active menu connector is missing.');
  }

  const activeColor = getComputedStyle(connector).fill;

  await userEvent.keyboard('{ArrowDown}');
  const restingColor = getComputedStyle(connector).fill;

  expect(activeColor).not.toBe(restingColor);
  expect(activeColor).not.toBe('none');
});

test('a hotkey opens the menu, and a key pressed inside it does not reopen it', async () => {
  using menu = mountMenu({ items });
  const onKeydown = ({ key, target }: KeyboardEvent): void => {
    const isInsideMenu =
      target instanceof Node && menu.surface.contains(target);
    if (key === 'm' && !isInsideMenu) {
      menu.mm.open();
    }
  };

  document.addEventListener('keydown', onKeydown);

  using _listener = {
    [Symbol.dispose]() {
      document.removeEventListener('keydown', onKeydown);
    },
  };

  await userEvent.keyboard('m');
  await expectFocused('menuitem', { name: 'Right' });
  await userEvent.keyboard('m');
  await expectFocused('menuitem', { name: 'Right' });
});

test('moving the mouse away from a standalone menu clears its active item', async () => {
  using menu = mountBetweenButtons();
  menu.mm.open();
  await userEvent.hover(plateOf('Left'));
  await expect
    .element(page.getByRole('menuitem', { name: 'Left' }))
    .toHaveClass('active');

  await mouseMoveTo({ x: 780, y: 580 });

  await expect
    .poll(() =>
      menu.surface
        .querySelector('.marking-menu')
        ?.shadowRoot?.querySelector('.marking-menu-item.active'),
    )
    .toBeNull();
  await expect.element(page.getByRole('menu')).toBeInTheDocument();
});

test('a standalone menu inside a shadow root selects an item and dismisses on an outside press', async () => {
  using menu = createNestedMenu('shadow');
  menu.mm.open();

  await mousePressAt(menu.itemCenter('Right'));
  await mouseReleaseAt();
  await expect.poll(() => menu.events).toEqual(['select']);

  menu.mm.open();
  await mousePressAt({ x: 780, y: 580 });
  await mouseReleaseAt();
  await expect.poll(() => menu.events).toEqual(['select', 'cancel']);
});

test('a standalone menu inside an iframe handles item clicks, outside presses, and a drag released outside the frame', async () => {
  using menu = createNestedMenu('iframe');
  menu.mm.open();

  await mousePressAt(menu.itemCenter('Right'));
  await mouseReleaseAt();
  await expect.poll(() => menu.events).toEqual(['select']);

  menu.mm.open();
  const frameBounds = menu.iframe?.getBoundingClientRect();
  if (!frameBounds) {
    throw new Error('The iframe is missing.');
  }

  await mousePressAt({ x: frameBounds.left + 370, y: frameBounds.top + 370 });
  await mouseReleaseAt();
  await expect.poll(() => menu.events).toEqual(['select', 'cancel']);

  menu.mm.open();
  await mouseMoveTo(menu.itemCenter('Left'));
  await mousePressAt(menu.itemCenter('Left'));
  await mouseMoveTo(
    { x: frameBounds.right + 100, y: frameBounds.top + 180 },
    4,
  );
  await mouseReleaseAt();
  await expect.poll(() => menu.events).toEqual(['select', 'cancel', 'cancel']);
});

import { userEvent } from 'vitest/browser';
import {
  moveMouse,
  press,
  pressMouse,
  type Point,
} from '../../__tests__/__fixtures__/browser-menu.js';
import {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  type MarkingMenuEventMap,
  type MarkingMenuEventSource,
} from '../../events.js';
import { createModel } from '../../model.js';
import type { KeyboardIntent, NavigationPhase } from '../machine.js';
import type { NavigationSend } from '../runtime.js';
import { createStandaloneSession } from '../standalone-session.js';
import { createMenuFixture, pointOf } from './__fixtures__/menu.js';

// Only the events' payload: the menu the session reads is the fixture's.
const model = createModel({
  items: [
    { id: 'leaf', label: 'Leaf', angle: 0 },
    { id: 'other', label: 'Other', angle: 180 },
  ],
});
const [item] = model.items;
type Model = typeof model;
type EventMap = MarkingMenuEventMap<Model>;

const standaloneOpen = (
  source: MarkingMenuEventSource,
  willAutoFocus = true,
): MarkingMenuOpenEvent<Model, 'standalone'> =>
  new MarkingMenuOpenEvent<Model, 'standalone'>({
    mode: 'standalone',
    position: source === 'pointer' ? [0, 0] : undefined,
    source,
    menu: model,
    menuCenter: [0, 0],
    willAutoFocus,
  });

const standaloneChange = (
  source: MarkingMenuEventSource,
): MarkingMenuChangeEvent<Model, 'standalone'> =>
  new MarkingMenuChangeEvent<Model, 'standalone'>({
    mode: 'standalone',
    position: source === 'pointer' ? [0, 0] : undefined,
    source,
    activeItem: item,
    previousActiveItem: undefined,
    menu: model,
  });

const standaloneCancel = (
  source: MarkingMenuEventSource,
): MarkingMenuCancelEvent<Model, 'standalone'> =>
  new MarkingMenuCancelEvent<Model, 'standalone'>({
    mode: 'standalone',
    position: source === 'pointer' ? [0, 0] : undefined,
    source,
    activeItem: undefined,
    menu: model,
    reason: 'dismissed',
  });

const standaloneSelect = new MarkingMenuSelectEvent<Model, 'standalone'>({
  mode: 'standalone',
  position: undefined,
  source: 'keyboard',
  selection: item,
  menu: model,
});

/**
 A session over a real menu and a stand-in runtime that records every input
 and announces what a test tells it to.
 */
const createFixture = () => {
  const menuFixture = createMenuFixture();
  const { parent, menu } = menuFixture;
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();

  const listeners = new Map<string, Set<(event: never) => void>>();
  const emit = <Name extends keyof EventMap>(
    type: Name,
    event: EventMap[Name],
  ): void => {
    for (const listener of listeners.get(type) ?? []) {
      listener(event as never);
    }
  };

  let react: ((name: Parameters<NavigationSend>[0]) => void) | undefined;
  const runtime = {
    phase: 'idle' as NavigationPhase,
    send: vi.fn<NavigationSend>((...input) => {
      react?.(input[0]);
    }),
    open: vi.fn<(position: unknown, options?: { autoFocus?: boolean }) => void>(
      (_position, { autoFocus = true } = {}) => {
        if (runtime.phase !== 'idle') {
          throw new Error('Not idle.');
        }

        runtime.phase = 'standalone';
        emit('open', standaloneOpen('api', autoFocus));
      },
    ),
    close: vi.fn<() => void>(() => {
      end('cancel', standaloneCancel('api'));
    }),
    on(type: string, listener: (event: never) => void) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    off(type: string, listener: (event: never) => void) {
      listeners.get(type)?.delete(listener);
    },
  };

  function end<Name extends 'select' | 'cancel'>(
    type: Name,
    event: EventMap[Name],
  ): void {
    runtime.phase = 'idle';
    emit(type, event);
  }

  const focusMenu = vi.spyOn(menu, 'focusMenu');
  const focusItem = vi.spyOn(menu, 'focusItem');
  const focusTabStop = vi.spyOn(menu, 'focusTabStop');

  const session = createStandaloneSession<Model>({
    parent,
    getMenu: () => (runtime.phase === 'idle' ? undefined : menu),
    runtime: runtime as never,
  });

  return {
    ...menuFixture,
    opener,
    session,
    runtime,
    send: runtime.send,
    focusMenu,
    focusItem,
    focusTabStop,
    emit,
    end,
    /**
    What the runtime does, synchronously, with each input it is sent.
    */
    onSend(reaction: (name: Parameters<NavigationSend>[0]) => void) {
      react = reaction;
    },
    open(options?: { autoFocus?: boolean }) {
      session.open([0, 0], options);
      runtime.send.mockClear();
    },
    listenerCount(): number {
      let count = 0;
      for (const set of listeners.values()) {
        count += set.size;
      }

      return count;
    },
    touchAction: () => parent.style.getPropertyValue('touch-action'),
    [Symbol.dispose]() {
      session.dispose();
      opener.remove();
      menuFixture[Symbol.dispose]();
    },
  };
};

/**
 Keeps every `keydown` the page gets, to read what the listeners did with
 each once dispatched.
 */
const recordKeys = () => {
  const events: KeyboardEvent[] = [];
  const listener = (event: KeyboardEvent) => {
    events.push(event);
  };

  document.addEventListener('keydown', listener);
  return {
    /**
    Whether the `keydown` of each of `keys` had its default prevented.
    */
    prevented: (...keys: string[]) =>
      keys.map(
        (key) =>
          events.findLast((event) => event.key === key)?.defaultPrevented,
      ),
    [Symbol.dispose]() {
      document.removeEventListener('keydown', listener);
    },
  };
};

/**
 Keeps every `pointerdown` the page gets, like {@link recordKeys}.
 */
const recordPresses = () => {
  const events: PointerEvent[] = [];
  const listener = (event: PointerEvent) => {
    events.push(event);
  };

  document.addEventListener('pointerdown', listener);
  return {
    events,
    [Symbol.dispose]() {
      document.removeEventListener('pointerdown', listener);
    },
  };
};

// On the page, but outside the parent and away from the menu.
const elsewhere: Point = { x: 20, y: 20 };

const position = ({ x, y }: Point): [number, number] => [x, y];

const inputNames = (send: ReturnType<typeof createFixture>['send']) =>
  send.mock.calls.map(([name]) => name);

describe('createStandaloneSession', () => {
  describe('open and close', () => {
    it('opens and closes the menu through the runtime', () => {
      using fixture = createFixture();

      fixture.session.open([3, 4], { autoFocus: false });
      fixture.session.close();

      expect(fixture.runtime.open).toHaveBeenCalledExactlyOnceWith([3, 4], {
        autoFocus: false,
      });
      expect(fixture.runtime.close).toHaveBeenCalledOnce();
    });

    it('lets a refused open throw', () => {
      using fixture = createFixture();
      fixture.open();

      expect(() => {
        fixture.session.open([0, 0]);
      }).toThrow('Not idle.');
    });
  });

  describe('the gesture', () => {
    it('starts from a press on the parent while no menu is open', async () => {
      using fixture = createFixture();
      using presses = recordPresses();

      await using _drag = await press(fixture.at(480, 280));

      expect(inputNames(fixture.send)).toEqual(['pointerDown']);
      expect(presses.events.map((event) => event.defaultPrevented)).toEqual([
        true,
      ]);
      expect(fixture.touchAction()).toBe('none');
    });

    it('leaves the pointer and touch-action to the page while a menu is open', async () => {
      using fixture = createFixture();
      using presses = recordPresses();
      fixture.open();

      await using _drag = await press(pointOf(fixture.leaf));

      const [down] = presses.events;
      expect(inputNames(fixture.send)).toEqual(['standalonePointerMove']);
      expect(down?.defaultPrevented).toBe(false);
      expect(fixture.parent.hasPointerCapture(down?.pointerId ?? NaN)).toBe(
        false,
      );
      expect(fixture.touchAction()).toBe('');
    });

    it.each([
      ['select', standaloneSelect],
      ['cancel', standaloneCancel('keyboard')],
    ] as const)('takes the pointer back on %s', (type, event) => {
      using fixture = createFixture();
      fixture.open();

      fixture.end(type, event);

      expect(fixture.touchAction()).toBe('none');
    });

    it('stays suspended when a second open is refused', () => {
      using fixture = createFixture();
      fixture.open();

      expect(() => {
        fixture.session.open([0, 0]);
      }).toThrow();
      expect(fixture.touchAction()).toBe('');
    });

    it('does not start from the outside press that dismisses the menu', async () => {
      using fixture = createFixture();
      using presses = recordPresses();
      fixture.open();
      fixture.onSend((name) => {
        if (name === 'standalonePointerOutside') {
          fixture.end('cancel', standaloneCancel('pointer'));
        }
      });

      await using _drag = await press(pointOf(fixture.outside));

      const [down] = presses.events;
      expect(inputNames(fixture.send)).toEqual(['standalonePointerOutside']);
      expect(down?.defaultPrevented).toBe(false);
      expect(fixture.parent.hasPointerCapture(down?.pointerId ?? NaN)).toBe(
        false,
      );
    });

    it('starts from the press that follows an outside press', async () => {
      using fixture = createFixture();
      fixture.open();
      fixture.onSend((name) => {
        if (name === 'standalonePointerOutside') {
          fixture.end('cancel', standaloneCancel('pointer'));
        }
      });
      await using _outside = await press(pointOf(fixture.outside));

      await using _next = await pressMouse(fixture.at(480, 280));

      expect(inputNames(fixture.send)).toEqual([
        'standalonePointerOutside',
        'pointerDown',
      ]);
    });
  });

  describe('the keyboard', () => {
    it.each<[string, KeyboardIntent]>([
      ['ArrowUp', 'up'],
      ['ArrowDown', 'down'],
      ['ArrowLeft', 'left'],
      ['ArrowRight', 'right'],
      ['Home', 'first'],
      ['End', 'last'],
      ['Enter', 'activate'],
      ['Escape', 'back'],
    ])('sends %s as the %s intent, and prevents it', async (key, intent) => {
      using fixture = createFixture();
      using keys = recordKeys();
      fixture.open();

      await userEvent.keyboard(`{${key}}`);

      expect(fixture.send).toHaveBeenCalledExactlyOnceWith(intent);
      expect(keys.prevented(key)).toEqual([true]);
    });

    it.each(['{Tab}', '{Shift>}{Tab}{/Shift}'])(
      'sends %s as the dismiss intent, and lets it move focus on',
      async (keystrokes) => {
        using fixture = createFixture();
        using keys = recordKeys();
        fixture.open();
        // What the runtime does with a dismissal.
        fixture.onSend((name) => {
          if (name === 'dismiss') {
            fixture.end('cancel', standaloneCancel('keyboard'));
          }
        });

        await userEvent.keyboard(keystrokes);

        expect(fixture.send.mock.calls).toEqual([
          ['dismiss', { source: 'keyboard' }],
        ]);
        expect(keys.prevented('Tab')).toEqual([false]);
      },
    );

    it('ignores keys without an intent', async () => {
      using fixture = createFixture();
      using keys = recordKeys();
      fixture.open();

      await userEvent.keyboard('a');

      expect(fixture.send).not.toHaveBeenCalled();
      expect(keys.prevented('a')).toEqual([false]);
    });

    it('leaves shortcuts with a modifier other than Shift to the page', async () => {
      using fixture = createFixture();
      using keys = recordKeys();
      fixture.open();

      await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
      await userEvent.keyboard('{Control>}{Home}{/Control}');
      await userEvent.keyboard('{Meta>}{Enter}{/Meta}');

      expect(fixture.send).not.toHaveBeenCalled();
      expect(keys.prevented('ArrowLeft', 'Home', 'Enter')).toEqual([
        false,
        false,
        false,
      ]);
    });

    it('ignores keys pressed outside the menu', async () => {
      using fixture = createFixture();
      using keys = recordKeys();
      fixture.open({ autoFocus: false });
      fixture.outside.focus();

      await userEvent.keyboard('{ArrowDown}');

      expect(fixture.send).not.toHaveBeenCalled();
      expect(keys.prevented('ArrowDown')).toEqual([false]);
    });

    it('ignores keys and focus unless a menu is open', async () => {
      using fixture = createFixture();
      using keys = recordKeys();
      fixture.runtime.phase = 'novice';

      fixture.leaf.focus();
      await userEvent.keyboard('{Escape}');

      expect(fixture.send).not.toHaveBeenCalled();
      expect(keys.prevented('Escape')).toEqual([false]);
    });
  });

  describe('platform focus', () => {
    it('sends the item that took focus', () => {
      using fixture = createFixture();
      fixture.open({ autoFocus: false });

      fixture.leaf.focus();

      expect(fixture.send).toHaveBeenCalledExactlyOnceWith('focus', {
        key: 'leaf-key',
        source: 'keyboard',
      });
    });

    it('reports the focus an opening menu takes as caused by the API', () => {
      using fixture = createFixture();
      fixture.menu.setTabStop('leaf-key');

      fixture.session.open([0, 0]);

      expect(fixture.send).toHaveBeenCalledExactlyOnceWith('focus', {
        key: 'leaf-key',
        source: 'api',
      });
    });

    it('reports a later focus as caused by the keyboard again', () => {
      using fixture = createFixture();
      fixture.menu.setTabStop('leaf-key');
      fixture.session.open([0, 0]);
      fixture.outside.focus();
      fixture.send.mockClear();

      fixture.leaf.focus();

      expect(fixture.send).toHaveBeenCalledExactlyOnceWith('focus', {
        key: 'leaf-key',
        source: 'keyboard',
      });
    });

    it('ignores focus on the menu layer', () => {
      using fixture = createFixture();
      fixture.open({ autoFocus: false });

      fixture.menu.focusMenu();

      expect(fixture.send).not.toHaveBeenCalled();
    });

    it('ignores focus moving outside while the menu never had it', () => {
      using fixture = createFixture();
      fixture.open({ autoFocus: false });

      fixture.outside.focus();

      expect(fixture.send).not.toHaveBeenCalled();
    });

    it('sends a focus loss when focus moves outside the menu or clears', () => {
      using fixture = createFixture();
      fixture.open({ autoFocus: false });

      fixture.leaf.focus();
      fixture.outside.focus();
      fixture.leaf.focus();
      fixture.leaf.blur();

      expect(fixture.send.mock.calls).toEqual([
        ['focus', { key: 'leaf-key', source: 'keyboard' }],
        ['dismiss', { source: 'focus-loss' }],
        ['focus', { key: 'leaf-key', source: 'keyboard' }],
        ['dismiss', { source: 'focus-loss' }],
      ]);
    });

    it('sends no focus loss while focus moves between items', () => {
      using fixture = createFixture();
      fixture.open({ autoFocus: false });

      fixture.leaf.focus();
      fixture.menu.focusItem('submenu-key');

      expect(inputNames(fixture.send)).not.toContain('dismiss');
    });

    it('sends no focus loss for a blur its own input caused', async () => {
      using fixture = createFixture();
      fixture.open({ autoFocus: false });
      fixture.leaf.focus();
      // Stands for a level's DOM swapped out from under the focused item.
      fixture.onSend((name) => {
        if (name === 'activate') {
          fixture.outside.focus();
        }
      });

      await userEvent.keyboard('{Enter}');

      expect(inputNames(fixture.send)).toEqual(['focus', 'activate']);
    });
  });

  describe('the pointer on the menu', () => {
    it('sends a move with the item under a hover, and with no item once it leaves the menu', async () => {
      using fixture = createFixture();
      // Hovering starts from wherever the mouse is, which is off the menu
      // only once it's been moved there.
      await moveMouse(elsewhere);
      fixture.open();
      const onLeaf = pointOf(fixture.leaf);
      const offMenu = fixture.at(480, 280);

      await moveMouse(onLeaf);
      await moveMouse(offMenu);

      expect(fixture.send.mock.calls).toEqual([
        [
          'standalonePointerMove',
          { position: position(onLeaf), itemKey: 'leaf-key' },
        ],
        [
          'standalonePointerMove',
          { position: position(offMenu), itemKey: undefined },
        ],
      ]);
    });

    it('sends a move for a press, and an activate with the item under its release', async () => {
      using fixture = createFixture();
      fixture.open();
      const onLeaf = pointOf(fixture.leaf);
      const onSubmenu = pointOf(fixture.submenu);

      await moveMouse(onLeaf);
      fixture.send.mockClear();

      // The mouse: the page owns `touch-action` while the menu is open, so a
      // touch that moves this far becomes a pan, and is canceled.
      const drag = await pressMouse(onLeaf);
      await drag.moveTo(onSubmenu, 1);
      await drag.release();

      expect(fixture.send.mock.calls).toEqual([
        [
          'standalonePointerMove',
          { position: position(onLeaf), itemKey: 'leaf-key' },
        ],
        [
          'standalonePointerMove',
          { position: position(onSubmenu), itemKey: 'submenu-key' },
        ],
        [
          'standalonePointerActivate',
          { position: position(onSubmenu), itemKey: 'submenu-key' },
        ],
      ]);
    });

    it('ignores a release without a press, a secondary press, and a second contact', async () => {
      using fixture = createFixture();
      const onLeaf = pointOf(fixture.leaf);
      // Down before the menu opens, so it is released without a press.
      const early = await press(elsewhere);
      fixture.open();

      {
        await using _secondary = await pressMouse(onLeaf, 'right');
      }

      {
        // Not the primary contact while the first finger is down.
        await using _nonPrimary = await press(onLeaf);
      }

      await early.release();

      // Hovers still count, but none of these presses acted on the menu.
      expect(inputNames(fixture.send)).not.toContain(
        'standalonePointerActivate',
      );
      expect(inputNames(fixture.send)).not.toContain(
        'standalonePointerOutside',
      );

      // Nor did any of them hold on to the menu: the next press is taken.
      fixture.send.mockClear();
      const first = await press(onLeaf);
      {
        // The mouse is a primary pointer too, but the finger came first.
        await using _second = await pressMouse(pointOf(fixture.submenu));
      }

      await first.release();

      expect(fixture.send.mock.calls.slice(0, 2)).toEqual([
        [
          'standalonePointerMove',
          { position: position(onLeaf), itemKey: 'leaf-key' },
        ],
        [
          'standalonePointerActivate',
          { position: position(onLeaf), itemKey: 'leaf-key' },
        ],
      ]);
    });

    it('sends a cancel for a canceled contact', async () => {
      using fixture = createFixture();
      fixture.open();
      const onLeaf = pointOf(fixture.leaf);
      const drag = await press(onLeaf);

      await drag.cancel();

      expect(fixture.send).toHaveBeenCalledWith('standalonePointerCancel', {
        position: position(onLeaf),
      });
    });

    it('lets go of the capture the browser takes for a touch', async () => {
      using fixture = createFixture();
      using presses = recordPresses();
      fixture.open();
      const label = fixture.leaf.querySelector('.marking-menu-label');

      await using _drag = await press(pointOf(fixture.leaf));

      const [down] = presses.events;
      expect(label?.hasPointerCapture(down?.pointerId ?? NaN)).toBe(false);
    });
  });

  describe('the pointer outside the menu', () => {
    it('sends an outside press for a press on the parent or the page', async () => {
      using fixture = createFixture();
      // Without focus in the menu, the button taking it is no focus loss.
      fixture.open({ autoFocus: false });
      const onOutside = pointOf(fixture.outside);

      {
        await using _drag = await press(onOutside);
      }

      {
        await using _drag = await press(elsewhere);
      }

      expect(fixture.send.mock.calls).toEqual([
        ['standalonePointerOutside', { position: position(onOutside) }],
        ['standalonePointerOutside', { position: position(elsewhere) }],
      ]);
    });

    it('sends an outside press for a held press released off the menu', async () => {
      using fixture = createFixture();
      fixture.open();
      // The mouse, for the same reason as a press moved across the menu.
      const drag = await pressMouse(pointOf(fixture.leaf));

      await drag.moveTo(elsewhere, 1);
      await drag.release();

      expect(fixture.send).toHaveBeenLastCalledWith(
        'standalonePointerOutside',
        { position: position(elsewhere) },
      );
    });

    it('tells inside from outside when the parent is in a shadow root', async () => {
      using fixture = createFixture();
      const host = document.createElement('div');
      document.body.append(host);
      host.attachShadow({ mode: 'open' }).append(fixture.parent);
      // Without focus in the menu, pressing the page is no focus loss.
      fixture.open({ autoFocus: false });

      await using _inside = await press(pointOf(fixture.leaf));
      await using _outside = await pressMouse(elsewhere);

      expect(inputNames(fixture.send)).toEqual([
        'standalonePointerMove',
        'standalonePointerOutside',
      ]);
      host.remove();
    });
  });

  describe('focus', () => {
    it('focuses the tab stop when the menu opens', () => {
      using fixture = createFixture();

      fixture.open();

      expect(fixture.focusTabStop).toHaveBeenCalledOnce();
      expect(fixture.focusMenu).not.toHaveBeenCalled();
    });

    it('takes no focus with autoFocus: false', () => {
      using fixture = createFixture();

      fixture.open({ autoFocus: false });

      expect(fixture.focusTabStop).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(fixture.opener);
    });

    it('focuses the item a key made active, but not one the pointer did', () => {
      using fixture = createFixture();
      fixture.open({ autoFocus: false });

      fixture.emit('change', standaloneChange('pointer'));
      fixture.emit('change', standaloneChange('keyboard'));

      expect(fixture.focusItem).toHaveBeenCalledExactlyOnceWith(item.key);
    });

    it('leaves a level entered with a key to the change that follows', () => {
      using fixture = createFixture();
      fixture.open();
      fixture.focusTabStop.mockClear();

      fixture.emit('open', standaloneOpen('keyboard'));

      expect(fixture.focusTabStop).not.toHaveBeenCalled();
      expect(fixture.focusMenu).not.toHaveBeenCalled();
    });

    it('focuses the container of a level a pointer release opened', () => {
      using fixture = createFixture();
      fixture.open();

      fixture.emit('open', standaloneOpen('pointer'));

      expect(fixture.focusMenu).toHaveBeenCalledOnce();
    });

    it.each([
      ['select', standaloneSelect],
      ['cancel', standaloneCancel('keyboard')],
      ['cancel', standaloneCancel('api')],
    ] as const)('gives focus back on %s', (type, event) => {
      using fixture = createFixture();
      fixture.open({ autoFocus: false });
      fixture.outside.focus();

      fixture.end(type, event);

      expect(document.activeElement).toBe(fixture.opener);
    });

    it.each(['pointer', 'focus-loss'] as const)(
      'leaves focus where it went on a cancel from %s',
      (source) => {
        using fixture = createFixture();
        fixture.open({ autoFocus: false });
        fixture.outside.focus();

        fixture.end('cancel', standaloneCancel(source));

        expect(document.activeElement).toBe(fixture.outside);
      },
    );

    it('saves focus afresh for the next menu', () => {
      using fixture = createFixture();
      fixture.open({ autoFocus: false });
      fixture.end('cancel', standaloneCancel('pointer'));
      fixture.outside.focus();

      fixture.open({ autoFocus: false });
      fixture.opener.focus();
      fixture.end('cancel', standaloneCancel('keyboard'));

      expect(document.activeElement).toBe(fixture.outside);
    });
  });

  it('ignores the events of a gesture', () => {
    using fixture = createFixture();

    fixture.emit(
      'open',
      new MarkingMenuOpenEvent<Model, 'novice'>({
        mode: 'novice',
        position: [0, 0],
        source: 'gesture',
        menu: model,
        menuCenter: [0, 0],
      }),
    );

    expect(fixture.focusTabStop).not.toHaveBeenCalled();
    expect(fixture.focusMenu).not.toHaveBeenCalled();
    expect(fixture.touchAction()).toBe('none');
  });

  it('gives focus and the pointer back when disposed, and stops listening', async () => {
    using fixture = createFixture();
    fixture.open({ autoFocus: false });
    fixture.outside.focus();

    fixture.session.dispose();

    expect(document.activeElement).toBe(fixture.opener);
    expect(fixture.touchAction()).toBe('');
    expect(fixture.listenerCount()).toBe(0);

    fixture.leaf.focus();
    await userEvent.keyboard('{ArrowDown}');
    await moveMouse(pointOf(fixture.submenu));
    await using _drag = await press(fixture.at(480, 280));

    expect(fixture.send).not.toHaveBeenCalled();
  });
});

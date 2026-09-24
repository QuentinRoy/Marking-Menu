import {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  type MarkingMenuEventMap,
  type MarkingMenuEventSource,
} from '../events.js';
import { createModel } from '../model.js';
import { createMenuFixture } from './__fixtures__/menu.js';
import { pointer } from './__fixtures__/pointer.js';
import type {
  KeyboardIntent,
  NavigationInput,
  NavigationPhase,
} from './machine.js';
import { createStandaloneSession } from './standalone-session.js';

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

  let react: ((input: NavigationInput) => void) | undefined;
  const runtime = {
    phase: 'idle' as NavigationPhase,
    send: vi.fn<(input: NavigationInput) => void>((input) => {
      react?.(input);
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
    onSend(reaction: (input: NavigationInput) => void) {
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

const press = (
  target: EventTarget,
  key: string,
  init: KeyboardEventInit = {},
): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

const inputTypes = (send: ReturnType<typeof createFixture>['send']) =>
  send.mock.calls.map(([input]) => input.type);

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
    it('starts from a press on the parent while no menu is open', () => {
      using fixture = createFixture();
      const down = pointer('pointerdown', { cancelable: true });

      fixture.parent.dispatchEvent(down);

      expect(inputTypes(fixture.send)).toEqual(['pointer.down']);
      expect(down.defaultPrevented).toBe(true);
      expect(fixture.touchAction()).toBe('none');
    });

    it('leaves the pointer and touch-action to the page while a menu is open', () => {
      using fixture = createFixture();
      fixture.open();
      const down = pointer('pointerdown', { cancelable: true });

      fixture.leaf.dispatchEvent(down);

      expect(inputTypes(fixture.send)).toEqual(['standalonePointer.move']);
      expect(down.defaultPrevented).toBe(false);
      expect(fixture.parent.hasPointerCapture(1)).toBe(false);
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

    it('does not start from the outside press that dismisses the menu', () => {
      using fixture = createFixture();
      fixture.open();
      fixture.onSend((input) => {
        if (input.type === 'standalonePointer.outside') {
          fixture.end('cancel', standaloneCancel('pointer'));
        }
      });
      const down = pointer('pointerdown', { cancelable: true });

      fixture.outside.dispatchEvent(down);

      expect(inputTypes(fixture.send)).toEqual(['standalonePointer.outside']);
      expect(down.defaultPrevented).toBe(false);
      expect(fixture.parent.hasPointerCapture(1)).toBe(false);
    });

    it('starts from the press that follows an outside press', () => {
      using fixture = createFixture();
      fixture.open();
      fixture.onSend((input) => {
        if (input.type === 'standalonePointer.outside') {
          fixture.end('cancel', standaloneCancel('pointer'));
        }
      });
      fixture.outside.dispatchEvent(pointer('pointerdown', { pointerId: 7 }));

      fixture.parent.dispatchEvent(pointer('pointerdown', { pointerId: 8 }));

      expect(inputTypes(fixture.send)).toEqual([
        'standalonePointer.outside',
        'pointer.down',
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
    ])('sends %s as the %s intent, and prevents it', (key, intent) => {
      using fixture = createFixture();
      fixture.open();

      const event = press(fixture.leaf, key);

      expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
        type: 'keyboard',
        intent,
      });
      expect(event.defaultPrevented).toBe(true);
    });

    it('sends Tab as the dismiss intent, and lets it move focus on', () => {
      using fixture = createFixture();
      fixture.open();

      const event = press(fixture.leaf, 'Tab');
      const shifted = press(fixture.leaf, 'Tab', { shiftKey: true });

      expect(fixture.send.mock.calls).toEqual([
        [{ type: 'keyboard', intent: 'dismiss' }],
        [{ type: 'keyboard', intent: 'dismiss' }],
      ]);
      expect(event.defaultPrevented).toBe(false);
      expect(shifted.defaultPrevented).toBe(false);
    });

    it('ignores keys without an intent', () => {
      using fixture = createFixture();
      fixture.open();

      const event = press(fixture.leaf, 'a');

      expect(fixture.send).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('leaves shortcuts with a modifier other than Shift to the page', () => {
      using fixture = createFixture();
      fixture.open();

      const events = [
        press(fixture.leaf, 'ArrowLeft', { altKey: true }),
        press(fixture.leaf, 'Home', { ctrlKey: true }),
        press(fixture.leaf, 'Enter', { metaKey: true }),
      ];

      expect(fixture.send).not.toHaveBeenCalled();
      expect(events.map((event) => event.defaultPrevented)).toEqual([
        false,
        false,
        false,
      ]);
    });

    it('ignores keys pressed outside the menu', () => {
      using fixture = createFixture();
      fixture.open();

      const event = press(fixture.outside, 'ArrowDown');

      expect(fixture.send).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('ignores keys and focus unless a menu is open', () => {
      using fixture = createFixture();
      fixture.runtime.phase = 'novice';

      const event = press(fixture.leaf, 'Escape');
      fixture.leaf.focus();

      expect(fixture.send).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('platform focus', () => {
    it('sends the item that took focus', () => {
      using fixture = createFixture();
      fixture.open({ autoFocus: false });

      fixture.leaf.focus();

      expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
        type: 'focus',
        key: 'leaf-key',
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

      expect(inputTypes(fixture.send)).toEqual([
        'focus',
        'focus-loss',
        'focus',
        'focus-loss',
      ]);
    });

    it('sends no focus loss while focus moves between items', () => {
      using fixture = createFixture();
      fixture.open({ autoFocus: false });

      fixture.leaf.focus();
      fixture.menu.focusItem('submenu-key');

      expect(inputTypes(fixture.send)).not.toContain('focus-loss');
    });

    it('sends no focus loss for a blur its own input caused', () => {
      using fixture = createFixture();
      fixture.open({ autoFocus: false });
      fixture.leaf.focus();
      // Stands for a level's DOM swapped out from under the focused item.
      fixture.onSend((input) => {
        if (input.type === 'keyboard') {
          fixture.outside.focus();
        }
      });

      press(fixture.leaf, 'Enter');

      expect(inputTypes(fixture.send)).toEqual(['focus', 'keyboard']);
    });
  });

  describe('the pointer on the menu', () => {
    it('sends a move with the item under a hover', () => {
      using fixture = createFixture();
      fixture.open();

      fixture.leaf.dispatchEvent(
        pointer('pointermove', { clientX: 3, clientY: 4 }),
      );
      fixture.layer.dispatchEvent(
        pointer('pointermove', { clientX: 5, clientY: 5 }),
      );

      expect(fixture.send.mock.calls).toEqual([
        [
          {
            type: 'standalonePointer.move',
            position: [3, 4],
            itemKey: 'leaf-key',
          },
        ],
        [
          {
            type: 'standalonePointer.move',
            position: [5, 5],
            itemKey: undefined,
          },
        ],
      ]);
    });

    it('sends a move for a press, and an activate with the item under its release', () => {
      using fixture = createFixture();
      fixture.open();

      fixture.leaf.dispatchEvent(
        pointer('pointerdown', { clientX: 0, clientY: 0 }),
      );
      fixture.submenu.dispatchEvent(
        pointer('pointerup', { clientX: 9, clientY: 9 }),
      );

      expect(fixture.send.mock.calls).toEqual([
        [
          {
            type: 'standalonePointer.move',
            position: [0, 0],
            itemKey: 'leaf-key',
          },
        ],
        [
          {
            type: 'standalonePointer.activate',
            position: [9, 9],
            itemKey: 'submenu-key',
          },
        ],
      ]);
    });

    it('sends a move with no item when a hover leaves the menu', () => {
      using fixture = createFixture();
      fixture.open();

      fixture.leaf.dispatchEvent(
        pointer('pointerout', { clientX: 1, clientY: 2 }),
      );

      expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
        type: 'standalonePointer.move',
        position: [1, 2],
        itemKey: undefined,
      });
    });

    it('ignores a release without a press, a secondary press, and a second contact', () => {
      using fixture = createFixture();
      fixture.open();

      fixture.leaf.dispatchEvent(pointer('pointerup'));
      fixture.leaf.dispatchEvent(pointer('pointerdown', { isPrimary: false }));
      fixture.leaf.dispatchEvent(pointer('pointerdown', { button: 2 }));
      fixture.leaf.dispatchEvent(pointer('pointerdown', { pointerId: 1 }));
      fixture.submenu.dispatchEvent(pointer('pointerdown', { pointerId: 2 }));
      fixture.submenu.dispatchEvent(pointer('pointerup', { pointerId: 2 }));

      expect(inputTypes(fixture.send)).toEqual(['standalonePointer.move']);
    });

    it('sends a cancel for a canceled contact', () => {
      using fixture = createFixture();
      fixture.open();
      fixture.leaf.dispatchEvent(pointer('pointerdown'));

      fixture.leaf.dispatchEvent(
        pointer('pointercancel', { clientX: 7, clientY: 8 }),
      );

      expect(fixture.send).toHaveBeenLastCalledWith({
        type: 'standalonePointer.cancel',
        position: [7, 8],
      });
    });

    it('lets go of the capture the browser takes for a touch', () => {
      using fixture = createFixture();
      fixture.open();
      const captured = new Set([1]);
      Object.assign(fixture.leaf, {
        hasPointerCapture: (id: number) => captured.has(id),
        releasePointerCapture: (id: number) => captured.delete(id),
      });

      fixture.leaf.dispatchEvent(pointer('pointerdown', { pointerId: 1 }));

      expect(captured.has(1)).toBe(false);
    });
  });

  describe('the pointer outside the menu', () => {
    it('sends an outside press for a press on the parent or the page', () => {
      using fixture = createFixture();
      fixture.open();

      fixture.outside.dispatchEvent(
        pointer('pointerdown', { clientX: 2, clientY: 3 }),
      );
      fixture.opener.dispatchEvent(
        pointer('pointerdown', { clientX: 4, clientY: 5 }),
      );

      expect(fixture.send.mock.calls).toEqual([
        [{ type: 'standalonePointer.outside', position: [2, 3] }],
        [{ type: 'standalonePointer.outside', position: [4, 5] }],
      ]);
    });

    it('sends an outside press for a held press released off the menu', () => {
      using fixture = createFixture();
      fixture.open();
      fixture.leaf.dispatchEvent(pointer('pointerdown'));

      fixture.opener.dispatchEvent(
        pointer('pointerup', { clientX: 6, clientY: 6 }),
      );

      expect(fixture.send).toHaveBeenLastCalledWith({
        type: 'standalonePointer.outside',
        position: [6, 6],
      });
    });

    it('tells inside from outside when the parent is in a shadow root', () => {
      using fixture = createFixture();
      const host = document.createElement('div');
      document.body.append(host);
      host.attachShadow({ mode: 'open' }).append(fixture.parent);
      fixture.open();

      fixture.leaf.dispatchEvent(pointer('pointerdown', { pointerId: 1 }));
      fixture.opener.dispatchEvent(pointer('pointerdown', { pointerId: 2 }));

      expect(inputTypes(fixture.send)).toEqual([
        'standalonePointer.move',
        'standalonePointer.outside',
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

  it('gives focus and the pointer back when disposed, and stops listening', () => {
    using fixture = createFixture();
    fixture.open({ autoFocus: false });
    fixture.outside.focus();

    fixture.session.dispose();
    press(fixture.leaf, 'ArrowDown');
    fixture.leaf.dispatchEvent(pointer('pointermove'));
    fixture.parent.dispatchEvent(pointer('pointerdown'));

    expect(document.activeElement).toBe(fixture.opener);
    expect(fixture.touchAction()).toBe('');
    expect(fixture.listenerCount()).toBe(0);
    expect(fixture.send).not.toHaveBeenCalled();
  });
});

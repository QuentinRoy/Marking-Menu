import { fakeTimers } from '../../__tests__/__fixtures__/timers.js';
import {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuOpenEvent,
  type MarkingMenuEventMap,
} from '../../events.js';
import { createModel } from '../../model.js';
import { manageFocus } from '../focus.js';

// Starting from the bottom: the first item is the first one listed.
const model = createModel({
  items: [
    { id: 'down', label: 'Down', angle: 90 },
    { id: 'left', label: 'Left', angle: 180 },
    { id: 'right', label: 'Right', angle: 0 },
  ],
});
const right = model.items[2];

/**
 A listen-only stand-in for the runtime, and the two ways the menu takes
 focus, all recorded.
 */
const createFixture = ({
  submenuOpeningDelay = 1000,
}: { submenuOpeningDelay?: number } = {}) => {
  const listeners = new Map<string, Set<(event: never) => void>>();
  const runtime = {
    on(type: string, listener: (event: never) => void) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    off(type: string, listener: (event: never) => void) {
      listeners.get(type)?.delete(listener);
    },
  };
  const emit = <Name extends keyof MarkingMenuEventMap<typeof model>>(
    type: Name,
    event: MarkingMenuEventMap<typeof model>[Name],
  ): void => {
    for (const listener of listeners.get(type) ?? []) {
      listener(event as never);
    }
  };

  const menu = {
    focusMenu: vi.fn<() => void>(),
    focusItem: vi.fn<(key: string) => void>(),
  };
  const focusManager = manageFocus({
    doc: document,
    getMenu: () => menu,
    runtime: runtime as never,
    submenuOpeningDelay,
  });
  const listenerCount = (): number => {
    let count = 0;
    for (const set of listeners.values()) {
      count += set.size;
    }

    return count;
  };

  return { emit, menu, focusManager, listenerCount };
};

/**
 A button holding focus, standing for whatever had it before the menu opened.
 */
const createOpener = () => {
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  return {
    opener,
    [Symbol.dispose]() {
      opener.remove();
    },
  };
};

describe('manageFocus', () => {
  describe('in a gesture', () => {
    it('focuses the menu when it opens, and the active item once it stayed active for a moment', () => {
      using _timers = fakeTimers();
      const { emit, menu } = createFixture();

      emit(
        'open',
        new MarkingMenuOpenEvent<typeof model, 'novice'>({
          mode: 'novice',
          position: [0, 0],
          source: 'gesture',
          menu: model,
          menuCenter: [0, 0],
        }),
      );
      emit(
        'change',
        new MarkingMenuChangeEvent<typeof model, 'novice'>({
          mode: 'novice',
          position: [0, 0],
          source: 'gesture',
          activeItem: right,
          previousActiveItem: undefined,
          menu: model,
        }),
      );
      expect(menu.focusMenu).toHaveBeenCalledTimes(1);
      expect(menu.focusItem).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);

      expect(menu.focusItem).toHaveBeenCalledExactlyOnceWith(right.key);
    });

    const changeNovice = new MarkingMenuChangeEvent<typeof model, 'novice'>({
      mode: 'novice',
      position: [0, 0],
      source: 'gesture',
      activeItem: right,
      previousActiveItem: undefined,
      menu: model,
    });

    it.each([
      [20, 10],
      [1000, 50],
    ])(
      'with a submenu opening delay of %j ms, announces the active item after %j ms',
      (submenuOpeningDelay, announcedAfter) => {
        using _timers = fakeTimers();
        const { emit, menu } = createFixture({ submenuOpeningDelay });

        emit('change', changeNovice);
        vi.advanceTimersByTime(announcedAfter - 1);
        expect(menu.focusItem).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);

        expect(menu.focusItem).toHaveBeenCalledExactlyOnceWith(right.key);
      },
    );

    it('announces the active item without waiting when the submenu opens at once', () => {
      using _timers = fakeTimers();
      const { emit, menu } = createFixture({ submenuOpeningDelay: 0 });

      emit('change', changeNovice);
      vi.advanceTimersByTime(0);

      expect(menu.focusItem).toHaveBeenCalledExactlyOnceWith(right.key);
    });
  });

  it('leaves a standalone menu to its session', () => {
    using _timers = fakeTimers();
    using fixture = createOpener();
    const { emit, menu } = createFixture();
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);

    emit(
      'open',
      new MarkingMenuOpenEvent<typeof model, 'standalone'>({
        mode: 'standalone',
        position: undefined,
        source: 'api',
        menu: model,
        menuCenter: [0, 0],
      }),
    );
    emit(
      'change',
      new MarkingMenuChangeEvent<typeof model, 'standalone'>({
        mode: 'standalone',
        position: undefined,
        source: 'keyboard',
        activeItem: right,
        previousActiveItem: undefined,
        menu: model,
      }),
    );
    elsewhere.focus();
    emit(
      'cancel',
      new MarkingMenuCancelEvent<typeof model, 'standalone'>({
        mode: 'standalone',
        position: undefined,
        source: 'keyboard',
        activeItem: undefined,
        menu: model,
        reason: 'dismissed',
      }),
    );
    vi.runAllTimers();

    expect(menu.focusMenu).not.toHaveBeenCalled();
    expect(menu.focusItem).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
    expect(fixture.opener).not.toBe(document.activeElement);
  });

  it('gives focus back when disposed mid-interaction, and stops listening', () => {
    using fixture = createOpener();
    const { emit, focusManager, listenerCount } = createFixture();
    emit(
      'open',
      new MarkingMenuOpenEvent<typeof model, 'novice'>({
        mode: 'novice',
        position: [0, 0],
        source: 'gesture',
        menu: model,
        menuCenter: [0, 0],
      }),
    );
    fixture.opener.blur();

    focusManager.dispose();

    expect(document.activeElement).toBe(fixture.opener);
    expect(listenerCount()).toBe(0);
  });
});

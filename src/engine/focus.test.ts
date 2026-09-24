import { fakeTimers } from '../__fixtures__/timers.js';
import {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  type MarkingMenuEventMap,
} from '../events.js';
import { createModel } from '../model.js';
import { manageFocus } from './focus.js';

// Starting from the bottom: the first item is the first one listed.
const model = createModel({
  items: [
    { id: 'down', label: 'Down', angle: 90 },
    { id: 'left', label: 'Left', angle: 180 },
    { id: 'right', label: 'Right', angle: 0 },
  ],
});
const [down, , right] = model.items;

/**
 A listen-only stand-in for the runtime, and the two ways the menu takes
 focus, all recorded.
 */
const createFixture = ({
  submenuOpeningDelay = 1000 / 3,
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
    focusTabStop: vi.fn<() => void>(),
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

const openStandalone = new MarkingMenuOpenEvent<typeof model, 'standalone'>({
  mode: 'standalone',
  position: undefined,
  source: 'api',
  menu: model,
  menuCenter: [0, 0],
});
const openStandaloneDisplayOnly = new MarkingMenuOpenEvent<
  typeof model,
  'standalone'
>({
  mode: 'standalone',
  position: undefined,
  source: 'api',
  menu: model,
  menuCenter: [0, 0],
  focus: false,
});
const changeStandalone = (active: (typeof model.items)[number] | undefined) =>
  new MarkingMenuChangeEvent<typeof model, 'standalone'>({
    mode: 'standalone',
    position: undefined,
    source: 'keyboard',
    activeItem: active,
    previousActiveItem: undefined,
    menu: model,
  });
const cancelStandalone = new MarkingMenuCancelEvent<typeof model, 'standalone'>(
  {
    mode: 'standalone',
    position: undefined,
    source: 'keyboard',
    activeItem: undefined,
    menu: model,
    reason: 'dismissed',
  },
);
const cancelStandaloneOutsidePress = new MarkingMenuCancelEvent<
  typeof model,
  'standalone'
>({
  mode: 'standalone',
  position: [0, 0],
  source: 'pointer',
  activeItem: undefined,
  menu: model,
  reason: 'dismissed',
});
const cancelStandaloneFocusLoss = new MarkingMenuCancelEvent<
  typeof model,
  'standalone'
>({
  mode: 'standalone',
  position: undefined,
  source: 'focus-loss',
  activeItem: undefined,
  menu: model,
  reason: 'dismissed',
});
const changeStandalonePointer = (
  active: (typeof model.items)[number] | undefined,
) =>
  new MarkingMenuChangeEvent<typeof model, 'standalone'>({
    mode: 'standalone',
    position: [0, 0],
    source: 'pointer',
    activeItem: active,
    previousActiveItem: undefined,
    menu: model,
  });
// A new level entered by a pointer release, where the machine's own
// `active: undefined` means the `change` that follows a keyboard entry
// never fires here.
const openStandaloneLevelByPointer = new MarkingMenuOpenEvent<
  typeof model,
  'standalone'
>({
  mode: 'standalone',
  position: [0, 0],
  source: 'pointer',
  menu: model,
  menuCenter: [0, 0],
});
const selectStandalone = new MarkingMenuSelectEvent<typeof model, 'standalone'>(
  {
    mode: 'standalone',
    position: undefined,
    source: 'keyboard',
    selection: down,
    menu: model,
  },
);

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

    it('announces the active item before a submenu can open, however short the opening delay', () => {
      using _timers = fakeTimers();
      const { emit, menu } = createFixture({ submenuOpeningDelay: 20 });

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
      vi.advanceTimersByTime(19);

      expect(menu.focusItem).toHaveBeenCalledExactlyOnceWith(right.key);
    });
  });

  describe('in a standalone menu', () => {
    it('focuses the tab stop as soon as it opens, not the menu layer', () => {
      const { emit, menu } = createFixture();

      emit('open', openStandalone);

      expect(menu.focusTabStop).toHaveBeenCalledTimes(1);
      expect(menu.focusMenu).not.toHaveBeenCalled();
    });

    it('focuses the active item at once, with no delay', () => {
      using _timers = fakeTimers();
      const { emit, menu } = createFixture();
      emit('open', openStandalone);

      emit('change', changeStandalone(down));

      expect(menu.focusItem).toHaveBeenCalledExactlyOnceWith(down.key);
    });

    it('moves nothing when nothing became active', () => {
      const { emit, menu } = createFixture();
      emit('open', openStandalone);

      emit('change', changeStandalone(undefined));

      expect(menu.focusItem).not.toHaveBeenCalled();
    });

    it('leaves the focus of a level it did not open alone: the change that follows moves it', () => {
      const { emit, menu } = createFixture();
      emit('open', openStandalone);
      menu.focusTabStop.mockClear();

      emit('open', openStandalone);

      expect(menu.focusTabStop).not.toHaveBeenCalled();
      expect(menu.focusMenu).not.toHaveBeenCalled();
    });

    it.each([
      ['select', selectStandalone],
      ['cancel', cancelStandalone],
    ] as const)('gives focus back to where it was on %s', (type, event) => {
      using fixture = createOpener();
      const { emit } = createFixture();
      emit('open', openStandalone);
      fixture.opener.blur();

      emit(type, event as never);

      expect(document.activeElement).toBe(fixture.opener);
    });

    it('leaves focus where it moved when focus loss closes the menu', () => {
      using fixture = createOpener();
      const { emit } = createFixture();
      emit('open', openStandalone);

      const elsewhere = document.createElement('button');
      document.body.append(elsewhere);
      elsewhere.focus();
      emit('cancel', cancelStandaloneFocusLoss);

      expect(document.activeElement).toBe(elsewhere);
      elsewhere.remove();
      expect(fixture.opener).not.toBe(document.activeElement);
    });

    it('takes no focus when asked to just display, but still saves it to give back later', () => {
      using fixture = createOpener();
      const { emit, menu } = createFixture();

      emit('open', openStandaloneDisplayOnly);
      expect(menu.focusTabStop).not.toHaveBeenCalled();
      expect(menu.focusMenu).not.toHaveBeenCalled();

      const elsewhere = document.createElement('button');
      document.body.append(elsewhere);
      elsewhere.focus();
      emit('cancel', cancelStandalone);

      expect(document.activeElement).toBe(fixture.opener);
      elsewhere.remove();
    });

    it('still follows the keyboard once someone tabbed into a display-only menu', () => {
      const { emit, menu } = createFixture();
      emit('open', openStandaloneDisplayOnly);

      emit('change', changeStandalone(down));

      expect(menu.focusItem).toHaveBeenCalledExactlyOnceWith(down.key);
    });

    it('takes focus again for the next menu after a display-only one', () => {
      const { emit, menu } = createFixture();
      emit('open', openStandaloneDisplayOnly);
      emit('cancel', cancelStandalone);

      emit('open', openStandalone);

      expect(menu.focusTabStop).toHaveBeenCalledTimes(1);
    });

    it('takes focus again for the next menu after one ended', () => {
      const { emit, menu } = createFixture();
      emit('open', openStandalone);
      emit('cancel', cancelStandalone);
      menu.focusTabStop.mockClear();

      emit('open', openStandalone);

      expect(menu.focusTabStop).toHaveBeenCalledTimes(1);
    });

    it('never moves focus for a pointer-caused change, hover or press', () => {
      const { emit, menu } = createFixture();
      emit('open', openStandalone);
      menu.focusItem.mockClear();

      emit('change', changeStandalonePointer(down));

      expect(menu.focusItem).not.toHaveBeenCalled();
    });

    it("focuses the new level's container when a pointer release opens one", () => {
      const { emit, menu } = createFixture();
      emit('open', openStandalone);
      menu.focusMenu.mockClear();

      emit('open', openStandaloneLevelByPointer);

      expect(menu.focusMenu).toHaveBeenCalledTimes(1);
    });

    it('does not restore focus after an outside press dismisses the menu', () => {
      using fixture = createOpener();
      const { emit } = createFixture();
      emit('open', openStandalone);

      const elsewhere = document.createElement('button');
      document.body.append(elsewhere);
      elsewhere.focus();
      emit('cancel', cancelStandaloneOutsidePress);

      expect(document.activeElement).toBe(elsewhere);
      elsewhere.remove();
      expect(fixture.opener).not.toBe(document.activeElement);
    });

    it('still restores focus normally for the next menu after an outside press', () => {
      const { emit, menu } = createFixture();
      emit('open', openStandalone);
      emit('cancel', cancelStandaloneOutsidePress);

      emit('open', openStandalone);
      emit('cancel', cancelStandalone);

      expect(menu.focusTabStop).toHaveBeenCalledTimes(2);
    });
  });

  it('gives focus back when disposed mid-interaction, and stops listening', () => {
    using fixture = createOpener();
    const { emit, focusManager, listenerCount } = createFixture();
    emit('open', openStandalone);
    fixture.opener.blur();

    focusManager.dispose();

    expect(document.activeElement).toBe(fixture.opener);
    expect(listenerCount()).toBe(0);
  });
});

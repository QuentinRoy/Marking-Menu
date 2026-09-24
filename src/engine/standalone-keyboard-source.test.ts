import { createMenuFixture } from './__fixtures__/menu.js';
import type {
  KeyboardIntent,
  NavigationInput,
  NavigationPhase,
} from './machine.js';
import { createStandaloneKeyboardSource } from './standalone-keyboard-source.js';

/**
 A parent holding a real menu, plus something else that is not part of it.
 */
const createFixture = (
  phase: NavigationPhase = 'standalone',
  { hasMenu = true }: { hasMenu?: boolean } = {},
) => {
  const menuFixture = createMenuFixture();
  const { parent, menu, leaf, submenu, outside } = menuFixture;

  const send = vi.fn<(input: NavigationInput) => void>();
  const runtime = { phase, send, isSending: false };
  const source = createStandaloneKeyboardSource({
    parent,
    getMenu: () => (hasMenu ? menu : undefined),
    runtime,
  });
  return {
    parent,
    menu,
    leaf,
    submenu,
    outside,
    send,
    source,
    setPhase(next: NavigationPhase) {
      runtime.phase = next;
    },
    setIsSending(isSending: boolean) {
      runtime.isSending = isSending;
    },
    [Symbol.dispose]() {
      source.dispose();
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

describe('createStandaloneKeyboardSource', () => {
  it.each<[string, KeyboardIntent]>([
    ['ArrowUp', 'up'],
    ['ArrowDown', 'down'],
    ['ArrowLeft', 'left'],
    ['ArrowRight', 'right'],
    ['Home', 'first'],
    ['End', 'last'],
    ['Enter', 'activate'],
    ['Escape', 'back'],
  ])(
    'turns %s into the %s intent, and keeps the page from acting on it',
    (key, intent) => {
      using fixture = createFixture();

      const event = press(fixture.leaf, key);

      expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
        type: 'keyboard',
        intent,
      });
      expect(event.defaultPrevented).toBe(true);
    },
  );

  it('turns Tab into the dismiss intent, and lets it move focus on', () => {
    using fixture = createFixture();

    const event = press(fixture.leaf, 'Tab');
    const shifted = press(fixture.leaf, 'Tab', { shiftKey: true });

    expect(fixture.send).toHaveBeenCalledTimes(2);
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'keyboard',
      intent: 'dismiss',
    });
    expect(event.defaultPrevented).toBe(false);
    expect(shifted.defaultPrevented).toBe(false);
  });

  it('ignores keys it has no intent for', () => {
    using fixture = createFixture();

    const event = press(fixture.leaf, 'a');

    expect(fixture.send).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves a shortcut alone when a modifier other than Shift is held', () => {
    using fixture = createFixture();

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

  it('ignores a key pressed outside the menu', () => {
    using fixture = createFixture();

    const event = press(fixture.outside, 'ArrowDown');

    expect(fixture.send).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores every key, and does not prevent it, unless a standalone menu is open', () => {
    using fixture = createFixture('novice');

    const event = press(fixture.leaf, 'Escape');

    expect(fixture.send).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('follows the phase as it changes', () => {
    using fixture = createFixture('idle');

    press(fixture.leaf, 'ArrowDown');
    fixture.setPhase('standalone');
    press(fixture.leaf, 'ArrowDown');

    expect(fixture.send).toHaveBeenCalledTimes(1);
  });

  it('reports the item that took focus', () => {
    using fixture = createFixture();

    fixture.leaf.focus();

    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'focus',
      key: 'leaf-key',
    });
  });

  it('ignores focus that lands on the menu layer rather than an item', () => {
    using fixture = createFixture();

    fixture.menu.focusMenu();

    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('ignores focus that lands outside the menu', () => {
    using fixture = createFixture();

    fixture.outside.focus();

    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('ignores focus unless a standalone menu is open', () => {
    using fixture = createFixture('novice');

    fixture.leaf.focus();

    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('closes the standalone menu when focus moves outside it', () => {
    using fixture = createFixture();

    fixture.leaf.focus();
    fixture.outside.focus();

    expect(fixture.send).toHaveBeenNthCalledWith(1, {
      type: 'focus',
      key: 'leaf-key',
    });
    expect(fixture.send).toHaveBeenNthCalledWith(2, {
      type: 'focus-loss',
    });
  });

  it('closes the standalone menu when focus clears', () => {
    using fixture = createFixture();

    fixture.leaf.focus();
    fixture.leaf.blur();

    expect(fixture.send).toHaveBeenLastCalledWith({ type: 'focus-loss' });
  });

  it('keeps a standalone menu open while focus moves between its items', () => {
    using fixture = createFixture();

    fixture.leaf.focus();
    fixture.submenu.focus();

    expect(fixture.send).not.toHaveBeenCalledWith({ type: 'focus-loss' });
  });

  it('ignores a blur fired as a side effect of a source-driven send, keyboard or not', () => {
    using fixture = createFixture();
    fixture.leaf.focus();

    // A pointer release entering a submenu swaps the DOM out from under the
    // focused item mid-send, the same way `isHandlingKeyboardIntent` used to
    // guard only for a keyboard-driven one.
    fixture.setIsSending(true);
    fixture.outside.focus();

    expect(fixture.send).not.toHaveBeenCalledWith({ type: 'focus-loss' });
  });

  it('ignores everything once there is no menu to read', () => {
    using fixture = createFixture('standalone', { hasMenu: false });

    press(fixture.leaf, 'ArrowDown');
    fixture.leaf.focus();

    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('stops listening once disposed', () => {
    using fixture = createFixture();
    fixture.source.dispose();

    press(fixture.leaf, 'ArrowDown');
    fixture.leaf.focus();

    expect(fixture.send).not.toHaveBeenCalled();
  });
});

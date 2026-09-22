import { createKeyboardSource } from './keyboard-source.js';
import type {
  KeyboardIntent,
  NavigationInput,
  NavigationPhase,
} from './machine.js';

/**
 A parent holding a menu layer of two items, the way the renderer lays them
 out, plus something else that is not part of the menu.
 */
const createFixture = (
  phase: NavigationPhase = 'standalone',
  { hasMenu = true }: { hasMenu?: boolean } = {},
) => {
  const parent = document.createElement('div');
  const layer = document.createElement('div');
  const item = document.createElement('div');
  item.className = 'marking-menu-item';
  item.dataset.itemId = 'item-key';
  item.tabIndex = -1;
  const nextItem = document.createElement('div');
  nextItem.className = 'marking-menu-item';
  nextItem.dataset.itemId = 'next-item-key';
  nextItem.tabIndex = -1;
  layer.append(item, nextItem);
  const outside = document.createElement('button');
  parent.append(layer, outside);
  document.body.append(parent);

  const send = vi.fn<(input: NavigationInput) => void>();
  const onFocusLoss = vi.fn<() => void>();
  const runtime = { phase, send };
  const source = createKeyboardSource({
    parent,
    getMenu: () => (hasMenu ? { layer } : undefined),
    runtime,
    onFocusLoss,
  });
  return {
    parent,
    layer,
    item,
    nextItem,
    outside,
    send,
    onFocusLoss,
    source,
    setPhase(next: NavigationPhase) {
      runtime.phase = next;
    },
    [Symbol.dispose]() {
      source.dispose();
      parent.remove();
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

describe('createKeyboardSource', () => {
  it.each<[string, KeyboardIntent]>([
    ['ArrowDown', 'next'],
    ['ArrowUp', 'previous'],
    ['Home', 'first'],
    ['End', 'last'],
    ['Enter', 'activate'],
    ['ArrowRight', 'enter'],
    ['ArrowLeft', 'leave'],
    ['Escape', 'escape'],
  ])(
    'turns %s into the %s intent, and keeps the page from acting on it',
    (key, intent) => {
      using fixture = createFixture();

      const event = press(fixture.item, key);

      expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
        type: 'keyboard',
        intent,
      });
      expect(event.defaultPrevented).toBe(true);
    },
  );

  it('turns Tab into the close intent, and lets it move focus on', () => {
    using fixture = createFixture();

    const event = press(fixture.item, 'Tab');
    const shifted = press(fixture.item, 'Tab', { shiftKey: true });

    expect(fixture.send).toHaveBeenCalledTimes(2);
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'keyboard',
      intent: 'close',
    });
    expect(event.defaultPrevented).toBe(false);
    expect(shifted.defaultPrevented).toBe(false);
  });

  it('ignores keys it has no intent for', () => {
    using fixture = createFixture();

    const event = press(fixture.item, 'a');

    expect(fixture.send).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves a shortcut alone when a modifier other than Shift is held', () => {
    using fixture = createFixture();

    const events = [
      press(fixture.item, 'ArrowLeft', { altKey: true }),
      press(fixture.item, 'Home', { ctrlKey: true }),
      press(fixture.item, 'Enter', { metaKey: true }),
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

    const event = press(fixture.item, 'Escape');

    expect(fixture.send).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('follows the phase as it changes', () => {
    using fixture = createFixture('idle');

    press(fixture.item, 'ArrowDown');
    fixture.setPhase('standalone');
    press(fixture.item, 'ArrowDown');

    expect(fixture.send).toHaveBeenCalledTimes(1);
  });

  it('reports the item that took focus', () => {
    using fixture = createFixture();

    fixture.item.focus();

    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'focus',
      key: 'item-key',
    });
  });

  it('ignores focus that lands on the menu layer rather than an item', () => {
    using fixture = createFixture();
    fixture.layer.tabIndex = -1;

    fixture.layer.focus();

    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('ignores focus that lands outside the menu', () => {
    using fixture = createFixture();

    fixture.outside.focus();

    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('ignores focus unless a standalone menu is open', () => {
    using fixture = createFixture('novice');

    fixture.item.focus();

    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('closes the standalone menu when focus moves outside it', () => {
    using fixture = createFixture();

    fixture.item.focus();
    fixture.outside.focus();

    expect(fixture.onFocusLoss).toHaveBeenCalledExactlyOnceWith();
    expect(fixture.send).toHaveBeenNthCalledWith(1, {
      type: 'focus',
      key: 'item-key',
    });
    expect(fixture.send).toHaveBeenNthCalledWith(2, {
      type: 'keyboard',
      intent: 'close',
    });
  });

  it('closes the standalone menu when focus clears', () => {
    using fixture = createFixture();

    fixture.item.focus();
    fixture.item.blur();

    expect(fixture.onFocusLoss).toHaveBeenCalledExactlyOnceWith();
    expect(fixture.send).toHaveBeenLastCalledWith({
      type: 'keyboard',
      intent: 'close',
    });
  });

  it('keeps a standalone menu open while focus moves between its items', () => {
    using fixture = createFixture();

    fixture.item.focus();
    fixture.nextItem.focus();

    expect(fixture.onFocusLoss).not.toHaveBeenCalled();
    expect(fixture.send).not.toHaveBeenCalledWith({
      type: 'keyboard',
      intent: 'close',
    });
  });

  it('ignores everything once there is no menu to read', () => {
    using fixture = createFixture('standalone', { hasMenu: false });

    press(fixture.item, 'ArrowDown');
    fixture.item.focus();

    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('stops listening once disposed', () => {
    using fixture = createFixture();
    fixture.source.dispose();

    press(fixture.item, 'ArrowDown');
    fixture.item.focus();

    expect(fixture.send).not.toHaveBeenCalled();
  });
});

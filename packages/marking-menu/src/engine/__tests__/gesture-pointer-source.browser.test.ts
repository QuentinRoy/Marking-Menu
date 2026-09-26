import {
  centerOf,
  GESTURE_MENU_ITEMS,
  mountMenu,
  offset,
  press,
  pressMouse,
  waitForMenuClosed,
  waitForMenuOpen,
} from '../../__tests__/__fixtures__/browser-menu.js';
import { createGesturePointerSource } from '../gesture-pointer-source.js';
import type { NavigationSend } from '../runtime.js';
import { createParent } from './__fixtures__/parent.js';

/**
 Keeps every `type` event `element` gets, to read what the listeners did
 with it once dispatched.
 */
const recordEvents = <Type extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  type: Type,
) => {
  const events: Array<HTMLElementEventMap[Type]> = [];
  const listener = (event: HTMLElementEventMap[Type]) => {
    events.push(event);
  };

  element.addEventListener(type, listener);
  return {
    events,
    [Symbol.dispose]() {
      element.removeEventListener(type, listener);
    },
  };
};

/**
 A source over `parent`, disposed at the end of the block.
 */
const createSource = (
  parent: HTMLElement,
  send: NavigationSend = vi.fn<NavigationSend>(),
) => {
  const source = createGesturePointerSource({ parent, runtime: { send } });
  return Object.assign(source, { [Symbol.dispose]: source.dispose });
};

describe('createGesturePointerSource', () => {
  it('prevents native touch gestures until disposed', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    using touches = recordEvents(parent, 'touchstart');
    const send = vi.fn<NavigationSend>();
    const source = createSource(parent, send);

    {
      await using _drag = await press(at(0, 0));
    }

    source.dispose();

    {
      await using _drag = await press(at(0, 0));
    }

    expect(touches.events.map((event) => event.defaultPrevented)).toEqual([
      true,
      false,
    ]);
  });

  it('ignores move and up events from a pointer that is not the active gesture owner', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    const send = vi.fn<NavigationSend>();
    using _source = createSource(parent, send);

    await using _owner = await press(at(0, 0));
    send.mockClear();

    const other = await press(at(10, 10));
    await other.moveTo(at(20, 20), 1);
    await other.release();

    expect(send).not.toHaveBeenCalled();
  });

  it('sends pointerCancel for a native pointercancel on the active gesture, and releases capture beforehand', async () => {
    using fixture = createParent();
    const { parent, at, client } = fixture;
    using downs = recordEvents(parent, 'pointerdown');
    let heldOnSend: boolean | undefined;
    const send = vi.fn<NavigationSend>(() => {
      heldOnSend = downs.events.some((event) =>
        parent.hasPointerCapture(event.pointerId),
      );
    });
    using _source = createSource(parent, send);

    const drag = await press(at(0, 0));
    await drag.moveTo(at(10, 10), 1);
    const [down] = downs.events;
    expect(parent.hasPointerCapture(down?.pointerId ?? NaN)).toBe(true);
    send.mockClear();

    await drag.cancel();

    expect(send).toHaveBeenCalledExactlyOnceWith('pointerCancel', {
      position: client(10, 10),
    });
    expect(heldOnSend).toBe(false);
  });

  it('ignores a pointercancel from a pointer that is not the active gesture owner', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    const send = vi.fn<NavigationSend>();
    using _source = createSource(parent, send);

    // The mouse owns the gesture, so canceling touches leaves it alone.
    await using _owner = await pressMouse(at(0, 0));
    send.mockClear();

    const other = await press(at(10, 10));
    await other.cancel();

    expect(send).not.toHaveBeenCalled();
  });

  describe('while suspended', () => {
    it('leaves pointer input to the page: nothing is sent, prevented or captured', async () => {
      using fixture = createParent();
      const { parent, at } = fixture;
      using downs = recordEvents(parent, 'pointerdown');
      const send = vi.fn<NavigationSend>();
      using source = createSource(parent, send);

      source.suspend();
      // The mouse, because the browser itself captures a touch to the
      // element it lands on.
      await using _drag = await pressMouse(at(0, 0));

      const [down] = downs.events;
      expect(send).not.toHaveBeenCalled();
      expect(down?.defaultPrevented).toBe(false);
      expect(parent.hasPointerCapture(down?.pointerId ?? NaN)).toBe(false);
    });

    it('lets touch gestures through, and gives touch-action back', async () => {
      using fixture = createParent();
      const { parent, at } = fixture;
      using touches = recordEvents(parent, 'touchstart');
      parent.style.touchAction = 'pan-y';
      using source = createSource(parent);
      expect(parent.style.touchAction).toBe('none');

      source.suspend();
      await using _drag = await press(at(0, 0));

      expect(touches.events.map((event) => event.defaultPrevented)).toEqual([
        false,
      ]);
      expect(parent.style.touchAction).toBe('pan-y');
    });

    it('takes pointer input and touch-action back once resumed', async () => {
      using fixture = createParent();
      const { parent, at, client } = fixture;
      using touches = recordEvents(parent, 'touchstart');
      const send = vi.fn<NavigationSend>();
      using source = createSource(parent, send);
      source.suspend();

      source.resume();
      await using _drag = await press(at(3, 4));

      expect(send).toHaveBeenCalledExactlyOnceWith('pointerDown', {
        position: client(3, 4),
      });
      expect(parent.style.touchAction).toBe('none');
      expect(touches.events.map((event) => event.defaultPrevented)).toEqual([
        true,
      ]);
    });

    it('tolerates being suspended or resumed twice in a row', () => {
      using fixture = createParent();
      const { parent } = fixture;
      parent.style.touchAction = 'pan-y';
      const source = createSource(parent);

      source.suspend();
      source.suspend();
      expect(parent.style.touchAction).toBe('pan-y');

      source.resume();
      source.resume();
      source.dispose();
      expect(parent.style.touchAction).toBe('pan-y');
    });

    it('does not take touch-action back once disposed', () => {
      using fixture = createParent();
      const { parent } = fixture;
      const source = createSource(parent);
      source.suspend();
      source.dispose();

      source.resume();

      expect(parent.style.touchAction).toBe('');
    });

    it('still gives touch-action back on disposal', () => {
      using fixture = createParent();
      const { parent } = fixture;
      const source = createSource(parent);

      source.suspend();
      source.dispose();

      expect(parent.style.touchAction).toBe('');
    });
  });
});

test('concurrent touch pointers leave the owning gesture in control', async () => {
  using menu = mountMenu({ items: GESTURE_MENU_ITEMS });
  const selections: Array<string | undefined> = [];
  menu.mm.on('select', (event) => {
    selections.push(event.selection.id);
  });
  const center = centerOf(menu.surface);

  await using owner = await press(center);
  await waitForMenuOpen(menu.surface);
  await using decoy = await press(offset(center, 180, 100));
  await decoy.moveTo(offset(center, 270, 100));
  await decoy.release();
  await owner.moveTo(offset(center, 0, 100), 3);
  await owner.release();

  await expect.poll(() => selections).toEqual(['right']);
});

test('touchCancel reaches the menu as a real pointer cancellation', async () => {
  using menu = mountMenu({ items: GESTURE_MENU_ITEMS });
  const events: string[] = [];
  menu.mm.on('cancel', (event) => {
    events.push(event.type);
  });

  await using drag = await press(centerOf(menu.surface));
  await waitForMenuOpen(menu.surface);
  await drag.cancel();

  await expect.poll(() => events).toEqual(['cancel']);
  await waitForMenuClosed(menu.surface);
});

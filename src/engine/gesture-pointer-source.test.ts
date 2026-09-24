import { createParent, pointer } from './__fixtures__/pointer.js';
import { createGesturePointerSource } from './gesture-pointer-source.js';
import type { NavigationSend } from './runtime.js';

describe('createGesturePointerSource', () => {
  it('prevents native touch gestures until disposed', () => {
    const parent = createParent();
    const send = vi.fn<NavigationSend>();
    const source = createGesturePointerSource({ parent, runtime: { send } });

    const whileActive = new Event('touchstart', { cancelable: true });
    expect(parent.dispatchEvent(whileActive)).toBe(false);
    expect(whileActive.defaultPrevented).toBe(true);

    source.dispose();

    const afterDisposal = new Event('touchstart', { cancelable: true });
    expect(parent.dispatchEvent(afterDisposal)).toBe(true);
    expect(afterDisposal.defaultPrevented).toBe(false);
  });

  it('ignores move and up events from a pointer that is not the active gesture owner', () => {
    const parent = createParent();
    const send = vi.fn<NavigationSend>();
    createGesturePointerSource({ parent, runtime: { send } });

    parent.dispatchEvent(
      pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    send.mockClear();

    parent.dispatchEvent(
      pointer('pointermove', { pointerId: 99, clientX: 10, clientY: 10 }),
    );
    parent.dispatchEvent(
      pointer('pointerup', { pointerId: 99, clientX: 10, clientY: 10 }),
    );

    expect(send).not.toHaveBeenCalled();
  });

  it('sends pointerCancel for a native pointercancel on the active gesture, and releases capture beforehand', () => {
    const parent = createParent();
    const send = vi.fn<NavigationSend>();
    createGesturePointerSource({ parent, runtime: { send } });

    parent.dispatchEvent(
      pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    expect(parent.hasPointerCapture(1)).toBe(true);
    send.mockClear();

    parent.dispatchEvent(
      pointer('pointercancel', { pointerId: 1, clientX: 10, clientY: 10 }),
    );

    expect(parent.hasPointerCapture(1)).toBe(false);
    expect(send).toHaveBeenCalledExactlyOnceWith('pointerCancel', {
      position: [10, 10],
    });
  });

  it('ignores a pointercancel from a pointer that is not the active gesture owner', () => {
    const parent = createParent();
    const send = vi.fn<NavigationSend>();
    createGesturePointerSource({ parent, runtime: { send } });

    parent.dispatchEvent(
      pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    send.mockClear();

    parent.dispatchEvent(
      pointer('pointercancel', { pointerId: 99, clientX: 10, clientY: 10 }),
    );

    expect(send).not.toHaveBeenCalled();
  });

  describe('while suspended', () => {
    it('leaves pointer input to the page: nothing is sent, prevented or captured', () => {
      const parent = createParent();
      const send = vi.fn<NavigationSend>();
      const source = createGesturePointerSource({ parent, runtime: { send } });

      source.suspend();
      const down = pointer('pointerdown', {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        cancelable: true,
      });
      parent.dispatchEvent(down);

      expect(send).not.toHaveBeenCalled();
      expect(down.defaultPrevented).toBe(false);
      expect(parent.hasPointerCapture(1)).toBe(false);
    });

    it('lets touch gestures through, and gives touch-action back', () => {
      const parent = createParent();
      parent.style.touchAction = 'pan-y';
      const source = createGesturePointerSource({
        parent,
        runtime: { send: vi.fn<NavigationSend>() },
      });
      expect(parent.style.touchAction).toBe('none');

      source.suspend();

      const touch = new Event('touchstart', { cancelable: true });
      expect(parent.dispatchEvent(touch)).toBe(true);
      expect(parent.style.touchAction).toBe('pan-y');
    });

    it('takes pointer input and touch-action back once resumed', () => {
      const parent = createParent();
      const send = vi.fn<NavigationSend>();
      const source = createGesturePointerSource({ parent, runtime: { send } });
      source.suspend();

      source.resume();
      parent.dispatchEvent(
        pointer('pointerdown', { pointerId: 1, clientX: 3, clientY: 4 }),
      );

      expect(send).toHaveBeenCalledExactlyOnceWith('pointerDown', {
        position: [3, 4],
      });
      expect(parent.style.touchAction).toBe('none');
      const touch = new Event('touchstart', { cancelable: true });
      expect(parent.dispatchEvent(touch)).toBe(false);
    });

    it('tolerates being suspended or resumed twice in a row', () => {
      const parent = createParent();
      parent.style.touchAction = 'pan-y';
      const source = createGesturePointerSource({
        parent,
        runtime: { send: vi.fn<NavigationSend>() },
      });

      source.suspend();
      source.suspend();
      expect(parent.style.touchAction).toBe('pan-y');

      source.resume();
      source.resume();
      source.dispose();
      expect(parent.style.touchAction).toBe('pan-y');
    });

    it('does not take touch-action back once disposed', () => {
      const parent = createParent();
      const source = createGesturePointerSource({
        parent,
        runtime: { send: vi.fn<NavigationSend>() },
      });
      source.suspend();
      source.dispose();

      source.resume();

      expect(parent.style.touchAction).toBe('');
    });

    it('still gives touch-action back on disposal', () => {
      const parent = createParent();
      const source = createGesturePointerSource({
        parent,
        runtime: { send: vi.fn<NavigationSend>() },
      });

      source.suspend();
      source.dispose();

      expect(parent.style.touchAction).toBe('');
    });
  });
});

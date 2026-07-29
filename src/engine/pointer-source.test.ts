import { createParent, pointer } from './__fixtures__/pointer.js';
import type { NavigationInput } from './machine.js';
import { createPointerSource } from './pointer-source.js';

describe('createPointerSource', () => {
  it('ignores move and up events from a pointer that is not the active gesture owner', () => {
    const parent = createParent();
    const send = vi.fn<(input: NavigationInput) => void>();
    createPointerSource({ parent, runtime: { send } });

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

  it('sends pointer.cancel for a native pointercancel on the active gesture, and releases capture beforehand', () => {
    const parent = createParent();
    const send = vi.fn<(input: NavigationInput) => void>();
    createPointerSource({ parent, runtime: { send } });

    parent.dispatchEvent(
      pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    expect(parent.hasPointerCapture(1)).toBe(true);
    send.mockClear();

    parent.dispatchEvent(
      pointer('pointercancel', { pointerId: 1, clientX: 10, clientY: 10 }),
    );

    expect(parent.hasPointerCapture(1)).toBe(false);
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'pointer.cancel',
      position: [10, 10],
    });
  });

  it('ignores a pointercancel from a pointer that is not the active gesture owner', () => {
    const parent = createParent();
    const send = vi.fn<(input: NavigationInput) => void>();
    createPointerSource({ parent, runtime: { send } });

    parent.dispatchEvent(
      pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    send.mockClear();

    parent.dispatchEvent(
      pointer('pointercancel', { pointerId: 99, clientX: 10, clientY: 10 }),
    );

    expect(send).not.toHaveBeenCalled();
  });
});

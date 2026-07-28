import type { NavigationInput } from './machine.js';
import { createPointerSource } from './pointer-source.js';

const createParent = (): HTMLElement => {
  const parent = document.createElement('div');
  Object.assign(parent, {
    hasPointerCapture: vi.fn(() => true),
    releasePointerCapture: vi.fn(),
    setPointerCapture: vi.fn(),
  });
  return parent;
};

const pointer = (type: string, init: PointerEventInit = {}): PointerEvent =>
  new PointerEvent(type, {
    button: 0,
    isPrimary: true,
    pointerId: 1,
    ...init,
  });

describe('createPointerSource', () => {
  it('ignores move and up events from a pointer that is not the active gesture owner', () => {
    const parent = createParent();
    const send = vi.fn<(input: NavigationInput) => void>();
    const dispose = vi.fn<() => void>();
    createPointerSource({ parent, runtime: { send, dispose } });

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
});

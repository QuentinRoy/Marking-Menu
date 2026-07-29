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
});

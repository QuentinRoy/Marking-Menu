import { createMarkingMenu } from '../create-marking-menu.js';
import {
  createParent,
  pointer,
} from '../engine/__tests__/__fixtures__/pointer.js';
import { fakeTimers } from './__fixtures__/timers.js';

describe('createMarkingMenu', () => {
  it('builds a working, already-active controller', () => {
    using _timers = fakeTimers();

    const parent = createParent();
    const items = [
      { id: 'right', label: 'Right' },
      { id: 'left', label: 'Left' },
    ] as const;
    const mm = createMarkingMenu({ items, parent });

    const selected = vi.fn<() => void>();
    mm.on('select', selected);

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));

    expect(selected).toHaveBeenCalledOnce();

    mm.dispose();
  });
});

import { vi } from 'vitest';

/*
 Shared by `controller.test.ts` and `gesture-pointer-source.test.ts`: a parent
 element with statefully-stubbed pointer-capture methods (JSDOM implements
 none of that API), and a `PointerEvent` builder defaulting to the primary
 pointer and primary button.
 */

export const createParent = (): HTMLElement => {
  const parent = document.createElement('div');
  const captured = new Set<number>();
  Object.assign(parent, {
    hasPointerCapture: vi.fn((pointerId: number) => captured.has(pointerId)),
    releasePointerCapture: vi.fn((pointerId: number) => {
      captured.delete(pointerId);
    }),
    setPointerCapture: vi.fn((pointerId: number) => {
      captured.add(pointerId);
    }),
  });
  return parent;
};

export const pointer = (
  type: string,
  init: PointerEventInit = {},
): PointerEvent =>
  new PointerEvent(type, {
    button: 0,
    isPrimary: true,
    pointerId: 1,
    // Real pointer events bubble and cross shadow boundaries; a
    // constructed one defaults both to `false` unless told otherwise, and a
    // test dispatching on a descendant inside the menu's shadow root (an
    // item, or a child of one) relies on both to reach a listener above it.
    bubbles: true,
    composed: true,
    ...init,
  });

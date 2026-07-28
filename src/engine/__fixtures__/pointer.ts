import { vi } from 'vitest';

/*
 Shared by `controller.test.ts` and `pointer-source.test.ts`: a parent
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
    ...init,
  });

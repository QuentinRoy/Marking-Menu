import { claimTouchAction } from '../move/touch-action.js';
import type { Point } from '../utils.js';
import type { NavigationRuntime } from './runtime.js';

export type PointerSource = {
  dispose: () => void;
};

const toPosition = (event: PointerEvent): Point =>
  Object.freeze([event.clientX, event.clientY]) as Point;

/**
 Native pointer listeners: accepts only the primary pointer and primary
 button, owns capture, and enforces the one-active-gesture policy before
 inputs reach the machine.
 */
export function createPointerSource({
  parent,
  runtime,
}: {
  parent: HTMLElement;
  runtime: NavigationRuntime;
}): PointerSource {
  let activePointerId: number | null = null;
  const releaseTouchAction = claimTouchAction(parent);

  const onPointerDown = (event: PointerEvent): void => {
    if (activePointerId !== null || !event.isPrimary || event.button !== 0) {
      return;
    }

    activePointerId = event.pointerId;
    parent.setPointerCapture(event.pointerId);
    runtime.send({ type: 'pointer.down', position: toPosition(event) });
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    runtime.send({ type: 'pointer.move', position: toPosition(event) });
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = null;
    runtime.send({ type: 'pointer.up', position: toPosition(event) });
    parent.releasePointerCapture(event.pointerId);
  };

  parent.addEventListener('pointerdown', onPointerDown);
  parent.addEventListener('pointermove', onPointerMove);
  parent.addEventListener('pointerup', onPointerUp);

  const dispose = (): void => {
    parent.removeEventListener('pointerdown', onPointerDown);
    parent.removeEventListener('pointermove', onPointerMove);
    parent.removeEventListener('pointerup', onPointerUp);
    releaseTouchAction();
  };

  return { dispose };
}

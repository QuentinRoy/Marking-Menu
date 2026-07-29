import { claimTouchAction } from '../move/touch-action.js';
import type { Point } from '../utils.js';
import type { NavigationInputSink } from './runtime.js';

export type PointerSource = {
  dispose: () => void;
};

const toPosition = (event: PointerEvent): Point =>
  Object.freeze([event.clientX, event.clientY] as const);

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
  runtime: NavigationInputSink;
}): PointerSource {
  let activePointerId: number | null = null;
  const releaseTouchAction = claimTouchAction(parent);

  /**
   Give back the capture the active gesture took, if it still holds one.
   Idempotent, and safe to call with no gesture in progress.
   */
  const releaseCapture = (): void => {
    if (activePointerId === null) {
      return;
    }

    const pointerId = activePointerId;
    activePointerId = null;
    if (parent.hasPointerCapture(pointerId)) {
      parent.releasePointerCapture(pointerId);
    }
  };

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

    // Before `send`, not after: `send` dispatches `select` synchronously, and
    // a listener must observe fully committed state — including capture
    // ownership, so that it may start a gesture of its own.
    releaseCapture();
    runtime.send({ type: 'pointer.up', position: toPosition(event) });
  };

  parent.addEventListener('pointerdown', onPointerDown);
  parent.addEventListener('pointermove', onPointerMove);
  parent.addEventListener('pointerup', onPointerUp);

  const dispose = (): void => {
    parent.removeEventListener('pointerdown', onPointerDown);
    parent.removeEventListener('pointermove', onPointerMove);
    parent.removeEventListener('pointerup', onPointerUp);
    // Disposing mid-gesture: the listeners that would have released the
    // capture are gone, so nothing else ever would.
    releaseCapture();
    releaseTouchAction();
  };

  return { dispose };
}

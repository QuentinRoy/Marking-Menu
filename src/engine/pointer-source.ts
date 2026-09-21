import { claimTouchAction } from '../move/touch-action.js';
import type { Point } from '../utils.js';
import type { NavigationInputSink } from './runtime.js';

export type PointerSource = {
  /**
   Leave pointer input to the page while a standalone menu is displayed: no
   gesture starts, nothing is prevented or captured, and `touch-action` goes
   back to what it was.
   */
  suspend: () => void;
  /**
  Take pointer input back after {@link PointerSource.suspend}.
  */
  resume: () => void;
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
  let activePointerId: number | undefined;
  let isDisposed = false;
  let releaseTouchAction: (() => void) | undefined = claimTouchAction(parent);

  /**
   Give back the capture the active gesture took, if it still holds one.
   Idempotent, and safe to call with no gesture in progress.
   */
  const releaseCapture = (): void => {
    if (activePointerId === undefined) {
      return;
    }

    const pointerId = activePointerId;
    activePointerId = undefined;
    if (parent.hasPointerCapture(pointerId)) {
      parent.releasePointerCapture(pointerId);
    }
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (
      releaseTouchAction === undefined ||
      activePointerId !== undefined ||
      !event.isPrimary ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
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
    // a listener must observe fully committed state, including capture
    // ownership, so that it may start a gesture of its own.
    releaseCapture();
    runtime.send({ type: 'pointer.up', position: toPosition(event) });
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    // Same ordering rationale as `onPointerUp`: release before dispatching.
    releaseCapture();
    runtime.send({ type: 'pointer.cancel', position: toPosition(event) });
  };

  // WebKit only suppresses its long-press loupe when touchstart itself is
  // canceled; canceling the corresponding pointerdown is not enough.
  const onTouchStart = (event: TouchEvent): void => {
    if (releaseTouchAction !== undefined) {
      event.preventDefault();
    }
  };

  parent.addEventListener('pointerdown', onPointerDown);
  parent.addEventListener('pointermove', onPointerMove);
  parent.addEventListener('pointerup', onPointerUp);
  parent.addEventListener('pointercancel', onPointerCancel);
  parent.addEventListener('touchstart', onTouchStart, { passive: false });

  // Suspended exactly when `touch-action` is not claimed: one fact, so the
  // two can never disagree.
  const suspend = (): void => {
    releaseTouchAction?.();
    releaseTouchAction = undefined;
  };

  const resume = (): void => {
    if (!isDisposed) {
      releaseTouchAction ??= claimTouchAction(parent);
    }
  };

  const dispose = (): void => {
    isDisposed = true;
    parent.removeEventListener('pointerdown', onPointerDown);
    parent.removeEventListener('pointermove', onPointerMove);
    parent.removeEventListener('pointerup', onPointerUp);
    parent.removeEventListener('pointercancel', onPointerCancel);
    parent.removeEventListener('touchstart', onTouchStart);
    // Disposing mid-gesture: the listeners that would have released the
    // capture are gone, so nothing else ever would.
    releaseCapture();
    suspend();
  };

  return { suspend, resume, dispose };
}

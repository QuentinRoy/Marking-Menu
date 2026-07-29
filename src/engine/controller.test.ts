import { type Mock } from 'vitest';
import {
  fakeTimers,
  queryCanvasContext,
  stubbedCanvasContexts,
} from '../__fixtures__/canvas.js';
import type {
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
} from '../events.js';
import type { AnyModelNode } from '../types.js';
import { createParent, pointer } from './__fixtures__/pointer.js';
import { createController } from './controller.js';

/** Read the pointer-capture mocks `createParent` attaches to a real element. */
const pointerCaptureMocks = (
  parent: HTMLElement,
): {
  hasPointerCapture: Mock;
  releasePointerCapture: Mock;
  setPointerCapture: Mock;
} =>
  parent as unknown as {
    hasPointerCapture: Mock;
    releasePointerCapture: Mock;
    setPointerCapture: Mock;
  };

const items = [
  { id: 'right', label: 'Right' },
  { id: 'down', label: 'Down' },
  { id: 'left', label: 'Left' },
  { id: 'up', label: 'Up' },
] as const;

// `vi.fn()` alone infers a value-returning signature, which an event
// listener's `void` return type rejects.
const voidMock = <Arguments extends readonly unknown[]>() =>
  vi.fn<(...args: Arguments) => void>();

describe('createController', () => {
  it('dispatches select carrying the leaf a straight drag recognizes', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    using controller = createController({ items, parent });

    const selected = vi.fn<() => void>();
    let selectedId: string | undefined;
    controller.on('select', (event) => {
      selected();
      selectedId = event.selection.id;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));

    expect(selected).toHaveBeenCalledTimes(1);
    expect(selectedId).toBe('right');
  });

  it('dispatches start as the first event, before select', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    using controller = createController({ items, parent });

    const seen: string[] = [];
    controller.on('start', (event) => {
      seen.push(event.type);
      expect(event.mode).toBe('startup');
    });
    controller.on('select', (event) => {
      seen.push(event.type);
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));

    expect(seen).toEqual(['start', 'select']);
  });

  it('shows a crosshair cursor on gesture start', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    using _controller = createController({ items, parent });

    expect(parent.style.cursor).toBe('');
    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(parent.style.cursor).toBe('crosshair');
  });

  it("restores the parent's own inline cursor rather than clearing it", () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    parent.style.cursor = 'pointer';
    const controller = createController({ items, parent });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(parent.style.cursor).toBe('crosshair');

    // Back to idle: the parent's cursor is the parent's again, not blank.
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));
    expect(parent.style.cursor).toBe('pointer');

    controller.dispose();
    expect(parent.style.cursor).toBe('pointer');
  });

  it('draws the stroke through the RAF throttle, converging to the latest state when frames coalesce', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    using _controller = createController({ items, parent });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 10, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 50, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));

    // No frame has run yet: nothing is drawn synchronously.
    const context = queryCanvasContext(parent);
    expect(
      context.mock.methodCalls.filter((c) => c.method === 'stroke'),
    ).toHaveLength(0);

    vi.advanceTimersToNextFrame();

    // The three coalesced moves converge to a single draw of the full,
    // latest stroke: one `beginPath`/`stroke` pair, moveTo + 3 lineTo.
    const strokeCalls = context.mock.methodCalls.filter(
      (c) => c.method === 'stroke',
    );
    const lineToCalls = context.mock.methodCalls.filter(
      (c) => c.method === 'lineTo',
    );
    expect(strokeCalls).toHaveLength(1);
    expect(lineToCalls).toHaveLength(3);
    expect(lineToCalls.at(-1)?.args).toEqual([100, 0]);
  });

  it('shows one gesture-feedback trace on completion', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    using _controller = createController({ items, parent });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));

    expect(parent.querySelectorAll('canvas')).toHaveLength(1);
  });

  it('dispose() removes listeners, DOM, and the touch-action claim, and is idempotent', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    using controller = createController({ items, parent });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));

    expect(parent.querySelectorAll('canvas')).toHaveLength(1);
    expect(parent.style.getPropertyValue('touch-action')).toBe('none');

    const selected = voidMock<[MarkingMenuSelectEvent<AnyModelNode>]>();
    controller.on('select', selected);

    controller.dispose();

    expect(parent.querySelectorAll('canvas')).toHaveLength(0);
    expect(parent.style.getPropertyValue('touch-action')).toBe('');
    expect(parent.style.cursor).toBe('');

    // Disposal happened mid-gesture, so the capture the gesture took is the
    // controller's to give back: nothing else will ever release it.
    expect(
      pointerCaptureMocks(parent).releasePointerCapture,
    ).toHaveBeenCalledExactlyOnceWith(1);
    expect(parent.hasPointerCapture(1)).toBe(false);

    // Further pointer input is inert: the DOM listeners are gone.
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));
    expect(selected).not.toHaveBeenCalled();

    expect(() => {
      controller.dispose();
    }).not.toThrow();
  });

  it('freezes position on start and select, and dispatches select after the DOM is fully rendered', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    using controller = createController({ items, parent });

    let startPosition: readonly number[] | undefined;
    controller.on('start', (event) => {
      startPosition = event.position;
    });

    let observedDuringSelect: { canvases: number; cursor: string } | undefined;
    controller.on('select', (event) => {
      expect(Object.isFrozen(event.position)).toBe(true);
      observedDuringSelect = {
        canvases: parent.querySelectorAll('canvas').length,
        cursor: parent.style.cursor,
      };
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(Object.isFrozen(startPosition)).toBe(true);

    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));

    // The listener observed the *complete* result of the pointerup input:
    // the upper-stroke canvas already gone, the feedback trace already
    // shown, the cursor already reset — not a partial, mid-commit view.
    expect(observedDuringSelect).toEqual({ canvases: 1, cursor: '' });
  });

  it('only accepts the primary pointer and primary button, and owns pointer capture', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    using controller = createController({ items, parent });
    const { releasePointerCapture, setPointerCapture } =
      pointerCaptureMocks(parent);

    const started = voidMock<[MarkingMenuStartEvent]>();
    controller.on('start', started);

    // Non-primary pointer and non-primary button are both ignored.
    parent.dispatchEvent(
      pointer('pointerdown', { isPrimary: false, clientX: 0, clientY: 0 }),
    );
    parent.dispatchEvent(
      pointer('pointerdown', { button: 1, clientX: 0, clientY: 0 }),
    );
    expect(started).not.toHaveBeenCalled();
    expect(setPointerCapture).not.toHaveBeenCalled();

    // A qualifying down starts the gesture and takes capture.
    parent.dispatchEvent(
      pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    expect(started).toHaveBeenCalledTimes(1);
    expect(setPointerCapture).toHaveBeenCalledExactlyOnceWith(1);

    // A second, concurrent primary pointer is ignored: no second `start`.
    parent.dispatchEvent(
      pointer('pointerdown', { pointerId: 2, clientX: 0, clientY: 0 }),
    );
    expect(started).toHaveBeenCalledTimes(1);

    // Capture is released once the owning gesture ends.
    parent.dispatchEvent(
      pointer('pointermove', { pointerId: 1, clientX: 100, clientY: 0 }),
    );
    parent.dispatchEvent(
      pointer('pointerup', { pointerId: 1, clientX: 120, clientY: 0 }),
    );
    expect(releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('has already released pointer capture by the time select is dispatched', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    using controller = createController({ items, parent });

    let heldDuringSelect: boolean | undefined;
    controller.on('select', () => {
      heldDuringSelect = parent.hasPointerCapture(1);
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));

    // A `select` listener sees fully committed state, and capture ownership is
    // part of that state: a listener may legitimately start its own gesture.
    expect(heldDuringSelect).toBe(false);
  });

  it('[Symbol.dispose]() delegates to dispose()', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    const controller = createController({ items, parent });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(parent.querySelectorAll('canvas')).toHaveLength(1);

    controller[Symbol.dispose]();

    expect(parent.querySelectorAll('canvas')).toHaveLength(0);
    expect(parent.style.getPropertyValue('touch-action')).toBe('');
  });
});

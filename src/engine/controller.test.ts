import { type Mock } from 'vitest';
import {
  fakeTimers,
  queryCanvasContext,
  stubbedCanvasContexts,
} from '../__fixtures__/canvas.js';
import type {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuMoveEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
} from '../events.js';
import type { AnyModelNode } from '../types.js';
import { createParent, pointer } from './__fixtures__/pointer.js';
import { createController } from './controller.js';

/**
Read the pointer-capture mocks `createParent` attaches to a real element.
*/
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
    const controller = createController({ items, parent });

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

    controller.dispose();
  });

  it('dispatches start as the first event, before select', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    const controller = createController({ items, parent });

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

    controller.dispose();
  });

  it('shows a crosshair cursor on gesture start', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    const controller = createController({ items, parent });

    expect(parent.style.cursor).toBe('');
    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(parent.style.cursor).toBe('crosshair');

    controller.dispose();
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
    const controller = createController({ items, parent });

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

    controller.dispose();
  });

  it('shows one gesture-feedback trace on completion', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    const controller = createController({ items, parent });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));

    expect(parent.querySelectorAll('canvas')).toHaveLength(1);

    controller.dispose();
  });

  it('dispose() removes listeners, DOM, and the touch-action claim, and is idempotent', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    const controller = createController({ items, parent });

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
    const controller = createController({ items, parent });

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
    // shown, the cursor already reset. Not a partial, mid-commit view.
    expect(observedDuringSelect).toEqual({ canvases: 1, cursor: '' });

    controller.dispose();
  });

  it('only accepts the primary pointer and primary button, and owns pointer capture', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    const controller = createController({ items, parent });
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

    controller.dispose();
  });

  it('has already released pointer capture by the time select is dispatched', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    const controller = createController({ items, parent });

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

    controller.dispose();
  });

  it('dispatches cancel carrying a null active, not select, for a gesture with no movement at all', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    const controller = createController({ items, parent });

    const selected = voidMock<[MarkingMenuSelectEvent<AnyModelNode>]>();
    controller.on('select', selected);

    let cancelEvent: MarkingMenuCancelEvent<AnyModelNode> | undefined;
    controller.on('cancel', (event) => {
      cancelEvent = event;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 0, clientY: 0 }));

    expect(selected).not.toHaveBeenCalled();
    expect(cancelEvent?.mode).toBe('startup');
    expect(cancelEvent?.active).toBeNull();

    controller.dispose();
  });

  it('dispatches cancel, never select, when the native pointer is cancelled mid-gesture, even along a straight line that would otherwise recognize', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    const controller = createController({ items, parent });

    const selected = voidMock<[MarkingMenuSelectEvent<AnyModelNode>]>();
    controller.on('select', selected);

    let cancelEvent: MarkingMenuCancelEvent<AnyModelNode> | undefined;
    controller.on('cancel', (event) => {
      cancelEvent = event;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(
      pointer('pointercancel', { clientX: 100, clientY: 0 }),
    );

    expect(selected).not.toHaveBeenCalled();
    expect(cancelEvent?.mode).toBe('expert');
    expect(cancelEvent?.active).toBeNull();

    controller.dispose();
  });

  it('has already released pointer capture by the time cancel is dispatched', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    const controller = createController({ items, parent });

    let heldDuringCancel: boolean | undefined;
    controller.on('cancel', () => {
      heldDuringCancel = parent.hasPointerCapture(1);
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(
      pointer('pointercancel', { clientX: 100, clientY: 0 }),
    );

    expect(heldDuringCancel).toBe(false);

    controller.dispose();
  });

  it('leaves an earlier gesture-feedback trace untouched when a new gesture completes', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    const controller = createController({ items, parent });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));
    expect(parent.querySelectorAll('canvas')).toHaveLength(1);

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 0, clientY: 0 }));
    expect(parent.querySelectorAll('canvas')).toHaveLength(2);

    controller.dispose();
  });

  it('lets three overlapping gesture-feedback traces expire independently, on their own schedules', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({ items, parent });

    const gesture = (x: number) => {
      parent.dispatchEvent(pointer('pointerdown', { clientX: x, clientY: 0 }));
      parent.dispatchEvent(
        pointer('pointermove', { clientX: x + 100, clientY: 0 }),
      );
      parent.dispatchEvent(
        pointer('pointerup', { clientX: x + 120, clientY: 0 }),
      );
    };

    // Trace #1 shown at 0ms (expires at 1000ms).
    gesture(0);
    vi.advanceTimersByTime(400);
    // Trace #2 shown at 400ms (expires at 1400ms).
    gesture(200);
    vi.advanceTimersByTime(400);
    // Trace #3 shown at 800ms (expires at 1800ms).
    gesture(400);
    expect(parent.querySelectorAll('canvas')).toHaveLength(3);

    // 1000ms since trace #1 was shown: only that one has expired.
    vi.advanceTimersByTime(200);
    expect(parent.querySelectorAll('canvas')).toHaveLength(2);

    // 1400ms since trace #1: trace #2 has now expired too.
    vi.advanceTimersByTime(400);
    expect(parent.querySelectorAll('canvas')).toHaveLength(1);

    // 1800ms since trace #1: trace #3 has now expired too.
    vi.advanceTimersByTime(400);
    expect(parent.querySelectorAll('canvas')).toHaveLength(0);

    controller.dispose();
  });

  it('opens novice mode at the gesture origin after the pointer dwells without moving', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    let openEvent: MarkingMenuOpenEvent<AnyModelNode> | undefined;
    controller.on('open', (event) => {
      openEvent = event;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 50, clientY: 60 }));
    vi.advanceTimersByTime(100);

    expect(openEvent?.mode).toBe('novice');
    expect(openEvent?.menuCenter).toEqual([50, 60]);
    expect(openEvent?.position).toEqual([50, 60]);
    expect(parent.querySelector('.marking-menu')).not.toBeNull();

    controller.dispose();
  });

  it('renders the menu at its center in local coordinates, converting from client coordinates itself', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    parent.getBoundingClientRect = vi.fn(
      () => ({ left: 10, top: 20 }) as unknown as DOMRect,
    );
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 50, clientY: 60 }));
    vi.advanceTimersByTime(100);

    const menu = parent.querySelector<HTMLElement>('.marking-menu');
    expect(menu?.style.getPropertyValue('--center-x')).toBe('40px');
    expect(menu?.style.getPropertyValue('--center-y')).toBe('40px');

    controller.dispose();
  });

  it('does not open novice mode when movement crosses movementsThreshold before the dwell time elapses', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    const opened = voidMock<[MarkingMenuOpenEvent<AnyModelNode>]>();
    controller.on('open', opened);

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    vi.advanceTimersByTime(200);

    expect(opened).not.toHaveBeenCalled();
    expect(parent.querySelector('.marking-menu')).toBeNull();

    controller.dispose();
  });

  it('splits the stroke into an upper (current) and lower (accumulated) region once novice mode opens', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 1, clientY: 0 }));
    vi.advanceTimersByTime(100);
    vi.advanceTimersToNextFrame();

    // The upper stroke (fresh, starting at the menu center) and the lower
    // stroke (the accumulated startup stroke) are drawn on two separate
    // canvases.
    expect(parent.querySelectorAll('canvas')).toHaveLength(2);

    controller.dispose();
  });

  it('sets the cursor to none once novice mode opens', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(parent.style.cursor).toBe('crosshair');

    vi.advanceTimersByTime(100);
    expect(parent.style.cursor).toBe('none');

    controller.dispose();
  });

  it('cancels, carrying the open menu and no active item, when the pointer releases right after novice mode opens', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    const selected = voidMock<[MarkingMenuSelectEvent<AnyModelNode>]>();
    controller.on('select', selected);

    let cancelEvent: MarkingMenuCancelEvent<AnyModelNode> | undefined;
    controller.on('cancel', (event) => {
      cancelEvent = event;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    parent.dispatchEvent(pointer('pointerup', { clientX: 0, clientY: 0 }));

    expect(selected).not.toHaveBeenCalled();
    expect(cancelEvent?.mode).toBe('novice');
    expect(cancelEvent?.active).toBeNull();
    expect(cancelEvent?.menu).not.toBeNull();
    expect(parent.querySelector('.marking-menu')).toBeNull();

    controller.dispose();
  });

  it('dispatches select carrying the leaf and the open menu when releasing on a leaf active item (objective 7)', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
      minSelectionDist: 40,
    });

    const canceled = voidMock<[MarkingMenuCancelEvent<AnyModelNode>]>();
    controller.on('cancel', canceled);
    let openedMenu: unknown;
    controller.on('open', (event) => {
      openedMenu = event.menu;
    });
    let selectedId: string | undefined;
    let selectedMenu: unknown;
    controller.on('select', (event) => {
      selectedId = event.selection.id;
      selectedMenu = event.menu;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 0 }));

    expect(canceled).not.toHaveBeenCalled();
    expect(selectedId).toBe('right');
    // `select.menu` is the same root menu that opened this gesture, not
    // merely non-null.
    expect(openedMenu).not.toBeNull();
    expect(selectedMenu).toBe(openedMenu);
    expect(parent.querySelector('.marking-menu')).toBeNull();
    // A completed novice gesture shows feedback on the same terms as an
    // expert one: the stroke canvases are gone, and exactly one trace
    // remains.
    expect(parent.querySelectorAll('canvas')).toHaveLength(1);

    controller.dispose();
  });

  it('dispatches cancel, never select, when releasing on a non-leaf active item, carrying that item as active (objective 7)', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items: [
        {
          id: 'right',
          label: 'Right',
          items: [
            { id: 'rightUp', label: 'Right Up' },
            { id: 'rightDown', label: 'Right Down' },
          ],
        },
        { id: 'down', label: 'Down' },
        { id: 'left', label: 'Left' },
        { id: 'up', label: 'Up' },
      ],
      parent,
      noviceDwellingTime: 100,
      minSelectionDist: 40,
    });

    const selected = voidMock<[MarkingMenuSelectEvent<AnyModelNode>]>();
    controller.on('select', selected);
    let openedMenu: unknown;
    controller.on('open', (event) => {
      openedMenu = event.menu;
    });
    let canceledActiveId: string | undefined;
    let cancelMenu: unknown;
    controller.on('cancel', (event) => {
      canceledActiveId = event.active?.id;
      cancelMenu = event.menu;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 0 }));

    expect(selected).not.toHaveBeenCalled();
    expect(canceledActiveId).toBe('right');
    // `cancel.menu` is the same root menu that opened this gesture, not
    // merely non-null.
    expect(openedMenu).not.toBeNull();
    expect(cancelMenu).toBe(openedMenu);
    expect(parent.querySelectorAll('canvas')).toHaveLength(1);

    controller.dispose();
  });

  it('dispatches cancel, carrying the active item, when the native pointer is cancelled on a leaf active item (objective 8)', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
      minSelectionDist: 40,
    });

    const selected = voidMock<[MarkingMenuSelectEvent<AnyModelNode>]>();
    controller.on('select', selected);
    let canceledActiveId: string | undefined;
    controller.on('cancel', (event) => {
      canceledActiveId = event.active?.id;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(
      pointer('pointercancel', { clientX: 100, clientY: 0 }),
    );

    expect(selected).not.toHaveBeenCalled();
    expect(canceledActiveId).toBe('right');

    controller.dispose();
  });

  it('does not recreate the menu DOM or redraw the lower stroke when a render repeats with the same identity', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);

    const menuBefore = parent.querySelector('.marking-menu');
    expect(menuBefore).not.toBeNull();

    // Still within `minSelectionDist`, so the active item stays null and the
    // menu identity is unchanged: no DOM to patch, but a render pass still
    // runs.
    parent.dispatchEvent(pointer('pointermove', { clientX: 1, clientY: 0 }));

    expect(parent.querySelector('.marking-menu')).toBe(menuBefore);
    expect(parent.querySelectorAll('.marking-menu')).toHaveLength(1);

    controller.dispose();
  });

  it('activates no item while the pointer stays within minSelectionDist of the menu center', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
      minSelectionDist: 40,
    });

    const moved = voidMock<[MarkingMenuMoveEvent<AnyModelNode>]>();
    controller.on('move', moved);
    const changed = voidMock<[MarkingMenuChangeEvent<AnyModelNode>]>();
    controller.on('change', changed);

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    parent.dispatchEvent(pointer('pointermove', { clientX: 10, clientY: 0 }));

    expect(moved).toHaveBeenCalledTimes(1);
    expect(moved.mock.calls[0]?.[0].active).toBeNull();
    expect(changed).not.toHaveBeenCalled();
    expect(parent.querySelectorAll('.marking-menu-item.active')).toHaveLength(
      0,
    );

    controller.dispose();
  });

  it('activates the nearest item by angle once beyond minSelectionDist, patching the DOM without recreating the menu, and distinguishes continued pointing at the same item from moving to a new one', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
      minSelectionDist: 40,
    });

    const moved = vi.fn<() => void>();
    let lastMoveActiveId: string | undefined;
    controller.on('move', (event) => {
      moved();
      lastMoveActiveId = event.active?.id;
    });
    const changed = vi.fn<() => void>();
    let lastChangeActiveId: string | undefined;
    let lastChangePreviousActive: unknown;
    controller.on('change', (event) => {
      changed();
      lastChangeActiveId = event.active?.id;
      lastChangePreviousActive = event.previousActive;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    const menuBefore = parent.querySelector('.marking-menu');

    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));

    expect(moved).toHaveBeenCalledTimes(1);
    expect(lastMoveActiveId).toBe('right');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(lastChangeActiveId).toBe('right');
    expect(lastChangePreviousActive).toBeNull();

    // The menu DOM is patched in place, not recreated.
    expect(parent.querySelector('.marking-menu')).toBe(menuBefore);
    const activeItems = parent.querySelectorAll('.marking-menu-item.active');
    expect(activeItems).toHaveLength(1);
    // "right" is the first described item, so its library-assigned key is
    // "0" — `dataset.itemId` is keyed on that, not on the caller's own `id`.
    expect((activeItems[0] as HTMLElement).dataset.itemId).toBe('0');

    // Continued pointing at the same item: another `move`, no further `change`.
    parent.dispatchEvent(pointer('pointermove', { clientX: 110, clientY: 0 }));
    expect(moved).toHaveBeenCalledTimes(2);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(parent.querySelectorAll('.marking-menu-item.active')).toHaveLength(
      1,
    );

    controller.dispose();
  });

  it('dispatches change carrying the new and previous active item, in one batch with move, when the nearest item changes', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
      minSelectionDist: 40,
    });

    const seen: string[] = [];
    controller.on('move', () => {
      seen.push('move');
    });
    let lastChangeActiveId: string | undefined;
    let lastChangePreviousActive: unknown;
    controller.on('change', (event) => {
      seen.push('change');
      lastChangeActiveId = event.active?.id;
      lastChangePreviousActive = event.previousActive;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    // First activates "right".
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    const previousActive = lastChangePreviousActive;
    const firstActive = lastChangeActiveId;
    expect(seen).toEqual(['move', 'change']);
    expect(firstActive).toBe('right');
    expect(previousActive).toBeNull();

    // Moving to "down" produces a second, distinct change in the same batch
    // as its move.
    seen.length = 0;
    parent.dispatchEvent(pointer('pointermove', { clientX: 0, clientY: 100 }));

    expect(seen).toEqual(['move', 'change']);
    expect(lastChangeActiveId).toBe('down');
    expect(lastChangePreviousActive).not.toBeNull();

    controller.dispose();
  });

  it('never fires change, and always reports a null active, for move events dispatched in startup and expert', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = createParent();
    const controller = createController({ items, parent });

    const moved: Array<MarkingMenuMoveEvent<AnyModelNode>> = [];
    controller.on('move', (event) => {
      moved.push(event);
    });
    const changed = voidMock<[MarkingMenuChangeEvent<AnyModelNode>]>();
    controller.on('change', changed);

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 1, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));

    expect(moved).toHaveLength(2);
    expect(moved[0]?.mode).toBe('startup');
    expect(moved[0]?.active).toBeNull();
    expect(moved[0]?.menu).toBeNull();
    expect(moved[1]?.mode).toBe('expert');
    expect(moved[1]?.active).toBeNull();
    expect(moved[1]?.menu).toBeNull();
    expect(changed).not.toHaveBeenCalled();

    controller.dispose();
  });

  describe('dwelling into a submenu (objectives 9, 11)', () => {
    const submenuItems = [
      {
        id: 'right',
        label: 'Right',
        items: [
          { id: 'subRight', label: 'Sub Right' },
          { id: 'subDown', label: 'Sub Down' },
          { id: 'subLeft', label: 'Sub Left' },
          { id: 'subUp', label: 'Sub Up' },
        ],
      },
      { id: 'down', label: 'Down' },
      { id: 'left', label: 'Left' },
      { id: 'up', label: 'Up' },
    ] as const;

    it('dispatches open for the submenu and recreates the menu DOM for it, once the pointer dwells beyond minMenuSelectionDist on it', () => {
      using _canvases = stubbedCanvasContexts();
      using _timers = fakeTimers();
      const parent = createParent();
      const controller = createController({
        items: submenuItems,
        parent,
        noviceDwellingTime: 100,
        minSelectionDist: 40,
        minMenuSelectionDist: 80,
        submenuOpeningDelay: 100,
      });

      const openedMenus: unknown[] = [];
      controller.on('open', (event) => {
        openedMenus.push(event.menu);
      });

      parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
      vi.advanceTimersByTime(100);
      const rootMenuDom = parent.querySelector('.marking-menu');

      // Beyond minMenuSelectionDist (80) on "right", a submenu.
      parent.dispatchEvent(
        pointer('pointermove', { clientX: 100, clientY: 0 }),
      );
      vi.advanceTimersByTime(100);

      expect(openedMenus).toHaveLength(2);
      expect(openedMenus[1]).not.toBe(openedMenus[0]);
      // A different menu identity: the DOM is recreated, not patched.
      expect(parent.querySelector('.marking-menu')).not.toBe(rootMenuDom);
      expect(parent.querySelectorAll('.marking-menu')).toHaveLength(1);

      controller.dispose();
    });

    it('selects a leaf inside the submenu', () => {
      using _canvases = stubbedCanvasContexts();
      using _timers = fakeTimers();
      const parent = createParent();
      const controller = createController({
        items: submenuItems,
        parent,
        noviceDwellingTime: 100,
        minSelectionDist: 40,
        minMenuSelectionDist: 80,
        submenuOpeningDelay: 100,
      });

      let selectedId: string | undefined;
      controller.on('select', (event) => {
        selectedId = event.selection.id;
      });

      parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
      vi.advanceTimersByTime(100);
      parent.dispatchEvent(
        pointer('pointermove', { clientX: 100, clientY: 0 }),
      );
      vi.advanceTimersByTime(100); // Opens the submenu, centered at [100, 0]

      // Relative to the submenu's own centre, the same geometry that
      // activates "right" from the root activates "subRight" here.
      parent.dispatchEvent(
        pointer('pointermove', { clientX: 200, clientY: 0 }),
      );
      parent.dispatchEvent(pointer('pointerup', { clientX: 200, clientY: 0 }));

      expect(selectedId).toBe('subRight');

      controller.dispose();
    });

    it('cancels a gesture that ends inside the submenu without a leaf active', () => {
      using _canvases = stubbedCanvasContexts();
      using _timers = fakeTimers();
      const parent = createParent();
      const controller = createController({
        items: submenuItems,
        parent,
        noviceDwellingTime: 100,
        minSelectionDist: 40,
        minMenuSelectionDist: 80,
        submenuOpeningDelay: 100,
      });

      const selected = voidMock<[MarkingMenuSelectEvent<AnyModelNode>]>();
      controller.on('select', selected);
      let cancelEvent: MarkingMenuCancelEvent<AnyModelNode> | undefined;
      controller.on('cancel', (event) => {
        cancelEvent = event;
      });
      let openedMenu: unknown;
      controller.on('open', (event) => {
        openedMenu = event.menu;
      });

      parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
      vi.advanceTimersByTime(100);
      parent.dispatchEvent(
        pointer('pointermove', { clientX: 100, clientY: 0 }),
      );
      vi.advanceTimersByTime(100); // Opens the submenu, centered at [100, 0]
      const submenu = openedMenu;

      // Released back at the submenu's own centre: within minSelectionDist,
      // so nothing is active there.
      parent.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 0 }));

      expect(selected).not.toHaveBeenCalled();
      expect(cancelEvent?.mode).toBe('novice');
      expect(cancelEvent?.active).toBeNull();
      expect(cancelEvent?.menu).toBe(submenu);

      controller.dispose();
    });
  });

  it('removes the menu DOM on dispose while novice mode is open', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    expect(parent.querySelector('.marking-menu')).not.toBeNull();

    controller.dispose();

    expect(parent.querySelector('.marking-menu')).toBeNull();
  });
});

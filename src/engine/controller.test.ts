import { type Mock } from 'vitest';
import { fakeTimers } from '../__fixtures__/timers.js';
import type {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuMoveEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
} from '../events.js';
import { createParent, pointer } from './__fixtures__/pointer.js';
import { createController, resolveEngineOptions } from './controller.js';

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

// Listed starting from "up": default angles start at the top, so this order
// alone keeps a rightward move activating `right`.
const items = [
  { id: 'up', label: 'Up' },
  { id: 'right', label: 'Right' },
  { id: 'down', label: 'Down' },
  { id: 'left', label: 'Left' },
] as const;

// `vi.fn()` alone infers a value-returning signature, which an event
// listener's `void` return type rejects.
const voidMock = <Arguments extends readonly unknown[]>() =>
  vi.fn<(...args: Arguments) => void>();

const activeMenuItems = (parent: HTMLElement): HTMLElement[] => [
  ...(parent
    .querySelector<HTMLElement>('.marking-menu')
    ?.shadowRoot?.querySelectorAll<HTMLElement>('.marking-menu-item.active') ??
    []),
];

// Excludes the opening indicator's own SVGs (background and dot): they draw
// the dwell-anticipation target, not a stroke.
const strokeSurfaces = (parent: HTMLElement): SVGSVGElement[] => [
  ...(parent
    .querySelector('.marking-menu')
    ?.shadowRoot?.querySelectorAll<SVGSVGElement>(
      'svg.marking-menu-stroke-surface',
    ) ?? []),
];

describe('resolveEngineOptions', () => {
  const parent = document.createElement('div');

  it('defaults every option the config omits', () => {
    const resolved = resolveEngineOptions({ items, parent });

    expect(resolved).toMatchObject({
      movementsThreshold: 5,
      noviceDwellingTime: 1000 / 3,
      deadZoneRadius: 40,
      submenuOpeningDelay: 1000 / 3,
      gestureFeedbackDuration: 1000,
    });
    expect(resolved.log.error).toBeTypeOf('function');
  });

  it('keeps every option the config provides explicitly', () => {
    const error = voidMock<[Error]>();
    const resolved = resolveEngineOptions({
      items,
      parent,
      movementsThreshold: 1,
      noviceDwellingTime: 2,
      deadZoneRadius: 3,
      submenuOpeningDelay: 4,
      gestureFeedbackDuration: 5,
      log: { error },
    });

    expect(resolved).toMatchObject({
      movementsThreshold: 1,
      noviceDwellingTime: 2,
      deadZoneRadius: 3,
      submenuOpeningDelay: 4,
      gestureFeedbackDuration: 5,
    });
    expect(resolved.log.error).toBe(error);
  });
});

describe('createController', () => {
  it('dispatches select carrying the leaf a straight drag recognizes', () => {
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

  it('hides the cursor on gesture start, behind the opening indicator', () => {
    const parent = createParent();
    const controller = createController({ items, parent });

    expect(parent.style.cursor).toBe('');
    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(parent.style.cursor).toBe('none');

    controller.dispose();
  });

  it("restores the parent's own inline cursor rather than clearing it", () => {
    const parent = createParent();
    parent.style.cursor = 'pointer';
    const controller = createController({ items, parent });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(parent.style.cursor).toBe('none');

    // Back to idle: the parent's cursor is the parent's again, not blank.
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));
    expect(parent.style.cursor).toBe('pointer');

    controller.dispose();
    expect(parent.style.cursor).toBe('pointer');
  });

  it('draws the stroke through the RAF throttle, converging to the latest state when frames coalesce', () => {
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({ items, parent });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 10, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 50, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));

    const root = parent.querySelector('.marking-menu')?.shadowRoot;
    expect(root?.querySelector('path')).toBeNull();

    vi.advanceTimersToNextFrame();

    expect(root?.querySelector('path')?.getAttribute('d')).toBe(
      'M 0 0 L 10 0 L 50 0 L 100 0',
    );

    controller.dispose();
  });

  it('shows one gesture-feedback trace on completion', () => {
    const parent = createParent();
    const controller = createController({ items, parent });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));

    expect(strokeSurfaces(parent)).toHaveLength(1);

    controller.dispose();
  });

  it('dispose() removes listeners, DOM, and the touch-action claim, and is idempotent', () => {
    const parent = createParent();
    const controller = createController({ items, parent });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));

    expect(strokeSurfaces(parent)).toHaveLength(1);
    expect(parent.style.getPropertyValue('touch-action')).toBe('none');

    const selected = voidMock<[MarkingMenuSelectEvent]>();
    controller.on('select', selected);
    // Disposal mid-gesture is silent: no final `cancel`, or any other public
    // event, is ever dispatched for it.
    const cancelled = voidMock<[MarkingMenuCancelEvent]>();
    controller.on('cancel', cancelled);

    controller.dispose();

    expect(strokeSurfaces(parent)).toHaveLength(0);
    expect(parent.style.getPropertyValue('touch-action')).toBe('');
    expect(parent.style.cursor).toBe('');
    expect(cancelled).not.toHaveBeenCalled();

    // Disposal happened mid-gesture, so the capture the gesture took is the
    // controller's to give back: nothing else will ever release it.
    expect(
      pointerCaptureMocks(parent).releasePointerCapture,
    ).toHaveBeenCalledExactlyOnceWith(1);
    expect(parent.hasPointerCapture(1)).toBe(false);

    // Further pointer input is inert: the DOM listeners are gone.
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));
    expect(selected).not.toHaveBeenCalled();
    expect(cancelled).not.toHaveBeenCalled();

    expect(() => {
      controller.dispose();
    }).not.toThrow();
  });

  it('is also disposable through [Symbol.dispose](), same as dispose()', () => {
    const parent = createParent();
    const controller = createController({ items, parent });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(parent.style.getPropertyValue('touch-action')).toBe('none');

    controller[Symbol.dispose]();

    expect(parent.style.getPropertyValue('touch-action')).toBe('');
    expect(strokeSurfaces(parent)).toHaveLength(0);

    // Idempotent, and interchangeable with dispose(): whichever runs first
    // wins, the other is a no-op.
    expect(() => {
      controller.dispose();
      controller[Symbol.dispose]();
    }).not.toThrow();
  });

  it('disposes via `using`, releasing everything at the end of the block', () => {
    const parent = createParent();

    {
      using _controller = createController({ items, parent });
      parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
      expect(parent.style.getPropertyValue('touch-action')).toBe('none');
    }

    expect(parent.style.getPropertyValue('touch-action')).toBe('');
  });

  it('keeps touch-action while another controller on the parent still holds a claim', () => {
    const parent = createParent();
    const first = createController({ items, parent });
    const second = createController({ items, parent });

    expect(parent.style.getPropertyValue('touch-action')).toBe('none');

    first.dispose();
    expect(parent.style.getPropertyValue('touch-action')).toBe('none');

    second.dispose();
    expect(parent.style.getPropertyValue('touch-action')).toBe('');
  });

  it('isolates a throwing consumer listener: the gesture proceeds and other listeners still run', () => {
    const parent = createParent();
    const controller = createController({ items, parent });

    controller.on('start', () => {
      throw new Error('boom');
    });
    const alsoNotified = voidMock<[MarkingMenuStartEvent]>();
    controller.on('start', alsoNotified);

    expect(() => {
      parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    }).not.toThrow();
    expect(alsoNotified).toHaveBeenCalledTimes(1);

    let selectedId: string | undefined;
    controller.on('select', (event) => {
      selectedId = event.selection.id;
    });
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));

    expect(selectedId).toBe('right');

    controller.dispose();
  });

  it('freezes position on start and select, and dispatches select after the DOM is fully rendered', () => {
    const parent = createParent();
    const controller = createController({ items, parent });

    let startPosition: readonly number[] | undefined;
    controller.on('start', (event) => {
      startPosition = event.position;
    });

    let observedDuringSelect: { traces: number; cursor: string } | undefined;
    controller.on('select', (event) => {
      expect(Object.isFrozen(event.position)).toBe(true);
      observedDuringSelect = {
        traces: strokeSurfaces(parent).length,
        cursor: parent.style.cursor,
      };
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(Object.isFrozen(startPosition)).toBe(true);

    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));

    expect(observedDuringSelect).toEqual({ traces: 1, cursor: '' });

    controller.dispose();
  });

  it('only accepts the primary pointer and primary button, and owns pointer capture', () => {
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

  it('dispatches cancel carrying an undefined activeItem, not select, for a gesture with no movement at all', () => {
    const parent = createParent();
    const controller = createController({ items, parent });

    const selected = voidMock<[MarkingMenuSelectEvent]>();
    controller.on('select', selected);

    let cancelEvent: MarkingMenuCancelEvent | undefined;
    controller.on('cancel', (event) => {
      cancelEvent = event;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 0, clientY: 0 }));

    expect(selected).not.toHaveBeenCalled();
    expect(cancelEvent?.mode).toBe('startup');
    expect(cancelEvent?.activeItem).toBeUndefined();

    controller.dispose();
  });

  it('dispatches cancel, never select, when the native pointer is cancelled mid-gesture, even along a straight line that would otherwise recognize', () => {
    const parent = createParent();
    const controller = createController({ items, parent });

    const selected = voidMock<[MarkingMenuSelectEvent]>();
    controller.on('select', selected);

    let cancelEvent: MarkingMenuCancelEvent | undefined;
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
    expect(cancelEvent?.activeItem).toBeUndefined();

    controller.dispose();
  });

  it('has already released pointer capture by the time cancel is dispatched', () => {
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
    const parent = createParent();
    const controller = createController({ items, parent });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));
    expect(strokeSurfaces(parent)).toHaveLength(1);

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 0, clientY: 0 }));
    expect(strokeSurfaces(parent)).toHaveLength(2);

    controller.dispose();
  });

  it('lets three overlapping gesture-feedback traces expire independently, on their own schedules', () => {
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
    expect(strokeSurfaces(parent)).toHaveLength(3);

    // 1000ms since trace #1 was shown: only that one has expired.
    vi.advanceTimersByTime(200);
    expect(strokeSurfaces(parent)).toHaveLength(2);

    // 1400ms since trace #1: trace #2 has now expired too.
    vi.advanceTimersByTime(400);
    expect(strokeSurfaces(parent)).toHaveLength(1);

    // 1800ms since trace #1: trace #3 has now expired too.
    vi.advanceTimersByTime(400);
    expect(strokeSurfaces(parent)).toHaveLength(0);

    controller.dispose();
  });

  it('reports the mode of the gesture through state, with a menu once one is displayed', () => {
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });
    expect(controller.state).toEqual({ mode: 'idle' });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(controller.state).toEqual({ mode: 'startup' });

    parent.dispatchEvent(pointer('pointermove', { clientX: 50, clientY: 0 }));
    expect(controller.state).toEqual({ mode: 'expert' });

    parent.dispatchEvent(pointer('pointerup', { clientX: 50, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    expect(controller.state).toMatchObject({
      mode: 'novice',
      menu: { isRoot: true },
      activeItem: undefined,
    });

    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    expect(controller.state).toMatchObject({
      mode: 'novice',
      activeItem: { id: 'right' },
    });

    controller.dispose();
  });

  it('is already idle inside a select listener', () => {
    const parent = createParent();
    const controller = createController({ items, parent });
    let modeInListener: string | undefined;
    controller.on('select', () => {
      modeInListener = controller.state.mode;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 0 }));

    expect(modeInListener).toBe('idle');

    controller.dispose();
  });

  it('opens novice mode at the gesture origin after the pointer dwells without moving', () => {
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    let openEvent: MarkingMenuOpenEvent | undefined;
    controller.on('open', (event) => {
      openEvent = event;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 50, clientY: 60 }));
    vi.advanceTimersByTime(100);

    expect(openEvent?.mode).toBe('novice');
    expect(openEvent?.menuCenter).toEqual([50, 60]);
    expect(openEvent?.position).toEqual([50, 60]);
    expect(controller.state.mode).toBe('novice');

    controller.dispose();
  });

  it('renders the menu at its center in local coordinates, converting from client coordinates itself', () => {
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

    const menu = parent
      .querySelector('.marking-menu')
      ?.shadowRoot?.querySelector<HTMLElement>('.marking-menu-layer');
    expect(menu?.style.getPropertyValue('--center-x')).toBe('40px');
    expect(menu?.style.getPropertyValue('--center-y')).toBe('40px');

    controller.dispose();
  });

  it('does not open novice mode when movement crosses movementsThreshold before the dwell time elapses', () => {
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    const opened = voidMock<[MarkingMenuOpenEvent]>();
    controller.on('open', opened);

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    vi.advanceTimersByTime(200);

    expect(opened).not.toHaveBeenCalled();
    expect(
      parent
        .querySelector('.marking-menu')
        ?.shadowRoot?.querySelector('.marking-menu-layer'),
    ).toBeNull();

    controller.dispose();
  });

  it('splits the stroke into an upper (current) and lower (accumulated) region once novice mode opens', () => {
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

    expect(strokeSurfaces(parent)).toHaveLength(2);

    controller.dispose();
  });

  it('keeps the cursor hidden across the dwell into novice mode, with no flicker back to a visible cursor', () => {
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(parent.style.cursor).toBe('none');

    vi.advanceTimersByTime(100);
    expect(parent.style.cursor).toBe('none');

    controller.dispose();
  });

  it('cancels, carrying the open menu and no active item, when the pointer releases right after novice mode opens', () => {
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    const selected = voidMock<[MarkingMenuSelectEvent]>();
    controller.on('select', selected);

    let cancelEvent: MarkingMenuCancelEvent | undefined;
    controller.on('cancel', (event) => {
      cancelEvent = event;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    parent.dispatchEvent(pointer('pointerup', { clientX: 0, clientY: 0 }));

    expect(selected).not.toHaveBeenCalled();
    expect(cancelEvent?.mode).toBe('novice');
    expect(cancelEvent?.activeItem).toBeUndefined();
    expect(cancelEvent?.menu).not.toBeUndefined();
    expect(
      parent
        .querySelector('.marking-menu')
        ?.shadowRoot?.querySelector('.marking-menu-layer'),
    ).toBeNull();

    controller.dispose();
  });

  it('dispatches select carrying the leaf and the open menu when releasing on a leaf active item (objective 7)', () => {
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
      deadZoneRadius: 40,
    });

    const canceled = voidMock<[MarkingMenuCancelEvent]>();
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
    // merely defined.
    expect(openedMenu).not.toBeUndefined();
    expect(selectedMenu).toBe(openedMenu);
    const root = parent.querySelector('.marking-menu')?.shadowRoot;
    expect(root?.querySelector('.marking-menu-layer')).toBeNull();
    expect(strokeSurfaces(parent)).toHaveLength(1);

    controller.dispose();
  });

  it('dispatches cancel, never select, when releasing on a non-leaf active item, carrying that item as active (objective 7)', () => {
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      // Listed starting from "up": see the top-level `items` comment above.
      items: [
        { id: 'up', label: 'Up' },
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
      ],
      parent,
      noviceDwellingTime: 100,
      deadZoneRadius: 40,
    });

    const selected = voidMock<[MarkingMenuSelectEvent]>();
    controller.on('select', selected);
    let openedMenu: unknown;
    controller.on('open', (event) => {
      openedMenu = event.menu;
    });
    let canceledActiveId: string | undefined;
    let cancelMenu: unknown;
    controller.on('cancel', (event) => {
      canceledActiveId = event.activeItem?.id;
      cancelMenu = event.menu;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    parent.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 0 }));

    expect(selected).not.toHaveBeenCalled();
    expect(canceledActiveId).toBe('right');
    // `cancel.menu` is the same root menu that opened this gesture, not
    // merely defined.
    expect(openedMenu).not.toBeUndefined();
    expect(cancelMenu).toBe(openedMenu);
    expect(strokeSurfaces(parent)).toHaveLength(1);

    controller.dispose();
  });

  it('dispatches cancel, carrying the active item, when the native pointer is cancelled on a leaf active item (objective 8)', () => {
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
      deadZoneRadius: 40,
    });

    const selected = voidMock<[MarkingMenuSelectEvent]>();
    controller.on('select', selected);
    let canceledActiveId: string | undefined;
    controller.on('cancel', (event) => {
      canceledActiveId = event.activeItem?.id;
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

    // Still within `deadZoneRadius`, so the active item stays undefined and
    // the
    // menu identity is unchanged: no DOM to patch, but a render pass still
    // runs.
    parent.dispatchEvent(pointer('pointermove', { clientX: 1, clientY: 0 }));

    expect(parent.querySelector('.marking-menu')).toBe(menuBefore);
    expect(parent.querySelectorAll('.marking-menu')).toHaveLength(1);

    controller.dispose();
  });

  it('activates no item while the pointer stays within the dead zone', () => {
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
      deadZoneRadius: 40,
    });

    const moved = voidMock<[MarkingMenuMoveEvent]>();
    controller.on('move', moved);
    const changed = voidMock<[MarkingMenuChangeEvent]>();
    controller.on('change', changed);

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    parent.dispatchEvent(pointer('pointermove', { clientX: 10, clientY: 0 }));

    expect(moved).toHaveBeenCalledTimes(1);
    expect(moved.mock.calls[0]?.[0].activeItem).toBeUndefined();
    expect(changed).not.toHaveBeenCalled();
    expect(activeMenuItems(parent)).toHaveLength(0);

    controller.dispose();
  });

  it('activates the nearest item by angle once past the dead zone, patching the DOM without recreating the menu, and distinguishes continued pointing at the same item from moving to a new one', () => {
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
      deadZoneRadius: 40,
    });

    const moved = vi.fn<() => void>();
    let lastMoveActiveId: string | undefined;
    controller.on('move', (event) => {
      moved();
      lastMoveActiveId = event.activeItem?.id;
    });
    const changed = vi.fn<() => void>();
    let lastChangeActiveId: string | undefined;
    let lastChangePreviousActive: unknown;
    controller.on('change', (event) => {
      changed();
      lastChangeActiveId = event.activeItem?.id;
      lastChangePreviousActive = event.previousActiveItem;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    const menuBefore = parent.querySelector('.marking-menu');

    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));

    expect(moved).toHaveBeenCalledTimes(1);
    expect(lastMoveActiveId).toBe('right');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(lastChangeActiveId).toBe('right');
    expect(lastChangePreviousActive).toBeUndefined();

    // The menu DOM is patched in place, not recreated.
    expect(parent.querySelector('.marking-menu')).toBe(menuBefore);
    const activeItems = activeMenuItems(parent);
    expect(activeItems).toHaveLength(1);
    // `dataset.itemId` is keyed on the item's index ("1" for "right", the
    // second described item), not on the caller's own `id`.
    expect((activeItems[0] as HTMLElement).dataset.itemId).toBe('1');

    // Continued pointing at the same item: another `move`, no further `change`.
    parent.dispatchEvent(pointer('pointermove', { clientX: 110, clientY: 0 }));
    expect(moved).toHaveBeenCalledTimes(2);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(activeMenuItems(parent)).toHaveLength(1);

    controller.dispose();
  });

  it('dispatches change carrying the new and previous active item, in one batch with move, when the nearest item changes', () => {
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
      deadZoneRadius: 40,
    });

    const seen: string[] = [];
    controller.on('move', () => {
      seen.push('move');
    });
    let lastChangeActiveId: string | undefined;
    let lastChangePreviousActive: unknown;
    controller.on('change', (event) => {
      seen.push('change');
      lastChangeActiveId = event.activeItem?.id;
      lastChangePreviousActive = event.previousActiveItem;
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    // First activates "right".
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
    const previousActive = lastChangePreviousActive;
    const firstActive = lastChangeActiveId;
    expect(seen).toEqual(['move', 'change']);
    expect(firstActive).toBe('right');
    expect(previousActive).toBeUndefined();

    // Moving to "down" produces a second, distinct change in the same batch
    // as its move.
    seen.length = 0;
    parent.dispatchEvent(pointer('pointermove', { clientX: 0, clientY: 100 }));

    expect(seen).toEqual(['move', 'change']);
    expect(lastChangeActiveId).toBe('down');
    expect(lastChangePreviousActive).not.toBeUndefined();

    controller.dispose();
  });

  it('never fires change, and always reports an undefined activeItem, for move events dispatched in startup and expert', () => {
    const parent = createParent();
    const controller = createController({ items, parent });

    const moved: MarkingMenuMoveEvent[] = [];
    controller.on('move', (event) => {
      moved.push(event);
    });
    const changed = voidMock<[MarkingMenuChangeEvent]>();
    controller.on('change', changed);

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 1, clientY: 0 }));
    parent.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));

    expect(moved).toHaveLength(2);
    expect(moved[0]?.mode).toBe('startup');
    expect(moved[0]?.activeItem).toBeUndefined();
    expect(moved[0]?.menu).toBeUndefined();
    expect(moved[1]?.mode).toBe('expert');
    expect(moved[1]?.activeItem).toBeUndefined();
    expect(moved[1]?.menu).toBeUndefined();
    expect(changed).not.toHaveBeenCalled();

    controller.dispose();
  });

  describe('dwelling into a submenu (objectives 9, 11)', () => {
    // Listed starting from "up"/"subUp": see the top-level `items` comment
    // above.
    const submenuItems = [
      { id: 'up', label: 'Up' },
      {
        id: 'right',
        label: 'Right',
        items: [
          { id: 'subUp', label: 'Sub Up' },
          { id: 'subRight', label: 'Sub Right' },
          { id: 'subDown', label: 'Sub Down' },
          { id: 'subLeft', label: 'Sub Left' },
        ],
      },
      { id: 'down', label: 'Down' },
      { id: 'left', label: 'Left' },
    ] as const;

    it('dispatches open for the submenu and recreates the menu DOM for it, once the pointer dwells past the dead zone on it', () => {
      using _timers = fakeTimers();
      const parent = createParent();
      const controller = createController({
        items: submenuItems,
        parent,
        noviceDwellingTime: 100,
        deadZoneRadius: 40,
        submenuOpeningDelay: 100,
      });

      const openedMenus: unknown[] = [];
      controller.on('open', (event) => {
        openedMenus.push(event.menu);
      });

      parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
      vi.advanceTimersByTime(100);
      const rootMenuDom = parent
        .querySelector('.marking-menu')
        ?.shadowRoot?.querySelector('.marking-menu-layer');

      // Past the dead zone on "right", a submenu.
      parent.dispatchEvent(
        pointer('pointermove', { clientX: 100, clientY: 0 }),
      );
      vi.advanceTimersByTime(100);

      expect(openedMenus).toHaveLength(2);
      expect(openedMenus[1]).not.toBe(openedMenus[0]);
      expect(
        parent
          .querySelector('.marking-menu')
          ?.shadowRoot?.querySelector('.marking-menu-layer'),
      ).not.toBe(rootMenuDom);
      expect(parent.querySelectorAll('.marking-menu')).toHaveLength(1);

      controller.dispose();
    });

    it('selects a leaf inside the submenu', () => {
      using _timers = fakeTimers();
      const parent = createParent();
      const controller = createController({
        items: submenuItems,
        parent,
        noviceDwellingTime: 100,
        deadZoneRadius: 40,
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
      using _timers = fakeTimers();
      const parent = createParent();
      const controller = createController({
        items: submenuItems,
        parent,
        noviceDwellingTime: 100,
        deadZoneRadius: 40,
        submenuOpeningDelay: 100,
      });

      const selected = voidMock<[MarkingMenuSelectEvent]>();
      controller.on('select', selected);
      let cancelEvent: MarkingMenuCancelEvent | undefined;
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

      // Released back at the submenu's own centre: within the dead zone,
      // so nothing is active there.
      parent.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 0 }));

      expect(selected).not.toHaveBeenCalled();
      expect(cancelEvent?.mode).toBe('novice');
      expect(cancelEvent?.activeItem).toBeUndefined();
      expect(cancelEvent?.menu).toBe(submenu);

      controller.dispose();
    });
  });

  describe('mid-expert dwell falling back to novice, or canceling', () => {
    // Listed starting from "up"/"subUp": see the top-level `items` comment
    // above.
    const submenuItems = [
      { id: 'up', label: 'Up' },
      {
        id: 'right',
        label: 'Right',
        items: [
          { id: 'subUp', label: 'Sub Up' },
          { id: 'subRight', label: 'Sub Right' },
          { id: 'subDown', label: 'Sub Down' },
          { id: 'subLeft', label: 'Sub Left' },
        ],
      },
      { id: 'down', label: 'Down' },
      { id: 'left', label: 'Left' },
    ] as const;

    it('switches to novice, rooted at the menu the dwell recognizes', () => {
      using _timers = fakeTimers();
      const parent = createParent();
      const controller = createController({
        items: submenuItems,
        parent,
        noviceDwellingTime: 100,
      });

      const opened: MarkingMenuOpenEvent[] = [];
      controller.on('open', (event) => {
        opened.push(event);
      });

      parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
      // Crosses movementsThreshold straight onto "right": expert mode.
      parent.dispatchEvent(
        pointer('pointermove', { clientX: 100, clientY: 0 }),
      );
      vi.advanceTimersByTime(100); // The mid-expert dwell fires.

      expect(opened).toHaveLength(1);
      expect(opened[0]?.mode).toBe('novice');
      expect(opened[0]?.menuCenter).toEqual([100, 0]);
      expect(controller.state.mode).toBe('novice');

      // Selection now works at this depth, exactly as if novice had opened
      // the submenu by dwelling on it directly.
      let selectedId: string | undefined;
      controller.on('select', (event) => {
        selectedId = event.selection.id;
      });
      parent.dispatchEvent(
        pointer('pointermove', { clientX: 200, clientY: 0 }),
      );
      parent.dispatchEvent(pointer('pointerup', { clientX: 200, clientY: 0 }));
      expect(selectedId).toBe('subRight');

      controller.dispose();
    });

    it('cancels the expert attempt when the dwell recognizes only the root', () => {
      using _timers = fakeTimers();
      const parent = createParent();
      const controller = createController({
        items, // The plain, leaf-only fixture: every dwell recognizes the root.
        parent,
        noviceDwellingTime: 100,
      });

      const selected = voidMock<[MarkingMenuSelectEvent]>();
      controller.on('select', selected);
      const opened = voidMock<[MarkingMenuOpenEvent]>();
      controller.on('open', opened);
      let cancelEvent: MarkingMenuCancelEvent | undefined;
      controller.on('cancel', (event) => {
        cancelEvent = event;
      });

      parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
      parent.dispatchEvent(
        pointer('pointermove', { clientX: 100, clientY: 0 }),
      );
      vi.advanceTimersByTime(100); // The mid-expert dwell fires.

      expect(opened).not.toHaveBeenCalled();
      expect(selected).not.toHaveBeenCalled();
      expect(cancelEvent?.mode).toBe('expert');
      expect(cancelEvent?.activeItem).toBeUndefined();
      expect(cancelEvent?.menu).toBeUndefined();
      expect(
        parent
          .querySelector('.marking-menu')
          ?.shadowRoot?.querySelector('.marking-menu-layer'),
      ).toBeNull();

      controller.dispose();
    });
  });

  it('removes the menu DOM on dispose while novice mode is open', () => {
    using _timers = fakeTimers();
    const parent = createParent();
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    parent.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(100);
    expect(controller.state.mode).toBe('novice');

    controller.dispose();

    expect(parent.querySelector('.marking-menu')).toBeNull();
  });

  describe('moving focus during a gesture', () => {
    // Focus only ever lands on a connected element, so these attach `parent`
    // to `document.body` (unlike the rest of this file, which never needs
    // real focus) and detach it again once done.
    it("focuses each controller's own menu, not another controller's sharing the same parent", () => {
      using _timers = fakeTimers();
      const parent = createParent();
      document.body.append(parent);
      const first = createController({
        items,
        parent,
        noviceDwellingTime: 100,
      });
      const second = createController({
        items,
        parent,
        noviceDwellingTime: 100,
      });

      try {
        // One shared `pointerdown` starts a gesture on both controllers at
        // once: each owns an independent pointer source over the same
        // parent.
        parent.dispatchEvent(
          pointer('pointerdown', { clientX: 0, clientY: 0 }),
        );
        vi.advanceTimersByTime(100);

        const [firstRoot, secondRoot] = [
          ...parent.querySelectorAll('.marking-menu'),
        ].map((host) => host.shadowRoot);
        const secondMenu = secondRoot?.querySelector('[role="menu"]');
        expect(secondMenu).not.toBeNull();
        expect(secondRoot?.activeElement).toBe(secondMenu);
        expect(firstRoot?.activeElement).toBeNull();
      } finally {
        first.dispose();
        second.dispose();
        parent.remove();
      }
    });

    describe('announcing an item whose submenu is about to open', () => {
      // Two points either side of the up/right boundary, closer than
      // `movementsThreshold`: moving from one to the other changes the active
      // item without a significant move.
      const beforeBoundary = { clientX: 33, clientY: -36 };
      const afterBoundary = { clientX: 36, clientY: -34 };

      const setup = (submenuOpeningDelay: number) => {
        const parent = createParent();
        document.body.append(parent);
        const controller = createController({
          items: [
            { id: 'up', label: 'Up' },
            {
              id: 'right',
              label: 'Right',
              items: [{ id: 'sub', label: 'Sub' }],
            },
            { id: 'down', label: 'Down' },
            { id: 'left', label: 'Left' },
          ],
          parent,
          noviceDwellingTime: 100,
          submenuOpeningDelay,
        });
        const opened = vi.fn<() => void>();
        controller.on('open', () => {
          opened();
        });
        parent.dispatchEvent(
          pointer('pointerdown', { clientX: 0, clientY: 0 }),
        );
        vi.advanceTimersByTime(100);
        opened.mockClear();
        return {
          parent,
          opened,
          focusedLabel: () =>
            parent
              .querySelector('.marking-menu')
              ?.shadowRoot?.activeElement?.querySelector('.marking-menu-label')
              ?.textContent,
          [Symbol.dispose]() {
            controller.dispose();
            parent.remove();
          },
        };
      };

      it('announces an item that became active through a small move', () => {
        using _timers = fakeTimers();
        using menu = setup(300);
        const { parent, opened, focusedLabel } = menu;

        parent.dispatchEvent(pointer('pointermove', beforeBoundary));
        vi.advanceTimersByTime(270);
        parent.dispatchEvent(pointer('pointermove', afterBoundary));

        // The dwell restarted with the item, so its announcement comes
        // before its submenu.
        vi.advanceTimersByTime(60);
        expect(focusedLabel()).toBe('Right');
        expect(opened).not.toHaveBeenCalled();

        vi.advanceTimersByTime(300);
        expect(opened).toHaveBeenCalledTimes(1);
      });

      it('announces the item even when the submenu opens without delay', () => {
        using _timers = fakeTimers();
        using menu = setup(0);
        const { parent, opened, focusedLabel } = menu;

        parent.dispatchEvent(pointer('pointermove', afterBoundary));
        vi.advanceTimersByTime(0);

        expect(focusedLabel()).toBe('Right');
        expect(opened).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1000);
        expect(opened).toHaveBeenCalledTimes(1);
      });
    });

    it('restores focus that was moved when the controller is disposed mid-gesture', () => {
      using _timers = fakeTimers();
      const parent = createParent();
      document.body.append(parent);
      const before = document.createElement('button');
      document.body.append(before);
      before.focus();

      const controller = createController({
        items,
        parent,
        noviceDwellingTime: 100,
      });

      try {
        parent.dispatchEvent(
          pointer('pointerdown', { clientX: 0, clientY: 0 }),
        );
        vi.advanceTimersByTime(100);
        expect(document.activeElement).not.toBe(before);
        controller.dispose();
        expect(document.activeElement).toBe(before);
      } finally {
        controller.dispose();
        parent.remove();
        before.remove();
      }
    });
  });
});

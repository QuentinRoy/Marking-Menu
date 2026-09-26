import {
  openMenu,
  press,
  pressMouse,
  waitForMenuOpen,
  type Point,
} from '../../__tests__/__fixtures__/browser-menu.js';
import { catchReportedErrors } from '../../__tests__/__fixtures__/reported-errors.js';
import { fakeTimers } from '../../__tests__/__fixtures__/timers.js';
import type {
  MarkingMenuCancelEvent,
  MarkingMenuMoveEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
} from '../../events.js';
import { createController, resolveEngineOptions } from '../controller.js';
import { createParent } from './__fixtures__/parent.js';

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

const menuLayer = (parent: HTMLElement): HTMLElement | undefined =>
  parent
    .querySelector('.marking-menu')
    ?.shadowRoot?.querySelector<HTMLElement>('.marking-menu-layer') ??
  undefined;

const createFrameParent = () => {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '800px',
    height: '600px',
    border: '0',
  });
  document.body.append(iframe);

  const frameDocument = iframe.contentDocument;
  if (!frameDocument) {
    iframe.remove();
    throw new Error('The iframe did not create a document.');
  }

  const themeProperty = '--mm-stroke-color';
  const rootStyle = document.documentElement.style;
  const previousTheme = rootStyle.getPropertyValue(themeProperty);
  const previousPriority = rootStyle.getPropertyPriority(themeProperty);
  rootStyle.setProperty(themeProperty, 'rgb(255, 0, 0)');
  frameDocument.documentElement.style.setProperty(
    themeProperty,
    'rgb(0, 0, 255)',
  );

  const parent = frameDocument.createElement('div');
  Object.assign(parent.style, {
    position: 'fixed',
    left: '150px',
    top: '250px',
    width: '500px',
    height: '300px',
  });
  frameDocument.body.append(parent);

  return {
    parent,
    at: (x: number, y: number): Point => ({ x: 150 + x, y: 250 + y }),
    [Symbol.dispose]() {
      iframe.remove();
      if (previousTheme === '') {
        rootStyle.removeProperty(themeProperty);
      } else {
        rootStyle.setProperty(themeProperty, previousTheme, previousPriority);
      }
    },
  };
};

// Excludes the opening indicator's own SVGs (background and dot): they draw
// the dwell-anticipation target, not a stroke.
const strokeSurfaces = (parent: HTMLElement): SVGSVGElement[] => [
  ...(parent
    .querySelector('.marking-menu')
    ?.shadowRoot?.querySelectorAll<SVGSVGElement>(
      'svg.marking-menu-stroke-surface',
    ) ?? []),
];

/**
 Touch down at the first point, move to each of the others in one step, and
 lift.
 */
const stroke = async (...[first, ...rest]: [Point, ...Point[]]) => {
  const drag = await press(first);
  for (const point of rest) {
    // eslint-disable-next-line no-await-in-loop
    await drag.moveTo(point, 1);
  }

  await drag.release();
};

/**
 Records the id of every pointer pressed on `element`.
 */
const recordPointers = (element: HTMLElement) => {
  const ids: number[] = [];
  const onDown = (event: PointerEvent) => {
    ids.push(event.pointerId);
  };

  element.addEventListener('pointerdown', onDown);
  return {
    ids,
    [Symbol.dispose]() {
      element.removeEventListener('pointerdown', onDown);
    },
  };
};

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
  it('uses the parent document for a gesture drawn inside an iframe', async () => {
    using fixture = createFrameParent();
    const { parent, at } = fixture;
    using controller = createController({ items, parent });

    const selected: string[] = [];
    controller.on('select', (event) => {
      selected.push(event.selection.id);
    });

    await using drag = await press(at(0, 0));
    await waitForMenuOpen(parent);
    await drag.moveTo(at(100, 0), 1);
    await drag.moveTo(at(120, 0), 1);

    const path = () => {
      const root = parent.querySelector(':scope > .marking-menu')?.shadowRoot;
      // `:scope` isn't supported on a bare ShadowRoot.
      // eslint-disable-next-line unicorn/prefer-scoped-selector
      return root?.querySelector<SVGPathElement>(
        'svg:not(.marking-menu-stroke--lower) > .marking-menu-stroke-path',
      );
    };

    await expect.poll(path).not.toBeNull();
    const gesturePath = path();
    if (!gesturePath) {
      throw new Error('The iframe gesture stroke is missing.');
    }

    const frameWindow = parent.ownerDocument.defaultView;
    if (!frameWindow) {
      throw new Error('The iframe has no window.');
    }

    expect(frameWindow.getComputedStyle(gesturePath).stroke).toBe(
      'rgb(0, 0, 255)',
    );

    await drag.release();
    expect(selected).toEqual(['right']);
  });

  it('dispatches select carrying the leaf a straight drag recognizes', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    using controller = createController({ items, parent });

    const selected: MarkingMenuSelectEvent[] = [];
    controller.on('select', (event) => {
      selected.push(event);
    });

    await stroke(at(0, 0), at(100, 0), at(120, 0));

    expect(selected.map((event) => event.selection.id)).toEqual(['right']);
  });

  it('hides the cursor on gesture start, behind the opening indicator', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    using _controller = createController({ items, parent });

    expect(parent.style.cursor).toBe('');
    await using _drag = await press(at(0, 0));
    expect(parent.style.cursor).toBe('none');
  });

  it("restores the parent's own inline cursor rather than clearing it", async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    parent.style.cursor = 'pointer';
    const controller = createController({ items, parent });

    await using drag = await press(at(0, 0));
    expect(parent.style.cursor).toBe('none');

    // Back to idle: the parent's cursor is the parent's again, not blank.
    await drag.moveTo(at(100, 0), 1);
    await drag.moveTo(at(120, 0), 1);
    await drag.release();
    expect(parent.style.cursor).toBe('pointer');

    controller.dispose();
    expect(parent.style.cursor).toBe('pointer');
  });

  it('draws the stroke through the animation-frame throttle, converging to the latest state when frames coalesce', async () => {
    using _timers = fakeTimers();
    using fixture = createParent();
    const { parent, at } = fixture;
    using _controller = createController({ items, parent });

    await using drag = await press(at(0, 0));
    await drag.moveTo(at(10, 0), 1);
    await drag.moveTo(at(50, 0), 1);
    await drag.moveTo(at(100, 0), 1);

    const root = parent.querySelector('.marking-menu')?.shadowRoot;
    expect(root?.querySelector('path')).toBeNull();

    vi.advanceTimersToNextFrame();

    expect(root?.querySelector('path')?.getAttribute('d')).toBe(
      'M 0 0 L 10 0 L 50 0 L 100 0',
    );
  });

  it('shows one gesture-feedback trace on completion', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    using _controller = createController({ items, parent });

    await stroke(at(0, 0), at(100, 0), at(120, 0));

    expect(strokeSurfaces(parent)).toHaveLength(1);
  });

  it('dispose() removes listeners, DOM, and the touch-action claim, and is idempotent', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    const controller = createController({ items, parent });
    using pointers = recordPointers(parent);

    await using drag = await press(at(0, 0));
    await drag.moveTo(at(100, 0), 1);

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
    const [pointerId] = pointers.ids;
    expect(pointerId).toBeDefined();
    expect(parent.hasPointerCapture(pointerId ?? NaN)).toBe(false);

    // Further pointer input is inert: the DOM listeners are gone.
    await drag.moveTo(at(120, 0), 1);
    await drag.release();
    expect(selected).not.toHaveBeenCalled();
    expect(cancelled).not.toHaveBeenCalled();

    expect(() => {
      controller.dispose();
    }).not.toThrow();
  });

  it('is also disposable through [Symbol.dispose](), same as dispose()', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    const controller = createController({ items, parent });

    await using _drag = await press(at(0, 0));
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

  it('keeps touch-action while another controller on the parent still holds a claim', () => {
    using fixture = createParent();
    const { parent } = fixture;
    const first = createController({ items, parent });
    const second = createController({ items, parent });

    expect(parent.style.getPropertyValue('touch-action')).toBe('none');

    first.dispose();
    expect(parent.style.getPropertyValue('touch-action')).toBe('none');

    second.dispose();
    expect(parent.style.getPropertyValue('touch-action')).toBe('');
  });

  it('isolates a throwing consumer listener: the gesture proceeds and other listeners still run', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    using controller = createController({ items, parent });
    using reported = catchReportedErrors();

    const failure = new Error('Expected consumer listener failure');
    controller.on('start', () => {
      throw failure;
    });
    const alsoNotified = voidMock<[MarkingMenuStartEvent]>();
    controller.on('start', alsoNotified);
    let selectedId: string | undefined;
    controller.on('select', (event) => {
      selectedId = event.selection.id;
    });

    await stroke(at(0, 0), at(100, 0), at(120, 0));

    expect(reported.errors).toEqual([failure]);
    expect(alsoNotified).toHaveBeenCalledTimes(1);
    expect(selectedId).toBe('right');
  });

  it('freezes position on start and select, and dispatches select after the DOM is fully rendered', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    using controller = createController({ items, parent });

    let startPosition: readonly number[] | undefined;
    controller.on('start', (event) => {
      startPosition = event.position;
    });

    let observedOpen: { domItems: number; eventItems: number } | undefined;
    controller.on('open', (event) => {
      observedOpen = {
        domItems:
          parent
            .querySelector('.marking-menu')
            ?.shadowRoot?.querySelectorAll('.marking-menu-item').length ?? 0,
        eventItems: event.menu.items.length,
      };
    });

    let observedChange:
      | { domActiveKey: string | undefined; eventActiveKey: string | undefined }
      | undefined;
    controller.on('change', (event) => {
      observedChange = {
        domActiveKey:
          parent
            .querySelector('.marking-menu')
            ?.shadowRoot?.querySelector<HTMLElement>(
              '.marking-menu-item.active',
            )?.dataset.itemId ?? undefined,
        eventActiveKey: event.activeItem?.key ?? undefined,
      };
    });

    let observedDuringSelect:
      { traces: number; cursor: string; menuLayers: number } | undefined;
    controller.on('select', (event) => {
      expect(Object.isFrozen(event.position)).toBe(true);
      observedDuringSelect = {
        traces: strokeSurfaces(parent).length,
        cursor: parent.style.cursor,
        menuLayers:
          parent
            .querySelector('.marking-menu')
            ?.shadowRoot?.querySelectorAll('.marking-menu-layer').length ?? 0,
      };
    });

    await using drag = await openMenu(parent);
    expect(Object.isFrozen(startPosition)).toBe(true);

    await drag.moveTo(at(100, 0), 1);
    await drag.moveTo(at(120, 0), 1);
    await drag.release();

    expect(observedOpen).toEqual({ domItems: 4, eventItems: 4 });
    expect(observedChange).toEqual({
      domActiveKey: '0',
      eventActiveKey: '0',
    });
    expect(observedDuringSelect).toEqual({
      traces: 1,
      cursor: '',
      menuLayers: 0,
    });
  });

  it('only accepts the primary pointer and primary button, and owns pointer capture', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    using controller = createController({ items, parent });
    using pointers = recordPointers(parent);

    const started = voidMock<[MarkingMenuStartEvent]>();
    controller.on('start', started);

    // A second finger is not the primary pointer. The first one, pressed
    // outside the parent, is the page's.
    {
      await using _outside = await press({ x: 10, y: 10 });
      await using _second = await press(at(0, 0));
    }

    // Nor is the middle button the primary button.
    {
      await using _middle = await pressMouse(at(0, 0), 'middle');
    }

    expect(started).not.toHaveBeenCalled();

    // A qualifying down starts the gesture and takes capture.
    await using drag = await press(at(0, 0));
    expect(started).toHaveBeenCalledTimes(1);
    const owner = pointers.ids.at(-1);
    expect(owner).toBeDefined();
    expect(parent.hasPointerCapture(owner ?? NaN)).toBe(true);

    // The mouse is a primary pointer of its own, but a gesture is already
    // going on: no second `start`.
    {
      await using _mouse = await pressMouse(at(0, 0));
    }

    expect(started).toHaveBeenCalledTimes(1);

    // Capture is released once the owning gesture ends.
    await drag.moveTo(at(100, 0), 1);
    await drag.release();
    expect(parent.hasPointerCapture(owner ?? NaN)).toBe(false);
  });

  it('has already released pointer capture by the time select is dispatched', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    using controller = createController({ items, parent });
    using pointers = recordPointers(parent);

    let heldDuringSelect: boolean | undefined;
    controller.on('select', () => {
      heldDuringSelect = pointers.ids.some((pointerId) =>
        parent.hasPointerCapture(pointerId),
      );
    });

    await stroke(at(0, 0), at(100, 0), at(120, 0));

    // A `select` listener sees fully committed state, and capture ownership is
    // part of that state: a listener may legitimately start its own gesture.
    expect(pointers.ids).not.toHaveLength(0);
    expect(heldDuringSelect).toBe(false);
  });

  it('dispatches cancel carrying an undefined activeItem, not select, for a gesture with no movement at all', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    using controller = createController({ items, parent });

    const selected = voidMock<[MarkingMenuSelectEvent]>();
    controller.on('select', selected);

    let cancelEvent: MarkingMenuCancelEvent | undefined;
    controller.on('cancel', (event) => {
      cancelEvent = event;
    });

    await stroke(at(0, 0));

    expect(selected).not.toHaveBeenCalled();
    expect(cancelEvent?.mode).toBe('startup');
    expect(cancelEvent?.activeItem).toBeUndefined();
  });

  it('dispatches cancel, never select, when the native pointer is cancelled mid-gesture, having released capture already', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    using controller = createController({ items, parent });
    using pointers = recordPointers(parent);

    const selected = voidMock<[MarkingMenuSelectEvent]>();
    controller.on('select', selected);

    let cancelEvent: MarkingMenuCancelEvent | undefined;
    let heldDuringCancel: boolean | undefined;
    controller.on('cancel', (event) => {
      cancelEvent = event;
      heldDuringCancel = pointers.ids.some((pointerId) =>
        parent.hasPointerCapture(pointerId),
      );
    });

    const drag = await press(at(0, 0));
    // A straight line that would otherwise recognize.
    await drag.moveTo(at(100, 0), 1);
    await drag.cancel();

    expect(selected).not.toHaveBeenCalled();
    expect(cancelEvent?.mode).toBe('expert');
    expect(cancelEvent?.activeItem).toBeUndefined();
    expect(heldDuringCancel).toBe(false);
  });

  it('leaves an earlier gesture-feedback trace untouched when a new gesture completes', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    using _controller = createController({ items, parent });

    await stroke(at(0, 0), at(100, 0), at(120, 0));
    expect(strokeSurfaces(parent)).toHaveLength(1);

    await stroke(at(0, 0));
    expect(strokeSurfaces(parent)).toHaveLength(2);
  });

  it('lets three overlapping gesture-feedback traces expire independently, on their own schedules', async () => {
    using _timers = fakeTimers();
    using fixture = createParent();
    const { parent, at } = fixture;
    using _controller = createController({ items, parent });

    const gesture = async (x: number) =>
      stroke(at(x, 0), at(x + 100, 0), at(x + 120, 0));

    // Trace #1 shown at 0ms (expires at 1000ms).
    await gesture(0);
    vi.advanceTimersByTime(400);
    // Trace #2 shown at 400ms (expires at 1400ms).
    await gesture(200);
    vi.advanceTimersByTime(400);
    // Trace #3 shown at 800ms (expires at 1800ms).
    await gesture(400);
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
  });

  it('reports the mode of the gesture through state, with a menu once one is displayed', async () => {
    using _timers = fakeTimers();
    using fixture = createParent();
    const { parent, at } = fixture;
    using controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });
    expect(controller.state).toEqual({ mode: 'idle' });

    const expert = await press(at(0, 0));
    expect(controller.state).toEqual({ mode: 'startup' });

    await expert.moveTo(at(50, 0), 1);
    expect(controller.state).toEqual({ mode: 'expert' });

    await expert.release();
    await using novice = await press(at(0, 0));
    vi.advanceTimersByTime(100);
    expect(controller.state).toMatchObject({
      mode: 'novice',
      menu: { isRoot: true },
      activeItem: undefined,
    });

    await novice.moveTo(at(100, 0), 1);
    expect(controller.state).toMatchObject({
      mode: 'novice',
      activeItem: { id: 'right' },
    });
  });

  it('is already idle inside a select listener', async () => {
    using fixture = createParent();
    const { parent, at } = fixture;
    using controller = createController({ items, parent });
    let modeInListener: string | undefined;
    controller.on('select', () => {
      modeInListener = controller.state.mode;
    });

    await stroke(at(0, 0), at(100, 0), at(120, 0));

    expect(modeInListener).toBe('idle');
  });

  it('opens novice mode at the gesture origin after the pointer dwells without moving', async () => {
    using _timers = fakeTimers();
    using fixture = createParent();
    const { parent, at, client } = fixture;
    using controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    let openEvent: MarkingMenuOpenEvent | undefined;
    controller.on('open', (event) => {
      openEvent = event;
    });

    await using _drag = await press(at(50, 60));
    vi.advanceTimersByTime(100);

    expect(openEvent?.mode).toBe('novice');
    expect(openEvent?.menuCenter).toEqual(client(50, 60));
    expect(openEvent?.position).toEqual(client(50, 60));
    expect(controller.state.mode).toBe('novice');
  });

  it('renders the menu at its center in local coordinates, converting from client coordinates itself', async () => {
    using _timers = fakeTimers();
    using fixture = createParent();
    const { parent, at } = fixture;
    using _controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    await using _drag = await press(at(40, 40));
    vi.advanceTimersByTime(100);

    const layer = menuLayer(parent);
    expect(layer?.style.getPropertyValue('--center-x')).toBe('40px');
    expect(layer?.style.getPropertyValue('--center-y')).toBe('40px');
  });

  it('splits the stroke into an upper (current) and lower (accumulated) region once novice mode opens', async () => {
    using _timers = fakeTimers();
    using fixture = createParent();
    const { parent, at } = fixture;
    using _controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    await using drag = await press(at(0, 0));
    await drag.moveTo(at(1, 0), 1);
    vi.advanceTimersByTime(100);
    vi.advanceTimersToNextFrame();

    expect(strokeSurfaces(parent)).toHaveLength(2);
  });

  it('keeps the cursor hidden across the dwell into novice mode, with no flicker back to a visible cursor', async () => {
    using _timers = fakeTimers();
    using fixture = createParent();
    const { parent, at } = fixture;
    using _controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    await using _drag = await press(at(0, 0));
    expect(parent.style.cursor).toBe('none');

    vi.advanceTimersByTime(100);
    expect(parent.style.cursor).toBe('none');
  });

  it('dispatches select carrying the leaf and the open menu when releasing on a leaf active item (objective 7)', async () => {
    using _timers = fakeTimers();
    using fixture = createParent();
    const { parent, at } = fixture;
    using controller = createController({
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

    const drag = await press(at(0, 0));
    vi.advanceTimersByTime(100);
    await drag.moveTo(at(100, 0), 1);
    await drag.release();

    expect(canceled).not.toHaveBeenCalled();
    expect(selectedId).toBe('right');
    // `select.menu` is the same root menu that opened this gesture, not
    // merely defined.
    expect(openedMenu).not.toBeUndefined();
    expect(selectedMenu).toBe(openedMenu);
    expect(menuLayer(parent)).toBeUndefined();
    expect(strokeSurfaces(parent)).toHaveLength(1);
  });

  it('does not recreate the menu DOM when a render repeats with the same identity', async () => {
    using _timers = fakeTimers();
    using fixture = createParent();
    const { parent, at } = fixture;
    using _controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    await using drag = await press(at(0, 0));
    vi.advanceTimersByTime(100);

    const menuBefore = parent.querySelector('.marking-menu');
    expect(menuBefore).not.toBeNull();

    // Still within `deadZoneRadius`, so the active item stays undefined and
    // the menu identity is unchanged: no DOM to patch, but a render pass
    // still runs.
    await drag.moveTo(at(1, 0), 1);

    expect(parent.querySelector('.marking-menu')).toBe(menuBefore);
    expect(parent.querySelectorAll('.marking-menu')).toHaveLength(1);
  });

  it('activates the nearest item by angle once past the dead zone, patching the DOM without recreating the menu, and distinguishes continued pointing at the same item from moving to a new one', async () => {
    using _timers = fakeTimers();
    using fixture = createParent();
    const { parent, at } = fixture;
    using controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
      deadZoneRadius: 40,
    });

    const moved: MarkingMenuMoveEvent[] = [];
    controller.on('move', (event) => {
      moved.push(event);
    });
    const changed = vi.fn<() => void>();
    let lastChangeActiveId: string | undefined;
    let lastChangePreviousActive: unknown;
    controller.on('change', (event) => {
      changed();
      lastChangeActiveId = event.activeItem?.id;
      lastChangePreviousActive = event.previousActiveItem;
    });

    await using drag = await press(at(0, 0));
    vi.advanceTimersByTime(100);
    const menuBefore = parent.querySelector('.marking-menu');

    await drag.moveTo(at(100, 0), 1);

    expect(moved.map((event) => event.activeItem?.id)).toEqual(['right']);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(lastChangeActiveId).toBe('right');
    expect(lastChangePreviousActive).toBeUndefined();

    // The menu DOM is patched in place, not recreated.
    expect(parent.querySelector('.marking-menu')).toBe(menuBefore);
    const activeItems = activeMenuItems(parent);
    expect(activeItems).toHaveLength(1);
    // `dataset.itemId` is keyed on the item's index ("1" for "right", the
    // second described item), not on the caller's own `id`.
    expect(activeItems[0]?.dataset.itemId).toBe('1');

    // Continued pointing at the same item: another `move`, no further `change`.
    await drag.moveTo(at(110, 0), 1);
    expect(moved).toHaveLength(2);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(activeMenuItems(parent)).toHaveLength(1);
  });

  it('dispatches open for a submenu and recreates the menu DOM for it, once the pointer dwells past the dead zone on it', async () => {
    using _timers = fakeTimers();
    using fixture = createParent();
    const { parent, at } = fixture;
    using controller = createController({
      // Listed starting from "up"/"subUp": see the top-level `items` comment
      // above.
      items: [
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
      ],
      parent,
      noviceDwellingTime: 100,
      deadZoneRadius: 40,
      submenuOpeningDelay: 100,
    });

    const openedMenus: unknown[] = [];
    controller.on('open', (event) => {
      openedMenus.push(event.menu);
    });

    await using drag = await press(at(0, 0));
    vi.advanceTimersByTime(100);
    const rootMenuDom = menuLayer(parent);

    // Past the dead zone on "right", a submenu.
    await drag.moveTo(at(100, 0), 1);
    vi.advanceTimersByTime(100);

    expect(openedMenus).toHaveLength(2);
    expect(openedMenus[1]).not.toBe(openedMenus[0]);
    expect(menuLayer(parent)).not.toBe(rootMenuDom);
    expect(parent.querySelectorAll('.marking-menu')).toHaveLength(1);
  });

  it('removes the menu DOM on dispose while novice mode is open', async () => {
    using _timers = fakeTimers();
    using fixture = createParent();
    const { parent, at } = fixture;
    const controller = createController({
      items,
      parent,
      noviceDwellingTime: 100,
    });

    await using _drag = await press(at(0, 0));
    vi.advanceTimersByTime(100);
    expect(controller.state.mode).toBe('novice');

    controller.dispose();

    expect(parent.querySelector('.marking-menu')).toBeNull();
  });

  describe('moving focus during a gesture', () => {
    it("focuses each controller's own menu, not another controller's sharing the same parent", async () => {
      using _timers = fakeTimers();
      using fixture = createParent();
      const { parent, at } = fixture;
      using _first = createController({
        items,
        parent,
        noviceDwellingTime: 100,
      });
      using _second = createController({
        items,
        parent,
        noviceDwellingTime: 100,
      });

      // One press starts a gesture on both controllers at once: each owns an
      // independent pointer source over the same parent.
      await using _drag = await press(at(0, 0));
      vi.advanceTimersByTime(100);

      const [firstRoot, secondRoot] = [
        ...parent.querySelectorAll('.marking-menu'),
      ].map((host) => host.shadowRoot);
      const secondMenu = secondRoot?.querySelector('[role="menu"]');
      expect(secondMenu).not.toBeNull();
      expect(secondRoot?.activeElement).toBe(secondMenu);
      expect(firstRoot?.activeElement).toBeNull();
    });

    describe('announcing an item whose submenu is about to open', () => {
      // Two points either side of the up/right boundary, closer than
      // `movementsThreshold`: moving from one to the other changes the active
      // item without a significant move.
      const beforeBoundary = [33, -36] as const;
      const afterBoundary = [36, -34] as const;

      const setup = async (submenuOpeningDelay: number) => {
        const fixture = createParent();
        const { parent, at } = fixture;
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
        const drag = await press(at(0, 0));
        vi.advanceTimersByTime(100);
        opened.mockClear();
        return {
          opened,
          moveTo: async ([x, y]: readonly [number, number]) =>
            drag.moveTo(at(x, y), 1),
          focusedLabel: () =>
            parent
              .querySelector('.marking-menu')
              ?.shadowRoot?.activeElement?.querySelector('.marking-menu-label')
              ?.textContent,
          async [Symbol.asyncDispose]() {
            await drag.release();
            controller.dispose();
            fixture[Symbol.dispose]();
          },
        };
      };

      it('announces an item that became active through a small move', async () => {
        using _timers = fakeTimers();
        await using menu = await setup(300);
        const { opened, moveTo, focusedLabel } = menu;

        await moveTo(beforeBoundary);
        vi.advanceTimersByTime(270);
        await moveTo(afterBoundary);

        // The dwell restarted with the item, so its announcement comes
        // before its submenu.
        vi.advanceTimersByTime(60);
        expect(focusedLabel()).toBe('Right');
        expect(opened).not.toHaveBeenCalled();

        vi.advanceTimersByTime(300);
        expect(opened).toHaveBeenCalledTimes(1);
      });

      it('announces the item even when the submenu opens without delay', async () => {
        using _timers = fakeTimers();
        await using menu = await setup(0);
        const { opened, moveTo, focusedLabel } = menu;

        await moveTo(afterBoundary);
        vi.advanceTimersByTime(0);

        expect(focusedLabel()).toBe('Right');
        expect(opened).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1000);
        expect(opened).toHaveBeenCalledTimes(1);
      });
    });

    it('restores focus that was moved when the controller is disposed mid-gesture', async () => {
      using _timers = fakeTimers();
      using fixture = createParent();
      const { parent, at } = fixture;
      const before = document.createElement('button');
      document.body.append(before);
      before.focus();

      using controller = createController({
        items,
        parent,
        noviceDwellingTime: 100,
      });

      try {
        await using _drag = await press(at(0, 0));
        vi.advanceTimersByTime(100);
        expect(document.activeElement).not.toBe(before);
        controller.dispose();
        expect(document.activeElement).toBe(before);
      } finally {
        before.remove();
      }
    });
  });
});

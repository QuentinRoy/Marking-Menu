import { commands, page } from 'vitest/browser';
import {
  createMarkingMenu,
  type MarkingMenuConfig,
} from '../../create-marking-menu.js';
import type { MarkingMenuController } from '../../engine/controller.js';
import { fakeTimers } from './timers.js';

declare module 'vitest/browser' {
  // Module augmentation only merges through an interface, not a type alias.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface BrowserCommands {
    touchStart: (id: number, x: number, y: number) => Promise<void>;
    touchMove: (id: number, x: number, y: number) => Promise<void>;
    touchEnd: (id: number) => Promise<void>;
    touchCancel: () => Promise<void>;
    mouseMove: (x: number, y: number) => Promise<void>;
    mouseDown: (button: MouseButton) => Promise<void>;
    mouseUp: (button: MouseButton) => Promise<void>;
    emulateMedia: (options: {
      reducedMotion?: 'reduce' | 'no-preference';
      forcedColors?: 'active' | 'none';
    }) => Promise<void>;
  }
}

export type Point = { x: number; y: number };

export type MouseButton = 'left' | 'middle' | 'right';

/**
An item's rendered label and the angle (in degrees) it's laid out at.
*/
export type MenuItemGeometry = { label: string; angle: number };

/**
 The eight-direction topology mounted menus are given below, keyed by item
 id. Angles match the library's own convention (0° = right, clockwise on
 screen, since `toPolar` in `src/utils.ts` derives angle from
 `atan2(dy, dx)` with y growing downward): 0 = right, 90 = down, 180 = left,
 270 = up.
 */
export const TOP_LEVEL_ITEMS = {
  right: { angle: 0, label: 'Right' },
  'down-right': { angle: 45, label: 'Down-Right' },
  others: { angle: 90, label: 'Others...' },
  'down-left': { angle: 135, label: 'Down-Left' },
  left: { angle: 180, label: 'Left' },
  'up-left': { angle: 225, label: 'Up-Left' },
  up: { angle: 270, label: 'Up' },
  'up-right': { angle: 315, label: 'Up-Right' },
} satisfies Record<string, MenuItemGeometry>;

export type MountedMenu = Disposable & {
  readonly mm: MarkingMenuController;
  readonly surface: HTMLElement;
  readonly snapshotArea: HTMLElement;
};

/**
 Mounts a menu the way the old Playwright fixture's CSS did: a fixed-size
 `snapshotArea` (what gets screenshotted) containing an inset `surface`
 (what the menu attaches to and gestures target).
 */
export const mountMenu = (
  config: Omit<MarkingMenuConfig, 'parent'>,
): MountedMenu => {
  const snapshotArea = document.createElement('div');
  Object.assign(snapshotArea.style, {
    position: 'fixed',
    top: '120px',
    left: '100px',
    width: '600px',
    height: '480px',
  });

  const surface = document.createElement('div');
  Object.assign(surface.style, {
    position: 'absolute',
    top: '30px',
    left: '150px',
    width: '300px',
    height: '300px',
    background: '#fff',
    border: '1px solid #ccc',
  });

  snapshotArea.append(surface);
  document.body.append(snapshotArea);

  const mm = createMarkingMenu({ ...config, parent: surface });

  return {
    mm,
    surface,
    snapshotArea,
    [Symbol.dispose]() {
      mm.dispose();
      snapshotArea.remove();
    },
  };
};

/**
A point `radius` pixels away from `from`, in the direction `angleDeg`.
*/
export const offset = (
  from: Point,
  angleDeg: number,
  radius: number,
): Point => {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: from.x + radius * Math.cos(rad),
    y: from.y + radius * Math.sin(rad),
  };
};

/**
The center of `element`, in viewport coordinates.
*/
export const centerOf = (element: Element): Point => {
  const box = element.getBoundingClientRect();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

export type Drag = AsyncDisposable & {
  readonly at: Point;
  /**
  Move to `at`, interpolating steps.
  */
  moveTo(at: Point, steps?: number): Promise<void>;
  /**
  Lift the finger or button. Safe to call more than once.
  */
  release(): Promise<void>;
};

export type TouchDrag = Drag & {
  /**
   Cancel the touch, the way the platform does when it takes a touch over:
   the page gets `pointercancel` instead of `pointerup`. Cancels every finger
   still down, not just this one.
   */
  cancel(): Promise<void>;
};

/**
 Moves from `from` to `to` in `steps` separate moves, each a real input at a
 point in time, so the browser sees the same gradual path a hand drawing it
 would: dispatching them all at once would collapse the interpolation this
 exists for.
 */
const interpolate = async (
  from: Point,
  to: Point,
  steps: number,
  move: (x: number, y: number) => Promise<void>,
): Promise<void> => {
  for (let step = 1; step <= steps; step += 1) {
    // eslint-disable-next-line no-await-in-loop
    await move(
      from.x + ((to.x - from.x) * step) / steps,
      from.y + ((to.y - from.y) * step) / steps,
    );
  }
};

let nextFingerId = 0;
const fingersDown = new Set<number>();

/**
 Touch down at `at` and hold, as its own finger: a second `press()` while
 this one is still down drives a genuinely concurrent touch point, the way
 two fingers on a real screen do (see `vitest.config.ts`'s touch commands).
 Call `release()` when the gesture should end, or let the scope's
 disposal (`await using`) do it: the Playwright page behind these tests,
 unlike Playwright Test's own pages, is shared across every test in the
 file, so a touch left active would carry into whichever test runs next.
 */
export const press = async (at: Point): Promise<TouchDrag> => {
  const id = nextFingerId;
  nextFingerId += 1;
  await commands.touchStart(id, at.x, at.y);
  fingersDown.add(id);
  let current = at;

  const release = async (): Promise<void> => {
    if (!fingersDown.delete(id)) {
      return;
    }

    await commands.touchEnd(id);
  };

  return {
    at,
    async moveTo(to, steps = 5) {
      await interpolate(current, to, steps, async (x, y) =>
        commands.touchMove(id, x, y),
      );
      current = to;
    },
    release,
    async cancel() {
      fingersDown.clear();
      await commands.touchCancel();
    },
    [Symbol.asyncDispose]: release,
  };
};

// Where the mouse is. Chromium reports even a move to where the mouse
// already is as a `pointermove`, which would count as a hover.
let mouseAt: Point | undefined;

/**
 Move the mouse to `at` with no button held, such as to hover.
 */
export const moveMouse = async (at: Point): Promise<void> => {
  if (mouseAt?.x === at.x && mouseAt.y === at.y) {
    return;
  }

  await commands.mouseMove(at.x, at.y);
  mouseAt = at;
};

/**
 Press the mouse `button` at `at` and hold, like {@link press} does with a
 finger. Release it the same way: the mouse, too, is shared across the file.
 */
export const pressMouse = async (
  at: Point,
  button: MouseButton = 'left',
): Promise<Drag> => {
  await moveMouse(at);
  await commands.mouseDown(button);
  let current = at;
  let hasReleased = false;

  const release = async (): Promise<void> => {
    if (hasReleased) {
      return;
    }

    hasReleased = true;
    await commands.mouseUp(button);
  };

  return {
    at,
    async moveTo(to, steps = 5) {
      await interpolate(current, to, steps, async (x, y) =>
        moveMouse({ x, y }),
      );
      current = to;
    },
    release,
    [Symbol.asyncDispose]: release,
  };
};

/**
 Wait for the menu to be open, however it got there (novice or dwell).
 Polls for `.marking-menu-label`, the first element in the menu's DOM with
 an actual rendered size (`.marking-menu` and `.marking-menu-item` are both
 zero-size positioning anchors), inside `.marking-menu`'s shadow root: the
 host element renders in the light DOM, but its content doesn't.
 */
export const waitForMenuOpen = async (surface: Element): Promise<void> => {
  await expect
    .poll(() =>
      surface
        .querySelector('.marking-menu')
        ?.shadowRoot?.querySelector('.marking-menu-label'),
    )
    .not.toBeNull();
};

/**
Wait for a menu opened with {@link waitForMenuOpen} to close.
*/
export const waitForMenuClosed = async (surface: Element): Promise<void> => {
  await expect
    .poll(() =>
      surface
        .querySelector('.marking-menu')
        ?.shadowRoot?.querySelector('.marking-menu-label'),
    )
    .toBeNull();
};

// Comfortably past the default `noviceDwellingTime` (1000 / 3). The dwell
// fires deterministically under fake time, so the exact margin doesn't
// matter.
const NOVICE_DWELL_MARGIN = 1000;

/**
 Presses and waits for the menu to open, driving the dwell through fake
 time rather than waiting on it in real time. The freeze is scoped to this
 function alone: real timers are restored before it returns, so callers
 that move the pointer afterward still redraw normally through the real
 `requestAnimationFrame` their strokes throttle through.
 */
export const openMenu = async (surface: Element): Promise<Drag> => {
  const drag = await press(centerOf(surface));
  using _timers = fakeTimers();
  await vi.advanceTimersByTimeAsync(NOVICE_DWELL_MARGIN);
  await waitForMenuOpen(surface);
  return drag;
};

/**
 The element actually holding focus, unlike `document.activeElement`: a
 shadow host reports itself as active for any descendant focused inside it
 (DOM's own retargeting), so `toHaveFocus()` alone can never see past the
 menu's shadow root. This walks into every nested `shadowRoot.activeElement`
 to find the real target.
 */
const deepActiveElement = (): Element | undefined => {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }

  return active ?? undefined;
};

/**
Asserts that the element with the given role (and, optionally, accessible
name) currently has focus.
*/
export const expectFocused = async (
  role: string,
  options?: { name?: string | RegExp },
): Promise<void> => {
  const locator = page.getByRole(role, options);
  await expect.poll(() => locator.query() === deepActiveElement()).toBe(true);
};

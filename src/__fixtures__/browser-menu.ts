import { commands } from 'vitest/browser';
import type { MarkingMenuController } from '../engine/controller.js';
import { createMarkingMenu, type MarkingMenuConfig } from '../marking-menu.js';
import type { AnyModelNode } from '../types.js';

declare module 'vitest/browser' {
  // Module augmentation only merges through an interface, not a type alias.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface BrowserCommands {
    mouseMove: (x: number, y: number, steps?: number) => Promise<void>;
    mouseDown: () => Promise<void>;
    mouseUp: () => Promise<void>;
  }
}

export type Point = { x: number; y: number };

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
  readonly mm: MarkingMenuController<AnyModelNode>;
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

/**
Move the mouse to `at` and press the primary button, without releasing.
*/
export const pressAt = async (at: Point): Promise<void> => {
  await commands.mouseMove(at.x, at.y);
  await commands.mouseDown();
};

/**
Move the (already pressed or free) mouse to `at`, interpolating steps.
*/
export const moveTo = async (at: Point, steps = 5): Promise<void> => {
  await commands.mouseMove(at.x, at.y, steps);
};

/**
Optionally move to `at`, then release the primary mouse button.
*/
export const releaseAt = async (at?: Point): Promise<void> => {
  if (at) {
    await commands.mouseMove(at.x, at.y);
  }

  await commands.mouseUp();
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

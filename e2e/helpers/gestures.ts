import { expect, type Page } from '@playwright/test';

export type Point = { x: number; y: number };

/** An item's rendered label and the angle (in degrees) it's laid out at. */
export type MenuItemGeometry = { label: string; angle: number };

/**
 The fixture's eight-direction topology (see `e2e/fixture/main.ts`), keyed by
 item id. Angles match the library's own convention (0° = right, clockwise on
 screen, since `toPolar` in `src/utils.ts` derives angle from `atan2(dy, dx)`
 with y growing downward): 0 = right, 90 = down, 180 = left, 270 = up.
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

/** The `Others...` submenu, laid out the same way around its own center. */
export const SUBMENU_ITEMS = {
  'sub-right': { angle: 0, label: 'Sub Right' },
  'sub-down': { angle: 90, label: 'Sub Down' },
  'sub-left': { angle: 180, label: 'Sub Left' },
  'sub-up': { angle: 270, label: 'Sub Up' },
} satisfies Record<string, MenuItemGeometry>;

/** A point `radius` pixels away from `from`, in the direction `angleDeg`. */
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

/** The gesture surface's bounding box, in viewport coordinates. */
export const surfaceBoundingBox = async (
  page: Page,
): Promise<{ x: number; y: number; width: number; height: number }> => {
  const box = await page.locator('#surface').boundingBox();
  if (!box) {
    throw new TypeError('#surface has no bounding box.');
  }

  return box;
};

/** The center of the gesture surface, in viewport coordinates. */
export const surfaceCenter = async (page: Page): Promise<Point> => {
  const box = await surfaceBoundingBox(page);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Move the mouse to `at` and press the primary button, without releasing. */
export const pressAt = async (page: Page, at: Point): Promise<void> => {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
};

/** Move the (already pressed or free) mouse to `at`, interpolating steps. */
export const moveTo = async (
  page: Page,
  at: Point,
  steps = 5,
): Promise<void> => {
  await page.mouse.move(at.x, at.y, { steps });
};

/** Optionally move to `at`, then release the primary mouse button. */
export const releaseAt = async (page: Page, at?: Point): Promise<void> => {
  if (at) {
    await page.mouse.move(at.x, at.y);
  }

  await page.mouse.up();
};

/**
 Wait for a (sub-)menu to be open, however it got there (novice or dwell).
 Checked on `.marking-menu-label`, the first element in the menu's DOM with
 an actual rendered size: `.marking-menu` and `.marking-menu-item` are both
 zero-size positioning anchors (`position: absolute`, no set dimensions), so
 Playwright never considers either one "visible".
 */
export const waitForMenuOpen = async (page: Page): Promise<void> => {
  await expect(page.locator('.marking-menu-label').first()).toBeVisible();
};

/**
 The `.marking-menu-label` element itself (not its zero-size
 `.marking-menu-item` container) whose rendered text is exactly `label`,
 scoped to the currently open menu so it can't match the notification log.
 */
export const menuItemLabel = (page: Page, label: string) =>
  page.locator('.marking-menu').getByText(label, { exact: true });

/** The signed delta between two angles in degrees, wrapped to [-180, 180]. */
const deltaAngle = (a: number, b: number): number =>
  ((((b - a + 180) % 360) + 360) % 360) - 180;

/**
 Assert that a (sub-)menu renders exactly the given items, each one closest
 (among the given items' own angles) to its own expected direction from
 `center`. "Closest", rather than a fixed angular tolerance, is what makes
 this an *approximate* octant check: it only asks that each label ended up
 nearer its own direction than any sibling's, not that it sits on an exact
 ray — which the CSS's label-box centering does not guarantee.
 */
export const expectApproximateOctants = async (
  page: Page,
  center: Point,
  items: Record<string, MenuItemGeometry>,
): Promise<void> => {
  const entries = Object.entries(items);
  await expect(page.locator('.marking-menu-item')).toHaveCount(entries.length);

  const measuredAngles = await Promise.all(
    entries.map(async ([id, { label }]) => {
      const box = await menuItemLabel(page, label).boundingBox();
      if (!box) {
        throw new TypeError(`Menu item "${label}" (${id}) is not visible.`);
      }

      const itemCenter = {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      };
      const angle =
        (Math.atan2(itemCenter.y - center.y, itemCenter.x - center.x) * 180) /
        Math.PI;
      return { angle, id, label };
    }),
  );

  for (const { angle: measuredAngle, id, label } of measuredAngles) {
    let nearestId = '';
    let nearestDelta = Infinity;
    for (const [candidateId, candidate] of entries) {
      const delta = Math.abs(deltaAngle(candidate.angle, measuredAngle));
      if (delta < nearestDelta) {
        nearestId = candidateId;
        nearestDelta = delta;
      }
    }

    expect(
      nearestId,
      `"${label}" rendered closest to "${nearestId}"'s expected direction, want "${id}"`,
    ).toBe(id);
  }
};

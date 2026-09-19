import { toLocalPoint, type Point } from '../utils.js';

export type SceneSlotName =
  | 'lower'
  | 'menu'
  | 'indicatorBackground'
  | 'upper'
  | 'indicatorDot'
  | 'feedback';

const slotOrder: readonly {
  key: SceneSlotName;
  name: string;
}[] = [
  { key: 'lower', name: 'lower' },
  { key: 'menu', name: 'menu' },
  { key: 'indicatorBackground', name: 'indicator-background' },
  { key: 'upper', name: 'upper' },
  { key: 'indicatorDot', name: 'indicator-dot' },
  { key: 'feedback', name: 'feedback' },
];

export type Scene = {
  /**
  One container per paint layer, in paint order. Layers mount their content
  into their own slot and never reorder the DOM themselves.
  */
  slots: Record<SceneSlotName, HTMLElement>;
  /**
  Convert a client-coordinates point to coordinates local to the menu's
  parent. Reads the parent's bounding rect on every call, so layers that draw
  after a delay (strokes in their animation frame, the indicator on its tick)
  see a parent that has since moved or scrolled.
  */
  toLocal: (point: Point) => Point;
  toLocalMany: (points: readonly Point[]) => Point[];
  dispose: () => void;
};

/**
  Create the renderer's scene: fixed layer slots in paint order plus the
  single page-to-local coordinate conversion every layer shares.
  */
export function createScene({
  root,
  parent,
}: {
  root: ShadowRoot;
  parent: HTMLElement;
}): Scene {
  const doc = root.ownerDocument;
  const slots = {} as Record<SceneSlotName, HTMLElement>;
  for (const { key, name } of slotOrder) {
    const slot = doc.createElement('div');
    slot.className = 'marking-menu-slot';
    slot.dataset.slot = name;
    // No box of its own: children position as if they were direct children
    // of the root, while DOM order (hence paint order) stays fixed.
    slot.style.display = 'contents';
    root.append(slot);
    slots[key] = slot;
  }

  const toLocal = (point: Point): Point =>
    toLocalPoint(point, parent.getBoundingClientRect());

  return {
    slots,
    toLocal,
    toLocalMany: (points) => points.map(toLocal),
    dispose() {
      for (const slot of Object.values(slots)) {
        slot.remove();
      }
    },
  };
}

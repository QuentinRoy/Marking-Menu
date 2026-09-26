import { toLocalPoint, type Point } from '../utils.js';

export type SceneSlotName =
  | 'lower'
  | 'menu'
  | 'indicatorBackground'
  | 'upper'
  | 'indicatorDot'
  | 'feedback';

export type SceneSlots = Record<SceneSlotName, HTMLElement>;

export type Scene = {
  /**
  One container per paint layer, in paint order. Layers mount their content
  into their own slot and never reorder the DOM themselves.
  */
  slots: SceneSlots;
  /**
  Convert a point from client coordinates to coordinates local to the menu's
  parent. Reads the parent's bounding rect on every call, so layers that draw
  late (strokes in their animation frame, the indicator on its tick) still
  convert against the current rect.
  */
  toLocal: (point: Point) => Point;
  toLocalMany: (points: readonly Point[]) => Point[];
  dispose: () => void;
};

/**
  Create the renderer's scene: fixed layer slots in paint order, plus the one
  conversion from client coordinates that every layer shares.
  */
export function createScene({
  root,
  parent,
}: {
  root: ShadowRoot;
  parent: HTMLElement;
}): Scene {
  const doc = root.ownerDocument;
  const createSlot = (name: string): HTMLElement => {
    const slot = doc.createElement('div');
    slot.className = 'marking-menu-slot';
    slot.dataset.slot = name;
    root.append(slot);
    return slot;
  };

  const slots: SceneSlots = {
    lower: createSlot('lower'),
    menu: createSlot('menu'),
    indicatorBackground: createSlot('indicator-background'),
    upper: createSlot('upper'),
    indicatorDot: createSlot('indicator-dot'),
    feedback: createSlot('feedback'),
  };

  const toLocal = (point: Point): Point =>
    toLocalPoint(point, parent.getBoundingClientRect());

  return {
    slots,
    toLocal,
    // One rect read per batch: a long stroke converts dozens of points
    // against the same frame, and a rect read can force layout.
    toLocalMany(points) {
      const rect = parent.getBoundingClientRect();
      return points.map((point) => toLocalPoint(point, rect));
    },
    dispose() {
      for (const slot of Object.values(slots)) {
        slot.remove();
      }
    },
  };
}

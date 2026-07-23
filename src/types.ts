/**
 Shared internal types.
 */

/**
 A 2D point.
 */
export type Point = [number, number];

/**
 A segment joining two points.
 */
export type Segment = [Point, Point];

export type MarkingMenuModelItem = {
  /** The item's parent menu (`null` for the root item). */
  parent: MarkingMenuModelItem | null;
  /** Whether the item is a leaf (i.e. it has no children). */
  isLeaf(): boolean;
  /** Whether the item is the root of the menu. */
  isRoot(): boolean;
  /** Retrieve the child whose angle is closest to the given angle. */
  getNearestChild(angle: number): MarkingMenuModelItem | null;
  /** The maximum depth of the menu below this item. */
  getMaxDepth(): number;
  /** The maximum breadth of the menu below this item. */
  getMaxBreadth(): number;
};

/**
 An array with at least one element.
 */
export type NonEmptyArray<T> = [T, ...T[]];

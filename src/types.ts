/**
 Shared internal types.
 */

import type { IsTuple } from './utils.js';

/* -------------------------------------------------------------------------- *
 * Input
 * -------------------------------------------------------------------------- */

/**
 An item of the menu, as described by the caller.
 */
export type MarkingMenuItemInput = {
  /**
   The item's identifier. Purely semantic: it is never generated, and only the
   caller gives it a meaning. It must be unique across the whole menu.
   */
  readonly id?: string | undefined;
  /** The item's label. */
  readonly label: string;
  /** The item's sub-items, if any. */
  readonly items?: readonly MarkingMenuItemInput[] | undefined;
};

/**
 The description of a marking menu, as provided to {@link createModel}.
 */
export type MarkingMenuInput = {
  /** The menu's top level items. */
  readonly items: readonly MarkingMenuItemInput[];
};

/* -------------------------------------------------------------------------- *
 * Model
 * -------------------------------------------------------------------------- */

/**
 What the root and the items of the model have in common.
 */
type MenuNode<Items extends readonly unknown[]> = {
  /** The node's direct sub-items. */
  readonly items: Items;
  /** Whether the node has no sub-item. */
  readonly isLeaf: IsLeaf<Items>;
  /**
   Retrieve a direct sub-item by its id. Only accepts the ids of the node's own
   sub-items, and hence always returns one of them.
   */
  readonly getChild: GetChild<Items>;
  /**
   Retrieve every direct sub-item matching a given label. Labels are not
   required to be unique, nor known in advance.
   */
  getChildrenByLabel(childLabel: string): Array<Items[number]>;
  /** Find the sub-item whose angle is the closest to a given angle. */
  getNearestChild(angle: number): IfLeaf<IsLeaf<Items>, null, Items[number]>;
  /** The maximum depth of the menu below this node. */
  getMaxDepth(): IfLeaf<IsLeaf<Items>, 0, number>;
  /** The maximum breadth of the menu below this node. */
  getMaxBreadth(): IfLeaf<IsLeaf<Items>, 0, number>;
};

/**
 `getChild` accepts the ids of the sub-items it can actually find. When the
 sub-items are not a tuple — a menu built at runtime — the ids are unknown, so
 it falls back to accepting any string and possibly returning `null`.
 */
type GetChild<Items extends readonly unknown[]> =
  IsTuple<Items> extends true
    ? <Id extends LiteralIds<Items>>(
        childId: Id,
      ) => Extract<Items[number], { id: Id }>
    : (childId: string) => Items[number] | null;

/**
 A node of the model that the caller described: it carries back the id and the
 label it was given, plus the angle the menu laid it out at.
 */
export type ModelItem<
  Id extends string | undefined,
  Label extends string,
  Items extends readonly unknown[],
> = MenuNode<Items> & {
  /** The item's id, as provided by the caller (`undefined` if it had none). */
  readonly id: Id;
  /** The item's label. */
  readonly label: Label;
  /** The item's angle, in degrees. */
  readonly angle: number;
  /** Items are never the root of the menu. */
  readonly isRoot: false;
};

/**
 The root of the model. Unlike items, it has no id, label nor angle.
 */
export type ModelRoot<Items extends readonly unknown[]> = MenuNode<Items> & {
  readonly isRoot: true;
};

/* -------------------------------------------------------------------------- *
 * Helpers
 * -------------------------------------------------------------------------- */

/**
 Whether an item list makes its owner a leaf. `boolean` when the list's length
 is not statically known.
 */
type IsLeaf<Items extends readonly unknown[]> = Items['length'] extends 0
  ? true
  : Items extends readonly [unknown, ...unknown[]]
    ? false
    : boolean;

/**
 Pick a type depending on whether the node is a leaf. Distributes over `Leaf`
 so that an undetermined `boolean` yields both alternatives.
 */
type IfLeaf<Leaf extends boolean, WhenLeaf, WhenBranch> = Leaf extends true
  ? WhenLeaf
  : WhenBranch;

/**
   The literal id of an item, or `never` if it has no id or its id is a widened
   `string`. Applied item per item so that one item with an unknown id does not
   collapse the ids of its siblings.
   */
export type LiteralId<Item> = Item extends { id: infer Id }
  ? string extends Id
    ? never
    : Id extends string
      ? Id
      : never
  : never;

/**
   The union of the statically known ids of `Items`.
   */
export type LiteralIds<Items extends readonly unknown[]> = {
  [K in keyof Items]: LiteralId<Items[K]>;
}[number];

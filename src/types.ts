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
  /**
  The item's label.
  */
  readonly label: string;
  /**
  The item's optional clockwise angle in degrees, measured from the right.
  */
  readonly angle?: number | undefined;
  /**
  The item's sub-items, if any.
  */
  readonly items?: readonly MarkingMenuItemInput[] | undefined;
};

/**
 The description of a marking menu, as provided to {@link createModel}.
 */
export type MarkingMenuInput = {
  /**
  The menu's top level items.
  */
  readonly items: readonly MarkingMenuItemInput[];
};

/* -------------------------------------------------------------------------- *
 * Model
 * -------------------------------------------------------------------------- */

/**
 Precise methods and properties added to nodes derived from menu inputs.
 */
export type MenuNode<Items extends readonly unknown[]> = {
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
  /**
  Find the sub-item whose angle is the closest to a given angle.
  */
  getNearestChild(
    angle: number,
  ): IfLeaf<IsLeaf<Items>, undefined, Items[number]>;
  /**
  The maximum depth of the menu below this node.
  */
  getMaxDepth(): IfLeaf<IsLeaf<Items>, 0, number>;
  /**
  The maximum breadth of the menu below this node.
  */
  getMaxBreadth(): IfLeaf<IsLeaf<Items>, 0, number>;
};

/**
 `getChild` accepts the ids of the sub-items it can actually find. When the
 sub-items are not a tuple — a menu built at runtime — the ids are unknown, so
 it falls back to accepting any string and possibly returning `undefined`.
 */
type GetChild<Items extends readonly unknown[]> =
  IsTuple<Items> extends true
    ? <Id extends LiteralIds<Items>>(
        childId: Id,
      ) => Extract<Items[number], { id: Id }>
    : (childId: string) => Items[number] | undefined;

/**
 A node of the model that the caller described: it carries back the id and the
 label it was given, plus the angle the menu laid it out at.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- interfaces allow self-referential tree types without circular alias errors.
export interface ModelItem<
  Id extends string | undefined = string | undefined,
  Label extends string = string,
  Items extends readonly unknown[] = readonly unknown[],
  Parent extends ModelNode = ModelNode,
> {
  /**
  The item's id, as provided by the caller (`undefined` if it had none).
  */
  readonly id: Id;
  /**
  The item's label.
  */
  readonly label: Label;
  /**
  The item's angle, in degrees.
  */
  readonly angle: number;
  /**
  Items are never the root of the menu.
  */
  readonly isRoot: false;
  /**
   The item's library-assigned positional key (e.g. `"1-0-2"`), unique across
   the whole menu. Unlike `id`, it is never provided by the caller.
   */
  readonly key: string;
  /**
  The node one level up.
  */
  readonly parent: Parent;
  /**
  The node's direct sub-items.
  */
  readonly items: Items;
  /**
   Whether the node has no sub-item.
   */
  readonly isLeaf: IsLeaf<Items>;
  getNearestChild(
    angle: number,
  ): IfLeaf<
    IsLeaf<Items>,
    undefined,
    Items[number] extends ModelItem<any, any, any, any>
      ? Items[number]
      : ModelItem
  >;
  /**
  The maximum depth of the menu below this node.
  */
  getMaxDepth(): IfLeaf<IsLeaf<Items>, 0, number>;
  /**
  The maximum breadth of the menu below this node.
  */
  getMaxBreadth(): IfLeaf<IsLeaf<Items>, 0, number>;
  /**
  The smallest angular gap between neighboring items in the menu.
  */
  getMinAngularGap(): number;
}

/**
 The root of the model. Unlike items, it has no id, label nor angle.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- interfaces allow self-referential tree types without circular alias errors.
export interface ModelRoot<
  Items extends readonly unknown[] = readonly unknown[],
> {
  readonly isRoot: true;
  readonly parent: undefined;
  /**
  The node's direct sub-items.
  */
  readonly items: Items;
  /**
   Whether the node has no sub-item.
   */
  readonly isLeaf: IsLeaf<Items>;
  getNearestChild(
    angle: number,
  ): IfLeaf<
    IsLeaf<Items>,
    undefined,
    Items[number] extends ModelItem<any, any, any, any>
      ? Items[number]
      : ModelItem
  >;
  /**
  The maximum depth of the menu below this node.
  */
  getMaxDepth(): IfLeaf<IsLeaf<Items>, 0, number>;
  /**
  The maximum breadth of the menu below this node.
  */
  getMaxBreadth(): IfLeaf<IsLeaf<Items>, 0, number>;
  /**
  The smallest angular gap between neighboring items in the menu.
  */
  getMinAngularGap(): number;
}

/**
 A terminal item in the menu tree with no sub-items.
 */
export type ModelLeaf = ModelItem & { readonly isLeaf: true };

type ModelMenuItem = ModelItem & { readonly isLeaf: false };

/**
 A node in the marking menu tree: either the root or an item, discriminated by
 `isRoot` and `isLeaf`.
 */
export type ModelNode = ModelRoot | ModelLeaf | ModelMenuItem;

/**
 A node that can hold sub-items: either the root or a submenu item.
 */
export type ModelMenu = ModelRoot | ModelMenuItem;

/* -------------------------------------------------------------------------- *
 * Generic node walking
 * -------------------------------------------------------------------------- */

/**
 Every node of the (sub-)tree rooted at `Node`, including `Node` itself: `Node` and,
 recursively, every one of its descendants. Recursion is guarded on
 {@link IsTuple}: for a menu built at runtime (a non-literal `items` list),
 the item type is already the same for every item in the (sub-)tree, so it
 includes that type without recursing forever.
 */
export type ModelNodes<Node extends ModelNode> = Node extends {
  items: infer Items extends readonly unknown[];
}
  ? IsTuple<Items> extends true
    ? Node | ModelNodes<Extract<Items[number], ModelNode>>
    : Node | Extract<Items[number], ModelNode>
  : Node;

/**
Every node of the (sub-)tree rooted at `Node`, excluding the root.
*/
export type ModelItems<Node extends ModelNode> = Exclude<
  ModelNodes<Node>,
  { isRoot: true }
>;

/**
 Every leaf of the (sub-)tree rooted at `Node`.
 */
export type ModelLeaves<Node extends ModelNode> =
  ModelItems<Node> extends infer Item
    ? Item extends { isLeaf: false }
      ? never
      : boolean extends (Item extends { isLeaf: infer L } ? L : never)
        ? Item & { readonly isLeaf: true }
        : Item
    : never;

/**
 Every non-leaf node of the (sub-)tree rooted at `Node`, root included.
 */
export type ModelMenus<Node extends ModelNode> =
  ModelNodes<Node> extends infer Member
    ? Member extends ModelNode
      ? Member['isRoot'] extends true
        ? Member
        : Member extends { isLeaf: true }
          ? never
          : boolean extends (Member extends { isLeaf: infer L } ? L : never)
            ? Member & { readonly isLeaf: false }
            : Member
      : never
    : never;

/* -------------------------------------------------------------------------- *
 * Helpers
 * -------------------------------------------------------------------------- */

/**
 Whether an item list makes its owner a leaf. `boolean` when the list's length
 is not statically known.
 */
export type IsLeaf<Items extends readonly unknown[]> = Items['length'] extends 0
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

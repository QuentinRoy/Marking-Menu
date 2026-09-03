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
 What the root and the items of the model have in common.
 */
type MenuNode<Items extends readonly unknown[]> = {
  /**
  The node's direct sub-items.
  */
  readonly items: Items;
  /**
  Whether the node has no sub-item.
  */
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
  /**
  Find the sub-item whose angle is the closest to a given angle.
  */
  getNearestChild(angle: number): IfLeaf<IsLeaf<Items>, null, Items[number]>;
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
  Id extends string | undefined = string | undefined,
  Label extends string = string,
  Items extends readonly unknown[] = readonly unknown[],
> = MenuNode<Items> & {
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
};

/**
 The root of the model. Unlike items, it has no id, label nor angle.
 */
export type ModelRoot<Items extends readonly unknown[] = readonly unknown[]> =
  MenuNode<Items> & {
    readonly isRoot: true;
    /**
     The root has no parent: it is never nested within another node.
     */
    readonly parent: null;
  };

/**
 The members of a model node that a caller can use without knowing the
 literal ids described in a specific menu: `getChild` and `getChildrenByLabel`
 are excluded, as `getChild`'s overload is only sound for the exact tuple type
 it was built from. `items` is kept — its element type is the same
 self-referential erased shape, not the literal tuple — so that
 {@link MarkingMenuModelItem} satisfies {@link AnyModelNode}.
 */
type GenericNodeKeys =
  | 'isLeaf'
  | 'isRoot'
  | 'items'
  | 'getNearestChild'
  | 'getMaxDepth'
  | 'getMaxBreadth';

/**
 The shape of a model node — root or item — for callers that walk the model
 generically rather than through the literal ids described in a specific menu.

 `parent` is added outside of {@link GenericNodeKeys}: `ModelItem` itself has
 no such field — a literal-preserving `parent` is exactly the type-level
 problem this file works around (see {@link AnyModelNode} and how
 {@link MarkingMenuModel} builds it) — so each variant states its own erased
 `parent` type directly. An item's parent is always some node of this same
 union; the root's is always `null`.
 */
export type MarkingMenuModelItem =
  | (Pick<
      ModelItem<string | undefined, string, readonly MarkingMenuModelItem[]>,
      GenericNodeKeys
    > & { readonly parent: MarkingMenuModelItem })
  | (Pick<ModelRoot<readonly MarkingMenuModelItem[]>, GenericNodeKeys> & {
      readonly parent: null;
    });

/* -------------------------------------------------------------------------- *
 * Generic node walking
 * -------------------------------------------------------------------------- */

/**
 The shape of a model node — root or item — precise enough to walk the model
 generically while keeping `getNearestChild` sound: unlike
 {@link MarkingMenuModelItem}, its return type is tied to the node's own
 `items` via a polymorphic `this`, so a generic node's nearest child resolves
 to that node's own item type instead of the erased one.

 Declared as an interface (not a type alias) because polymorphic `this` is
 only available on interfaces and classes.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- see above.
export interface AnyModelNode {
  readonly isLeaf: boolean;
  readonly isRoot: boolean;
  readonly items: readonly AnyModelNode[];
  /**
   The node one level up, or `null` for the root. Erased, like `items`: the
   precise, literal-preserving parent lives on the model {@link createModel}
   returns, not on this generic shape.
   */
  readonly parent: AnyModelNode | null;
  getNearestChild(angle: number): this['items'][number] | null;
  getMaxDepth(): number;
  getMaxBreadth(): number;
}

/**
 Every node of the (sub-)tree rooted at `N`, including `N` itself: `N` and,
 recursively, every one of its descendants. Recursion is guarded on
 {@link IsTuple}: for a menu built at runtime (a non-literal `items` list),
 the item type is already the same for every item in the (sub-)tree, so it
 includes that type without recursing forever.
 */
export type ModelNodes<N extends AnyModelNode> = N extends {
  items: infer I extends readonly AnyModelNode[];
}
  ? IsTuple<I> extends true
    ? N | ModelNodes<I[number]>
    : N | I[number]
  : N;

/**
Every node of the (sub-)tree rooted at `N`, excluding the root.
*/
export type ModelItems<N extends AnyModelNode> = Exclude<
  ModelNodes<N>,
  { isRoot: true }
>;

/**
Every leaf of the (sub-)tree rooted at `N`.
*/
export type ModelLeaves<N extends AnyModelNode> = Extract<
  ModelItems<N>,
  { isLeaf: true }
>;

/**
Every non-leaf node of the (sub-)tree rooted at `N`, root included.
*/
export type ModelMenus<N extends AnyModelNode> = Extract<
  ModelNodes<N>,
  { isLeaf: false }
>;

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

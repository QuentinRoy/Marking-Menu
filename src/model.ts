import type {
  LiteralId,
  MarkingMenuInput,
  MarkingMenuItemInput,
  MarkingMenuModelItem,
  ModelItem,
  ModelRoot,
} from './types.js';
import { deltaAngle, type EmptyTuple, type IsTuple } from './utils.js';

/*
 The marking menu model.

 `createModel` is generic over the (literal) menu description it receives: the
 shape of the returned model — the items' ids and labels, whether an item is a
 leaf, which ids `getChild` accepts — is derived from that description at the
 type level. Items lists that are not literal tuples (a menu built at runtime)
 degrade gracefully to the loose, non-generic types.
 */

/* -------------------------------------------------------------------------- *
 * Type level helpers
 * -------------------------------------------------------------------------- */

/**
   Whether `Ids` contains the (single) id `Id`. `never` is contained by nothing.
   */
type Includes<Id, Ids> = [Id] extends [never]
  ? false
  : [Id] extends [Ids]
    ? true
    : false;

/* -------------------------------------------------------------------------- *
 * Input validation
 * -------------------------------------------------------------------------- */

/**
 The type a menu description is intersected with when two of its items share an
 id. The description is not assignable to it, which turns the duplicate into a
 compile error naming the offending id.
 */
type DuplicateItemIdsError<Id extends string> = {
  readonly 'Error: menu item ids must be unique across the whole menu': Id;
};

/**
 Every statically known id of an item list, and of its sub-items, flattened in
 the order they are described. Items whose id is unknown are skipped.
 */
type AllIds<Items extends readonly MarkingMenuItemInput[]> =
  Items extends readonly [
    infer Head,
    ...infer Rest extends readonly MarkingMenuItemInput[],
  ]
    ? [...OwnId<Head>, ...SubIds<Head>, ...AllIds<Rest>]
    : EmptyTuple;

/**
The id of an item as a (possibly empty) list.
*/
type OwnId<Item> = [LiteralId<Item>] extends [never]
  ? EmptyTuple
  : [LiteralId<Item>];

/**
Every statically known id below an item.
*/
type SubIds<Item> = Item extends {
  items: infer SubItems extends readonly MarkingMenuItemInput[];
}
  ? AllIds<SubItems>
  : EmptyTuple;

/**
 The first id `Ids` holds more than once, or `never` if they are all unique.
 */
type DuplicateId<Ids extends readonly string[]> = Ids extends readonly [
  infer Head extends string,
  ...infer Rest extends readonly string[],
]
  ? Includes<Head, Rest[number]> extends true
    ? Head
    : DuplicateId<Rest>
  : never;

/**
 What a menu description must additionally satisfy, as a type to intersect the
 input with: `unknown` where everything is fine, an error type where it is not.
 */
export type ValidateInput<Input extends MarkingMenuInput> = RejectDuplicate<
  DuplicateId<AllIds<Input['items']>>
>;

type RejectDuplicate<Duplicate extends string> = [Duplicate] extends [never]
  ? unknown
  : DuplicateItemIdsError<Duplicate>;

/**
The id an input item resolves to.
*/
type IdOf<Input> = Input extends { id: infer Id extends string }
  ? Id
  : undefined;

/**
The sub-items an input item resolves to.
*/
type ItemsOf<Input> = Input extends {
  items: infer Items extends readonly MarkingMenuItemInput[];
}
  ? Items
  : EmptyTuple;

/**
 The raw description of the item at `Path` within `Items`, `Path`'s segments
 being the index to follow at each level, from `Items` down to the item
 itself. `Path` must be non-empty: the root has no input counterpart to look
 up — it *is* {@link MarkingMenuModel}'s `Root`, as a whole.
 */
type InputAt<
  Items extends readonly MarkingMenuItemInput[],
  Path extends readonly [number, ...number[]],
> = Path extends readonly [
  infer Head extends number,
  ...infer Tail extends readonly number[],
]
  ? Items[Head] extends infer Item extends MarkingMenuItemInput
    ? Tail extends readonly [number, ...number[]]
      ? InputAt<ItemsOf<Item>, Tail>
      : Item
    : never
  : never;

/**
 The model items built for `Inputs`, the sub-items of the node at
 `ParentPath` within `Root`.

 Built by real recursion — peeling `Inputs` one element at a time while
 growing `Index` in lockstep, so each child's own path is a distinct literal
 tuple — rather than a mapped type over `keyof Inputs`: that would substitute
 the generic `number` into every child's path alike, collapsing them all into
 one node whose `id` is the union of its siblings' rather than each child's
 own.

 Guarded on {@link IsTuple}: a menu built at runtime has a non-literal
 `items` list, whose length — and hence every descendant's path — is not
 statically known, so it degrades to {@link ToItems} instead of recursing
 forever. The guard has to stay at this one level, rather than have
 {@link ToItems} recurse back into `ItemsAt`: `Root`/`Path` become
 meaningless once a list's length isn't known, and — because `Inputs` can
 itself be a still-unresolved generic (e.g. a menu config not yet narrowed
 to a literal type) — the compiler must be able to check *both* branches
 structurally without one poisoning the other with an unresolvable `Root`.
 */
type ItemsAt<
  Root extends MarkingMenuInput,
  ParentPath extends readonly number[],
  Inputs extends readonly MarkingMenuItemInput[],
  Index extends readonly unknown[] = EmptyTuple,
> = IsTuple<Inputs> extends true
  ? Inputs extends readonly [
      infer _Head,
      ...infer Rest extends readonly MarkingMenuItemInput[],
    ]
    ? readonly [
        NodeAt<Root, readonly [...ParentPath, Index['length']]>,
        ...ItemsAt<Root, ParentPath, Rest, readonly [...Index, unknown]>,
      ]
    : EmptyTuple
  : ToItems<Inputs>;

/**
 The model items an input item list resolves to when its length is not
 statically known — a menu, or a portion of one, built at runtime.
 */
type ToItems<Inputs extends readonly MarkingMenuItemInput[]> = {
  [K in keyof Inputs]: ToItem<Inputs[K]>;
};

/**
 The model item an input item resolves to, without a `Root`/`Path` to derive
 a precise `parent` from, so `parent` widens to the generic, erased
 {@link MarkingMenuModelItem} — the same degradation a dynamic list's
 element type already undergoes for `id`, `label` and `items`.
 */
type ToItem<Input> = Input extends MarkingMenuItemInput
  ? ModelItem<IdOf<Input>, Input['label'], ToItems<ItemsOf<Input>>> & {
      readonly parent: MarkingMenuModelItem;
    }
  : never;

/**
 The node the model built from `Root` has at `Path`: the root itself for an
 empty path, or the item found by following `Path`'s indices otherwise.

 Parameterizing by `Root` and a `Path` locating the node within it — rather
 than by the node's own literal shape, the way {@link ModelItem} is — is what
 lets an item carry a precise `parent` without the type referencing itself:
 the parent is the very same lookup with the last path segment dropped, so
 node and parent are both *derived*, independently, from the one acyclic
 `Root`, instead of one being defined in terms of the other.
 */
type NodeAt<
  Root extends MarkingMenuInput,
  Path extends readonly number[],
> = Path extends readonly [number, ...number[]]
  ? InputAt<Root['items'], Path> extends infer Input extends
      MarkingMenuItemInput
    ? ModelItem<
        IdOf<Input>,
        Input['label'],
        ItemsAt<Root, Path, ItemsOf<Input>>
      > & { readonly parent: ParentAt<Root, Path> }
    : never
  : ModelRoot<ItemsAt<Root, EmptyTuple, Root['items']>>;

/**
 The parent of the node at (non-empty) `Path`: the node one path segment up.
 */
type ParentAt<
  Root extends MarkingMenuInput,
  Path extends readonly [number, ...number[]],
> = Path extends readonly [...infer Init extends readonly number[], number]
  ? NodeAt<Root, Init>
  : never;

/**
 The model {@link createModel} builds from a menu description.
 */
export type MarkingMenuModel<Input extends MarkingMenuInput> = NodeAt<
  Input,
  EmptyTuple
>;

/* -------------------------------------------------------------------------- *
 * Implementation
 * -------------------------------------------------------------------------- */

const getAngleRange = (items: readonly unknown[]): number =>
  items.length > 4 ? 45 : 90;

/**
 The behavior shared by the root of the menu and its items.

 The implementation classes are deliberately loosely typed: the precise types
 are re-attached once, in {@link createModel}.
 */
abstract class MarkingMenuNode {
  readonly #items: readonly MarkingMenuItem[];
  readonly #parent: MarkingMenuNode | null;

  constructor({
    parent,
    items,
  }: {
    parent: MarkingMenuNode | null;
    /**
     Builds the node's items, given the node itself: sub-items need their
     parent to exist before they can be created, so the node is constructed
     first and its items second, the reverse of the previous, child-first
     order.
     */
    items: (self: MarkingMenuNode) => readonly MarkingMenuItem[];
  }) {
    this.#parent = parent;
    this.#items = items(this);
  }

  get items(): readonly MarkingMenuItem[] {
    return this.#items;
  }

  get parent(): MarkingMenuNode | null {
    return this.#parent;
  }

  get isLeaf(): boolean {
    return this.#items.length === 0;
  }

  abstract get isRoot(): boolean;

  /**
   Retrieve a direct sub-item by its id.

   @param childId - The identifier of the sub-item to look for.
   @returns The sub-item with the id `childId`, or `null` if there is none.
   */
  getChild(childId: string): MarkingMenuItem | null {
    return this.#items.find((item) => item.id === childId) ?? null;
  }

  /**
   Retrieve every direct sub-item matching a given label.

   @param childLabel - The label of the sub-items to look for.
   @returns The sub-items with the label `childLabel`.
   */
  getChildrenByLabel(childLabel: string): MarkingMenuItem[] {
    return this.#items.filter((item) => item.label === childLabel);
  }

  /**
   Find the sub-item whose angle is the closest to a given angle.

   @param angle - The angle to compare the sub-items against.
   @returns The closest sub-item to the angle `angle`, or `null` if the node
   has no sub-item.
   */
  getNearestChild(angle: number): MarkingMenuItem | null {
    const [firstItem, ...otherItems] = this.#items;
    if (firstItem === undefined) {
      return null;
    }

    let nearest = firstItem;
    let nearestDelta = Math.abs(deltaAngle(nearest.angle, angle));
    for (const item of otherItems) {
      const delta = Math.abs(deltaAngle(item.angle, angle));
      if (delta < nearestDelta) {
        nearest = item;
        nearestDelta = delta;
      }
    }

    return nearest;
  }

  /**
   Compute the maximum depth of the menu below this node.

   @returns The maximum depth of the menu.
   */
  getMaxDepth(): number {
    let depth = 0;
    for (const item of this.#items) {
      depth = Math.max(depth, item.getMaxDepth() + 1);
    }

    return depth;
  }

  /**
   Compute the maximum breadth of the menu below this node.

   @returns The maximum breadth of the menu.
   */
  getMaxBreadth(): number {
    let breadth = this.#items.length;
    for (const item of this.#items) {
      breadth = Math.max(breadth, item.getMaxBreadth());
    }

    return breadth;
  }
}

/**
 One entry of a menu level: it holds the id and label it was described with,
 and the angle it was laid out at, on top of its own sub-items.
 */
class MarkingMenuItem extends MarkingMenuNode {
  readonly #id: string | undefined;
  readonly #label: string;
  readonly #angle: number;
  readonly #key: string;

  constructor({
    id,
    label,
    angle,
    key,
    parent,
    items,
  }: {
    id: string | undefined;
    label: string;
    angle: number;
    key: string;
    parent: MarkingMenuNode;
    items: (self: MarkingMenuNode) => readonly MarkingMenuItem[];
  }) {
    super({ parent, items });
    this.#id = id;
    this.#label = label;
    this.#angle = angle;
    this.#key = key;
  }

  get id(): string | undefined {
    return this.#id;
  }

  get label(): string {
    return this.#label;
  }

  get angle(): number {
    return this.#angle;
  }

  get key(): string {
    return this.#key;
  }

  override get isRoot(): false {
    return false;
  }
}

/**
 The top level of the menu: it holds the first items the user can select, but
 is not selectable itself, hence has neither id, label nor angle.
 */
class MarkingMenuRoot extends MarkingMenuNode {
  override get isRoot(): true {
    return true;
  }
}

/**
 Build the (frozen) item list of one menu level.

 @param inputs - The description of the level's items.
 @param parent - The level's own node, i.e. the items' parent.
 @param seenIds - The ids already used elsewhere in the menu. Mutated as the
 items are created.
 @param baseKey - The generated key of the parent level, if any. Joined with
 each item's index to derive its own key.
 @returns The level's model items.
 @throws If an item reuses an id. Duplicates are a compile error for a menu
 described literally, but ids are only known at runtime for a menu built
 dynamically.
 */
const createItems = (
  inputs: readonly MarkingMenuItemInput[],
  parent: MarkingMenuNode,
  seenIds: Set<string> = new Set(),
  baseKey?: string,
): readonly MarkingMenuItem[] => {
  const angleRange = getAngleRange(inputs);
  return Object.freeze(
    inputs.map((input, index) => {
      if (input.id !== undefined) {
        if (seenIds.has(input.id)) {
          throw new Error(
            `Menu item ids must be unique across the whole menu, but "${input.id}" is used more than once.`,
          );
        }

        seenIds.add(input.id);
      }

      const key = baseKey === undefined ? `${index}` : `${baseKey}-${index}`;

      return new MarkingMenuItem({
        id: input.id,
        label: input.label,
        angle: index * angleRange,
        key,
        parent,
        items: (self) =>
          input.items
            ? createItems(input.items, self, seenIds, key)
            : Object.freeze([]),
      });
    }),
  );
};

/**
 Create the marking menu model.

 @param input - The description of the menu.
 @returns The root of the model.
 @throws If two items share the same id.
 */
export function createModel<const Input extends MarkingMenuInput>(
  input: Input & ValidateInput<Input>,
): MarkingMenuModel<Input> {
  // The model is assembled from runtime lists, which cannot carry the tuple
  // types `MarkingMenuModel` derives from the (literal) description. This is
  // the single point where the precise types are re-attached to the loosely
  // typed implementation classes.
  return new MarkingMenuRoot({
    parent: null,
    items: (self) => createItems(input.items, self),
  }) as unknown as MarkingMenuModel<Input>;
}

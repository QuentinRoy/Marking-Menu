import type {
  LiteralId,
  MarkingMenuInput,
  MarkingMenuItemInput,
  ModelItem,
  ModelRoot,
} from './types.js';
import { deltaAngle, type EmptyTuple } from './utils.js';

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

/** The id of an item as a (possibly empty) list. */
type OwnId<Item> = [LiteralId<Item>] extends [never]
  ? EmptyTuple
  : [LiteralId<Item>];

/** Every statically known id below an item. */
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
type ValidateInput<Input extends MarkingMenuInput> = RejectDuplicate<
  DuplicateId<AllIds<Input['items']>>
>;

type RejectDuplicate<Duplicate extends string> = [Duplicate] extends [never]
  ? unknown
  : DuplicateItemIdsError<Duplicate>;

/** The id an input item resolves to. */
type IdOf<Input> = Input extends { id: infer Id extends string }
  ? Id
  : undefined;

/** The sub-items an input item resolves to. */
type ItemsOf<Input> = Input extends {
  items: infer Items extends readonly MarkingMenuItemInput[];
}
  ? Items
  : EmptyTuple;

/** The model items an input item list resolves to. */
type ToItems<Inputs extends readonly MarkingMenuItemInput[]> = {
  [K in keyof Inputs]: ToItem<Inputs[K]>;
};

/** The model item an input item resolves to. */
type ToItem<Input> = Input extends MarkingMenuItemInput
  ? ModelItem<IdOf<Input>, Input['label'], ToItems<ItemsOf<Input>>>
  : never;

/**
 The model {@link createModel} builds from a menu description.
 */
export type MarkingMenuModel<Input extends MarkingMenuInput> = ModelRoot<
  ToItems<Input['items']>
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

  constructor(items: readonly MarkingMenuItem[]) {
    this.#items = items;
  }

  get items(): readonly MarkingMenuItem[] {
    return this.#items;
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

  constructor({
    id,
    label,
    angle,
    items,
  }: {
    id: string | undefined;
    label: string;
    angle: number;
    items: readonly MarkingMenuItem[];
  }) {
    super(items);
    this.#id = id;
    this.#label = label;
    this.#angle = angle;
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
 @param seenIds - The ids already used elsewhere in the menu. Mutated as the
 items are created.
 @returns The level's model items.
 @throws If an item reuses an id. Duplicates are a compile error for a menu
 described literally, but ids are only known at runtime for a menu built
 dynamically.
 */
const createItems = (
  inputs: readonly MarkingMenuItemInput[],
  seenIds: Set<string>,
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

      return new MarkingMenuItem({
        id: input.id,
        label: input.label,
        angle: index * angleRange,
        items: input.items
          ? createItems(input.items, seenIds)
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
export default function createModel<const Input extends MarkingMenuInput>(
  input: Input & ValidateInput<Input>,
): MarkingMenuModel<Input> {
  // The model is assembled from runtime lists, which cannot carry the tuple
  // types `MarkingMenuModel` derives from the (literal) description. This is
  // the single point where the precise types are re-attached to the loosely
  // typed implementation classes.
  return new MarkingMenuRoot(
    createItems(input.items, new Set()),
  ) as unknown as MarkingMenuModel<Input>;
}

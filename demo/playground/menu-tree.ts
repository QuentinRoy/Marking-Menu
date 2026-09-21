import type {
  MarkingMenuInput,
  MarkingMenuItemInput,
  ModelNode,
} from 'marking-menu';

/*
 Plain navigation over the menu as JSON, the same shape `createMarkingMenu`
 itself accepts, plus reading a path back off a live menu's own `parent`
 chain. Nothing here builds a model of its own: there is nothing here that
 could drift from what the library builds.
 */

function childrenOf(
  item: MarkingMenuItemInput,
): readonly MarkingMenuItemInput[] {
  return item.items ?? [];
}

/**
 Follow `path` down from `menu`'s root, one index per level.

 @param menu - The menu to walk.
 @param path - The index to follow at each level.
 @returns The items at that level, or the root's if the path no longer
 resolves, e.g. the item at that index was just edited away.
 */
export function itemsAt(
  menu: MarkingMenuInput,
  path: readonly number[],
): readonly MarkingMenuItemInput[] {
  let { items } = menu;
  for (const index of path) {
    const next: MarkingMenuItemInput | undefined = items[index];
    if (next === undefined) {
      return menu.items;
    }

    items = childrenOf(next);
  }

  return items;
}

/**
 The subtree of `menu` rooted at `path`, as a menu of its own.

 @param menu - The menu to walk.
 @param path - The index to follow at each level.
 @returns A menu whose top level is the items at `path`.
 */
export function subtreeAt(
  menu: MarkingMenuInput,
  path: readonly number[],
): MarkingMenuInput {
  return { items: itemsAt(menu, path) };
}

/**
 A step of a path through the menu, as the footer's chips and breadcrumb
 show it.
 */
export type MenuStep = {
  readonly label: string;
  /**
  The path from the root down to this step, for a control that jumps to it.
  */
  readonly path: readonly number[];
  readonly isLeaf: boolean;
};

/**
 Name every step along `path`.

 @param menu - The menu to walk.
 @param path - The index to follow at each level.
 @returns One step per level, stopping early if the path no longer resolves.
 */
export function stepsAlong(
  menu: MarkingMenuInput,
  path: readonly number[],
): MenuStep[] {
  const steps: MenuStep[] = [];
  let { items } = menu;
  for (const index of path) {
    const next: MarkingMenuItemInput | undefined = items[index];
    if (next === undefined) {
      break;
    }

    steps.push({
      label: next.label === '' ? '(untitled)' : next.label,
      path: path.slice(0, steps.length + 1),
      isLeaf: childrenOf(next).length === 0,
    });
    items = childrenOf(next);
  }

  return steps;
}

/**
 Read a node's position in its own menu off the library's own `parent`
 chain, one index per level: the sibling index the node has in `parent.items`,
 for each ancestor up to the root of the tree `node` belongs to.

 Positional by construction, the same way the library assigns each node's key
 (see `src/model.ts`), which is what lets an event from a live menu address an
 item in the raw menu this page built it from.

 @param node - A node from a marking menu event, e.g. `event.menu` or
 `event.selection`.
 @returns One index per level, from the top down.
 */
export function pathToNode(node: ModelNode): number[] {
  const path: number[] = [];
  let current = node;
  while (current.parent !== undefined) {
    path.unshift(current.parent.items.indexOf(current));
    current = current.parent;
  }

  return path;
}

import type {
  MarkingMenuInput,
  MarkingMenuItemInput,
  ModelNode,
} from 'marking-menu';

/*
 Navigates the menu as plain JSON — no model of its own, so nothing here can
 drift from what the library builds.
 */

function childrenOf(
  item: MarkingMenuItemInput,
): readonly MarkingMenuItemInput[] {
  return item.items ?? [];
}

/**
 Items at `path`, or the root's if it no longer resolves (e.g. the item
 there was just edited away).
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
*/
export function subtreeAt(
  menu: MarkingMenuInput,
  path: readonly number[],
): MarkingMenuInput {
  return { items: itemsAt(menu, path) };
}

/**
One step of a path, as the footer's chips and breadcrumb show it.
*/
export type MenuStep = {
  readonly label: string;
  /**
  Path to this step, for jumping to it.
  */
  readonly path: readonly number[];
  readonly isLeaf: boolean;
};

/**
One step per level of `path`, stopping early if it no longer resolves.
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
 A node's path, read off the library's own `parent` chain rather than
 tracked separately: its sibling index in `parent.items`, root to node.
 Positional by construction, like the library's own keys (`src/model.ts`),
 which is what lets an event address an item in the raw menu this page
 built it from.
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

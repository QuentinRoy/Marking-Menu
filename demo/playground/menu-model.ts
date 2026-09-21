import { createModel } from '../../src/model.js';
import type { MarkingMenuInput } from '../../src/types.js';

/*
 The page builds the library's own model from the edited menu, and reads the
 layout, the breadcrumb and the recognizer's readout off it. It is the same
 call `createMarkingMenu` makes internally, so what the page shows and what a
 gesture does can never drift apart.

 `createModel` is not on `src/index.ts`, and is not meant to be: a menu built
 for someone else's project never holds a model of its own. This page is not
 someone else's project. It ships from this repository, alongside the code it
 reaches for, so it takes the internal path here and everywhere else it needs
 one, rather than widening what the package promises.
 */

const build = (menu: MarkingMenuInput) => createModel(menu);

/**
The model of a menu described at runtime, as this page builds it.
*/
export type MenuModel = ReturnType<typeof build>;

/**
One item of that model.
*/
export type MenuModelItem = MenuModel['items'][number];

/**
Either end of the model: the root, or one of its items.
*/
export type MenuModelNode = MenuModel | MenuModelItem;

/**
 What {@link buildMenuModel} made of a menu.
 */
export type MenuModelResult =
  | { readonly ok: true; readonly model: MenuModel }
  | { readonly ok: false; readonly message: string };

/**
 Build the model of a menu.

 The schema cannot express that ids are unique across the whole menu, so
 `createModel` is the only thing that catches a duplicate, and it does so by
 throwing. That is a menu the page can report on, not a crash.

 @param menu - The menu to build.
 @returns The model, or the message explaining why there is none.
 */
export function buildMenuModel(menu: MarkingMenuInput): MenuModelResult {
  try {
    return { ok: true, model: build(menu) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 Follow `path` down from the model's root, one index per level.

 @param model - The model to walk.
 @param path - The index to follow at each level.
 @returns The node reached, or the root if the path no longer resolves, e.g.
 the item at that index was just edited away.
 */
export function nodeAt(
  model: MenuModel,
  path: readonly number[],
): MenuModelNode {
  let node: MenuModelNode = model;
  for (const index of path) {
    const next: MenuModelItem | undefined = node.items[index];
    if (next === undefined) {
      return model;
    }

    node = next;
  }

  return node;
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

 @param model - The model to walk.
 @param path - The index to follow at each level.
 @returns One step per level, stopping early if the path no longer resolves.
 */
export function stepsAlong(
  model: MenuModel,
  path: readonly number[],
): MenuStep[] {
  const steps: MenuStep[] = [];
  let node: MenuModelNode = model;
  for (const index of path) {
    const next: MenuModelItem | undefined = node.items[index];
    if (next === undefined) {
      break;
    }

    steps.push({
      label: next.label === '' ? '(untitled)' : next.label,
      path: path.slice(0, steps.length + 1),
      isLeaf: next.isLeaf,
    });
    node = next;
  }

  return steps;
}

/**
 A node with the same parent/items shape as this page's own {@link
 MenuModelNode}: the root, or one of its (possibly deeply nested) items.
 */
type ParentedNode = {
  readonly parent: ParentedNode | undefined;
  readonly items: readonly unknown[];
};

/**
 Read a node's position in its own model, one index per level, by climbing
 its `parent` chain and locating each step in `parent.items`.

 Nodes are positional by construction (see `src/model.ts`), which is what
 lets a node from the live menu's own model — e.g. the leaf off a `select`
 event — address the same position in the model this page built from the
 same description.

 @param node - The node whose path to read.
 @returns One index per level, from the top down.
 */
export function pathOfNode(node: ParentedNode): number[] {
  const path: number[] = [];
  let current = node;
  while (current.parent !== undefined) {
    path.unshift(current.parent.items.indexOf(current));
    current = current.parent;
  }

  return path;
}

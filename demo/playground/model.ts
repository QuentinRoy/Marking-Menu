import { createModel } from '../../src/model.js';
import {
  toMarkingMenuItems,
  type BuilderItem,
  type ItemPath,
} from './menu-config.js';

/**
 Build the library's model from this page's editable tree. Shared by the
 preview (to draw a level) and the recognizer (to test a stroke against the
 whole tree), so the two always agree on what the current menu is.
 */
export const buildModel = (items: readonly BuilderItem[]) =>
  createModel({ items: toMarkingMenuItems(items) });

export type BuilderModel = ReturnType<typeof buildModel>;
export type BuilderModelItem = BuilderModel['items'][number];
export type BuilderModelNode = BuilderModel | BuilderModelItem;

/**
 Follow `path` down from `model`'s root, one index per level. Falls back to
 the root itself if `path` no longer resolves, e.g. the item at that index
 was just removed.
 */
export const nodeAt = (
  model: BuilderModel,
  path: ItemPath,
): BuilderModelNode => {
  let node: BuilderModelNode = model;
  for (const index of path) {
    const next: BuilderModelItem | undefined = node.items[index];
    if (next === undefined) {
      return model;
    }

    node = next;
  }

  return node;
};

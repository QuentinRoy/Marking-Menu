export {
  createMarkingMenu,
  type MarkingMenuConfig,
  type MarkingMenuLogger,
  type MarkingMenuNotification,
} from './marking-menu.js';
// `createModel` is deliberately not exported: callers never hold a model
// directly (see `MarkingMenuNotification`'s `menu`/`active`/`selection`
// fields), only its types.
export type { MarkingMenuModel } from './model.js';
export type {
  AnyModelNode,
  MarkingMenuInput,
  MarkingMenuItemInput,
  MarkingMenuModelItem,
  ModelItem,
  ModelItems,
  ModelLeaves,
  ModelMenus,
  ModelNodes,
  ModelRoot,
} from './types.js';

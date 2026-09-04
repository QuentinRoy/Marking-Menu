/*
 A consumer snippet typechecked against the package as actually published
 (see scripts/smoke-test.ts): resolved through node_modules by package name,
 public API surface that's easy to get wrong when re-exporting or packaging:
 generic inference, the compile-time duplicate-id check, and notification
 discrimination.
 */
import { createMarkingMenu } from 'marking-menu';
import type {
  AnyModelNode,
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuConfig,
  MarkingMenuController,
  MarkingMenuEvent,
  MarkingMenuEventBase,
  MarkingMenuEventEmitter,
  MarkingMenuEventMap,
  MarkingMenuInput,
  MarkingMenuItemInput,
  MarkingMenuLogger,
  MarkingMenuMode,
  MarkingMenuModel,
  MarkingMenuModelItem,
  MarkingMenuMoveEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
  ModelItem,
  ModelItems,
  ModelLeaves,
  ModelMenus,
  ModelNodes,
  ModelRoot,
  ReadonlyPoint,
} from 'marking-menu';

/*
 Every name `src/index.ts` exports, named again here: the published
 declarations are rolled up separately from the runtime bundle, so an export
 that never reaches them still typechecks everywhere else. Keep this in step
 with `src/index.ts` when adding a public export.
 */
export type PublicSurface = [
  typeof createMarkingMenu,
  AnyModelNode,
  MarkingMenuCancelEvent<AnyModelNode>,
  MarkingMenuChangeEvent<AnyModelNode>,
  MarkingMenuConfig,
  MarkingMenuController<AnyModelNode>,
  MarkingMenuEvent<AnyModelNode>,
  MarkingMenuEventBase,
  MarkingMenuEventEmitter<AnyModelNode>,
  MarkingMenuEventMap<AnyModelNode>,
  MarkingMenuInput,
  MarkingMenuItemInput,
  MarkingMenuLogger,
  MarkingMenuMode,
  MarkingMenuModel<MarkingMenuInput>,
  MarkingMenuModelItem,
  MarkingMenuMoveEvent<AnyModelNode>,
  MarkingMenuOpenEvent<AnyModelNode>,
  MarkingMenuSelectEvent<AnyModelNode>,
  MarkingMenuStartEvent,
  ModelItem,
  ModelItems<AnyModelNode>,
  ModelLeaves<AnyModelNode>,
  ModelMenus<AnyModelNode>,
  ModelNodes<AnyModelNode>,
  ModelRoot,
  ReadonlyPoint,
];

declare const parent: HTMLElement;

const mm = createMarkingMenu({
  items: [{ id: 'right', label: 'Right' }],
  parent,
});
mm.on('select', (event) => {
  const { id, isLeaf } = event.selection;
  const idIsNarrowed: 'right' = id;
  console.log(idIsNarrowed, isLeaf);
});
mm.on('open', (event) => {
  console.log(event.menu.items.length);
});
mm.dispose();

// Duplicate ids must be a compile error at the consumer call site too.
// @ts-expect-error -- two items share the id 'dup'.
createMarkingMenu({
  items: [
    { id: 'dup', label: 'A' },
    { id: 'dup', label: 'B' },
  ],
  parent,
});

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
  MarkingMenuConfig,
  MarkingMenuInput,
  MarkingMenuItemInput,
  MarkingMenuLogger,
  MarkingMenuModel,
  MarkingMenuModelItem,
  MarkingMenuNotification,
  ModelItem,
  ModelItems,
  ModelLeaves,
  ModelMenus,
  ModelNodes,
  ModelRoot,
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
  MarkingMenuConfig,
  MarkingMenuInput,
  MarkingMenuItemInput,
  MarkingMenuLogger,
  MarkingMenuModel<MarkingMenuInput>,
  MarkingMenuModelItem,
  MarkingMenuNotification,
  ModelItem,
  ModelItems<AnyModelNode>,
  ModelLeaves<AnyModelNode>,
  ModelMenus<AnyModelNode>,
  ModelNodes<AnyModelNode>,
  ModelRoot,
];

declare const parent: HTMLElement;

const menu$ = createMarkingMenu({
  items: [{ id: 'right', label: 'Right' }],
  parent,
});
menu$.subscribe((selection) => {
  const { id, isLeaf } = selection;
  const idIsNarrowed: 'right' = id;
  console.log(idIsNarrowed, isLeaf);
});

const notifications$ = createMarkingMenu({
  items: [{ id: 'right', label: 'Right' }],
  parent,
  notifySteps: true,
});
notifications$.subscribe((n) => {
  if (n.type === 'open') {
    console.log(n.menu.items.length);
  }

  console.log(n.type, n.mode);
});

// Duplicate ids must be a compile error at the consumer call site too.
// @ts-expect-error -- two items share the id 'dup'.
createMarkingMenu({
  items: [
    { id: 'dup', label: 'A' },
    { id: 'dup', label: 'B' },
  ],
  parent,
});

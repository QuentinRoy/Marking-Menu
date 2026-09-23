/*
 A consumer snippet typechecked against the package as actually published
 (see scripts/smoke-test.ts): resolved through node_modules by package name,
 public API surface that's easy to get wrong when re-exporting or packaging:
 generic inference, the compile-time duplicate-id check, and notification
 discrimination.
 */
import { createMarkingMenu } from 'marking-menu';
import type {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuConfig,
  MarkingMenuController,
  MarkingMenuEvent,
  MarkingMenuEventBase,
  MarkingMenuEventEmitter,
  MarkingMenuEventMap,
  MarkingMenuEventSource,
  MarkingMenuInput,
  MarkingMenuItemInput,
  MarkingMenuLogger,
  MarkingMenuMode,
  MarkingMenuModel,
  MarkingMenuMoveEvent,
  MarkingMenuOpenEvent,
  MarkingMenuOpenOptions,
  MarkingMenuRecognition,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
  MarkingMenuStrokeAnalysis,
  MarkingMenuStrokeSegment,
  ModelItem,
  ModelItems,
  ModelLeaf,
  ModelLeaves,
  ModelMenu,
  ModelMenus,
  ModelNode,
  ModelNodes,
  ModelRoot,
  Point,
} from 'marking-menu';

/*
 Every name `src/index.ts` exports, named again here: the published
 declarations are rolled up separately from the runtime bundle, so an export
 that never reaches them still typechecks everywhere else. Keep this in step
 with `src/index.ts` when adding a public export.
 */
export type PublicSurface = [
  typeof createMarkingMenu,
  MarkingMenuCancelEvent<ModelNode>,
  MarkingMenuChangeEvent<ModelNode>,
  MarkingMenuConfig,
  MarkingMenuController<ModelNode>,
  MarkingMenuEvent<ModelNode>,
  MarkingMenuEventBase,
  MarkingMenuEventEmitter<ModelNode>,
  MarkingMenuEventMap<ModelNode>,
  MarkingMenuEventSource,
  MarkingMenuInput,
  MarkingMenuItemInput,
  MarkingMenuLogger,
  MarkingMenuMode,
  MarkingMenuModel<MarkingMenuInput>,
  MarkingMenuMoveEvent<ModelNode>,
  MarkingMenuOpenEvent<ModelNode>,
  MarkingMenuOpenOptions,
  MarkingMenuRecognition,
  MarkingMenuSelectEvent<ModelNode>,
  MarkingMenuStartEvent,
  MarkingMenuStrokeAnalysis,
  MarkingMenuStrokeSegment,
  ModelItem,
  ModelItems<ModelNode>,
  ModelLeaf,
  ModelLeaves<ModelNode>,
  ModelMenu,
  ModelMenus<ModelNode>,
  ModelNode,
  ModelNodes<ModelNode>,
  ModelRoot,
  Point,
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
mm.on('cancel', (event) => {
  const source: MarkingMenuEventSource = event.source;
  if (event.mode === 'standalone') {
    // Standalone `position` is a point or `undefined`, not narrowed by `mode`.
    const position: Point | undefined = event.position;
    console.log(source, position);
  } else {
    const [x, y] = event.position;
    console.log(x, y);
  }
  const recognition: MarkingMenuRecognition | undefined = event.recognition;
  const analysis: MarkingMenuStrokeAnalysis | undefined = recognition?.analysis;
  const segment: MarkingMenuStrokeSegment | undefined = analysis?.segments[0];
  console.log(segment?.points);
});
const openOptions: MarkingMenuOpenOptions = { position: [0, 0], focus: false };
mm.open(openOptions);
mm.close();
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

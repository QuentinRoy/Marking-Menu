import { filter, map, share, type Observable } from 'rxjs';
import { connectLayout, type LayoutNotification } from './layout/connect.js';
import { createGestureFeedback } from './layout/gesture-feedback.js';
import {
  createMenu as createMenuLayout,
  type MenuLayoutModel,
} from './layout/menu.js';
import { createStrokeCanvas } from './layout/stroke.js';
import {
  createModel,
  type MarkingMenuModel,
  type ValidateInput,
} from './model.js';
import { pointerDrags } from './move/pointer-drag.js';
import { navigation } from './navigation/navigation.js';
import type {
  AnyModelNode,
  MarkingMenuInput,
  MarkingMenuItemInput,
  ModelItems,
  ModelLeaves,
  ModelMenus,
} from './types.js';
import { noOp, type Point } from './utils.js';

/**
 A notification as produced by the navigation/layout pipeline, before it is
 exported to the caller. Its shape is only loosely known here: it is threaded
 opaquely from the navigation engine through the layout connection, both of
 which attach whichever fields are relevant to the current step. The types of
 the navigation engine and the layout connection are not precise enough to
 express this directly (their notifications are discriminated unions keyed on
 `type`, so the fields carried alongside it vary per case), hence the two
 `as unknown as` conversions at the navigation/layout boundaries below.
 */
type RawNotification = {
  type?: string | undefined;
  mode?: string | undefined;
  position?: Point | undefined;
  active?: unknown;
  selection?: unknown;
  menu?: unknown;
  center?: Point | undefined;
  timeStamp?: number | undefined;
};

/**
 The loosely-typed shape {@link exportNotification} produces at runtime. The
 precise, discriminated {@link MarkingMenuNotification} the public API returns
 is re-attached once, via the documented cast in {@link createMarkingMenu}'s
 return statements — the same idiom `model.ts`'s `createModel` establishes.
 */
type RawExportedNotification = {
  type?: string | undefined;
  mode?: string | undefined;
  position?: Point | undefined;
  active?: unknown;
  selection?: unknown;
  menu?: unknown;
  menuCenter?: Point | undefined;
  timeStamp?: number | undefined;
};

/**
 A marking menu notification, as exported to the caller, discriminated on
 `type`. Verified against the navigation/layout emission sites (not by the
 compiler): {@link createMarkingMenu}'s runtime shape tests are load-bearing
 for this type, not decorative.
 */
export type MarkingMenuNotification<M extends AnyModelNode = AnyModelNode> =
  | { type: 'start'; mode: 'startup'; position?: Point; timeStamp?: number }
  | {
      type: 'draw';
      mode: 'startup' | 'expert';
      position: Point;
      timeStamp?: number;
    }
  | {
      type: 'open';
      mode: 'novice';
      menu: ModelMenus<M>;
      menuCenter: Point;
      position?: Point;
      timeStamp?: number;
    }
  | {
      type: 'move' | 'change';
      mode: 'novice';
      position: Point;
      active: ModelItems<M> | null;
      timeStamp?: number;
    }
  | {
      type: 'select';
      mode: 'startup' | 'novice' | 'expert';
      selection: ModelLeaves<M>;
      position?: Point;
      timeStamp?: number;
    }
  | {
      type: 'cancel';
      mode: 'startup' | 'novice' | 'expert';
      selection?: ModelItems<M> | null;
      position?: Point;
      timeStamp?: number;
    };

/**
 Clone a notification in a protected way so that the internal state cannot be corrupted.
 */
export const exportNotification = (
  n: RawNotification,
): RawExportedNotification => ({
  type: n.type,
  mode: n.mode,
  position: n.position ? [...n.position] : undefined,
  active: n.active,
  selection: n.selection,
  menu: n.menu,
  menuCenter: n.center ? [...n.center] : undefined,
  timeStamp: n.timeStamp,
});

/**
 A logger, as accepted by {@link createMarkingMenu}.
 */
export type MarkingMenuLogger = {
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

const defaultLogger: MarkingMenuLogger = {
  error: console?.error?.bind(console) ?? noOp,
  info: console?.info?.bind(console) ?? noOp,
  warn: console?.warn?.bind(console) ?? noOp,
  debug: noOp,
};

/**
 Configuration of a marking menu, as accepted by {@link createMarkingMenu}.
 */
export type MarkingMenuConfig = MarkingMenuInput & {
  /** The parent node. */
  parent: HTMLElement;
  /** The minimum distance from the center to select an item. */
  minSelectionDist?: number;
  /** The minimum distance from the center to open a sub-menu. */
  minMenuSelectionDist?: number;
  /** The dwelling delay before opening a sub-menu. */
  submenuOpeningDelay?: number;
  /**
   The minimum distance between two points to be considered a significant
   movement and breaking the sub-menu dwelling delay.
   */
  movementsThreshold?: number;
  /**
   The dwelling time required to trigger the novice mode (and open the menu).
   */
  noviceDwellingTime?: number;
  /** The color of the gesture stroke. */
  strokeColor?: string;
  /** The width of the gesture stroke. */
  strokeWidth?: number;
  /**
   The radius of the start point of the stroke (appearing at the middle of the
   menu in novice mode).
   */
  strokeStartPointRadius?: number;
  /**
   The color of the lower stroke. The lower stroke is the stroke drawn below
   the menu. It keeps track of the previous movements.
   */
  lowerStrokeColor?: string;
  /** The width of the lower stroke. Defaults to `strokeWidth`. */
  lowerStrokeWidth?: number;
  /**
   The radius of the start point of the lower stroke. Defaults to
   `strokeStartPointRadius`.
   */
  lowerStrokeStartPointRadius?: number;
  /** The width of the stroke of the gesture feedback. Defaults to `strokeWidth`. */
  gestureFeedbackStrokeWidth?: number;
  /** The color of the stroke of the gesture feedback. Defaults to `strokeColor`. */
  gestureFeedbackStrokeColor?: string;
  /**
   The color of the stroke of the gesture feedback when the selection is
   canceled.
   */
  gestureFeedbackCanceledStrokeColor?: string;
  /** The duration of the gesture feedback, in milliseconds. */
  gestureFeedbackDuration?: number;
  /**
   If true, every steps of the marking menu (include move) events, will be
   notified. Useful for logging.
   */
  notifySteps?: boolean;
  /** Override the default logger to use. */
  log?: Partial<MarkingMenuLogger>;
};

/**
 The observable {@link createMarkingMenu} returns: every step of the
 navigation when `Steps` is `true`, only the (leaf) selections otherwise.
 Written with a naked type parameter so that a widened `boolean` (a caller
 passing a variable rather than a literal for `notifySteps`) distributes over
 both branches instead of silently collapsing to one.
 */
type CreateMarkingMenuResult<
  Steps extends boolean | undefined,
  M extends AnyModelNode,
> = Steps extends true
  ? Observable<MarkingMenuNotification<M>>
  : Observable<ModelLeaves<M>>;

/**
 Create a Marking Menu.

 @param config - The menu configuration.
 @returns An observable on menu selections (or, if `notifySteps` is true, on
 every step of the navigation).
 */
export function createMarkingMenu<const Config extends MarkingMenuConfig>(
  config: Config & ValidateInput<Config>,
): CreateMarkingMenuResult<Config['notifySteps'], MarkingMenuModel<Config>> {
  const {
    parent,
    minSelectionDist = 40,
    minMenuSelectionDist = 80,
    submenuOpeningDelay = 100,
    movementsThreshold = 5,
    noviceDwellingTime = 1000 / 3,
    strokeColor = '#000',
    strokeWidth = 4,
    strokeStartPointRadius = 8,
    lowerStrokeColor = '#777',
    lowerStrokeWidth = strokeWidth,
    lowerStrokeStartPointRadius = lowerStrokeWidth,
    gestureFeedbackDuration = 1000,
    gestureFeedbackStrokeWidth = strokeWidth,
    gestureFeedbackCanceledStrokeColor = '#DE6C52',
    gestureFeedbackStrokeColor = strokeColor,
    notifySteps = false,
  } = config;
  const log = { ...defaultLogger, ...config.log };
  const strokeCanvasOptions = {
    lineColor: strokeColor,
    lineWidth: strokeWidth,
    pointRadius: strokeStartPointRadius,
  };
  const lowerStrokeCanvasOptions = {
    lineColor: lowerStrokeColor,
    lineWidth: lowerStrokeWidth,
    pointRadius: lowerStrokeStartPointRadius,
  };
  const gestureFeedbackOptions = {
    duration: gestureFeedbackDuration,
    strokeOptions: {
      lineColor: gestureFeedbackStrokeColor,
      lineWidth: gestureFeedbackStrokeWidth,
    },
    canceledStrokeOptions: {
      lineColor: gestureFeedbackCanceledStrokeColor,
    },
  };

  // Create model and navigation observable.
  // `config` already satisfies `ValidateInput<Config>`; passing it through
  // (rather than a freshly built `{ items }` object) keeps that evidence and
  // avoids re-validating a brand new, unvalidated object literal.
  const model = createModel(config);
  // The navigation engine's notifications are a discriminated union keyed on
  // `type`, so its precise type cannot express "whichever fields this step
  // attached, opaquely forwarded" — hence the cast to `RawNotification` (see
  // its definition above).
  const navigation$ = navigation(pointerDrags(parent), model, {
    minSelectionDist,
    minMenuSelectionDist,
    submenuOpeningDelay,
    movementsThreshold,
    noviceDwellingTime,
  }) as unknown as Observable<RawNotification>;

  // Connect the engine's notifications to menu opening/closing. Same
  // rationale as above for the casts around `navigation$`.
  const connectedNavigation$ = connectLayout({
    parent,
    navigation$: navigation$ as unknown as Observable<
      LayoutNotification<MenuLayoutModel>
    >,
    createMenuLayout: (
      menuParent: HTMLElement,
      menuModel: MenuLayoutModel,
      center: Point,
    ) =>
      createMenuLayout({
        parent: menuParent,
        model: menuModel,
        center,
      }),
    createUpperStrokeCanvas: (canvasParent: HTMLElement) =>
      createStrokeCanvas({ parent: canvasParent, ...strokeCanvasOptions }),
    createLowerStrokeCanvas: (canvasParent: HTMLElement) =>
      createStrokeCanvas({ parent: canvasParent, ...lowerStrokeCanvasOptions }),
    createGestureFeedback: ({
      parent: feedbackParent,
    }: {
      parent: HTMLElement;
    }) =>
      createGestureFeedback({
        parent: feedbackParent,
        ...gestureFeedbackOptions,
      }),
    log,
  }) as unknown as Observable<RawNotification>;

  // The public return type is precise (discriminated on `type`, `active` and
  // `selection` typed against the model); `connectedNavigation$` only carries
  // the loose `RawNotification` shape threaded through the navigation/layout
  // pipeline. The two branches below are the single, documented point where
  // that precision is re-attached — verified by reading the emission sites
  // (see `MarkingMenuNotification`'s own doc comment), backed by this
  // function's runtime shape tests, not by the compiler.
  type Result = CreateMarkingMenuResult<
    Config['notifySteps'],
    MarkingMenuModel<Config>
  >;

  // If every steps should be notified, just export connectedNavigation$.
  if (notifySteps) {
    const notifications$ = connectedNavigation$.pipe(
      map(exportNotification),
      share(),
    );
    return notifications$ as Result;
  }

  // Else, return an observable on the (leaf) selections: the expert path only
  // selects via `recognize(...)` with `requireLeaf` defaulting to `true`, and
  // the novice path only sets `type: 'select'` when `n.active.isLeaf`.
  const selections$ = connectedNavigation$.pipe(
    filter((notification) => notification.type === 'select'),
    map((notification) => notification.selection),
    share(),
  );
  return selections$ as Result;
}

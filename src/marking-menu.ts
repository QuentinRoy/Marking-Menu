import { tap, map, share, filter, type Observable } from 'rxjs';
import { navigation } from './navigation/navigation.js';
import {
  createMenu as createMenuLayout,
  type MenuLayoutModel,
} from './layout/menu.js';
import { createStrokeCanvas } from './layout/stroke.js';
import { connectLayout, type LayoutNotification } from './layout/connect.js';
import { createGestureFeedback } from './layout/gesture-feedback.js';
import { createModel } from './model.js';
import { watchDrags } from './move/linear-drag.js';
import { noOp, type Point } from './utils.js';
import type { MarkingMenuItemInput } from './types.js';

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
  center?: Point | undefined;
  timeStamp?: number | undefined;
  originalEvent?: { preventDefault(): void } | null | undefined;
};

/**
 A marking menu notification, as exported to the caller.
 */
export type MarkingMenuNotification = {
  /** The kind of the notification (e.g. `'open'`, `'change'`, `'select'`). */
  type?: string | undefined;
  /** The navigation mode the notification was produced in. */
  mode?: string | undefined;
  /** The current pointer position, if relevant. */
  position?: Point | undefined;
  /** The currently pointed at item, if any. */
  active?: unknown;
  /** The selected item, once a selection has been made. */
  selection?: unknown;
  /** The pixel coordinates of the currently open menu's center. */
  menuCenter?: Point | undefined;
  /** The timestamp of the notification. */
  timeStamp?: number | undefined;
};

/**
 Clone a notification in a protected way so that the internal state cannot be corrupted.
 */
export const exportNotification = (
  n: RawNotification,
): MarkingMenuNotification => ({
  type: n.type,
  mode: n.mode,
  position: n.position ? [...n.position] : undefined,
  active: n.active,
  selection: n.selection,
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

/**
 Configuration of a marking menu, as accepted by {@link createMarkingMenu}.
 */
export type MarkingMenuConfig = {
  /**
   The list of items. Each item must have a `label`; an item with `children`
   is a sub-menu.
   */
  items: readonly MarkingMenuItemInput[];
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
  log?: MarkingMenuLogger;
};

/**
 Create a Marking Menu.

 @param config - The menu configuration.
 @returns An observable on menu selections (or, if `notifySteps` is true, on
 every step of the navigation).
 */
export function createMarkingMenu(
  config: MarkingMenuConfig & { notifySteps: true },
): Observable<MarkingMenuNotification>;
export function createMarkingMenu(
  config: MarkingMenuConfig & { notifySteps?: false | undefined },
): Observable<unknown>;
export function createMarkingMenu({
  items,
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
  log = {
    error: console?.error?.bind(console) ?? noOp,
    info: console?.info?.bind(console) ?? noOp,
    warn: console?.warn?.bind(console) ?? noOp,
    debug: noOp,
  },
}: MarkingMenuConfig):
  Observable<MarkingMenuNotification> | Observable<unknown> {
  // Create the display options.
  const menuLayoutOptions = {};
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
  const model = createModel({ items });
  // The navigation engine's notifications are a discriminated union keyed on
  // `type`, so its precise type cannot express "whichever fields this step
  // attached, opaquely forwarded" — hence the cast to `RawNotification` (see
  // its definition above).
  const navigation$ = (
    navigation(watchDrags(parent), model, {
      minSelectionDist,
      minMenuSelectionDist,
      submenuOpeningDelay,
      movementsThreshold,
      noviceDwellingTime,
    }) as unknown as Observable<RawNotification>
  ).pipe(
    tap(({ originalEvent }) => {
      // Prevent default on every notifications.
      if (originalEvent) {
        originalEvent.preventDefault();
      }
    }),
  );

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
        ...menuLayoutOptions,
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

  // If every steps should be notified, just export connectedNavigation$.
  if (notifySteps) {
    return connectedNavigation$.pipe(map(exportNotification), share());
  }

  // Else, return an observable on the selections.
  return connectedNavigation$.pipe(
    filter((notification) => notification.type === 'select'),
    map((notification) => notification.selection),
    share(),
  );
}

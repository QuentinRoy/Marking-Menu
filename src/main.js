import { tap, map, share, filter, pluck } from 'rxjs/operators';
import navigation from './navigation/index.js';
import {
  createMenuLayout,
  createStrokeCanvas,
  connectLayout,
  createGestureFeedback,
} from './layout/index.js';
import createModel from './model.js';
import { watchDrags } from './move/index.js';
import { noOp } from './utils.js';

// Clone a notification in a protected way so that the internal state cannot be corrupted.
export const exportNotification = (n) => ({
  type: n.type,
  mode: n.mode,
  position: n.position ? [...n.position] : undefined,
  active: n.active,
  selection: n.selection,
  menuCenter: n.center ? [...n.center] : undefined,
  timeStamp: n.timeStamp,
});

/**
 Create a Marking Menu.

 @param {object} config - The menu configuration.
 @param {List<{label, children}>} config.items - The list of items. Each item must have a `label`;
 an item with `children` is a sub-menu.
 @param {HTMLElement} config.parent - The parent node.
 @param {number} [config.minSelectionDist] - The minimum distance from the center to select an
 item.
 @param {number} [config.minMenuSelectionDist] - The minimum distance from the center to open a
 sub-menu.
 @param {number} [config.submenuOpeningDelay] - The dwelling delay before opening a sub-menu.
 @param {number} [config.movementsThreshold] - The minimum distance between two points to be
 considered a significant movements and breaking
 the sub-menu dwelling delay.
 @param {number} [config.noviceDwellingTime] - The dwelling time required to trigger the novice
 mode (and open the menu).
 @param {number} [config.strokeColor] - The color of the gesture stroke.
 @param {number} [config.strokeWidth] - The width of the gesture stroke.
 @param {number} [config.strokeStartPointRadius] - The radius of the start point of the stroke
 (appearing at the middle of the menu in novice
 mode).
 @param {number} [config.lowerStrokeColor] - The color of the lower stroke. The lower stroke is
 the stroke drawn below the menu. It keeps track of
 the previous movements.
 @param {number} [config.lowerStrokeWidth] - The width of the lower stroke. Defaults to
 `strokeWidth`.
 @param {number} [config.lowerStrokeStartPointRadius] - The radius of the start point of the
 lower stroke. Defaults to `lowerStrokeWidth`.
 @param {number} [config.gestureFeedbackStrokeWidth] - The width of the stroke of the gesture
 feedback. Defaults to `strokeWidth`.
 @param {number} [config.gestureFeedbackStrokeColor] - The color of the stroke of the gesture
 feedback. Defaults to `strokeColor`.
 @param {number} [config.gestureFeedbackCanceledStrokeColor] - The color of the stroke of the
 gesture feedback when the selection is
 canceled.
 @param {number} [config.gestureFeedbackDuration] - The duration of the gesture feedback, in
 milliseconds.
 @param {boolean} [config.notifySteps] - If true, every steps of the marking menu (include move)
 events, will be notified. Useful for logging.
 @param {{error, info, warn, debug}} [config.log] - Override the default logger to use.
 @returns {Observable} An observable on menu selections.
 */
export default function createMarkingMenu({
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
    error: (console.error && console.error.bind(console)) ?? noOp,
    info: (console.info && console.info.bind(console)) ?? noOp,
    warn: (console.warn && console.warn.bind(console)) ?? noOp,
    debug: noOp,
  },
}) {
  // Create the display options
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
  const model = createModel(items);
  const navigation$ = navigation(watchDrags(parent), model, {
    minSelectionDist,
    minMenuSelectionDist,
    submenuOpeningDelay,
    movementsThreshold,
    noviceDwellingTime,
  }).pipe(
    tap(({ originalEvent }) => {
      // Prevent default on every notifications.
      if (originalEvent) {
        originalEvent.preventDefault();
      }
    }),
  );

  // Connect the engine's notifications to menu opening/closing.
  const connectedNavigation$ = connectLayout({
    parent,
    navigation$,
    createMenuLayout: (menuParent, menuModel, center, current) =>
      createMenuLayout({
        parent: menuParent,
        model: menuModel,
        center,
        current,
        ...menuLayoutOptions,
      }),
    createUpperStrokeCanvas: (canvasParent) =>
      createStrokeCanvas(canvasParent, strokeCanvasOptions),
    createLowerStrokeCanvas: (canvasParent) =>
      createStrokeCanvas(canvasParent, lowerStrokeCanvasOptions),
    createGestureFeedback: (feedbackParent) =>
      createGestureFeedback(feedbackParent, gestureFeedbackOptions),
    log,
  });

  // If every steps should be notified, just export connectedNavigation$.
  if (notifySteps) {
    return connectedNavigation$.pipe(map(exportNotification), share());
  }

  // Else, return an observable on the selections.
  return connectedNavigation$.pipe(
    filter((notification) => notification.type === 'select'),
    pluck('selection'),
    share(),
  );
}

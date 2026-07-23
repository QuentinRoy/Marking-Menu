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

 @param {List<string | {name, children}>} items - The list of items.
 @param {HTMLElement} parentDOM - The parent node.
 @param {object} [options] - Configuration options for the menu.
 @param {number} [options.minSelectionDist] - The minimum distance from the center to select an
 item.
 @param {number} [options.minMenuSelectionDist] - The minimum distance from the center to open a
 sub-menu.
 @param {number} [options.submenuOpeningDelay] - The dwelling delay before opening a sub-menu.
 @param {number} [options.movementsThreshold] - The minimum distance between two points to be
 considered a significant movements and breaking
 the sub-menu dwelling delay.
 @param {number} [options.noviceDwellingTime] - The dwelling time required to trigger the novice
 mode (and open the menu).
 @param {number} [options.strokeColor] - The color of the gesture stroke.
 @param {number} [options.strokeWidth] - The width of the gesture stroke.
 @param {number} [options.strokeStartPointRadius] - The radius of the start point of the stroke
 (appearing at the middle of the menu in novice
 mode).
 @param {number} [options.lowerStrokeColor] - The color of the lower stroke. The lower stroke is
 the stroke drawn below the menu. It keeps track of
 the previous movements.
 @param {number} [options.lowerStrokeWidth] - The width of the lower stroke. Defaults to
 `strokeWidth`.
 @param {number} [options.lowerStrokeStartPointRadius] - The radius of the start point of the
 lower stroke. Defaults to `lowerStrokeWidth`.
 @param {number} [options.gestureFeedbackStrokeWidth] - The width of the stroke of the gesture
 feedback. Defaults to `strokeWidth`.
 @param {number} [options.gestureFeedbackStrokeColor] - The color of the stroke of the gesture
 feedback. Defaults to `strokeColor`.
 @param {number} [options.gestureFeedbackCanceledStrokeColor] - The color of the stroke of the
 gesture feedback when the selection is
 canceled.
 @param {number} [options.gestureFeedbackDuration] - The duration of the gesture feedback, in
 milliseconds.
 @param {boolean} [options.notifySteps] - If true, every steps of the marking menu (include move)
 events, will be notified. Useful for logging.
 @param {{error, info, warn, debug}} [options.log] - Override the default logger to use.
 @returns {Observable} An observable on menu selections.
 */
export default function createMarkingMenu(
  items,
  parentDOM,
  {
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
  } = {},
) {
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
  const navigation$ = navigation(watchDrags(parentDOM), model, {
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
  const connectedNavigation$ = connectLayout(
    parentDOM,
    navigation$,
    (parent, menuModel, center, current) =>
      createMenuLayout({
        parent,
        model: menuModel,
        center,
        current,
        ...menuLayoutOptions,
      }),
    (parent) => createStrokeCanvas(parent, strokeCanvasOptions),
    (parent) => createStrokeCanvas(parent, lowerStrokeCanvasOptions),
    (parent) => createGestureFeedback(parent, gestureFeedbackOptions),
    log,
  );

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

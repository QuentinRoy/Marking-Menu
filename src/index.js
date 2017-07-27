import createEngine from './engine';
import createLayout from './layout';
import createModel from './model';
import { watchDrags } from './drag';
import connectEngineToLayout from './connect-engine-to-layout';

/**
 * Create a Marking Menu.
 *
 * @param {List<String|{name,children}>} items - The list of items.
 * @param {HTMLElement} parentDOM - The parent node.
 * @param {Object} options - Configuration options for the menu.
 * @param {number} options.minSelectionDist - The minimum distance from the center to select an
 *                                            item.
 * @param {number} options.minMenuSelectionDist - The minimum distance from the center to open a
 *                                                sub-menu.
 * @param {number} options.subMenuOpeningDelay - The dwelling delay before opening a sub-menu.
 * @param {number} options.movementsThreshold - The minimum distance between two points to be
 *                                              considered a significant movements and breaking
 *                                              the sub-menu dwelling delay.
 * @return {Observable} An observable on menu selections.
 */
export default (
  items,
  parentDOM,
  options = {
    minSelectionDist: 40,
    minMenuSelectionDist: 80,
    subMenuOpeningDelay: 25,
    movementsThreshold: 5
  }
) => {
  // Create model and engine.
  const model = createModel(items);
  const engineNotif$ = createEngine(
    watchDrags(parentDOM),
    model,
    options
  ).do(({ originalEvent }) => {
    // Prevent default on every notifications.
    if (originalEvent) originalEvent.preventDefault();
  });
  // Connect the engine notifications to menu opening/closing.
  const connectedEngineNotif$ = connectEngineToLayout(
    parentDOM,
    engineNotif$,
    createLayout
  ).share();
  // Subscribe to start the menu operations.
  connectedEngineNotif$.subscribe();
  // Return an observable on the selections.
  return connectedEngineNotif$
    .filter(notif => notif.type === 'select')
    .pluck('selection');
};

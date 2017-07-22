import createEngine from './engine';
import createMenu from './menu';
import createModel from './model';
import watchDrags from './watch-drag';
import connectEngineToMenu from './connect-engine-to-menu';

/**
 * Create a Marking Menu.
 *
 * @param {List<String|{name,children}>} itemList the list of items.
 * @param {HTMLElement} parent the parent node
 * @param {{selectionDist, submenuOpeningDelay}} config
 */
export default (
  items,
  parentDOM,
  config = {
    minSelectionDist: 40,
    minMenuSelectionDist: 80,
    subMenuOpeningDelay: 25
  }
) => {
  // Create model and engine.
  const model = createModel(items);
  const engineNotif$ = createEngine(
    watchDrags(parentDOM),
    model,
    config
  ).do(({ originalEvent }) => {
    // Prevent default on every notifications.
    if (originalEvent) originalEvent.preventDefault();
  });
  // Connect the engine notifications to menu opening/closing.
  const connectedEngineNotif$ = connectEngineToMenu(
    parentDOM,
    engineNotif$,
    createMenu
  ).share();
  // Subscribe to start the menu operations.
  connectedEngineNotif$.subscribe();
  // Return an observable on the selections.
  return connectedEngineNotif$
    .filter(notif => notif.type === 'select')
    .pluck('selection');
};

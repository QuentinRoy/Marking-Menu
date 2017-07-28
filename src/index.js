import navigation from './navigation';
import createLayout from './layout';
import createModel from './model';
import { watchDrags } from './move';
import connectNavigationToLayout from './connect-navigation-to-layout';

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
 * @param {number} options.noviceDwellingTime - The dwelling time required to trigger the novice
                                                mode (and open the menu).
 * @return {Observable} An observable on menu selections.
 */
export default (
  items,
  parentDOM,
  options = {
    minSelectionDist: 40,
    minMenuSelectionDist: 80,
    subMenuOpeningDelay: 25,
    movementsThreshold: 5,
    noviceDwellingTime: 1000 / 3
  }
) => {
  // Create model and engine.
  const model = createModel(items);
  const navigation$ = navigation(
    watchDrags(parentDOM),
    model,
    options
  ).do(({ originalEvent }) => {
    // Prevent default on every notifications.
    if (originalEvent) originalEvent.preventDefault();
  });
  // Connect the engine notifications to menu opening/closing.
  const connectedNavigation$ = connectNavigationToLayout(
    parentDOM,
    navigation$,
    createLayout
  ).share();
  // Subscribe to start the menu operations.
  connectedNavigation$.subscribe();
  // Return an observable on the selections.
  return connectedNavigation$
    .filter(notification => notification.type === 'select')
    .pluck('selection');
};

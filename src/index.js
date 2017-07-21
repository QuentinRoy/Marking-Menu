import createEngine from './engine';
import createMenu from './menu';
import createModel from './model';
import watchDrags from './watch-drag';

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
    minSelectionDist: 50,
    minMenuSelectionDist: 120,
    subMenuOpeningDelay: 25
  }
) => {
  const model = createModel(items);
  // Create the engine.
  const engineNotif$ = createEngine(
    watchDrags(parentDOM),
    model,
    config
  ).share();
  // Open the menu in function of engine events.
  let menu = null;
  const action$ = engineNotif$
    .do({
      next(notif) {
        try {
          switch (notif.type) {
            case 'open': {
              const cbr = parentDOM.getBoundingClientRect();
              if (menu) menu.remove();
              menu = createMenu(notif.menu, parentDOM, [
                notif.center[0] - cbr.left,
                notif.center[1] - cbr.top
              ]);
              break;
            }
            case 'change': {
              menu.setActive((notif.active && notif.active.id) || null);
              break;
            }
            case 'select':
            case 'cancel':
              menu.remove();
              menu = null;
              break;
            case 'move':
              break;
            default:
              throw new Error(`Invalid engine type: ${notif.type}`);
          }
        } catch (err) {
          console.error(err);
          throw err;
        }
      },
      error(err) {
        console.error(err);
        throw err;
      }
    })
    .share();
  action$.subscribe();
  return action$.filter(notif => notif.type === 'select').pluck('selection');
};

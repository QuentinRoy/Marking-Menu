import createEngine from './engine';
import createMenu from './menu';
import createModel from './model';
import { watchAngleDrag } from './watch-drag';

export default (items, parentDOM) => {
  const model = createModel(items);
  // Create the engine.
  const engineNotif$ = createEngine(model, watchAngleDrag(parentDOM)).share();
  // Open the menu in function of engine events.
  let menu = null;
  const action$ = engineNotif$
    .do({
      next(notif) {
        try {
          switch (notif.type) {
            case 'open': {
              const cbr = parentDOM.getBoundingClientRect();
              menu = createMenu(model, parentDOM, [
                notif.position[0] - cbr.left,
                notif.position[1] - cbr.top
              ]);
              break;
            }
            case 'change': {
              menu.setActive(notif.active.id);
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
  return action$
    .filter(notif => notif.type === 'select')
    .pluck('selection');
};

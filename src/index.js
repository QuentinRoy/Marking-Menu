import createEngine from './engine';
import createMenu from './menu';
import createModel from './model';
import { watchAngleDrag } from './watch-drag';

export default (items, parentDOM) => {
  const model = createModel(items);
  // Create the engine.
  const menuEvent$ = createEngine(watchAngleDrag(parentDOM));
  // Open the menu in function of engine events.
  let menu = null;
  menuEvent$.subscribe({
    next(evt) {
      try {
        switch (evt.type) {
          case 'open': {
            const cbr = parentDOM.getBoundingClientRect();
            menu = createMenu(model, parentDOM, [
              evt.position[0] - cbr.left,
              evt.position[1] - cbr.top
            ]);
            break;
          }
          case 'move': {
            const nearest = model.getNearest(evt.alpha);
            menu.setActive(nearest.id);
            break;
          }
          case 'close':
            menu.remove();
            menu = null;
            break;
          default:
            throw new Error(`Invalid engine type: ${evt.type}`);
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
  });
};

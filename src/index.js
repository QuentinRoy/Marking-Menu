import createEngine from './engine';
import createMenu from './menu';

export default (items, parentDOM) => {
  let menu = null;
  // Create the engine.
  const menuEvent$ = createEngine(parentDOM);
  // Open the menu in function of engine events.
  menuEvent$.subscribe(evt => {
    try {
      switch (evt.type) {
        case 'open':
          menu = createMenu(items, parentDOM, evt.position);
          break;
        case 'change':
          menu.setActiveByNearestAngle(evt.alpha);
          break;
        case 'close':
          menu.remove();
          menu = null;
          break;
        default:
          throw new Error(`Invalid engine type: ${evt.type}`);
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
};

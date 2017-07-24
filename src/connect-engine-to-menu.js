/**
 * Connect engine to menu opening and closing.
 *
 * @param {HTMLElement} parentDOM - The element where to append the menu.
 * @param {Observable} engineNotif$ - Notifications of the engine.
 * @param {Function} createMenu - Menu factory.
 * @return {Observable} `engineNotif$` with menu opening and closing side effects.
 */
export default (parentDOM, engineNotif$, createMenu) => {
  // Open the menu in function of engine events.
  let menu = null;

  const closeMenuIfOpened = () => {
    if (menu) {
      menu.remove();
      menu = null;
    }
  };

  const openMenu = (model, position) => {
    const cbr = parentDOM.getBoundingClientRect();
    menu = createMenu(parentDOM, model, [
      position[0] - cbr.left,
      position[1] - cbr.top
    ]);
  };

  const setActive = id => {
    menu.setActive(id);
  };

  return engineNotif$.do({
    next(notif) {
      switch (notif.type) {
        case 'open': {
          closeMenuIfOpened();
          openMenu(notif.menu, notif.center);
          break;
        }
        case 'change': {
          setActive((notif.active && notif.active.id) || null);
          break;
        }
        case 'select':
        case 'cancel':
          closeMenuIfOpened();
          break;
        case 'move':
          break;
        default:
          throw new Error(`Invalid engine type: ${notif.type}`);
      }
    },
    complete() {
      closeMenuIfOpened();
    }
  });
};

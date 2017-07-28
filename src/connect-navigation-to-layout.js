/**
 * Connect navigation notifications to menu opening and closing.
 *
 * @param {HTMLElement} parentDOM - The element where to append the menu.
 * @param {Observable} navigation$ - Notifications of the navigation.
 * @param {Function} createLayout - Menu layout factory.
 * @return {Observable} `navigation$` with menu opening and closing side effects.
 */
export default (parentDOM, navigation$, createLayout) => {
  // Open the menu in function of navigation notifications.
  let menu = null;

  const closeMenuIfOpened = () => {
    if (menu) {
      menu.remove();
      menu = null;
    }
  };

  const openMenu = (model, position) => {
    const cbr = parentDOM.getBoundingClientRect();
    menu = createLayout(parentDOM, model, [
      position[0] - cbr.left,
      position[1] - cbr.top
    ]);
  };

  const setActive = id => {
    menu.setActive(id);
  };

  return navigation$.do({
    next(notification) {
      switch (notification.type) {
        case 'open': {
          closeMenuIfOpened();
          openMenu(notification.menu, notification.center);
          break;
        }
        case 'change': {
          setActive((notification.active && notification.active.id) || null);
          break;
        }
        case 'select':
        case 'cancel':
          closeMenuIfOpened();
          break;
        case 'draw':
        case 'move':
          // TODO: Provide a feedback.
          break;
        default:
          throw new Error(
            `Invalid navigation notification type: ${notification.type}`
          );
      }
    },
    complete() {
      closeMenuIfOpened();
    }
  });
};

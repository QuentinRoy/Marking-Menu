import rafThrottle from 'raf-throttle';
import MenuLayout from './menu';
import StrokeCanvas from './stroke';

/**
 * Connect navigation notifications to menu opening and closing.
 *
 * @param {HTMLElement} parentDOM - The element where to append the menu.
 * @param {Observable} navigation$ - Notifications of the navigation.
 * @param {Function} [createMenuLayout] - Menu layout factory.
 * @param {Function} [createStrokeCanvas] - Stroke canvas factory.
 * @return {Observable} `navigation$` with menu opening and closing side effects.
 */
export default (
  parentDOM,
  navigation$,
  createMenuLayout = MenuLayout,
  createStrokeCanvas = StrokeCanvas
) => {
  // Open the menu in function of navigation notifications.
  let menu = null;
  let strokeCanvas = null;
  let strokeStart = null;

  const closeMenu = () => {
    menu.remove();
    menu = null;
  };

  const openMenu = (model, position) => {
    const cbr = parentDOM.getBoundingClientRect();
    menu = createMenuLayout(parentDOM, model, [
      position[0] - cbr.left,
      position[1] - cbr.top
    ]);
  };

  const setActive = id => {
    menu.setActive(id);
  };

  const startStroke = position => {
    strokeCanvas = createStrokeCanvas(parentDOM);
    strokeCanvas.drawStroke([position]);
    strokeStart = position;
  };

  const noviceMove = rafThrottle(position => {
    if (strokeCanvas) {
      strokeCanvas.clear();
      strokeCanvas.drawStroke([strokeStart, position]);
      strokeCanvas.drawPoint(strokeStart);
    }
  });

  const expertDraw = rafThrottle(stroke => {
    if (strokeCanvas) {
      strokeCanvas.clear();
      strokeCanvas.drawStroke(stroke);
    }
  });

  const clearStroke = () => {
    strokeCanvas.remove();
    strokeCanvas = null;
    strokeStart = null;
  };

  const onNotification = notification => {
    switch (notification.type) {
      case 'open': {
        // eslint-disable-next-line no-param-reassign
        parentDOM.style.cursor = 'none';
        if (menu) closeMenu();
        clearStroke();
        openMenu(notification.menu, notification.center);
        startStroke(notification.center);
        noviceMove(notification.position);
        break;
      }
      case 'change': {
        setActive((notification.active && notification.active.id) || null);
        break;
      }
      case 'select':
      case 'cancel':
        // eslint-disable-next-line no-param-reassign
        parentDOM.style.cursor = '';
        if (menu) closeMenu();
        clearStroke();
        break;
      case 'start':
        // eslint-disable-next-line no-param-reassign
        parentDOM.style.cursor = 'crosshair';
        startStroke(notification.position);
        break;
      case 'draw':
        expertDraw(notification.stroke);
        break;
      case 'move':
        noviceMove(notification.position);
        break;
      default:
        throw new Error(
          `Invalid navigation notification type: ${notification.type}`
        );
    }
  };

  const cleanUp = () => {
    // Make sure everything is cleaned upon completion.
    if (menu) closeMenu();
    if (strokeCanvas) clearStroke();
    // eslint-disable-next-line no-param-reassign
    parentDOM.style.cursor = '';
  };

  return navigation$
    .do(notification => {
      try {
        onNotification(notification);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        throw e;
      }
    })
    .finally(() => {
      try {
        cleanUp();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        throw e;
      }
    });
};

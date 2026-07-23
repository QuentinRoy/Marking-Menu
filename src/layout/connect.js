import { finalize, tap } from 'rxjs/operators';
import rafThrottle from 'raf-schd';

/**
 Connect navigation notifications to menu opening and closing.
 
 @param {object} options - Connection options.
 @param {HTMLElement} options.parent - The element where to append the menu.
 @param {Observable} options.navigation$ - Notifications of the navigation.
 @param {(parentDOM: HTMLElement, model: object, position: number[]) => object} options.createMenuLayout -
 Menu layout factory.
 @param {(parentDOM: HTMLElement) => object} options.createUpperStrokeCanvas - Upper stroke
 canvas factory. The upper stroke show the user interaction on the current menu, and the
 movements in expert mode.
 @param {(parentDOM: HTMLElement) => object} options.createLowerStrokeCanvas - Lower stroke
 canvas factory. The lower stroke is stroke drawn below the menu. It keeps track of the
 previous movements.
 @param {function(object): object} options.createGestureFeedback - Gesture feedback factory
 accepting an options object with a `parent` property.
 @param {{error}} options.log - Logger.
 @returns {Observable} `navigation$` with menu opening and closing side effects.
 */
export default function connectLayout({
  parent: parentDOM,
  navigation$,
  createMenuLayout,
  createUpperStrokeCanvas,
  createLowerStrokeCanvas,
  createGestureFeedback,
  log,
}) {
  // The menu object.
  let menu = null;
  // A stroke drawn on top of the menu.
  let upperStrokeCanvas = null;
  // A stroke drawn below the menu.
  let lowerStrokeCanvas = null;
  // The points of the lower strokes.
  let lowerStroke = null;
  // The points of the upper stroke.
  let upperStroke = null;

  const gestureFeedback = createGestureFeedback({ parent: parentDOM });

  const closeMenu = () => {
    menu.remove();
    menu = null;
  };

  const openMenu = (model, position) => {
    const cbr = parentDOM.getBoundingClientRect();
    menu = createMenuLayout(parentDOM, model, [
      position[0] - cbr.left,
      position[1] - cbr.top,
    ]);
  };

  const setActive = (id) => {
    menu.setActive(id);
  };

  const startUpperStroke = (position) => {
    upperStrokeCanvas = createUpperStrokeCanvas(parentDOM);
    upperStroke = [position];
    upperStrokeCanvas.drawStroke(upperStroke);
  };

  const noviceMove = rafThrottle((position) => {
    if (!upperStrokeCanvas) {
      return;
    }

    upperStrokeCanvas.clear();
    if (position) {
      upperStroke = [upperStroke[0], position];
      upperStrokeCanvas.drawStroke(upperStroke);
    }

    upperStrokeCanvas.drawPoint(upperStroke[0]);
  });

  const expertDraw = rafThrottle((stroke) => {
    // FIXME: Not very efficient.
    if (!upperStrokeCanvas) {
      return;
    }

    upperStrokeCanvas.clear();
    upperStroke = [...stroke];
    upperStrokeCanvas.drawStroke(upperStroke);
  });

  const clearUpperStroke = () => {
    upperStrokeCanvas.remove();
    upperStrokeCanvas = null;
    upperStroke = null;
  };

  const swapUpperStroke = () => {
    lowerStroke = lowerStroke ? [...lowerStroke, ...upperStroke] : upperStroke;
    clearUpperStroke();
    lowerStrokeCanvas ||= createLowerStrokeCanvas(parentDOM);
    lowerStrokeCanvas.drawStroke(lowerStroke);
  };

  const clearLowerStroke = () => {
    if (lowerStrokeCanvas) {
      lowerStrokeCanvas.remove();
      lowerStrokeCanvas = null;
    }

    lowerStroke = null;
  };

  const showGestureFeedback = (isCanceled) => {
    gestureFeedback.show(
      lowerStroke ? [...lowerStroke, ...upperStroke] : upperStroke,
      isCanceled,
    );
  };

  const cleanUp = () => {
    // Make sure everything is cleaned upon completion.
    if (menu) {
      closeMenu();
    }

    if (upperStrokeCanvas) {
      clearUpperStroke();
    }

    if (lowerStrokeCanvas) {
      clearLowerStroke();
    }

    gestureFeedback.remove();

    parentDOM.style.cursor = '';
  };

  const onNotification = (notification) => {
    switch (notification.type) {
      case 'open': {
        parentDOM.style.cursor = 'none';
        if (menu) {
          closeMenu();
        }

        swapUpperStroke();
        openMenu(notification.menu, notification.center);
        startUpperStroke(notification.center);
        noviceMove(notification.position);
        break;
      }

      case 'change': {
        setActive((notification.active && notification.active.id) || null);
        break;
      }

      case 'select':
      case 'cancel': {
        parentDOM.style.cursor = '';
        if (menu) {
          closeMenu();
        }

        showGestureFeedback(notification.type === 'cancel');
        clearUpperStroke();
        clearLowerStroke();
        break;
      }

      case 'start': {
        parentDOM.style.cursor = 'crosshair';
        startUpperStroke(notification.position);
        break;
      }

      case 'draw': {
        expertDraw(notification.stroke);
        break;
      }

      case 'move': {
        noviceMove(notification.position);
        break;
      }

      default: {
        throw new Error(
          `Invalid navigation notification type: ${notification.type}`,
        );
      }
    }
  };

  return navigation$.pipe(
    tap({
      next(notification) {
        try {
          onNotification(notification);
        } catch (error) {
          log.error(error);
          throw error;
        }
      },
      error(error) {
        log.error(error);
        throw error;
      },
    }),
    finalize(() => {
      try {
        cleanUp();
      } catch (error) {
        log.error(error);
        throw error;
      }
    }),
  );
}

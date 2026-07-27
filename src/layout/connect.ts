import rafThrottle from 'raf-schd';
import { finalize, tap, type Observable } from 'rxjs';
import type { NonEmptyArray, Point } from '../utils.js';
import type { GestureFeedback } from './gesture-feedback.js';
import type { Menu } from './menu.js';
import type { StrokeCanvas } from './stroke.js';

/**
 A navigation notification consumed by the layout.

 The `menu` model is generic: the layout only forwards it to the menu layout
 factory.
 */
export type LayoutNotification<M> =
  | { type: 'open'; menu: M; center: Point; position?: Point }
  | { type: 'change'; active?: { key: string } | null }
  | { type: 'select' }
  | { type: 'cancel' }
  | { type: 'start'; position: Point }
  | { type: 'draw'; stroke: Readonly<NonEmptyArray<Point>> }
  | { type: 'move'; position?: Point };

/**
 Connect navigation notifications to menu opening and closing.

 @param options - Connection options.
 @param options.parent - The element where to append the menu.
 @param options.navigation$ - Notifications of the navigation.
 @param options.createMenuLayout - Menu layout factory.
 @param options.createUpperStrokeCanvas - Upper stroke canvas factory. The
 upper stroke show the user interaction on the current menu, and the movements
 in expert mode.
 @param options.createLowerStrokeCanvas - Lower stroke canvas factory. The
 lower stroke is stroke drawn below the menu. It keeps track of the previous
 movements.
 @param options.createGestureFeedback - Gesture feedback factory accepting an
 options object with a `parent` property.
 @param options.log - Logger.
 @param options.log.error - Logs errors.
 @returns `navigation$` with menu opening and closing side effects.
 */
export function connectLayout<M, N extends LayoutNotification<M>>({
  parent: parentDOM,
  navigation$,
  createMenuLayout,
  createUpperStrokeCanvas,
  createLowerStrokeCanvas,
  createGestureFeedback,
  log,
}: {
  parent: HTMLElement;
  navigation$: Observable<N>;
  createMenuLayout: (parentDOM: HTMLElement, model: M, position: Point) => Menu;
  createUpperStrokeCanvas: (parentDOM: HTMLElement) => StrokeCanvas;
  createLowerStrokeCanvas: (parentDOM: HTMLElement) => StrokeCanvas;
  createGestureFeedback: (options: { parent: HTMLElement }) => GestureFeedback;
  log: { error: (error: unknown) => void };
}): Observable<N> {
  // The menu object.
  let menu: Menu | null = null;
  // The stroke drawn on top of the menu: its canvas and its (non-empty) points.
  // Both are always set and cleared together, so they live in a single value.
  let upperStroke: {
    canvas: StrokeCanvas;
    points: Readonly<NonEmptyArray<Point>>;
  } | null = null;
  // The stroke drawn below the menu: its canvas and its accumulated points.
  // Both are always set and cleared together, so they live in a single value.
  let lowerStroke: { canvas: StrokeCanvas; points: readonly Point[] } | null =
    null;

  const gestureFeedback = createGestureFeedback({ parent: parentDOM });

  const closeMenu = () => {
    if (!menu) {
      throw new Error('Cannot close the menu: no menu is open.');
    }

    menu.remove();
    menu = null;
  };

  const openMenu = (model: M, position: Point) => {
    const cbr = parentDOM.getBoundingClientRect();
    menu = createMenuLayout(parentDOM, model, [
      position[0] - cbr.left,
      position[1] - cbr.top,
    ]);
  };

  const setActive = (id: string | null) => {
    if (!menu) {
      throw new Error('Cannot set the active item: no menu is open.');
    }

    menu.setActive(id);
  };

  const startUpperStroke = (position: Point) => {
    const canvas = createUpperStrokeCanvas(parentDOM);
    upperStroke = { canvas, points: [position] };
    canvas.drawStroke(upperStroke.points);
  };

  const noviceMove = rafThrottle((position?: Point) => {
    if (!upperStroke) {
      return;
    }

    const { canvas } = upperStroke;
    const [start] = upperStroke.points;
    canvas.clear();
    if (position) {
      upperStroke = { canvas, points: [start, position] };
      canvas.drawStroke(upperStroke.points);
    }

    canvas.drawPoint(start);
  });

  const expertDraw = rafThrottle((stroke: Readonly<NonEmptyArray<Point>>) => {
    if (!upperStroke) {
      return;
    }

    const { canvas } = upperStroke;
    canvas.clear();
    upperStroke = { canvas, points: stroke };
    canvas.drawStroke(upperStroke.points);
  });

  const clearUpperStroke = () => {
    if (!upperStroke) {
      throw new Error(
        'Cannot clear the upper stroke: no stroke is in progress.',
      );
    }

    upperStroke.canvas.remove();
    upperStroke = null;
  };

  const swapUpperStroke = () => {
    if (!upperStroke) {
      throw new Error(
        'Cannot swap the upper stroke: no stroke is in progress.',
      );
    }

    const { points } = upperStroke;
    const lowerPoints = lowerStroke
      ? [...lowerStroke.points, ...points]
      : [...points];
    clearUpperStroke();
    const canvas = lowerStroke?.canvas ?? createLowerStrokeCanvas(parentDOM);
    lowerStroke = { canvas, points: lowerPoints };
    canvas.drawStroke(lowerPoints);
  };

  const clearLowerStroke = () => {
    if (!lowerStroke) {
      return;
    }

    lowerStroke.canvas.remove();
    lowerStroke = null;
  };

  const showGestureFeedback = ({ canceled }: { canceled: boolean }) => {
    if (!upperStroke) {
      throw new Error(
        'Cannot show the gesture feedback: no stroke is in progress.',
      );
    }

    const { points } = upperStroke;
    gestureFeedback.show(
      lowerStroke ? [...lowerStroke.points, ...points] : points,
      { canceled },
    );
  };

  const cleanUp = () => {
    // Make sure everything is cleaned upon completion.
    if (menu) {
      closeMenu();
    }

    if (upperStroke) {
      clearUpperStroke();
    }

    if (lowerStroke) {
      clearLowerStroke();
    }

    gestureFeedback.remove();

    parentDOM.style.cursor = '';
  };

  const onNotification = (notification: LayoutNotification<M>) => {
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
        setActive(notification.active?.key ?? null);
        break;
      }

      case 'select':
      case 'cancel': {
        parentDOM.style.cursor = '';
        if (menu) {
          closeMenu();
        }

        showGestureFeedback({ canceled: notification.type === 'cancel' });
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

      // The switch is exhaustive type-wise, but this runtime guard is kept
      // for untyped callers passing unknown notification types.
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
      default: {
        // The assertion is required to read `type` from `never`.
        throw new Error(
          `Invalid navigation notification type: ${(notification as { type: string }).type}`,
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
      error(error: unknown) {
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

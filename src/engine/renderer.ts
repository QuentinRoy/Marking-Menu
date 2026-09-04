import { createGestureFeedback } from '../layout/gesture-feedback.js';
import { createMenu, type Menu, type MenuLayoutModel } from '../layout/menu.js';
import { rafThrottle } from '../layout/raf-throttle.js';
import {
  createStrokeCanvas,
  type StrokeCanvas,
  type StrokeCanvasOptions,
} from '../layout/stroke.js';
import type { AnyModelNode, ModelMenus } from '../types.js';
import { toLocalPoint, type Point } from '../utils.js';
import type { LayoutView } from './layout-view.js';

export type FeedbackEffect = {
  readonly stroke: readonly Point[];
  readonly canceled: boolean;
};

export type LayoutRenderer<M extends AnyModelNode> = {
  render: (view: LayoutView<M>) => void;
  showFeedback: (effect: FeedbackEffect) => void;
  dispose: () => void;
};

/**
 The menu DOM the renderer currently owns, keyed by the model reference it
 was built from: reference equality on `model` is enough to decide
 recreate-vs-patch, since the model tree is built once and frozen.
 */
type MenuHandle<M extends AnyModelNode> = {
  model: ModelMenus<M>;
  menu: Menu;
};

/**
 One stroke canvas (upper or lower), owning its own reference-equality cache
 so an unchanged stroke array skips the redraw. `upperStroke` and
 `lowerStroke` are two independent instances of the exact same behavior.
 */
function createStrokeLayer({
  parent,
  canvasOptions,
}: {
  parent: HTMLElement;
  canvasOptions?: Omit<StrokeCanvasOptions, 'parent'>;
}): {
  sync: (
    stroke: readonly Point[] | null,
    options?: { drawStartPoint?: boolean },
  ) => void;
  element: () => HTMLCanvasElement | null;
  dispose: () => void;
} {
  let canvas: StrokeCanvas | null = null;
  let previousStroke: readonly Point[] | null = null;

  const draw = rafThrottle(
    (stroke: readonly Point[], shouldDrawStartPoint: boolean) => {
      canvas?.clear();
      canvas?.drawStroke(stroke);
      const [start] = stroke;
      if (shouldDrawStartPoint && start !== undefined) {
        canvas?.drawPoint(start);
      }
    },
  );

  return {
    sync(stroke, { drawStartPoint: shouldDrawStartPoint = false } = {}) {
      if (stroke === null) {
        canvas?.remove();
        canvas = null;
        previousStroke = null;
      } else if (stroke !== previousStroke) {
        previousStroke = stroke;
        canvas ??= createStrokeCanvas({ parent, ...canvasOptions });
        draw(stroke, shouldDrawStartPoint);
      }
    },
    element: () => canvas?.element ?? null,
    dispose() {
      draw.cancel();
      canvas?.remove();
      canvas = null;
    },
  };
}

/**
 Whether `node` is painted before `other`. The two are always siblings under
 the renderer's parent, never nested, so `compareDocumentPosition` returns
 exactly one of the two ordering flags and nothing has to be masked off.
 */
function isPaintedBefore(node: Node, other: Node): boolean {
  return (
    node.compareDocumentPosition(other) === Node.DOCUMENT_POSITION_FOLLOWING
  );
}

export type RendererOptions = {
  readonly parent: HTMLElement;
  /**
  The color of the upper (current gesture) stroke.
  */
  readonly strokeColor?: string | undefined;
  /**
  The width of the upper stroke.
  */
  readonly strokeWidth?: number | undefined;
  /**
   The radius of the point marking the start of the upper stroke, drawn while
   novice mode is open.
   */
  readonly strokeStartPointRadius?: number | undefined;
  /**
   The color of the lower stroke, tracking movement accumulated before the
   currently open menu.
   */
  readonly lowerStrokeColor?: string | undefined;
  /**
  The width of the lower stroke. Defaults to `strokeWidth`.
  */
  readonly lowerStrokeWidth?: number | undefined;
  /**
  The radius of the lower stroke's start point. Defaults to `lowerStrokeWidth`.
  */
  readonly lowerStrokeStartPointRadius?: number | undefined;
  /**
  The duration a completed-gesture feedback trace stays visible, in ms.
  */
  readonly gestureFeedbackDuration?: number | undefined;
  /**
  The width of a gesture-feedback stroke. Defaults to `strokeWidth`.
  */
  readonly gestureFeedbackStrokeWidth?: number | undefined;
  /**
  The color of a selected gesture's feedback stroke. Defaults to `strokeColor`.
  */
  readonly gestureFeedbackStrokeColor?: string | undefined;
  /**
  The color of a canceled gesture's feedback stroke.
  */
  readonly gestureFeedbackCanceledStrokeColor?: string | undefined;
};

export function createRenderer<M extends AnyModelNode = AnyModelNode>({
  parent,
  strokeColor = '#000',
  strokeWidth = 4,
  strokeStartPointRadius = 8,
  lowerStrokeColor = '#777',
  lowerStrokeWidth = strokeWidth,
  lowerStrokeStartPointRadius = lowerStrokeWidth,
  gestureFeedbackDuration = 1000,
  gestureFeedbackStrokeWidth = strokeWidth,
  gestureFeedbackStrokeColor = strokeColor,
  gestureFeedbackCanceledStrokeColor = '#DE6C52',
}: RendererOptions): LayoutRenderer<M> {
  let menuHandle: MenuHandle<M> | null = null;
  // Reference-equality cache: an unchanged active key skips the DOM scan
  // `Menu.setActive` performs.
  let previousActiveKey: string | null = null;
  const upperStroke = createStrokeLayer({
    parent,
    canvasOptions: {
      lineColor: strokeColor,
      lineWidth: strokeWidth,
      pointRadius: strokeStartPointRadius,
    },
  });
  const lowerStroke = createStrokeLayer({
    parent,
    canvasOptions: {
      lineColor: lowerStrokeColor,
      lineWidth: lowerStrokeWidth,
      pointRadius: lowerStrokeStartPointRadius,
    },
  });
  // The parent's own inline cursor, read before the renderer writes one, and
  // restored rather than cleared whenever the view asks for `default`: what
  // the renderer did not set, it does not get to throw away.
  const ownCursor = parent.style.cursor;
  const gestureFeedback = createGestureFeedback({
    parent,
    duration: gestureFeedbackDuration,
    strokeOptions: {
      lineColor: gestureFeedbackStrokeColor,
      lineWidth: gestureFeedbackStrokeWidth,
    },
    canceledStrokeOptions: {
      lineColor: gestureFeedbackCanceledStrokeColor,
    },
  });

  /**
   The paint order the novice feedback depends on: the lower stroke, which
   records movement made before the menu opened, goes behind the menu; the
   upper stroke and its origin marker go in front of it, so the marker
   stays visible and the line is not cut where it crosses an item.

   A completed-gesture trace belongs in front of the menu as well. It
   outlives the gesture that produced it, so a menu opened before it fades
   is appended after it and would cover it.

   Nothing in the stylesheet sets any of this, and each canvas and the menu
   land wherever they were first needed, so sibling order is all that holds
   it. Every render re-asserts that order, moving an element only when it
   is out of place.
   */
  function restack(): void {
    const menuElement = menuHandle?.menu.element;
    if (menuElement === undefined) {
      return;
    }

    const lower = lowerStroke.element();
    if (lower !== null && !isPaintedBefore(lower, menuElement)) {
      menuElement.before(lower);
    }

    const upper = upperStroke.element();
    if (upper !== null && !isPaintedBefore(menuElement, upper)) {
      menuElement.after(upper);
    }

    // After the upper stroke, so a live gesture still draws over a fading
    // trace of the previous one.
    for (const trace of gestureFeedback.elements()) {
      if (!isPaintedBefore(menuElement, trace)) {
        menuElement.after(trace);
      }
    }
  }

  return {
    render(view) {
      parent.style.cursor = view.cursor === 'default' ? ownCursor : view.cursor;
      // `projectLayout` sets `cursor: 'none'` exactly in novice mode: the
      // only phase where the upper stroke's origin point (the gesture's
      // start) is drawn alongside the line.
      const isNoviceMode = view.cursor === 'none';

      if (view.menu === null) {
        menuHandle?.menu.remove();
        menuHandle = null;
        previousActiveKey = null;
      } else {
        if (menuHandle?.model !== view.menu.model) {
          menuHandle?.menu.remove();
          // `LayoutView.menu.center` is in client coordinates; the menu
          // layout wants it relative to `parent`. This is the one
          // DOM-dependent conversion the projector deliberately leaves to
          // the renderer.
          const cbr = parent.getBoundingClientRect();
          menuHandle = {
            model: view.menu.model,
            menu: createMenu({
              parent,
              // `ModelMenus<M>`'s `items` are generically erased to
              // `AnyModelNode` inside this function body, the same reason
              // `recognize-mm-stroke.ts`'s `walkModelLoose` needs a cast:
              // the compiler cannot prove genericness away. Every real menu
              // item built by `model.ts` carries `key`/`label`/`angle`.
              model: view.menu.model as unknown as MenuLayoutModel,
              center: toLocalPoint(view.menu.center, cbr),
            }),
          };
          previousActiveKey = null;
        }

        if (view.menu.activeKey !== previousActiveKey) {
          previousActiveKey = view.menu.activeKey;
          menuHandle.menu.setActive(view.menu.activeKey);
        }
      }

      upperStroke.sync(view.upperStroke, { drawStartPoint: isNoviceMode });
      lowerStroke.sync(view.lowerStroke);
      restack();
    },
    showFeedback(effect) {
      gestureFeedback.show(effect.stroke, { canceled: effect.canceled });
    },
    dispose() {
      parent.style.cursor = ownCursor;
      upperStroke.dispose();
      lowerStroke.dispose();
      menuHandle?.menu.remove();
      menuHandle = null;
      gestureFeedback.remove();
    },
  };
}

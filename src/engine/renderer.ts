import { createGestureFeedback } from '../layout/gesture-feedback.js';
import {
  createMenu,
  type Menu,
  type MenuLayoutModel,
  type MenuStrokeTheme,
} from '../layout/menu.js';
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

type StrokeLayers = {
  upper: ReturnType<typeof createStrokeLayer>;
  lower: ReturnType<typeof createStrokeLayer>;
  feedback: ReturnType<typeof createGestureFeedback>;
};

const defaultStrokeTheme: MenuStrokeTheme = {
  strokeColor: '#000000',
  strokeWidth: 4,
  strokeStartPointRadius: 8,
  lowerStrokeColor: '#777777',
  lowerStrokeWidth: 4,
  lowerStrokeStartPointRadius: 4,
  gestureFeedbackStrokeColor: '#000000',
  gestureFeedbackStrokeWidth: 4,
  gestureFeedbackCanceledStrokeColor: '#de6c52',
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
      // Strokes arrive in client coordinates, straight from the pointer; a
      // canvas draws relative to its own top-left, which is the parent's.
      // Converting here rather than in `sync` keeps that method's reference
      // check comparing the array the caller passed, and picks up a parent
      // that has since moved or scrolled.
      const rect = parent.getBoundingClientRect();
      const local = stroke.map((point) => toLocalPoint(point, rect));
      canvas?.clear();
      canvas?.drawStroke(local);
      const [start] = local;
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

function createStrokeLayers(
  parent: HTMLElement,
  strokeTheme: MenuStrokeTheme,
  gestureFeedbackDuration: number,
): StrokeLayers {
  return {
    upper: createStrokeLayer({
      parent,
      canvasOptions: {
        lineColor: strokeTheme.strokeColor,
        lineWidth: strokeTheme.strokeWidth,
        pointRadius: strokeTheme.strokeStartPointRadius,
      },
    }),
    lower: createStrokeLayer({
      parent,
      canvasOptions: {
        lineColor: strokeTheme.lowerStrokeColor,
        lineWidth: strokeTheme.lowerStrokeWidth,
        pointRadius: strokeTheme.lowerStrokeStartPointRadius,
      },
    }),
    feedback: createGestureFeedback({
      parent,
      duration: gestureFeedbackDuration,
      strokeOptions: {
        lineColor: strokeTheme.gestureFeedbackStrokeColor,
        lineWidth: strokeTheme.gestureFeedbackStrokeWidth,
      },
      canceledStrokeOptions: {
        lineColor: strokeTheme.gestureFeedbackCanceledStrokeColor,
      },
    }),
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
  readonly deadZoneRadius?: number | undefined;
  /**
  The duration a completed-gesture feedback trace stays visible, in ms.
  */
  readonly gestureFeedbackDuration?: number | undefined;
};

export function createRenderer<M extends AnyModelNode = AnyModelNode>({
  parent,
  deadZoneRadius = 40,
  gestureFeedbackDuration = 1000,
}: RendererOptions): LayoutRenderer<M> {
  let menuHandle: MenuHandle<M> | null = null;
  // Reference-equality cache: an unchanged active key skips the DOM scan
  // `Menu.setActive` performs.
  let previousActiveKey: string | null = null;
  let strokeLayers = createStrokeLayers(
    parent,
    defaultStrokeTheme,
    gestureFeedbackDuration,
  );
  const previousFeedbackLayers: Array<StrokeLayers['feedback']> = [];
  // The parent's own inline cursor, read before the renderer writes one, and
  // restored rather than cleared whenever the view asks for `default`: what
  // the renderer did not set, it does not get to throw away.
  const ownCursor = parent.style.cursor;
  const setStrokeTheme = (strokeTheme: MenuStrokeTheme) => {
    if (strokeLayers.feedback.elements().length > 0) {
      previousFeedbackLayers.push(strokeLayers.feedback);
    }

    strokeLayers.upper.dispose();
    strokeLayers.lower.dispose();
    strokeLayers = createStrokeLayers(
      parent,
      strokeTheme,
      gestureFeedbackDuration,
    );
  };

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

    const lower = strokeLayers.lower.element();
    if (lower !== null && !isPaintedBefore(lower, menuElement)) {
      menuElement.before(lower);
    }

    const upper = strokeLayers.upper.element();
    if (upper !== null && !isPaintedBefore(menuElement, upper)) {
      menuElement.after(upper);
    }

    // After the upper stroke, so a live gesture still draws over a fading
    // trace of the previous one.
    for (const feedback of previousFeedbackLayers) {
      for (const trace of feedback.elements()) {
        if (!isPaintedBefore(menuElement, trace)) {
          menuElement.after(trace);
        }
      }
    }

    for (let index = previousFeedbackLayers.length - 1; index >= 0; index--) {
      if (previousFeedbackLayers[index]?.elements().length === 0) {
        previousFeedbackLayers.splice(index, 1);
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
          // layout wants it relative to `parent`. The projector is
          // DOM-free, so every such conversion is the renderer's to make
          // (see `createStrokeLayer` and `showFeedback` for the others).
          const cbr = parent.getBoundingClientRect();
          menuHandle = {
            model: view.menu.model,
            menu: createMenu({
              parent,
              deadZoneRadius,
              // `ModelMenus<M>`'s `items` are generically erased to
              // `AnyModelNode` inside this function body, the same reason
              // `recognize-mm-stroke.ts`'s `walkModelLoose` needs a cast:
              // the compiler cannot prove genericness away. Every real menu
              // item built by `model.ts` carries `key`/`label`/`angle`.
              model: view.menu.model as unknown as MenuLayoutModel,
              center: toLocalPoint(view.menu.center, cbr),
            }),
          };

          setStrokeTheme(menuHandle.menu.strokeTheme);
          previousActiveKey = null;
        }

        if (view.menu.activeKey !== previousActiveKey) {
          previousActiveKey = view.menu.activeKey;
          menuHandle.menu.setActive(view.menu.activeKey);
        }
      }

      strokeLayers.upper.sync(view.upperStroke, {
        drawStartPoint: isNoviceMode,
      });
      strokeLayers.lower.sync(view.lowerStroke);
      restack();
    },
    showFeedback(effect) {
      const rect = parent.getBoundingClientRect();
      strokeLayers.feedback.show(
        effect.stroke.map((point) => toLocalPoint(point, rect)),
        { canceled: effect.canceled },
      );
    },
    dispose() {
      parent.style.cursor = ownCursor;
      strokeLayers.upper.dispose();
      strokeLayers.lower.dispose();
      menuHandle?.menu.remove();
      menuHandle = null;
      for (const feedback of previousFeedbackLayers) {
        feedback.remove();
      }

      strokeLayers.feedback.remove();
    },
  };
}

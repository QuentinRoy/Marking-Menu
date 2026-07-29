import { createGestureFeedback } from '../layout/gesture-feedback.js';
import { createMenu, type Menu, type MenuLayoutModel } from '../layout/menu.js';
import { rafThrottle } from '../layout/raf-throttle.js';
import { createStrokeCanvas, type StrokeCanvas } from '../layout/stroke.js';
import type { AnyModelNode, ModelMenus } from '../types.js';
import type { Point } from '../utils.js';
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

export function createRenderer<M extends AnyModelNode = AnyModelNode>({
  parent,
}: {
  parent: HTMLElement;
}): LayoutRenderer<M> {
  let upperStrokeCanvas: StrokeCanvas | null = null;
  let lowerStrokeCanvas: StrokeCanvas | null = null;
  // Reference-equality caches: an unchanged array skips the redraw.
  let previousUpperStroke: readonly Point[] | null = null;
  let previousLowerStroke: readonly Point[] | null = null;
  let menuHandle: MenuHandle<M> | null = null;
  // The parent's own inline cursor, read before the renderer writes one, and
  // restored rather than cleared whenever the view asks for `default`: what
  // the renderer did not set, it does not get to throw away.
  const ownCursor = parent.style.cursor;
  const gestureFeedback = createGestureFeedback({ parent, duration: 1000 });

  const drawUpperStroke = rafThrottle((stroke: readonly Point[]) => {
    upperStrokeCanvas?.clear();
    upperStrokeCanvas?.drawStroke(stroke);
  });

  const drawLowerStroke = rafThrottle((stroke: readonly Point[]) => {
    lowerStrokeCanvas?.clear();
    lowerStrokeCanvas?.drawStroke(stroke);
  });

  return {
    render(view) {
      parent.style.cursor = view.cursor === 'default' ? ownCursor : view.cursor;

      if (view.menu === null) {
        menuHandle?.menu.remove();
        menuHandle = null;
      } else if (menuHandle?.model !== view.menu.model) {
        menuHandle?.menu.remove();
        // `LayoutView.menu.center` is in client coordinates; the menu layout
        // wants it relative to `parent`. This is the one DOM-dependent
        // conversion the projector deliberately leaves to the renderer.
        const cbr = parent.getBoundingClientRect();
        menuHandle = {
          model: view.menu.model,
          menu: createMenu({
            parent,
            // `ModelMenus<M>`'s `items` are generically erased to
            // `AnyModelNode` inside this function body, the same reason
            // `recognize-mm-stroke.ts`'s `walkModelLoose` needs a cast: the
            // compiler cannot prove genericness away. Every real menu item
            // built by `model.ts` carries `key`/`label`/`angle`.
            model: view.menu.model as unknown as MenuLayoutModel,
            center: [
              view.menu.center[0] - cbr.left,
              view.menu.center[1] - cbr.top,
            ],
          }),
        };
      }

      menuHandle?.menu.setActive(view.menu?.activeKey ?? null);

      if (view.upperStroke === null) {
        upperStrokeCanvas?.remove();
        upperStrokeCanvas = null;
        previousUpperStroke = null;
      } else if (view.upperStroke !== previousUpperStroke) {
        previousUpperStroke = view.upperStroke;
        upperStrokeCanvas ??= createStrokeCanvas({ parent });
        drawUpperStroke(view.upperStroke);
      }

      if (view.lowerStroke === null) {
        lowerStrokeCanvas?.remove();
        lowerStrokeCanvas = null;
        previousLowerStroke = null;
      } else if (view.lowerStroke !== previousLowerStroke) {
        previousLowerStroke = view.lowerStroke;
        lowerStrokeCanvas ??= createStrokeCanvas({ parent });
        drawLowerStroke(view.lowerStroke);
      }
    },
    showFeedback(effect) {
      gestureFeedback.show(effect.stroke, { canceled: effect.canceled });
    },
    dispose() {
      parent.style.cursor = ownCursor;
      drawUpperStroke.cancel();
      drawLowerStroke.cancel();
      upperStrokeCanvas?.remove();
      upperStrokeCanvas = null;
      lowerStrokeCanvas?.remove();
      lowerStrokeCanvas = null;
      menuHandle?.menu.remove();
      menuHandle = null;
      gestureFeedback.remove();
    },
  };
}

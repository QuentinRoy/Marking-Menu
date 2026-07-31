import { createGestureFeedback } from '../layout/gesture-feedback.js';
import { createMenu, type Menu, type MenuLayoutModel } from '../layout/menu.js';
import { rafThrottle } from '../layout/raf-throttle.js';
import { createStrokeCanvas, type StrokeCanvas } from '../layout/stroke.js';
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
function createStrokeLayer({ parent }: { parent: HTMLElement }): {
  sync: (stroke: readonly Point[] | null) => void;
  dispose: () => void;
} {
  let canvas: StrokeCanvas | null = null;
  let previousStroke: readonly Point[] | null = null;

  const draw = rafThrottle((stroke: readonly Point[]) => {
    canvas?.clear();
    canvas?.drawStroke(stroke);
  });

  return {
    sync(stroke) {
      if (stroke === null) {
        canvas?.remove();
        canvas = null;
        previousStroke = null;
      } else if (stroke !== previousStroke) {
        previousStroke = stroke;
        canvas ??= createStrokeCanvas({ parent });
        draw(stroke);
      }
    },
    dispose() {
      draw.cancel();
      canvas?.remove();
      canvas = null;
    },
  };
}

export function createRenderer<M extends AnyModelNode = AnyModelNode>({
  parent,
}: {
  parent: HTMLElement;
}): LayoutRenderer<M> {
  let menuHandle: MenuHandle<M> | null = null;
  // Reference-equality cache: an unchanged active key skips the DOM scan
  // `Menu.setActive` performs.
  let previousActiveKey: string | null = null;
  const upperStroke = createStrokeLayer({ parent });
  const lowerStroke = createStrokeLayer({ parent });
  // The parent's own inline cursor, read before the renderer writes one, and
  // restored rather than cleared whenever the view asks for `default`: what
  // the renderer did not set, it does not get to throw away.
  const ownCursor = parent.style.cursor;
  const gestureFeedback = createGestureFeedback({ parent, duration: 1000 });

  return {
    render(view) {
      parent.style.cursor = view.cursor === 'default' ? ownCursor : view.cursor;

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

      upperStroke.sync(view.upperStroke);
      lowerStroke.sync(view.lowerStroke);
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

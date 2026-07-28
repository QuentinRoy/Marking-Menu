import { createGestureFeedback } from '../layout/gesture-feedback.js';
import { rafThrottle } from '../layout/raf-throttle.js';
import { createStrokeCanvas, type StrokeCanvas } from '../layout/stroke.js';
import type { Point } from '../utils.js';
import type { LayoutView } from './layout-view.js';

export type FeedbackEffect = {
  readonly stroke: readonly Point[];
  readonly canceled: boolean;
};

export type LayoutRenderer = {
  render: (view: LayoutView) => void;
  showFeedback: (effect: FeedbackEffect) => void;
  dispose: () => void;
};

export function createRenderer({
  parent,
}: {
  parent: HTMLElement;
}): LayoutRenderer {
  let upperStrokeCanvas: StrokeCanvas | null = null;
  // Reference-equality cache: an unchanged stroke array skips the redraw.
  let previousUpperStroke: readonly Point[] | null = null;
  const gestureFeedback = createGestureFeedback({ parent, duration: 1000 });

  const drawUpperStroke = rafThrottle((stroke: readonly Point[]) => {
    upperStrokeCanvas?.clear();
    upperStrokeCanvas?.drawStroke(stroke);
  });

  return {
    render(view) {
      parent.style.cursor = view.cursor === 'default' ? '' : view.cursor;

      if (view.upperStroke === null) {
        upperStrokeCanvas?.remove();
        upperStrokeCanvas = null;
        previousUpperStroke = null;
        return;
      }

      if (view.upperStroke === previousUpperStroke) {
        return;
      }

      previousUpperStroke = view.upperStroke;
      upperStrokeCanvas ??= createStrokeCanvas({ parent });
      drawUpperStroke(view.upperStroke);
    },
    showFeedback(effect) {
      gestureFeedback.show(effect.stroke, { canceled: effect.canceled });
    },
    dispose() {
      parent.style.cursor = '';
      upperStrokeCanvas?.remove();
      upperStrokeCanvas = null;
      gestureFeedback.remove();
    },
  };
}

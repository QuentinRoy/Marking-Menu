import type { Point } from '../utils.js';
import {
  createStrokeSurface,
  type StrokeSurface,
  type StrokeSurfaceOptions,
} from './stroke.js';

/**
 Stroke surface options of the gesture feedback (the parent is provided by the
 gesture feedback itself).
 */
export type GestureFeedbackStrokeOptions = Omit<StrokeSurfaceOptions, 'parent'>;

/**
 The gesture feedback controls.
 */
export type GestureFeedback = {
  /**
  Show the feedback for the given stroke.
  */
  show: (stroke: readonly Point[], options?: { canceled?: boolean }) => void;
  /**
  The surfaces of the traces still showing, so callers can place them among
  their siblings.
  */
  elements: () => readonly SVGSVGElement[];
  /**
  Immediately remove any shown feedback.
  */
  remove: () => void;
};

type StrokeTimeoutEntry = {
  surface: StrokeSurface;
  timeout: ReturnType<typeof setTimeout>;
};

export function createGestureFeedback({
  parent: parentDOM,
  duration,
  strokeOptions = {},
  canceledStrokeOptions = {},
}: {
  /**
  The parent node.
  */
  parent: HTMLElement | ShadowRoot;
  /**
  The duration of the feedback, in milliseconds.
  */
  duration: number;
  /**
  The options of the feedback strokes.
  */
  strokeOptions?: GestureFeedbackStrokeOptions;
  /**
  The options of the canceled feedback strokes.
  */
  canceledStrokeOptions?: GestureFeedbackStrokeOptions;
}): GestureFeedback {
  let strokeTimeoutEntries: StrokeTimeoutEntry[] = [];

  const show = (
    stroke: readonly Point[],
    { canceled = false }: { canceled?: boolean } = {},
  ) => {
    const surface = createStrokeSurface({
      parent: parentDOM,
      ...strokeOptions,
      ...(canceled && canceledStrokeOptions),
    });
    surface.drawStroke(stroke);
    const timeoutEntry: StrokeTimeoutEntry = {
      surface,
      timeout: setTimeout(() => {
        strokeTimeoutEntries = strokeTimeoutEntries.filter(
          (x) => x !== timeoutEntry,
        );
        surface.remove();
      }, duration),
    };
    strokeTimeoutEntries.push(timeoutEntry);
  };

  const remove = () => {
    for (const { timeout, surface } of strokeTimeoutEntries) {
      clearTimeout(timeout);
      surface.remove();
    }

    strokeTimeoutEntries = [];
  };

  const elements = () =>
    strokeTimeoutEntries.map(({ surface }) => surface.element);

  return { show, elements, remove };
}

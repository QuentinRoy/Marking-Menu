import { createGestureFeedback } from '../layout/gesture-feedback.js';
import {
  createIndicatorSurface,
  type IndicatorSurfaceOptions,
} from '../layout/indicator.js';
import {
  createMenu,
  createMenuHost,
  type Menu,
  type MenuLayoutModel,
  type MenuStrokeTheme,
} from '../layout/menu.js';
import { rafThrottle } from '../layout/raf-throttle.js';
import {
  createStrokeSurface,
  type StrokeSurface,
  type StrokeSurfaceOptions,
} from '../layout/stroke.js';
import type { Point } from '../utils.js';
import type { LayoutView } from './layout-view.js';
import { createScene, type SceneSlots } from '../layout/scene.js';

export type FeedbackEffect = {
  readonly stroke: readonly Point[];
  readonly canceled: boolean;
};

export type LayoutRenderer = {
  /**
  The shadow root this renderer's menu (and any submenu) mounts into.
  */
  root: ShadowRoot;
  render: (view: LayoutView) => void;
  showFeedback: (effect: FeedbackEffect) => void;
  dispose: () => void;
};

/**
 The menu DOM the renderer currently owns, keyed by the model reference it
 was built from: reference equality on `model` is enough to decide
 recreate-vs-patch, since the model tree is built once and frozen.
 */
type MenuHandle = {
  model: MenuLayoutModel;
  menu: Menu;
};

/**
 One indicator surface, growing on its own clock rather than in response to
 renders: while the pointer dwells, nothing else changes, so the layout
 announcement carrying the indicator arrives once and the growth has to keep
 animating on its own frame loop until either it clears (`sync(undefined)`)
 or a fresh dwell (a new `startedAt`) restarts it. The machine owns that
 clock; the loop just reads elapsed time against it. `position` is tracked
 separately from `startedAt`: the machine's own movement anchor, and so
 `startedAt`, can lag the pointer by up to `movementsThreshold`, since
 sub-threshold movement doesn't restart the dwell, but the indicator itself
 must always sit exactly where the stroke's own tip currently is, so every
 `sync` call updates `position` even when `startedAt` (and so the growth's
 timing) does not restart.
 */
function createIndicatorLayer({
  backgroundSlot,
  dotSlot,
  convert,
  surfaceOptions,
}: {
  backgroundSlot: HTMLElement;
  dotSlot: HTMLElement;
  /**
  Page-to-local conversion, called on every tick so a parent that has since
  moved or scrolled is picked up.
  */
  convert: (point: Point) => Point;
  surfaceOptions?: Omit<IndicatorSurfaceOptions, 'parent'>;
}): {
  sync: (indicator: LayoutView['indicator']) => void;
  dispose: () => void;
} {
  let surface: ReturnType<typeof createIndicatorSurface> | undefined;
  let currentStartedAt: number | undefined;
  let currentPosition: Point | undefined;
  let frame = -1;

  const stop = (): void => {
    if (frame === -1) {
      return;
    }

    cancelAnimationFrame(frame);
    frame = -1;
  };

  const tick = (delayMs: number, startTime: number): void => {
    if (currentPosition === undefined) {
      return;
    }

    const progress = Math.min(1, (Date.now() - startTime) / delayMs);
    surface?.draw(convert(currentPosition), progress);
    frame =
      progress < 1
        ? requestAnimationFrame(() => {
            tick(delayMs, startTime);
          })
        : -1;
  };

  return {
    sync(indicator) {
      if (indicator === undefined) {
        stop();
        surface?.remove();
        surface = undefined;
        currentStartedAt = undefined;
        currentPosition = undefined;
        return;
      }

      surface ??= createIndicatorSurface({
        parent: backgroundSlot,
        backgroundParent: backgroundSlot,
        dotParent: dotSlot,
        ...surfaceOptions,
      });
      currentPosition = indicator.position;
      if (indicator.startedAt === currentStartedAt) {
        return;
      }

      currentStartedAt = indicator.startedAt;
      stop();
      tick(indicator.delayMs, indicator.startedAt);
    },
    dispose() {
      stop();
      surface?.remove();
      surface = undefined;
    },
  };
}

/**
 One stroke surface (upper or lower), owning its own reference-equality cache
 so an unchanged stroke array skips the redraw. `upperStroke` and
 `lowerStroke` are two independent instances of the exact same behavior.
 */
function createStrokeLayer({
  slot,
  convert,
  surfaceOptions,
}: {
  slot: HTMLElement;
  /**
  Page-to-local conversion, called inside the animation frame rather than in
  `sync` so the reference check in `sync` keeps comparing the array the
  caller passed, and a parent that has since moved or scrolled is picked up.
  */
  convert: (point: Point) => Point;
  surfaceOptions?: Omit<StrokeSurfaceOptions, 'parent'>;
}): {
  sync: (
    stroke: readonly Point[] | undefined,
    options?: { drawStartPoint?: boolean },
  ) => void;
  dispose: () => void;
} {
  let surface: StrokeSurface | undefined;
  let previousStroke: readonly Point[] | undefined;

  const draw = rafThrottle(
    (stroke: readonly Point[], shouldDrawStartPoint: boolean) => {
      // Strokes arrive in client coordinates, straight from the pointer. The
      // surface draws relative to its own top-left, which is the parent's.
      const local = stroke.map((point) => convert(point));
      surface?.drawStroke(local);
      const [start] = local;
      if (shouldDrawStartPoint && start !== undefined) {
        surface?.drawPoint(start);
      }
    },
  );

  return {
    sync(stroke, { drawStartPoint: shouldDrawStartPoint = false } = {}) {
      if (stroke === undefined) {
        surface?.remove();
        surface = undefined;
        previousStroke = undefined;
      } else if (stroke !== previousStroke) {
        previousStroke = stroke;
        surface ??= createStrokeSurface({ parent: slot, ...surfaceOptions });
        draw(stroke, shouldDrawStartPoint);
      }
    },
    dispose() {
      draw.cancel();
      surface?.remove();
      surface = undefined;
    },
  };
}

/**
 The stroke and feedback layers: pure CSS-themed SVG surfaces with nothing in
 their creation depending on `MenuStrokeTheme`, so they live for the
 renderer's whole lifetime instead of being rebuilt per menu, and a CSS
 theme change reaches them immediately rather than on the next open.
 */
function createPersistentStrokeLayers(
  slots: Pick<SceneSlots, 'upper' | 'lower' | 'feedback'>,
  convert: (point: Point) => Point,
  gestureFeedbackDuration: number,
): {
  upper: ReturnType<typeof createStrokeLayer>;
  lower: ReturnType<typeof createStrokeLayer>;
  feedback: ReturnType<typeof createGestureFeedback>;
} {
  return {
    upper: createStrokeLayer({ slot: slots.upper, convert }),
    lower: createStrokeLayer({
      slot: slots.lower,
      convert,
      surfaceOptions: { className: 'marking-menu-stroke--lower' },
    }),
    feedback: createGestureFeedback({
      parent: slots.feedback,
      duration: gestureFeedbackDuration,
      strokeOptions: { className: 'marking-menu-stroke--feedback' },
      canceledStrokeOptions: {
        className:
          'marking-menu-stroke--feedback marking-menu-stroke--canceled',
      },
    }),
  };
}

function createThemedIndicatorLayer(
  slots: Pick<SceneSlots, 'indicatorBackground' | 'indicatorDot'>,
  convert: (point: Point) => Point,
  strokeTheme: MenuStrokeTheme,
): ReturnType<typeof createIndicatorLayer> {
  return createIndicatorLayer({
    backgroundSlot: slots.indicatorBackground,
    dotSlot: slots.indicatorDot,
    convert,
    surfaceOptions: {
      radius: strokeTheme.strokeStartPointRadius,
      strokeWidth: strokeTheme.strokeWidth,
    },
  });
}

export type RendererOptions = {
  readonly parent: HTMLElement;
  readonly deadZoneRadius: number;
  /**
  The duration a completed-gesture feedback trace stays visible, in ms.
  */
  readonly gestureFeedbackDuration: number;
};

export function createRenderer({
  parent,
  deadZoneRadius,
  gestureFeedbackDuration,
}: RendererOptions): LayoutRenderer {
  const {
    element: host,
    root,
    strokeTheme: initialStrokeTheme,
  } = createMenuHost({ parent });
  let menuHandle: MenuHandle | undefined;
  // Reference-equality cache: an unchanged active key skips the DOM scan
  // `Menu.setActive` performs.
  let previousActiveKey: string | undefined;
  // Fixed slots in paint order plus the single page-to-local conversion every
  // layer shares. Paint order needs no repair: each layer mounts into its own
  // slot, once, and stays there.
  const scene = createScene({ root, parent });
  const { upper, lower, feedback } = createPersistentStrokeLayers(
    scene.slots,
    scene.toLocal,
    gestureFeedbackDuration,
  );
  let indicator = createThemedIndicatorLayer(
    scene.slots,
    scene.toLocal,
    initialStrokeTheme,
  );
  // The parent's own inline cursor, read before the renderer writes one, and
  // restored rather than cleared whenever the view asks for `default`: what
  // the renderer did not set, it does not get to throw away.
  const ownCursor = parent.style.cursor;
  const setStrokeTheme = (strokeTheme: MenuStrokeTheme) => {
    indicator.dispose();
    indicator = createThemedIndicatorLayer(
      scene.slots,
      scene.toLocal,
      strokeTheme,
    );
  };

  return {
    root,
    render(view) {
      parent.style.cursor = view.cursor === 'default' ? ownCursor : view.cursor;
      // A menu is open exactly in novice mode: the only phase where the
      // upper stroke's origin point (the gesture's start) is drawn
      // alongside the line. `cursor` alone no longer distinguishes this,
      // since startup and expert now also hide the cursor while their own
      // opening indicator is shown.
      const isNoviceMode = view.menu !== undefined;

      if (view.menu === undefined) {
        menuHandle?.menu.remove();
        menuHandle = undefined;
        previousActiveKey = undefined;
      } else {
        if (menuHandle?.model !== view.menu.model) {
          menuHandle?.menu.remove();
          // `LayoutView.menu.center` is in client coordinates; the menu
          // layout wants it relative to `parent`. The projector is
          // DOM-free, so the scene converts it here, eagerly: menu creation
          // draws synchronously, so there is no later frame where the
          // parent could have moved (unlike strokes and the indicator,
          // which convert lazily inside their own draw loops).
          const handle = {
            model: view.menu.model,
            menu: createMenu({
              parent: root,
              layerParent: scene.slots.menu,
              deadZoneRadius,
              model: view.menu.model,
              center: scene.toLocal(view.menu.center),
            }),
          };
          menuHandle = handle;
          setStrokeTheme(handle.menu.strokeTheme);
          previousActiveKey = undefined;
        }

        if (view.menu.activeKey !== previousActiveKey) {
          previousActiveKey = view.menu.activeKey;
          menuHandle?.menu.setActive(view.menu.activeKey);
        }
      }

      upper.sync(view.upperStroke, { drawStartPoint: isNoviceMode });
      lower.sync(view.lowerStroke);
      indicator.sync(view.indicator);
    },
    showFeedback(effect) {
      // Like the menu center, feedback draws synchronously, so converting
      // eagerly here is already late enough.
      feedback.show(scene.toLocalMany(effect.stroke), {
        canceled: effect.canceled,
      });
    },
    dispose() {
      parent.style.cursor = ownCursor;
      upper.dispose();
      lower.dispose();
      indicator.dispose();
      menuHandle?.menu.remove();
      menuHandle = undefined;
      feedback.remove();
      scene.dispose();
      host.remove();
    },
  };
}

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
import type { AnyModelNode, ModelMenus } from '../types.js';
import { toLocalPoint, type Point } from '../utils.js';
import type { LayoutView } from './layout-view.js';

export type FeedbackEffect = {
  readonly stroke: readonly Point[];
  readonly canceled: boolean;
};

export type LayoutRenderer<M extends AnyModelNode> = {
  /**
  The shadow root this renderer's menu (and any submenu) mounts into.
  */
  root: ShadowRoot;
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
 One indicator surface, growing on its own clock rather than in response to
 renders: while the pointer dwells, nothing else changes, so the layout
 announcement carrying the indicator arrives once and the growth has to keep
 animating on its own frame loop until either it clears (`sync(undefined)`)
 or a fresh dwell (a new `startedAt`) restarts it. The machine owns that
 clock; the loop just reads elapsed time against it. `position` is tracked
 separately: it can lag behind the pointer by up to `movementsThreshold`,
 but the indicator itself must always sit exactly where the stroke's own tip
 currently is, so every `sync` call updates it even when the dwell (and so
 the growth's timing) does not restart.
 */
function createIndicatorLayer({
  parent,
  coordinateParent,
  surfaceOptions,
}: {
  parent: ShadowRoot;
  coordinateParent: HTMLElement;
  surfaceOptions?: Omit<IndicatorSurfaceOptions, 'parent'>;
}): {
  sync: (indicator: LayoutView<AnyModelNode>['indicator']) => void;
  backgroundElement: () => SVGSVGElement | undefined;
  dotElement: () => SVGSVGElement | undefined;
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

    const rect = coordinateParent.getBoundingClientRect();
    const progress = Math.min(1, (Date.now() - startTime) / delayMs);
    surface?.draw(toLocalPoint(currentPosition, rect), progress);
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

      surface ??= createIndicatorSurface({ parent, ...surfaceOptions });
      currentPosition = indicator.position;
      if (indicator.startedAt !== currentStartedAt) {
        currentStartedAt = indicator.startedAt;
        stop();
        tick(indicator.delayMs, indicator.startedAt);
      }
    },
    backgroundElement: () => surface?.backgroundElement ?? undefined,
    dotElement: () => surface?.dotElement ?? undefined,
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
  parent,
  coordinateParent,
  surfaceOptions,
}: {
  parent: ShadowRoot;
  coordinateParent: HTMLElement;
  surfaceOptions?: Omit<StrokeSurfaceOptions, 'parent'>;
}): {
  sync: (
    stroke: readonly Point[] | undefined,
    options?: { drawStartPoint?: boolean },
  ) => void;
  element: () => SVGSVGElement | undefined;
  dispose: () => void;
} {
  let surface: StrokeSurface | undefined;
  let previousStroke: readonly Point[] | undefined;

  const draw = rafThrottle(
    (stroke: readonly Point[], shouldDrawStartPoint: boolean) => {
      // Strokes arrive in client coordinates, straight from the pointer. The
      // surface draws relative to its own top-left, which is the parent's.
      // Converting here rather than in `sync` keeps that method's reference
      // check comparing the array the caller passed, and picks up a parent
      // that has since moved or scrolled.
      const rect = coordinateParent.getBoundingClientRect();
      const local = stroke.map((point) => toLocalPoint(point, rect));
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
        surface ??= createStrokeSurface({ parent, ...surfaceOptions });
        draw(stroke, shouldDrawStartPoint);
      }
    },
    element: () => surface?.element ?? undefined,
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
  parent: ShadowRoot,
  gestureFeedbackDuration: number,
): {
  upper: ReturnType<typeof createStrokeLayer>;
  lower: ReturnType<typeof createStrokeLayer>;
  feedback: ReturnType<typeof createGestureFeedback>;
} {
  const coordinateParent = parent.host.parentElement as HTMLElement;
  return {
    upper: createStrokeLayer({ parent, coordinateParent }),
    lower: createStrokeLayer({
      parent,
      coordinateParent,
      surfaceOptions: { className: 'marking-menu-stroke--lower' },
    }),
    feedback: createGestureFeedback({
      parent,
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
  parent: ShadowRoot,
  strokeTheme: MenuStrokeTheme,
): ReturnType<typeof createIndicatorLayer> {
  return createIndicatorLayer({
    parent,
    coordinateParent: parent.host.parentElement as HTMLElement,
    surfaceOptions: {
      radius: strokeTheme.strokeStartPointRadius,
      strokeWidth: strokeTheme.strokeWidth,
    },
  });
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
  const {
    element: host,
    root,
    strokeTheme: initialStrokeTheme,
  } = createMenuHost({ parent });
  let menuHandle: MenuHandle<M> | undefined;
  // Reference-equality cache: an unchanged active key skips the DOM scan
  // `Menu.setActive` performs.
  let previousActiveKey: string | undefined;
  const { upper, lower, feedback } = createPersistentStrokeLayers(
    root,
    gestureFeedbackDuration,
  );
  let indicator = createThemedIndicatorLayer(root, initialStrokeTheme);
  // The parent's own inline cursor, read before the renderer writes one, and
  // restored rather than cleared whenever the view asks for `default`: what
  // the renderer did not set, it does not get to throw away.
  const ownCursor = parent.style.cursor;
  const setStrokeTheme = (strokeTheme: MenuStrokeTheme) => {
    indicator.dispose();
    indicator = createThemedIndicatorLayer(root, strokeTheme);
  };

  /**
   The paint order the novice feedback depends on: the lower stroke, which
   records movement made before the menu opened, goes behind the menu; the
   upper stroke and its origin marker go in front of it, so the marker
   stays visible and the line is not cut where it crosses an item.

   A completed-gesture trace belongs in front of the menu as well. It
   outlives the gesture that produced it, so a menu opened before it fades
   is appended after it and would cover it.

   Nothing in the stylesheet sets any of this, and each stroke surface and menu
   land wherever they were first needed, so sibling order is all that holds
   it. Every render re-asserts that order, moving an element only when it
   is out of place.
   */
  function restack(): void {
    const menuElement = menuHandle?.menu.layer;

    const lowerElement = lower.element();
    if (
      menuElement !== undefined &&
      lowerElement !== undefined &&
      !isPaintedBefore(lowerElement, menuElement)
    ) {
      menuElement.before(lowerElement);
    }

    // Chains every remaining layer in paint order, each moved right after
    // the one before it only when it isn't already there. `tail` starts
    // undefined when no menu is open (startup and expert, where the
    // indicator and the upper stroke draw with nothing to anchor against
    // yet): the first layer found then anchors the rest, wherever it
    // already sits.
    let tail: Element | undefined = menuElement;
    const place = (element: Element | undefined): void => {
      if (element === undefined) {
        return;
      }

      if (tail !== undefined && !isPaintedBefore(tail, element)) {
        tail.after(element);
      }

      tail = element;
    };

    // The indicator's background sits behind the upper stroke: it is
    // static, not something announcing itself in front of it. The growing
    // dot stays in front, in the upper stroke's own slot, since it is what
    // becomes the novice-mode dot there.
    place(indicator.backgroundElement());
    place(upper.element());
    place(indicator.dotElement());

    for (const trace of feedback.elements()) {
      place(trace);
    }
  }

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
          // DOM-free, so every such conversion is the renderer's to make
          // (see `createStrokeLayer` and `showFeedback` for the others).
          const cbr = parent.getBoundingClientRect();
          menuHandle = {
            model: view.menu.model,
            menu: createMenu({
              parent: root,
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
          previousActiveKey = undefined;
        }

        if (view.menu.activeKey !== previousActiveKey) {
          previousActiveKey = view.menu.activeKey;
          menuHandle.menu.setActive(view.menu.activeKey);
        }
      }

      upper.sync(view.upperStroke, { drawStartPoint: isNoviceMode });
      lower.sync(view.lowerStroke);
      indicator.sync(view.indicator);
      restack();
    },
    showFeedback(effect) {
      const rect = parent.getBoundingClientRect();
      feedback.show(
        effect.stroke.map((point) => toLocalPoint(point, rect)),
        { canceled: effect.canceled },
      );
    },
    dispose() {
      parent.style.cursor = ownCursor;
      upper.dispose();
      lower.dispose();
      indicator.dispose();
      menuHandle?.menu.remove();
      menuHandle = undefined;
      feedback.remove();
      host.remove();
    },
  };
}

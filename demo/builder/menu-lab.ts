import { createMenu, type Menu } from '../../src/layout/menu.js';
import {
  createStrokeCanvas,
  type StrokeCanvas,
} from '../../src/layout/stroke.js';
import { createModel } from '../../src/model.js';
import {
  analyzeMarkingMenuStroke,
  type MarkingMenuStrokeAnalysis,
} from '../../src/recognizer/recognize-mm-stroke.js';
import { strokeLength } from '../../src/recognizer/stroke-length.js';
import { radiansToDegrees, type Point } from '../../src/utils.js';
import {
  toMarkingMenuItems,
  type BuilderItem,
  type ItemPath,
} from './menu-config.js';

/*
 The live half of the builder page: a menu built from the current items, laid
 out and drawn exactly as the shipped library draws it, that you can click
 into (to preview a sub-menu's own layout) and draw on (to test what the
 recognizer makes of a stroke). The two are independent: clicking only
 changes which level is shown, drawing always tests the whole menu from its
 top level, resetting the shown level to match before the stroke starts so
 what's on screen matches what's being tested.
 */

const buildModel = (items: readonly BuilderItem[]) =>
  createModel({ items: toMarkingMenuItems(items) });

type BuilderModel = ReturnType<typeof buildModel>;
type BuilderModelItem = BuilderModel['items'][number];
type BuilderModelNode = BuilderModel | BuilderModelItem;

const nodeAt = (model: BuilderModel, path: ItemPath): BuilderModelNode => {
  let node: BuilderModelNode = model;
  for (const index of path) {
    const next: BuilderModelItem | undefined = node.items[index];
    if (next === undefined) {
      return model;
    }

    node = next;
  }

  return node;
};

const labelAt = (items: readonly BuilderItem[], path: ItemPath): string => {
  let level = items;
  let label = 'Top level';
  for (const index of path) {
    const item = level[index];
    if (item === undefined) {
      break;
    }

    label = item.label === '' ? '(untitled)' : item.label;
    level = item.items;
  }

  return label;
};

// A stroke shorter than this counts as a click, not a gesture: pointer
// wobble between a press and a release is normal and shouldn't be read as a
// (failed) drawing attempt.
const CLICK_MOVEMENT_PX = 8;

// A click this close to the center selects nothing: the menu itself has
// `pointer-events: none` (selection is by direction, not by DOM hit-testing,
// the same as the real recognizer), so a click needs a direction to read.
const MIN_SELECTION_DIST_PX = 20;

const localPoint = (event: PointerEvent, surface: HTMLElement): Point => {
  const rect = surface.getBoundingClientRect();
  return [event.clientX - rect.left, event.clientY - rect.top];
};

/**
 The recognizer sandbox's controls.
 */
export type MenuLab = {
  /**
   Redraw the previewed level with the new items, keeping the level shown
   and the last recognition result on screen. For a live edit, which is
   usually local to whatever the tree editor is already showing.
   */
  refresh(items: readonly BuilderItem[]): void;
  /**
   Reset the preview to the top level and clear any stroke, then redraw with
   the new items. For a wholesale replacement, e.g. the address changed.
   */
  update(items: readonly BuilderItem[]): void;
};

/**
 Build the menu preview and recognizer sandbox.

 @param options - Configuration options.
 @param options.parent - The element the lab is appended to.
 @param options.items - The tree to preview and test, initially.
 @returns The lab's controls.
 */
export function createMenuLab({
  parent,
  items,
}: {
  parent: HTMLElement;
  items: readonly BuilderItem[];
}): MenuLab {
  let currentItems = items;
  let focusPath: ItemPath = [];

  const breadcrumb = document.createElement('div');
  breadcrumb.className = 'menu-lab-breadcrumb';

  const surface = document.createElement('div');
  surface.className = 'menu-lab-surface';

  const result = document.createElement('div');
  result.className = 'menu-lab-result';
  result.textContent = 'Draw a stroke to test the recognizer.';

  parent.append(breadcrumb, surface, result);

  const menuLayer = document.createElement('div');
  menuLayer.className = 'menu-lab-menu-layer';
  surface.append(menuLayer);

  // Layered back to front: the stroke as drawn, the pieces the recognizer
  // cut it into (alternating color so consecutive pieces stay legible), then
  // the corners it found on top.
  const strokeCanvas = createStrokeCanvas({
    parent: surface,
    lineColor: 'rgba(15, 23, 42, 0.35)',
  });
  const pieceCanvases: [StrokeCanvas, StrokeCanvas] = [
    createStrokeCanvas({ parent: surface, lineColor: '#2563eb', lineWidth: 3 }),
    createStrokeCanvas({ parent: surface, lineColor: '#d97706', lineWidth: 3 }),
  ];
  const cornerCanvas = createStrokeCanvas({
    parent: surface,
    lineColor: 'transparent',
    pointColor: '#111827',
    pointRadius: 5,
  });

  let menu: Menu | null = null;

  const goToFocusPath = (path: ItemPath): void => {
    focusPath = path;
    renderMenu();
  };

  const renderBreadcrumb = (): void => {
    breadcrumb.replaceChildren();
    for (let depth = 0; depth <= focusPath.length; depth++) {
      const path = focusPath.slice(0, depth);
      if (depth > 0) {
        breadcrumb.append(document.createTextNode(' › '));
      }

      const crumb = document.createElement('button');
      crumb.type = 'button';
      crumb.className = 'menu-lab-crumb';
      crumb.textContent = labelAt(currentItems, path);
      crumb.disabled = depth === focusPath.length;
      crumb.addEventListener('click', () => {
        goToFocusPath(path);
      });
      breadcrumb.append(crumb);
    }
  };

  const renderMenu = (): void => {
    menu?.remove();
    const model = buildModel(currentItems);
    const node = nodeAt(model, focusPath);
    const { width, height } = surface.getBoundingClientRect();
    menu = createMenu({
      parent: menuLayer,
      model: node,
      center: [width / 2, height / 2],
    });
    renderBreadcrumb();
  };

  const clearDiagnostics = (): void => {
    strokeCanvas.clear();
    for (const canvas of pieceCanvases) {
      canvas.clear();
    }

    cornerCanvas.clear();
  };

  const drawDiagnostics = (
    analysis: MarkingMenuStrokeAnalysis<BuilderModelNode>,
  ): void => {
    for (const [index, segment] of analysis.segments.entries()) {
      const canvas = index % 2 === 0 ? pieceCanvases[0] : pieceCanvases[1];
      canvas.drawStroke(segment.points);
    }

    for (const point of analysis.articulationPoints) {
      cornerCanvas.drawPoint(point);
    }
  };

  const labelOf = (node: { readonly isRoot: boolean }): string =>
    'label' in node && typeof node.label === 'string' ? node.label : '';

  const reportResult = (
    analysis: MarkingMenuStrokeAnalysis<BuilderModelNode>,
  ): void => {
    const selection =
      analysis.path === null
        ? 'No selection: the stroke does not lead to an item'
        : `Reached: ${analysis.path.map((node) => labelOf(node)).join(' › ')}${
            analysis.path.at(-1)?.isLeaf === false
              ? ' (a sub-menu, not a leaf)'
              : ''
          }`;
    result.textContent =
      `${selection}. ${analysis.articulationPoints.length} corner(s), ` +
      `${analysis.segments.length} piece(s), ` +
      `threshold ${analysis.angleThreshold.toFixed(1)}°.`;
  };

  const runRecognition = (stroke: readonly Point[]): void => {
    const model = buildModel(currentItems);
    const analysis = analyzeMarkingMenuStroke(stroke, model);
    drawDiagnostics(analysis);
    reportResult(analysis);
  };

  // The menu has `pointer-events: none` (see menu.css), so a click is read
  // by direction from the center, the same way the recognizer itself reads
  // one. It is not read by which DOM element is underneath it.
  const drillDownAt = (point: Point): void => {
    const model = buildModel(currentItems);
    const node = nodeAt(model, focusPath);
    if (node.items.length === 0) {
      return;
    }

    const { width, height } = surface.getBoundingClientRect();
    const dx = point[0] - width / 2;
    const dy = point[1] - height / 2;
    if (Math.hypot(dx, dy) < MIN_SELECTION_DIST_PX) {
      return;
    }

    const item = node.getNearestChild(radiansToDegrees(Math.atan2(dy, dx)));
    const index =
      item === null
        ? -1
        : node.items.findIndex((candidate) => candidate.key === item.key);
    if (index === -1 || item?.items.length === 0) {
      return;
    }

    focusPath = [...focusPath, index];
    renderMenu();
  };

  let stroke: Point[] = [];
  let isDrawing = false;

  surface.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary) {
      return;
    }

    isDrawing = true;
    stroke = [localPoint(event, surface)];
  });

  surface.addEventListener('pointermove', (event) => {
    if (!isDrawing || !event.isPrimary) {
      return;
    }

    stroke.push(localPoint(event, surface));
    // A real gesture, not a click: show what it is testing (the top level)
    // and start drawing it.
    if (strokeLength(stroke) >= CLICK_MOVEMENT_PX) {
      if (focusPath.length > 0) {
        focusPath = [];
        renderMenu();
      }

      clearDiagnostics();
      result.textContent = 'Drawing…';
      strokeCanvas.drawStroke(stroke);
    }
  });

  const endStroke = (event: PointerEvent): void => {
    if (!isDrawing || !event.isPrimary) {
      return;
    }

    isDrawing = false;
    if (strokeLength(stroke) < CLICK_MOVEMENT_PX) {
      const point = stroke.at(-1);
      if (point !== undefined) {
        drillDownAt(point);
      }

      return;
    }

    // The raw stroke stays visible under the pieces the recognizer cut it
    // into, so the two can be compared.
    runRecognition(stroke);
  };

  surface.addEventListener('pointerup', endStroke);
  surface.addEventListener('pointercancel', () => {
    isDrawing = false;
    strokeCanvas.clear();
  });

  renderMenu();

  return {
    refresh(next) {
      currentItems = next;
      renderMenu();
    },
    update(next) {
      currentItems = next;
      focusPath = [];
      clearDiagnostics();
      result.textContent = 'Draw a stroke to test the recognizer.';
      renderMenu();
    },
  };
}

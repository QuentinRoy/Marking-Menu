import { at, degreesToRadians, normalizeAngle, type Point } from '../utils.js';
import { solveLabelLayout } from './label-layout.js';
import menuStyles from './menu.css?inline';

/**
 An item of the menu layout's model.
 */
export type MenuLayoutItem = {
  /**
  The item's key.
  */
  key: string;
  /**
  The item's label.
  */
  label: string;
  /**
  The item's angle, in degrees.
  */
  angle: number;
};

/**
 The menu layout's view of the marking menu model.
 */
export type MenuLayoutModel = {
  /**
  The items of the (sub-)menu to display.
  */
  items: readonly MenuLayoutItem[];
};

/**
 The menu controls.
 */
export type Menu = {
  /**
  The menu's root element, so callers can place it among its siblings.
  */
  element: HTMLElement;
  /**
  Mark the item with the given id as active (or none if nullish).
  */
  setActive: (itemId: string | number | null) => void;
  /**
  Remove the menu.
  */
  remove: () => void;
};

// Items may be styled differently near a corner, so the connecting line meets
// the label squarely. Which corner applies depends on the quadrant the item's
// angle falls in, not on any exact angle: an axis-aligned angle (0, 90, 180,
// 270) sits between two quadrants and gets no corner class. This stays keyed
// on the angle alone, unaffected by the solved layout below: the connector
// always approaches a plate along that same fixed direction, whatever
// tangential offset the solver gave the plate.
const CORNER_ITEM_CLASSES = [
  'bottom-right-item',
  'bottom-left-item',
  'top-left-item',
  'top-right-item',
];

function getCornerClass(angle: number): string | undefined {
  const normalizedAngle = ((angle % 360) + 360) % 360;
  if (normalizedAngle % 90 === 0) {
    return undefined;
  }

  return CORNER_ITEM_CLASSES[Math.floor(normalizedAngle / 90)];
}

type LayoutProbes = {
  ringRadius: HTMLElement;
  wedgeGap: HTMLElement;
  wedgeCornerRadius: HTMLElement;
  plateGapHorizontal: HTMLElement;
  plateGapVertical: HTMLElement;
  plateGapRing: HTMLElement;
  plateGapConnector: HTMLElement;
};

type MenuDom = {
  main: HTMLDivElement;
  root: ShadowRoot;
  probes: LayoutProbes;
};

function appendLayoutProbe(
  root: ShadowRoot,
  doc: Document,
  property: string,
): HTMLElement {
  const probe = doc.createElement('div');
  probe.className = `marking-menu-layout-probe marking-menu-layout-probe--${property}`;
  root.append(probe);
  return probe;
}

const template = (
  { items, center }: { items: readonly MenuLayoutItem[]; center: Point },
  doc: Document,
): MenuDom => {
  const main = doc.createElement('div');
  main.className = 'marking-menu';
  main.style.setProperty('--center-x', `${center[0]}px`);
  main.style.setProperty('--center-y', `${center[1]}px`);
  const root = main.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = menuStyles;
  root.append(style);

  const probes: LayoutProbes = {
    ringRadius: appendLayoutProbe(root, doc, 'ring-radius'),
    wedgeGap: appendLayoutProbe(root, doc, 'wedge-gap'),
    wedgeCornerRadius: appendLayoutProbe(root, doc, 'wedge-corner-radius'),
    plateGapHorizontal: appendLayoutProbe(root, doc, 'plate-gap-horizontal'),
    plateGapVertical: appendLayoutProbe(root, doc, 'plate-gap-vertical'),
    plateGapRing: appendLayoutProbe(root, doc, 'plate-gap-ring'),
    plateGapConnector: appendLayoutProbe(root, doc, 'plate-gap-connector'),
  };

  for (const item of items) {
    const elt = doc.createElement('div');
    elt.className = 'marking-menu-item';
    elt.dataset.itemId = item.key;
    elt.style.setProperty('--angle', `${item.angle}deg`);
    const cornerClass = getCornerClass(item.angle);
    if (cornerClass !== undefined) {
      elt.classList.add(cornerClass);
    }

    const radAngle = degreesToRadians(item.angle);
    // CSS y grows downward, unlike label layout's y-axis.
    elt.style.setProperty('--cosine', `${Math.cos(-radAngle)}`);
    elt.style.setProperty('--sine', `${Math.sin(-radAngle)}`);
    const innerConnector = doc.createElement('div');
    innerConnector.className = 'marking-menu-inner-connector';
    innerConnector.setAttribute('part', 'inner-connector');
    elt.append(innerConnector);

    const outerConnector = doc.createElement('div');
    outerConnector.className = 'marking-menu-outer-connector';
    outerConnector.setAttribute('part', 'outer-connector');
    elt.append(outerConnector);

    const labelElt = doc.createElement('div');
    labelElt.className = 'marking-menu-label';
    labelElt.setAttribute('part', 'plate label');
    labelElt.textContent = item.label;
    elt.append(labelElt);
    root.append(elt);
  }

  return { main, root, probes };
};

const svgNamespace = 'http://www.w3.org/2000/svg';

const polar = (angle: number, radius: number): Point => [
  Math.cos(angle) * radius,
  Math.sin(angle) * radius,
];

const svgPoint = ([x, y]: Point): string => `${x} ${y}`;

const svgArc = (
  radius: number,
  isLargeArc: boolean,
  sweep: 0 | 1,
  endpoint: Point,
): string =>
  `A ${radius} ${radius} 0 ${Number(isLargeArc)} ${sweep} ${svgPoint(endpoint)}`;

function fullAnnulusPath(innerRadius: number, outerRadius: number): string {
  const innerStart = polar(0, innerRadius);
  const innerOpposite = polar(Math.PI, innerRadius);
  const outerStart = polar(0, outerRadius);
  const outerOpposite = polar(Math.PI, outerRadius);
  return [
    `M ${svgPoint(innerStart)}`,
    svgArc(innerRadius, true, 1, innerOpposite),
    svgArc(innerRadius, true, 1, innerStart),
    `L ${svgPoint(outerStart)}`,
    svgArc(outerRadius, true, 0, outerOpposite),
    svgArc(outerRadius, true, 0, outerStart),
    'Z',
  ].join(' ');
}

function wedgePath({
  before,
  next,
  innerRadius,
  outerRadius,
  gap,
  cornerRadius,
}: {
  before: number;
  next: number;
  innerRadius: number;
  outerRadius: number;
  gap: number;
  cornerRadius: number;
}): string | null {
  const inset = gap / 2 + cornerRadius;
  const insetInnerRadius = innerRadius + cornerRadius;
  const insetOuterRadius = outerRadius - cornerRadius;
  if (insetInnerRadius >= insetOuterRadius || inset > insetInnerRadius) {
    return null;
  }

  const innerOffset = Math.asin(inset / insetInnerRadius);
  const outerOffset = Math.asin(inset / insetOuterRadius);
  const start = before + innerOffset;
  const end = next - innerOffset;
  if (end <= start) {
    return null;
  }

  const innerStart = polar(start, innerRadius);
  const innerEnd = polar(end, innerRadius);
  const outerEnd = polar(next - outerOffset, outerRadius);
  const outerStart = polar(before + outerOffset, outerRadius);
  const isInnerLargeArc = end - start > Math.PI;
  const isOuterLargeArc = next - outerOffset - (before + outerOffset) > Math.PI;
  if (cornerRadius === 0) {
    return [
      `M ${svgPoint(innerStart)}`,
      svgArc(innerRadius, isInnerLargeArc, 1, innerEnd),
      `L ${svgPoint(outerEnd)}`,
      svgArc(outerRadius, isOuterLargeArc, 0, outerStart),
      'Z',
    ].join(' ');
  }

  const endNormal = polar(next - Math.PI / 2, 1);
  const startNormal = polar(before + Math.PI / 2, 1);
  const tangent = (angle: number, radius: number, normal: Point): Point => {
    const point = polar(angle, radius);
    return [
      point[0] - cornerRadius * normal[0],
      point[1] - cornerRadius * normal[1],
    ];
  };

  const innerEndTangent = tangent(
    next - innerOffset,
    insetInnerRadius,
    endNormal,
  );
  const outerEndTangent = tangent(
    next - outerOffset,
    insetOuterRadius,
    endNormal,
  );
  const outerStartTangent = tangent(
    before + outerOffset,
    insetOuterRadius,
    startNormal,
  );
  const innerStartTangent = tangent(
    before + innerOffset,
    insetInnerRadius,
    startNormal,
  );
  return [
    `M ${svgPoint(innerStart)}`,
    svgArc(innerRadius, isInnerLargeArc, 1, innerEnd),
    svgArc(cornerRadius, false, 0, innerEndTangent),
    `L ${svgPoint(outerEndTangent)}`,
    svgArc(cornerRadius, false, 0, outerEnd),
    svgArc(outerRadius, isOuterLargeArc, 0, outerStart),
    svgArc(cornerRadius, false, 0, outerStartTangent),
    `L ${svgPoint(innerStartTangent)}`,
    svgArc(cornerRadius, false, 0, innerStart),
    'Z',
  ].join(' ');
}

function readPixels(
  doc: Document,
  probe: HTMLElement,
  fallback: number,
): number {
  const { width } = (doc.defaultView ?? globalThis).getComputedStyle(probe);
  // Vitest leaves inline CSS imports empty, unlike a browser where the probe
  // always resolves the fallback in its stylesheet.
  // eslint-disable-next-line unicorn/prefer-number-coercion
  const pixels = Number.parseFloat(width);
  return Number.isNaN(pixels) ? fallback : pixels;
}

function appendWedge(
  ring: SVGSVGElement,
  item: MenuLayoutItem,
  pathData: string,
  doc: Document,
): void {
  const wedge = doc.createElementNS(svgNamespace, 'path');
  wedge.classList.add('marking-menu-wedge');
  wedge.dataset.itemId = item.key;
  wedge.setAttribute('part', 'wedge');
  wedge.setAttribute('d', pathData);
  ring.append(wedge);
}

function renderWedgeRing(
  { root, probes }: MenuDom,
  items: readonly MenuLayoutItem[],
  doc: Document,
  innerRadius: number,
): void {
  const outerRadius = readPixels(doc, probes.ringRadius, 80);
  const gap = readPixels(doc, probes.wedgeGap, 4);
  const cornerRadius = readPixels(doc, probes.wedgeCornerRadius, 4);
  if (
    !Number.isFinite(outerRadius) ||
    !Number.isFinite(gap) ||
    !Number.isFinite(cornerRadius) ||
    !Number.isFinite(innerRadius) ||
    outerRadius <= 0 ||
    innerRadius < 0 ||
    gap < 0 ||
    cornerRadius < 0
  ) {
    return;
  }

  const ring = doc.createElementNS(svgNamespace, 'svg');
  ring.classList.add('marking-menu-ring');
  ring.setAttribute('part', 'ring');
  ring.setAttribute('width', `${outerRadius * 2}`);
  ring.setAttribute('height', `${outerRadius * 2}`);
  ring.setAttribute(
    'viewBox',
    `${-outerRadius} ${-outerRadius} ${outerRadius * 2} ${outerRadius * 2}`,
  );
  ring.style.left = `${-outerRadius}px`;
  ring.style.top = `${-outerRadius}px`;
  root.insertBefore(ring, root.querySelector('.marking-menu-item'));

  if (items.length === 1 && outerRadius > innerRadius) {
    appendWedge(
      ring,
      at(items, 0),
      fullAnnulusPath(innerRadius, outerRadius),
      doc,
    );
    return;
  }

  const orderedItems = items
    .map((item, index) => ({
      item,
      index,
      angle: normalizeAngle(item.angle),
    }))
    .toSorted((a, b) =>
      a.angle === b.angle ? a.index - b.index : a.angle - b.angle,
    );
  for (const [index, entry] of orderedItems.entries()) {
    const previous = at(
      orderedItems,
      (index - 1 + orderedItems.length) % orderedItems.length,
    );
    const next = at(orderedItems, (index + 1) % orderedItems.length);
    const before = (previous.angle - (index === 0 ? 360 : 0) + entry.angle) / 2;
    const after =
      (entry.angle +
        next.angle +
        (index === orderedItems.length - 1 ? 360 : 0)) /
      2;
    const pathData = wedgePath({
      before: degreesToRadians(before),
      next: degreesToRadians(after),
      innerRadius,
      outerRadius,
      gap,
      cornerRadius,
    });
    if (pathData !== null) {
      appendWedge(ring, entry.item, pathData, doc);
    }
  }
}

/**
 Measure `main`'s rendered label boxes, solve their layout once, and apply
 the result. If the solver reports the menu is oversized, leave `main` as
 `template` built it: every label at the shared fixed radius `menu.css`
 already renders unconditionally, still valid, just not conflict-free.
 */
function applySolvedLayout(
  { root, probes }: MenuDom,
  items: readonly MenuLayoutItem[],
  doc: Document,
): void {
  const itemElements = [
    ...root.querySelectorAll<HTMLElement>('.marking-menu-item'),
  ];
  const labelElements = itemElements.map((element) => {
    const label = element.querySelector<HTMLElement>('.marking-menu-label');
    if (label === null) {
      throw new Error('Menu item element is missing its label.');
    }

    return label;
  });
  const connectorElements = itemElements.map((element) => {
    const connector = element.querySelector<HTMLElement>(
      '.marking-menu-outer-connector',
    );
    if (connector === null) {
      throw new Error('Menu item element is missing its connector.');
    }

    return connector;
  });
  const plates = items.map((item, index) => ({
    angle: item.angle,
    width: at(labelElements, index).offsetWidth,
    height: at(labelElements, index).offsetHeight,
  }));

  const layout = {
    plates,
    ringRadius: readPixels(doc, probes.ringRadius, NaN),
    clearances: {
      plateHorizontal: readPixels(doc, probes.plateGapHorizontal, NaN),
      plateVertical: readPixels(doc, probes.plateGapVertical, NaN),
      plateToRing: readPixels(doc, probes.plateGapRing, NaN),
      plateToConnector: readPixels(doc, probes.plateGapConnector, NaN),
    },
  };
  for (const probe of Object.values(probes)) {
    probe.remove();
  }

  const result = solveLabelLayout(layout);
  if (result.oversized) {
    return;
  }

  for (const [index, plate] of result.plates.entries()) {
    const label = at(labelElements, index);
    label.style.setProperty(
      '--solved-left',
      `calc(${plate.x}px - var(--item-box-width) / 2)`,
    );
    label.style.setProperty(
      '--solved-top',
      `calc(${plate.y}px - var(--item-box-height) / 2)`,
    );
    label.style.setProperty('--solved-bottom', 'auto');

    const connector = at(connectorElements, index);
    connector.style.setProperty(
      '--solved-connector-contact-radius',
      `${Math.hypot(...plate.connectorContact)}px`,
    );
  }
}

function togglePart(
  element: HTMLElement | SVGElement,
  part: string,
  isActive: boolean,
): void {
  element.part.toggle(part, isActive);
}

function setItemActive(
  root: ShadowRoot,
  item: HTMLElement,
  isActive: boolean,
): void {
  item.classList.toggle('active', isActive);
  const label = item.querySelector<HTMLElement>('.marking-menu-label');
  const innerConnector = item.querySelector<HTMLElement>(
    '.marking-menu-inner-connector',
  );
  const outerConnector = item.querySelector<HTMLElement>(
    '.marking-menu-outer-connector',
  );
  if (label === null || innerConnector === null || outerConnector === null) {
    throw new Error('Menu item element is incomplete.');
  }

  togglePart(label, 'plate--active', isActive);
  togglePart(label, 'label--active', isActive);
  togglePart(innerConnector, 'inner-connector--active', isActive);
  togglePart(outerConnector, 'outer-connector--active', isActive);
  const { itemId } = item.dataset;
  for (const wedge of root.querySelectorAll<SVGPathElement>(
    '.marking-menu-wedge',
  )) {
    if (wedge.dataset.itemId !== itemId) {
      continue;
    }

    wedge.classList.toggle('marking-menu-wedge--active', isActive);
    togglePart(wedge, 'wedge--active', isActive);
  }
}

/**
 Create the Menu display.

 @param options - Configuration options.
 @param options.parent - The parent node.
 @param options.model - The model of the menu to open.
 @param options.center - The pixel coordinates where the menu should be
 anchored.
 @param options.deadZoneRadius - The inner radius of the wedge ring.
 @param options.doc - The root document of the menu. Mostly useful for testing
 purposes.
 @returns The menu controls.
 */
export function createMenu({
  doc = document,
  parent,
  model,
  center,
  deadZoneRadius = 40,
}: {
  doc?: Document;
  parent: HTMLElement;
  model: MenuLayoutModel;
  center: Point;
  deadZoneRadius?: number;
}): Menu {
  const menuDom = template({ items: model.items, center }, doc);
  const { main, root } = menuDom;
  main.style.setProperty('--inner-connector-length', `${deadZoneRadius}px`);
  // Attach before measuring: a detached element's `offsetWidth`/`offsetHeight`
  // are always 0. Everything from here through `applySolvedLayout` runs
  // synchronously in this one call, so the unsolved layout is never
  // painted: a browser only paints between tasks, never mid-function.
  parent.append(main);
  renderWedgeRing(menuDom, model.items, doc, deadZoneRadius);
  applySolvedLayout(menuDom, model.items, doc);

  // Clear any  active items.
  const clearActiveItems = () => {
    for (const itemDom of root.querySelectorAll<HTMLElement>('.active')) {
      setItemActive(root, itemDom, false);
    }
  };

  // Return an item DOM element from its id.
  const getItemDom = (itemId: string | number) =>
    [...root.querySelectorAll<HTMLElement>('.marking-menu-item')].find(
      (elt) => elt.dataset.itemId === itemId,
    );

  // Mark an item as active.
  const setActive = (itemId: string | number | null) => {
    // Clear any  active items.
    clearActiveItems();

    // Set the active class. This mirrors the original truthiness check (which
    // also allowed the numeric id `0`): only `null`, `''`, and `NaN` are
    // skipped.
    if (
      itemId !== null &&
      itemId !== '' &&
      (typeof itemId !== 'number' || !Number.isNaN(itemId))
    ) {
      const itemDom = getItemDom(itemId);
      if (!(itemDom instanceof HTMLElement)) {
        throw new TypeError(`No menu item found for id: ${itemId}`);
      }

      setItemActive(root, itemDom, true);
    }
  };

  // Function to remove the menu.
  const remove = () => {
    main.remove();
  };

  // Create the interface.
  return { element: main, setActive, remove };
}

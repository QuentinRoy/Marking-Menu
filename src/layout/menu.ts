import { at, degreesToRadians, normalizeAngle, type Point } from '../utils.js';
import { solveLabelLayout } from './label-layout.js';
import menuStyles from './menu.css?inline';

// A constructable stylesheet is tied to the realm that created it: a shadow
// root in another document/window can't adopt one made in this document, so
// the cache is keyed per document rather than a single module-level value.
const menuStyleSheets = new WeakMap<Document, CSSStyleSheet>();

function getMenuStyleSheet(doc: Document): CSSStyleSheet {
  const cached = menuStyleSheets.get(doc);
  if (cached !== undefined) {
    return cached;
  }

  const styleSheetConstructor = doc.defaultView?.CSSStyleSheet ?? CSSStyleSheet;
  const styleSheet = new styleSheetConstructor();
  styleSheet.replaceSync(menuStyles);
  menuStyleSheets.set(doc, styleSheet);
  return styleSheet;
}

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
  /**
  Whether the item has no submenu.
  */
  isLeaf: boolean;
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
  The persistent host element.
  */
  element: HTMLElement;
  /**
  The menu layer within the shared root.
  */
  layer: HTMLElement;
  /**
  The resolved stroke theme for this menu opening.
  */
  strokeTheme: MenuStrokeTheme;
  /**
  Mark the item with the given id as active (or none if nullish).
  */
  setActive: (itemId: string | number | undefined) => void;
  /**
  Remove the menu.
  */
  remove: () => void;
};

type StrokeThemeProbes = {
  strokeWidth: HTMLElement;
  strokeStartPointRadius: HTMLElement;
};

type LayoutProbes = StrokeThemeProbes & {
  outerRadius: HTMLElement;
  wedgeGap: HTMLElement;
  wedgeCornerRadius: HTMLElement;
  plateGapHorizontal: HTMLElement;
  plateGapVertical: HTMLElement;
  plateGapRing: HTMLElement;
  plateGapConnector: HTMLElement;
};

export type MenuStrokeTheme = {
  strokeWidth: number;
  strokeStartPointRadius: number;
};

type MenuDom = {
  main: HTMLDivElement;
  root: ShadowRoot;
  probes: LayoutProbes;
  itemElements: ReadonlyMap<string, HTMLDivElement>;
  isOwnHost: boolean;
};

export function createMenuHost({
  parent,
  doc = parent.ownerDocument,
}: {
  parent: HTMLElement;
  doc?: Document;
}): {
  element: HTMLDivElement;
  root: ShadowRoot;
  strokeTheme: MenuStrokeTheme;
} {
  const element = doc.createElement('div');
  element.className = 'marking-menu';
  const root = element.attachShadow({ mode: 'open' });
  root.adoptedStyleSheets = [getMenuStyleSheet(doc)];
  parent.append(element);

  const probeParent = doc.createElement('div');
  root.append(probeParent);
  const strokeTheme = readStrokeTheme(
    doc,
    appendStrokeThemeProbes(probeParent, doc),
  );
  probeParent.remove();
  return { element, root, strokeTheme };
}

function appendLayoutProbe(
  parent: HTMLElement,
  doc: Document,
  property: string,
): HTMLElement {
  const probe = doc.createElement('div');
  probe.className = `marking-menu-layout-probe marking-menu-layout-probe--${property}`;
  parent.append(probe);
  return probe;
}

function appendStrokeThemeProbes(
  parent: HTMLElement,
  doc: Document,
): StrokeThemeProbes {
  return {
    strokeWidth: appendLayoutProbe(parent, doc, 'stroke-width'),
    strokeStartPointRadius: appendLayoutProbe(
      parent,
      doc,
      'stroke-start-point-radius',
    ),
  };
}

// `instanceof HTMLElement` would use this module's realm's constructor,
// which a parent from another document/window never matches. Node type
// identifies an element without depending on a realm-specific constructor.
const isElement = (parent: HTMLElement | ShadowRoot): parent is HTMLElement =>
  parent.nodeType === Node.ELEMENT_NODE;

const template = (
  { items, center }: { items: readonly MenuLayoutItem[]; center: Point },
  doc: Document,
  parent: HTMLElement | ShadowRoot,
): MenuDom => {
  const isOwnHost = isElement(parent);
  const { root } = isOwnHost
    ? createMenuHost({ parent, doc })
    : { root: parent };
  const main = doc.createElement('div');
  main.className = 'marking-menu-layer';
  main.role = 'menu';
  main.tabIndex = -1;
  main.style.setProperty('--center-x', `${center[0]}px`);
  main.style.setProperty('--center-y', `${center[1]}px`);
  root.append(main);
  const itemElements = new Map<string, HTMLDivElement>();

  const probes: LayoutProbes = {
    outerRadius: appendLayoutProbe(main, doc, 'outer-radius'),
    wedgeGap: appendLayoutProbe(main, doc, 'wedge-gap'),
    wedgeCornerRadius: appendLayoutProbe(main, doc, 'wedge-corner-radius'),
    plateGapHorizontal: appendLayoutProbe(main, doc, 'plate-gap-horizontal'),
    plateGapVertical: appendLayoutProbe(main, doc, 'plate-gap-vertical'),
    plateGapRing: appendLayoutProbe(main, doc, 'plate-gap-ring'),
    plateGapConnector: appendLayoutProbe(main, doc, 'plate-gap-connector'),
    ...appendStrokeThemeProbes(main, doc),
  };

  for (const item of items) {
    const elt = doc.createElement('div');
    elt.className = 'marking-menu-item';
    elt.role = 'menuitem';
    elt.tabIndex = -1;
    if (!item.isLeaf) {
      elt.ariaHasPopup = 'menu';
    }

    elt.dataset.itemId = item.key;
    elt.style.setProperty('--angle', `${item.angle}deg`);

    const radAngle = degreesToRadians(item.angle);
    // CSS y grows downward, unlike label layout's y-axis.
    elt.style.setProperty('--cosine', `${Math.cos(-radAngle)}`);
    elt.style.setProperty('--sine', `${Math.sin(-radAngle)}`);
    const innerConnector = doc.createElement('div');
    innerConnector.className = 'marking-menu-inner-connector';
    innerConnector.ariaHidden = 'true';
    elt.append(innerConnector);

    const outerConnector = doc.createElement('div');
    outerConnector.className = 'marking-menu-outer-connector';
    outerConnector.ariaHidden = 'true';
    elt.append(outerConnector);

    const plateElt = doc.createElement('div');
    plateElt.className = 'marking-menu-plate';
    const labelElt = doc.createElement('div');
    labelElt.className = 'marking-menu-label';
    labelElt.textContent = item.label;
    plateElt.append(labelElt);
    elt.append(plateElt);
    main.append(elt);
    itemElements.set(item.key, elt);
  }

  return { main, root, probes, itemElements, isOwnHost };
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
}): string | undefined {
  const inset = gap / 2 + cornerRadius;
  const insetInnerRadius = innerRadius + cornerRadius;
  const insetOuterRadius = outerRadius - cornerRadius;
  if (insetInnerRadius >= insetOuterRadius || inset > insetInnerRadius) {
    return undefined;
  }

  const innerOffset = Math.asin(inset / insetInnerRadius);
  const outerOffset = Math.asin(inset / insetOuterRadius);
  const start = before + innerOffset;
  const end = next - innerOffset;
  if (end <= start) {
    return undefined;
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

function readStrokeTheme(
  doc: Document,
  probes: StrokeThemeProbes,
): MenuStrokeTheme {
  return {
    strokeWidth: readPixels(doc, probes.strokeWidth, 4),
    strokeStartPointRadius: readPixels(doc, probes.strokeStartPointRadius, 8),
  };
}

// Unique per wedge, referenced by its self-clip `<clipPath>`; ids must be
// unique within the shadow root, which can hold several open menus' worth
// of wedges over a controller's lifetime.
let wedgeClipId = 0;

function appendWedge(
  itemElement: HTMLElement,
  pathData: string,
  doc: Document,
  outerRadius: number,
): void {
  const svg = doc.createElementNS(svgNamespace, 'svg');
  svg.classList.add('marking-menu-wedge-svg');
  svg.ariaHidden = 'true';
  svg.setAttribute('width', `${outerRadius * 2}`);
  svg.setAttribute('height', `${outerRadius * 2}`);
  svg.setAttribute(
    'viewBox',
    `${-outerRadius} ${-outerRadius} ${outerRadius * 2} ${outerRadius * 2}`,
  );
  svg.style.left = `${-outerRadius}px`;
  svg.style.top = `${-outerRadius}px`;

  const wedge = doc.createElementNS(svgNamespace, 'path');
  wedge.classList.add('marking-menu-wedge');
  wedge.setAttribute('d', pathData);

  // Self-clipped to its own shape: a stroke straddles the path, so clipping
  // away the outer half leaves an inset outline (see menu.css) without
  // touching the fill path above.
  const clipId = `marking-menu-wedge-clip-${wedgeClipId++}`;
  const defs = doc.createElementNS(svgNamespace, 'defs');
  const clipPath = doc.createElementNS(svgNamespace, 'clipPath');
  clipPath.id = clipId;
  const clipShape = doc.createElementNS(svgNamespace, 'path');
  clipShape.setAttribute('d', pathData);
  clipPath.append(clipShape);
  defs.append(clipPath);

  const outline = doc.createElementNS(svgNamespace, 'path');
  outline.classList.add('marking-menu-wedge-outline');
  outline.setAttribute('d', pathData);
  outline.setAttribute('clip-path', `url(#${clipId})`);

  svg.append(defs, wedge, outline);
  itemElement.prepend(svg);
}

function renderWedges(
  { itemElements, probes }: MenuDom,
  items: readonly MenuLayoutItem[],
  doc: Document,
  innerRadius: number,
): void {
  const outerRadius = readPixels(doc, probes.outerRadius, 80);
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

  const appendItemWedge = (item: MenuLayoutItem, pathData: string): void => {
    const itemElement = itemElements.get(item.key);
    if (itemElement === undefined) {
      throw new Error(`Menu item element not found for key: ${item.key}`);
    }

    appendWedge(itemElement, pathData, doc, outerRadius);
  };

  if (items.length === 1 && outerRadius > innerRadius) {
    appendItemWedge(at(items, 0), fullAnnulusPath(innerRadius, outerRadius));
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
    if (pathData !== undefined) {
      appendItemWedge(entry.item, pathData);
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
  const plateElements = itemElements.map((element) => {
    const plate =
      element.querySelector<HTMLElement>('.marking-menu-plate') ?? undefined;
    if (plate === undefined) {
      throw new Error('Menu item element is missing its plate.');
    }

    return plate;
  });
  const connectorElements = itemElements.map((element) => {
    const connector =
      element.querySelector<HTMLElement>('.marking-menu-outer-connector') ??
      undefined;
    if (connector === undefined) {
      throw new Error('Menu item element is missing its connector.');
    }

    return connector;
  });
  const plates = items.map((item, index) => ({
    angle: item.angle,
    width: at(plateElements, index).offsetWidth,
    height: at(plateElements, index).offsetHeight,
  }));

  const layout = {
    plates,
    ringRadius: readPixels(doc, probes.outerRadius, NaN),
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
    const plateElement = at(plateElements, index);
    plateElement.style.setProperty('--layout-left', `${plate.x}px`);
    plateElement.style.setProperty('--layout-top', `${plate.y}px`);
    plateElement.style.setProperty('--layout-bottom', 'auto');
    plateElement.style.setProperty(
      '--layout-translation',
      'translate(-50%, -50%)',
    );

    const connector = at(connectorElements, index);
    connector.style.setProperty(
      '--layout-connector-contact-radius',
      `${Math.hypot(...plate.connectorContact)}px`,
    );
  }
}

function setItemActive(item: HTMLElement, isActive: boolean): void {
  item.classList.toggle('active', isActive);
}

/**
 Create the Menu display.

 @param options - Configuration options.
 @param options.parent - The parent node.
 @param options.model - The model of the menu to open.
 @param options.center - The pixel coordinates where the menu should be
 anchored.
 @param options.deadZoneRadius - The inner radius of the wedge ring.
 @param options.pointerTarget - Whether the menu's items and wedges accept
 pointer events. Off by default: a live gesture reads strokes on the surface
 behind the menu, not hovers or clicks on the menu itself. Turn it on for a
 menu meant to be operated directly, such as a static, non-gesture preview.
 @param options.doc - The root document of the menu. Defaults to `parent`'s
 own document; override only for testing.
 @returns The menu controls.
 */
export function createMenu({
  parent,
  doc = parent.ownerDocument,
  model,
  center,
  deadZoneRadius,
  pointerTarget = false,
}: {
  doc?: Document;
  parent: HTMLElement | ShadowRoot;
  model: MenuLayoutModel;
  center: Point;
  deadZoneRadius: number;
  pointerTarget?: boolean;
}): Menu {
  const menuDom = template({ items: model.items, center }, doc, parent);
  const { main, root, isOwnHost } = menuDom;
  (root.host as HTMLElement).style.setProperty(
    '--inner-radius',
    `${deadZoneRadius}px`,
  );
  main.classList.toggle('marking-menu--pointer-target', pointerTarget);

  // `template` attaches the layer before measurement. A browser cannot paint
  // the unsolved layout while this call is still running.
  const strokeTheme = readStrokeTheme(doc, menuDom.probes);
  renderWedges(menuDom, model.items, doc, deadZoneRadius);
  applySolvedLayout(menuDom, model.items, doc);

  const clearActiveItems = () => {
    for (const itemDom of root.querySelectorAll<HTMLElement>('.active')) {
      setItemActive(itemDom, false);
    }
  };

  const getItemDom = (itemId: string | number) =>
    [...root.querySelectorAll<HTMLElement>('.marking-menu-item')].find(
      (elt) => elt.dataset.itemId === itemId,
    );

  const setActive = (itemId: string | number | undefined) => {
    clearActiveItems();

    // Set the active class. This mirrors the original truthiness check (which
    // also allowed the numeric id `0`): only `undefined`, `''`, and `NaN` are
    // skipped.
    if (
      itemId !== undefined &&
      itemId !== '' &&
      (typeof itemId !== 'number' || !Number.isNaN(itemId))
    ) {
      const itemDom = getItemDom(itemId);
      if (itemDom === undefined) {
        throw new TypeError(`No menu item found for id: ${itemId}`);
      }

      setItemActive(itemDom, true);
    }
  };

  const remove = () => {
    if (isOwnHost) {
      (root.host as HTMLElement).remove();
    } else {
      main.remove();
    }
  };

  return {
    element: root.host as HTMLElement,
    layer: main,
    strokeTheme,
    setActive,
    remove,
  };
}

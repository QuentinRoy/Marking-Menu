import { at, degreesToRadians, type Point } from '../utils.js';
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
    // Why -radAngle? I got the css math wrong at some point, but it works like
    // this and I could not be bothered fixing it.
    elt.style.setProperty('--cosine', `${Math.cos(-radAngle)}`);
    elt.style.setProperty('--sine', `${Math.sin(-radAngle)}`);
    const lineElt = doc.createElement('div');
    lineElt.className = 'marking-menu-line';
    lineElt.setAttribute('part', 'connector');
    elt.append(lineElt);

    const labelElt = doc.createElement('div');
    labelElt.className = 'marking-menu-label';
    labelElt.setAttribute('part', 'plate label');
    labelElt.textContent = item.label;
    elt.append(labelElt);
    root.append(elt);
  }

  return { main, root, probes };
};

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
    const connector = element.querySelector<HTMLElement>('.marking-menu-line');
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

  const view = doc.defaultView ?? globalThis;
  const readPixels = (probe: HTMLElement): number =>
    // The probe's resolved width retains its `px` suffix.
    // eslint-disable-next-line unicorn/prefer-number-coercion
    Number.parseFloat(view.getComputedStyle(probe).width);
  const layout = {
    plates,
    ringRadius: readPixels(probes.ringRadius),
    clearances: {
      plateHorizontal: readPixels(probes.plateGapHorizontal),
      plateVertical: readPixels(probes.plateGapVertical),
      plateToRing: readPixels(probes.plateGapRing),
      plateToConnector: readPixels(probes.plateGapConnector),
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
  element: HTMLElement,
  part: string,
  isActive: boolean,
): void {
  if (element.part !== undefined) {
    element.part.toggle(part, isActive);
    return;
  }

  const parts = new Set(element.getAttribute('part')?.split(' '));
  if (isActive) {
    parts.add(part);
  } else {
    parts.delete(part);
  }

  element.setAttribute('part', [...parts].join(' '));
}

function setItemActive(item: HTMLElement, isActive: boolean): void {
  item.classList.toggle('active', isActive);
  const label = item.querySelector<HTMLElement>('.marking-menu-label');
  const connector = item.querySelector<HTMLElement>('.marking-menu-line');
  if (label === null || connector === null) {
    throw new Error('Menu item element is incomplete.');
  }

  togglePart(label, 'plate--active', isActive);
  togglePart(label, 'label--active', isActive);
  togglePart(connector, 'connector--active', isActive);
}

/**
 Create the Menu display.

 @param options - Configuration options.
 @param options.parent - The parent node.
 @param options.model - The model of the menu to open.
 @param options.center - The pixel coordinates where the menu should be
 anchored.
 @param options.doc - The root document of the menu. Mostly useful for testing
 purposes.
 @returns The menu controls.
 */
export function createMenu({
  doc = document,
  parent,
  model,
  center,
}: {
  doc?: Document;
  parent: HTMLElement;
  model: MenuLayoutModel;
  center: Point;
}): Menu {
  const menuDom = template({ items: model.items, center }, doc);
  const { main, root } = menuDom;
  // Attach before measuring: a detached element's `offsetWidth`/`offsetHeight`
  // are always 0. Everything from here through `applySolvedLayout` runs
  // synchronously in this one call, so the unsolved layout is never
  // painted: a browser only paints between tasks, never mid-function.
  parent.append(main);
  applySolvedLayout(menuDom, model.items, doc);

  // Clear any  active items.
  const clearActiveItems = () => {
    for (const itemDom of root.querySelectorAll<HTMLElement>('.active')) {
      setItemActive(itemDom, false);
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

      setItemActive(itemDom, true);
    }
  };

  // Function to remove the menu.
  const remove = () => {
    main.remove();
  };

  // Create the interface.
  return { element: main, setActive, remove };
}

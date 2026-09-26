import {
  mouseMoveTo,
  mousePressAt,
  mouseReleaseAt,
} from '../../__tests__/__fixtures__/browser-menu.js';
import { createMenu } from '../menu.js';

const createPointerTargetMenu = () => {
  const parent = document.createElement('div');
  Object.assign(parent.style, {
    position: 'fixed',
    left: '180px',
    top: '100px',
    width: '300px',
    height: '300px',
  });
  document.body.append(parent);

  const menu = createMenu({
    center: [150, 150],
    deadZoneRadius: 40,
    model: {
      items: [
        { angle: 0, key: 'right', label: 'Right', isLeaf: true },
        { angle: 90, key: 'down', label: 'Down', isLeaf: true },
        { angle: 180, key: 'left', label: 'Left', isLeaf: true },
        { angle: 270, key: 'up', label: 'Up', isLeaf: true },
      ],
    },
    parent,
    pointerTarget: true,
  });

  const center = (): { x: number; y: number } => {
    const bounds = parent.getBoundingClientRect();
    return { x: bounds.x + 150, y: bounds.y + 150 };
  };

  parent.addEventListener('pointerdown', (event) => {
    const item = event
      .composedPath()
      .find(
        (target): target is HTMLElement =>
          target instanceof HTMLElement && target.dataset.itemId !== undefined,
      );
    parent.dataset.hitItemId = item?.dataset.itemId ?? '';
  });

  return {
    parent,
    menu,
    center,
    [Symbol.dispose]() {
      menu.remove();
      parent.remove();
    },
  };
};

const menuRoot = (parent: HTMLElement): ShadowRoot | undefined =>
  parent.querySelector(':scope > .marking-menu')?.shadowRoot ?? undefined;

test('painted item regions receive the pointer without blocking gaps', async () => {
  using surface = createPointerTargetMenu();
  const center = surface.center();

  await mouseMoveTo({ x: center.x + 60, y: center.y });
  await mousePressAt({ x: center.x + 60, y: center.y });
  await mouseReleaseAt();
  expect(surface.parent.dataset.hitItemId).toBe('right');

  const plate = menuRoot(surface.parent)
    ?.querySelector<HTMLElement>('.marking-menu-item[data-item-id="right"]')
    ?.querySelector<HTMLElement>('.marking-menu-plate');
  expect(plate).toBeDefined();
  const plateBounds = plate?.getBoundingClientRect();
  if (!plateBounds) {
    throw new Error('The right item plate is missing.');
  }

  await mousePressAt({
    x: plateBounds.x + plateBounds.width / 2,
    y: plateBounds.y + plateBounds.height / 2,
  });
  await mouseReleaseAt();
  expect(surface.parent.dataset.hitItemId).toBe('right');

  await mousePressAt({ x: center.x + 45, y: center.y + 45 });
  await mouseReleaseAt();
  expect(surface.parent.dataset.hitItemId).toBe('');
});

test('the inner connector stays outside the hit target and the outer connector gets hit', async () => {
  using surface = createPointerTargetMenu();
  const center = surface.center();

  await mousePressAt({ x: center.x + 20, y: center.y });
  await mouseReleaseAt();
  expect(surface.parent.dataset.hitItemId).toBe('');

  const connector = menuRoot(surface.parent)
    ?.querySelector<HTMLElement>('.marking-menu-item[data-item-id="right"]')
    ?.querySelector<SVGElement>('.marking-menu-outer-connector')
    ?.querySelector<SVGRectElement>('rect');
  const bounds = connector?.getBoundingClientRect();
  if (!bounds) {
    throw new Error('The right item outer connector is missing.');
  }

  await mousePressAt({ x: bounds.x + 1, y: bounds.y + bounds.height / 2 });
  await mouseReleaseAt();
  expect(surface.parent.dataset.hitItemId).toBe('right');
});

test('label plates use measured text dimensions and respect a fixed width', async () => {
  using surface = createPointerTargetMenu();
  const menuHost = surface.parent.querySelector<HTMLElement>('.marking-menu');
  const root = menuRoot(surface.parent);
  const rightItem = root?.querySelector<HTMLElement>(
    '.marking-menu-item[data-item-id="right"]',
  );
  const label = rightItem?.querySelector<HTMLElement>('.marking-menu-label');
  const plate = rightItem?.querySelector<HTMLElement>('.marking-menu-plate');
  if (!menuHost || !label || !plate) {
    throw new Error('The right item label and plate are missing.');
  }

  const originalWidth = plate.getBoundingClientRect().width;
  expect(plate.getBoundingClientRect().height).toBeGreaterThan(0);
  expect(originalWidth).toBeGreaterThan(0);

  menuHost.style.setProperty('--mm-plate-min-width', '120px');
  menuHost.style.setProperty('--mm-plate-max-width', '120px');
  label.textContent = 'A label longer than the configured width';
  const constrainedWidth = plate.getBoundingClientRect().width;

  expect(constrainedWidth).toBeGreaterThan(originalWidth);
  expect(constrainedWidth).toBeLessThan(160);
});

test('wedges and connectors follow their configured directions', () => {
  using surface = createPointerTargetMenu();
  const root = menuRoot(surface.parent);
  const upItem = root?.querySelector<HTMLElement>(
    '.marking-menu-item[data-item-id="up"]',
  );
  const downItem = root?.querySelector<HTMLElement>(
    '.marking-menu-item[data-item-id="down"]',
  );
  const rightItem = root?.querySelector<HTMLElement>(
    '.marking-menu-item[data-item-id="right"]',
  );
  const up = upItem?.querySelector<SVGPathElement>('.marking-menu-wedge');
  const down = downItem?.querySelector<SVGPathElement>('.marking-menu-wedge');
  const inner = rightItem
    ?.querySelector<SVGElement>('.marking-menu-inner-connector')
    ?.querySelector<SVGRectElement>('rect');
  const outer = rightItem?.querySelector<SVGElement>(
    '.marking-menu-outer-connector',
  );
  if (!up || !down || !inner || !outer) {
    throw new Error('Menu geometry is incomplete.');
  }

  expect(up.getBBox().y + up.getBBox().height / 2).toBeLessThan(0);
  expect(down.getBBox().y + down.getBBox().height / 2).toBeGreaterThan(0);
  expect(getComputedStyle(inner).height).toBe('0px');
  expect(getComputedStyle(inner).width).toBe('40px');
  expect(outer.getBoundingClientRect().x).toBeGreaterThan(
    inner.getBoundingClientRect().x,
  );
});

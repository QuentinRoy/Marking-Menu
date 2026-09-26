import { createRenderer } from '../renderer.js';

const createSurface = () => {
  const parent = document.createElement('div');
  Object.assign(parent.style, {
    position: 'fixed',
    left: '180px',
    top: '120px',
    width: '100px',
    height: '100px',
    overflow: 'visible',
  });
  document.body.append(parent);

  const renderer = createRenderer({
    deadZoneRadius: 40,
    gestureFeedbackDuration: 1000,
    parent,
  });

  return {
    parent,
    renderer,
    [Symbol.dispose]() {
      renderer.dispose();
      parent.remove();
    },
  };
};

const createScrolledSurface = () => {
  const scroller = document.createElement('div');
  Object.assign(scroller.style, {
    position: 'fixed',
    left: '150px',
    top: '100px',
    width: '200px',
    height: '100px',
    overflow: 'auto',
  });
  document.body.append(scroller);
  const parent = document.createElement('div');
  Object.assign(parent.style, {
    position: 'relative',
    width: '100px',
    height: '100px',
    overflow: 'visible',
  });
  scroller.append(parent);
  const renderer = createRenderer({
    deadZoneRadius: 40,
    gestureFeedbackDuration: 1000,
    parent,
  });

  return {
    parent,
    renderer,
    scroller,
    [Symbol.dispose]() {
      renderer.dispose();
      scroller.remove();
    },
  };
};

test('a stroke paints outside a visible-overflow parent and is clipped by hidden overflow', async () => {
  using surface = createScrolledSurface();
  const { parent, renderer, scroller } = surface;

  renderer.render({
    cursor: 'none',
    indicator: undefined,
    lowerStroke: undefined,
    menu: undefined,
    upperStroke: [
      [200, 150],
      [300, 150],
    ],
  });
  await expect
    .poll(() =>
      parent
        .querySelector('.marking-menu')
        ?.shadowRoot?.querySelector<SVGSVGElement>(
          '.marking-menu-stroke-surface',
        )
        ?.querySelector<SVGPathElement>('path'),
    )
    .not.toBeNull();

  const host = parent.querySelector<HTMLElement>('.marking-menu');
  const path = host?.shadowRoot
    ?.querySelector<SVGSVGElement>('.marking-menu-stroke-surface')
    ?.querySelector<SVGPathElement>('path');
  if (!host || !path) {
    throw new Error('The rendered stroke is missing.');
  }

  host.style.pointerEvents = 'auto';
  path.ownerSVGElement?.style.setProperty('pointer-events', 'auto');
  path.style.pointerEvents = 'stroke';
  expect(document.elementFromPoint(275, 150)).toBe(host);
  expect(getComputedStyle(host).overflow).toBe('visible');
  expect(scroller.scrollWidth).toBe(200);

  parent.style.overflow = 'hidden';
  expect(document.elementFromPoint(275, 150)).not.toBe(host);
});

test("the stroke's origin marker uses its CSS-set radius", async () => {
  using surface = createSurface();
  surface.parent.style.setProperty('--mm-stroke-start-point-radius', '12px');
  const bounds = surface.parent.getBoundingClientRect();
  const center = [
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  ] as const;

  surface.renderer.render({
    cursor: 'none',
    indicator: undefined,
    lowerStroke: undefined,
    menu: {
      model: {
        items: [{ angle: 0, key: 'right', label: 'Right', isLeaf: true }],
      },
      center,
      activeKey: undefined,
      tabStopKey: undefined,
      pointerTarget: false,
    },
    upperStroke: [center, [center[0] + 100, center[1]]],
  });

  const marker = () =>
    surface.parent
      .querySelector('.marking-menu')
      ?.shadowRoot?.querySelector<SVGCircleElement>(
        '.marking-menu-stroke-point',
      );
  await expect.poll(marker).not.toBeNull();
  const pointMarker = marker();
  if (!pointMarker) {
    throw new Error('The origin marker is missing.');
  }

  expect(getComputedStyle(pointMarker).r).toBe('12px');
});

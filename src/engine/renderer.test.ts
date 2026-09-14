import { createModel } from '../model.js';
import { createRenderer } from './renderer.js';

const model = createModel({
  items: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
});

const renderFrame = () => vi.advanceTimersToNextFrame();

const rootOf = (parent: HTMLElement): ShadowRoot => {
  const root = parent.querySelector('.marking-menu')?.shadowRoot;
  if (root === null || root === undefined) {
    throw new Error('The renderer root is missing.');
  }

  return root;
};

describe('createRenderer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('owns one host for its lifetime', () => {
    const parent = document.createElement('div');
    const renderer = createRenderer<typeof model>({ parent });
    const host = parent.querySelector('.marking-menu');

    renderer.render({
      cursor: 'none',
      menu: { model, center: [0, 0], activeKey: null },
      upperStroke: null,
      lowerStroke: null,
      indicator: null,
    });
    renderer.render({
      cursor: 'default',
      menu: null,
      upperStroke: null,
      lowerStroke: null,
      indicator: null,
    });

    expect(parent.querySelectorAll('.marking-menu')).toHaveLength(1);
    expect(parent.querySelector('.marking-menu')).toBe(host);
    renderer.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('converts live and completed strokes from client to parent coordinates', () => {
    const parent = document.createElement('div');
    let left = 200;
    parent.getBoundingClientRect = () =>
      ({ left, top: 50 }) as unknown as DOMRect;
    const renderer = createRenderer<typeof model>({ parent });

    renderer.render({
      cursor: 'none',
      menu: null,
      upperStroke: [
        [220, 60],
        [260, 90],
      ],
      lowerStroke: null,
      indicator: null,
    });
    left = 210;
    renderFrame();
    renderer.showFeedback({
      stroke: [
        [220, 60],
        [260, 90],
      ],
      canceled: false,
    });

    const root = rootOf(parent);
    expect(
      [...root.children]
        .filter((surface) => surface.localName === 'svg')
        .flatMap((surface) => [...surface.children])
        .filter((path) => path.localName === 'path')
        .map((path) => path.getAttribute('d')),
    ).toEqual(['M 10 10 L 50 40', 'M 10 10 L 50 40']);
    renderer.dispose();
  });

  it('keeps lower, menu, upper, then feedback paint order', () => {
    const parent = document.createElement('div');
    const renderer = createRenderer<typeof model>({ parent });

    renderer.showFeedback({
      stroke: [
        [0, 0],
        [10, 0],
      ],
      canceled: false,
    });
    renderer.render({
      cursor: 'none',
      menu: { model, center: [0, 0], activeKey: null },
      upperStroke: [
        [0, 0],
        [10, 0],
      ],
      lowerStroke: [
        [0, 0],
        [5, 5],
      ],
      indicator: null,
    });
    renderFrame();
    renderer.render({
      cursor: 'none',
      menu: { model, center: [0, 0], activeKey: null },
      upperStroke: [
        [0, 0],
        [10, 0],
      ],
      lowerStroke: [
        [0, 0],
        [5, 5],
      ],
      indicator: null,
    });

    const layers = [...rootOf(parent).children]
      .filter(
        (element) => !element.classList.contains('marking-menu-layout-probe'),
      )
      .map((element) => {
        if (element.classList.contains('marking-menu-layer')) {
          return 'menu';
        }

        const strokeElements = [...element.children];
        if (strokeElements.some((child) => child.localName === 'circle')) {
          return 'upper';
        }

        return strokeElements
          .find((child) => child.localName === 'path')
          ?.getAttribute('d') === 'M 0 0 L 5 5'
          ? 'lower'
          : 'feedback';
      });
    expect(layers).toEqual(['lower', 'menu', 'upper', 'feedback']);
    renderer.dispose();
  });

  it('cancels pending drawing and feedback removal on dispose', () => {
    const parent = document.createElement('div');
    const renderer = createRenderer<typeof model>({ parent });
    const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const clearTimer = vi.spyOn(globalThis, 'clearTimeout');

    renderer.render({
      cursor: 'crosshair',
      menu: null,
      upperStroke: [
        [0, 0],
        [10, 0],
      ],
      lowerStroke: null,
      indicator: null,
    });
    renderer.showFeedback({ stroke: [[0, 0]], canceled: false });
    renderer.dispose();

    expect(cancelFrame).toHaveBeenCalledOnce();
    expect(clearTimer).toHaveBeenCalled();
    expect(parent.children).toHaveLength(0);
  });

  it("draws the opening indicator's outline and dot at the given anchor, and removes both once the indicator clears", () => {
    const parent = document.createElement('div');
    const renderer = createRenderer<typeof model>({ parent });

    renderer.render({
      cursor: 'crosshair',
      menu: null,
      upperStroke: [[0, 0]],
      lowerStroke: null,
      indicator: { anchor: [20, 30], delayMs: 300 },
    });

    const root = rootOf(parent);
    const background = root.querySelector('.marking-menu-indicator-background');
    expect(background?.getAttribute('cx')).toBe('20');
    expect(background?.getAttribute('cy')).toBe('30');
    expect(root.querySelector('.marking-menu-indicator-dot')).not.toBeNull();

    renderer.render({
      cursor: 'default',
      menu: null,
      upperStroke: null,
      lowerStroke: null,
      indicator: null,
    });

    expect(root.querySelector('.marking-menu-indicator-background')).toBeNull();
    expect(root.querySelector('.marking-menu-indicator-dot')).toBeNull();
    renderer.dispose();
  });

  it('paints the opening indicator after the upper stroke', () => {
    const parent = document.createElement('div');
    const renderer = createRenderer<typeof model>({ parent });

    renderer.render({
      cursor: 'crosshair',
      menu: null,
      upperStroke: [[0, 0]],
      lowerStroke: null,
      indicator: { anchor: [20, 30], delayMs: 300 },
    });

    const root = rootOf(parent);
    const indicatorSvg = root
      .querySelector('.marking-menu-indicator-background')
      ?.closest('svg');
    const upperSvg = [...root.querySelectorAll('svg')].find(
      (svg) => svg !== indicatorSvg,
    );
    expect(upperSvg).toBeDefined();
    expect(upperSvg?.compareDocumentPosition(indicatorSvg as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    renderer.dispose();
  });

  it('grows the dot toward the outline radius over the given delay, and cancels its animation frame on dispose', () => {
    const parent = document.createElement('div');
    const renderer = createRenderer<typeof model>({ parent });
    const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame');

    renderer.render({
      cursor: 'crosshair',
      menu: null,
      upperStroke: [[0, 0]],
      lowerStroke: null,
      indicator: { anchor: [0, 0], delayMs: 300 },
    });

    const dot = rootOf(parent).querySelector('.marking-menu-indicator-dot');
    const radiusAtStart = Number(dot?.getAttribute('r'));
    renderFrame();
    vi.advanceTimersByTime(150);
    renderFrame();
    const radiusAtHalfway = Number(dot?.getAttribute('r'));

    expect(radiusAtHalfway).toBeGreaterThan(radiusAtStart);

    renderer.dispose();
    expect(cancelFrame).toHaveBeenCalled();
  });
});

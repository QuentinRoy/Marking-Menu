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
    });
    renderer.render({
      cursor: 'default',
      menu: null,
      upperStroke: null,
      lowerStroke: null,
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
      root.querySelector('[part~="stroke--upper"]')?.getAttribute('d'),
    ).toBe('M 10 10 L 50 40');
    expect(
      root.querySelector('[part~="stroke--feedback"]')?.getAttribute('d'),
    ).toBe('M 10 10 L 50 40');
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
    });

    const layers = [...rootOf(parent).children]
      .filter(
        (element) => !element.classList.contains('marking-menu-layout-probe'),
      )
      .map((element) => {
        if (element.classList.contains('marking-menu-layer')) {
          return 'menu';
        }

        const part = element.querySelector('path')?.getAttribute('part') ?? '';
        if (part.includes('stroke--lower')) {
          return 'lower';
        }

        if (part.includes('stroke--upper')) {
          return 'upper';
        }

        if (part.includes('stroke--feedback')) {
          return 'feedback';
        }

        return 'unknown';
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
    });
    renderer.showFeedback({ stroke: [[0, 0]], canceled: false });
    renderer.dispose();

    expect(cancelFrame).toHaveBeenCalledOnce();
    expect(clearTimer).toHaveBeenCalled();
    expect(parent.children).toHaveLength(0);
  });
});

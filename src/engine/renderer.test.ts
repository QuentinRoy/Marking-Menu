import { createModel } from '../model.js';
import {
  createRenderer as createRendererWithResolvedOptions,
  type RendererOptions,
} from './renderer.js';

// The suite below exercises rendering, not the resolved option values
// themselves, so every call site gets the same defaults unless it overrides
// them.
const createRenderer = (
  options: Omit<RendererOptions, 'deadZoneRadius' | 'gestureFeedbackDuration'> &
    Partial<
      Pick<RendererOptions, 'deadZoneRadius' | 'gestureFeedbackDuration'>
    >,
) =>
  createRendererWithResolvedOptions({
    deadZoneRadius: 40,
    gestureFeedbackDuration: 1000,
    ...options,
  });

const model = createModel({
  items: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
});

const renderFrame = () => vi.advanceTimersToNextFrame();

const rootOf = (parent: HTMLElement): ShadowRoot => {
  const root = parent.querySelector('.marking-menu')?.shadowRoot ?? undefined;
  if (root === undefined) {
    throw new Error('The renderer root is missing.');
  }

  return root;
};

const slotOf = (parent: HTMLElement, name: string): HTMLElement => {
  const slot =
    rootOf(parent).querySelector<HTMLElement>(
      `[data-slot="${CSS.escape(name)}"]`,
    ) ?? undefined;
  if (slot === undefined) {
    throw new Error(`The renderer slot is missing: ${name}.`);
  }

  return slot;
};

describe('createRenderer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('owns one host for its lifetime', () => {
    const parent = document.createElement('div');
    const renderer = createRenderer({ parent });
    const host = parent.querySelector('.marking-menu');

    renderer.render({
      cursor: 'none',
      menu: { model, center: [0, 0], activeKey: undefined },
      upperStroke: undefined,
      lowerStroke: undefined,
      indicator: undefined,
    });
    renderer.render({
      cursor: 'default',
      menu: undefined,
      upperStroke: undefined,
      lowerStroke: undefined,
      indicator: undefined,
    });

    expect(parent.querySelectorAll('.marking-menu')).toHaveLength(1);
    expect(parent.querySelector('.marking-menu')).toBe(host);
    renderer.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('creates one slot per layer, in paint order', () => {
    const parent = document.createElement('div');
    const renderer = createRenderer({ parent });

    renderer.render({
      cursor: 'default',
      menu: undefined,
      upperStroke: undefined,
      lowerStroke: undefined,
      indicator: undefined,
    });

    expect(
      [...rootOf(parent).querySelectorAll<HTMLElement>('[data-slot]')].map(
        (slot) => slot.dataset.slot,
      ),
    ).toEqual([
      'lower',
      'menu',
      'indicator-background',
      'upper',
      'indicator-dot',
      'feedback',
    ]);
    renderer.dispose();
  });

  it('converts live and completed strokes from client to parent coordinates', () => {
    const parent = document.createElement('div');
    let left = 200;
    parent.getBoundingClientRect = () =>
      ({ left, top: 50 }) as unknown as DOMRect;
    const renderer = createRenderer({ parent });

    renderer.render({
      cursor: 'none',
      menu: undefined,
      upperStroke: [
        [220, 60],
        [260, 90],
      ],
      lowerStroke: undefined,
      indicator: undefined,
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
      [...root.querySelectorAll('svg')]
        .flatMap((surface) => [...surface.children])
        .filter((path) => path.localName === 'path')
        .map((path) => path.getAttribute('d')),
    ).toEqual(['M 10 10 L 50 40', 'M 10 10 L 50 40']);
    renderer.dispose();
  });

  it('converts strokes against the parent rect at draw time', () => {
    const parent = document.createElement('div');
    let left = 200;
    parent.getBoundingClientRect = () =>
      ({ left, top: 50 }) as unknown as DOMRect;
    const renderer = createRenderer({ parent });

    renderer.render({
      cursor: 'none',
      menu: undefined,
      upperStroke: [
        [220, 60],
        [260, 90],
      ],
      lowerStroke: undefined,
      indicator: undefined,
    });
    left = 210;
    renderFrame();

    expect(
      slotOf(parent, 'upper')
        .querySelector('path')
        ?.getAttribute('d'),
    ).toBe('M 10 10 L 50 40');
    renderer.dispose();
  });

  it('positions the opening indicator against the parent rect on every tick', () => {
    const parent = document.createElement('div');
    let left = 0;
    parent.getBoundingClientRect = () =>
      ({ left, top: 0 }) as unknown as DOMRect;
    const renderer = createRenderer({ parent });

    renderer.render({
      cursor: 'crosshair',
      menu: undefined,
      upperStroke: [[0, 0]],
      lowerStroke: undefined,
      indicator: { startedAt: Date.now(), position: [20, 30], delayMs: 300 },
    });
    left = 5;
    renderFrame();

    expect(
      slotOf(parent, 'indicator-background')
        .querySelector('.marking-menu-indicator-background')
        ?.getAttribute('cx'),
    ).toBe('15');
    renderer.dispose();
  });

  it('paints each layer inside its own fixed slot', () => {
    const parent = document.createElement('div');
    const renderer = createRenderer({ parent });

    renderer.showFeedback({
      stroke: [
        [0, 0],
        [10, 0],
      ],
      canceled: false,
    });
    const view = {
      cursor: 'none',
      menu: {
        model,
        center: [0, 0] as [number, number],
        activeKey: undefined,
      },
      upperStroke: [
        [0, 0],
        [10, 0],
      ] as Array<[number, number]>,
      lowerStroke: [
        [0, 0],
        [5, 5],
      ] as Array<[number, number]>,
      indicator: { startedAt: Date.now(), position: [20, 30], delayMs: 300 },
    } as const;
    renderer.render(view);
    renderFrame();
    renderer.render(view);

    expect(
      slotOf(parent, 'lower').querySelector('path')?.getAttribute('d'),
    ).toBe('M 0 0 L 5 5');
    expect(
      slotOf(parent, 'menu').querySelector('.marking-menu-layer'),
    ).not.toBeNull();
    expect(
      slotOf(parent, 'indicator-background').querySelector(
        '.marking-menu-indicator-background',
      ),
    ).not.toBeNull();
    expect(
      slotOf(parent, 'upper').querySelectorAll('path'),
    ).toHaveLength(1);
    expect(
      slotOf(parent, 'indicator-dot').querySelector(
        '.marking-menu-indicator-dot',
      ),
    ).not.toBeNull();
    expect(
      slotOf(parent, 'feedback').querySelectorAll('path'),
    ).toHaveLength(1);
    renderer.dispose();
  });

  it('cancels pending drawing and feedback removal on dispose', () => {
    const parent = document.createElement('div');
    const renderer = createRenderer({ parent });
    const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const clearTimer = vi.spyOn(globalThis, 'clearTimeout');

    renderer.render({
      cursor: 'crosshair',
      menu: undefined,
      upperStroke: [
        [0, 0],
        [10, 0],
      ],
      lowerStroke: undefined,
      indicator: undefined,
    });
    renderer.showFeedback({ stroke: [[0, 0]], canceled: false });
    renderer.dispose();

    expect(cancelFrame).toHaveBeenCalledOnce();
    expect(clearTimer).toHaveBeenCalled();
    expect(parent.children).toHaveLength(0);
  });

  it("draws the opening indicator's background and dot at the given anchor, and removes both once the indicator clears", () => {
    const parent = document.createElement('div');
    const renderer = createRenderer({ parent });

    renderer.render({
      cursor: 'crosshair',
      menu: undefined,
      upperStroke: [[0, 0]],
      lowerStroke: undefined,
      indicator: { startedAt: Date.now(), position: [20, 30], delayMs: 300 },
    });

    const root = rootOf(parent);
    const background = root.querySelector('.marking-menu-indicator-background');
    expect(background?.getAttribute('cx')).toBe('20');
    expect(background?.getAttribute('cy')).toBe('30');
    expect(root.querySelector('.marking-menu-indicator-dot')).not.toBeNull();

    renderer.render({
      cursor: 'default',
      menu: undefined,
      upperStroke: undefined,
      lowerStroke: undefined,
      indicator: undefined,
    });

    expect(root.querySelector('.marking-menu-indicator-background')).toBeNull();
    expect(root.querySelector('.marking-menu-indicator-dot')).toBeNull();
    renderer.dispose();
  });

  it("paints the indicator's background behind the upper stroke and its dot in front of it", () => {
    const parent = document.createElement('div');
    const renderer = createRenderer({ parent });

    renderer.render({
      cursor: 'crosshair',
      menu: undefined,
      upperStroke: [[0, 0]],
      lowerStroke: undefined,
      indicator: { startedAt: Date.now(), position: [20, 30], delayMs: 300 },
    });

    const root = rootOf(parent);
    const backgroundSvg = root
      .querySelector('.marking-menu-indicator-background')
      ?.closest('svg');
    const dotSvg = root
      .querySelector('.marking-menu-indicator-dot')
      ?.closest('svg');
    const upperSvg = root.querySelector('.marking-menu-stroke-surface');
    expect(upperSvg).not.toBeNull();
    expect(upperSvg?.compareDocumentPosition(backgroundSvg as Node)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
    expect(upperSvg?.compareDocumentPosition(dotSvg as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    renderer.dispose();
  });

  it('grows the dot toward the background radius over the given delay, and cancels its animation frame on dispose', () => {
    const parent = document.createElement('div');
    const renderer = createRenderer({ parent });
    const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame');

    renderer.render({
      cursor: 'crosshair',
      menu: undefined,
      upperStroke: [[0, 0]],
      lowerStroke: undefined,
      indicator: { startedAt: Date.now(), position: [0, 0], delayMs: 300 },
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

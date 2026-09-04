import {
  canvasContext,
  fakeTimers,
  queryCanvasContext,
  stubbedCanvasContexts,
} from '../__fixtures__/canvas.js';
import { createModel } from '../model.js';
import type { Point } from '../utils.js';
import { createRenderer } from './renderer.js';

const model = createModel({
  items: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
});

// A distinct model reference, which is all it takes for the renderer to
// recreate the menu element rather than patch it.
const otherModel = createModel({
  items: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
});

// The canvas layers are told apart by their line width, the one drawing
// property `drawPoint` leaves alone, so the stacking tests below have to
// configure all three widths differently.
const upperStrokeWidth = 7;
const lowerStrokeWidth = 3;
const feedbackStrokeWidth = 5;

type Layer = 'lower' | 'menu' | 'upper' | 'feedback';

const layerByStrokeWidth = new Map<number | undefined, Layer>([
  [upperStrokeWidth, 'upper'],
  [lowerStrokeWidth, 'lower'],
  [feedbackStrokeWidth, 'feedback'],
]);

/**
Name every child of `parent` by the layer it belongs to, in paint order.
*/
const layerOrder = (parent: HTMLElement): Array<Layer | undefined> =>
  [...parent.children].map((child) =>
    child instanceof HTMLCanvasElement
      ? layerByStrokeWidth.get(canvasContext(child).lineWidth)
      : 'menu',
  );

/**
A renderer whose three canvas layers are individually identifiable.
*/
const createStackingRenderer = (parent: HTMLElement) =>
  createRenderer<typeof model>({
    parent,
    strokeWidth: upperStrokeWidth,
    lowerStrokeWidth,
    gestureFeedbackStrokeWidth: feedbackStrokeWidth,
  });

describe('createRenderer', () => {
  it('skips the redraw when the upper stroke is reference-equal to the previous frame', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();

    const parent = document.createElement('div');
    const renderer = createRenderer({ parent });
    const stroke: Point[] = [
      [0, 0],
      [10, 0],
    ];

    renderer.render({
      cursor: 'crosshair',
      menu: null,
      upperStroke: stroke,
      lowerStroke: null,
    });
    // Same array reference: the second render must skip the redraw.
    renderer.render({
      cursor: 'crosshair',
      menu: null,
      upperStroke: stroke,
      lowerStroke: null,
    });

    vi.advanceTimersToNextFrame();

    const context = queryCanvasContext(parent);
    expect(
      context.mock.methodCalls.filter((c) => c.method === 'stroke'),
    ).toHaveLength(1);
  });

  it('cancels a pending frame on dispose', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();

    const parent = document.createElement('div');
    const renderer = createRenderer({ parent });
    const stroke: Point[] = [
      [0, 0],
      [10, 0],
    ];
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');

    renderer.render({
      cursor: 'crosshair',
      menu: null,
      upperStroke: stroke,
      lowerStroke: null,
    });
    renderer.dispose();

    expect(cancelSpy).toHaveBeenCalledOnce();
  });

  it('updates the active item only when activeKey changes, skipping the redundant DOM scan otherwise', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = document.createElement('div');
    const renderer = createRenderer<typeof model>({ parent });
    const activeCount = () =>
      parent.querySelectorAll('.marking-menu-item.active').length;

    renderer.render({
      cursor: 'none',
      menu: { model, center: [0, 0], activeKey: '0' },
      upperStroke: null,
      lowerStroke: null,
    });
    expect(activeCount()).toBe(1);
    expect(parent.querySelector('[data-item-id="0"]')?.classList).toContain(
      'active',
    );

    // Same activeKey, same menu identity: the skip branch.
    renderer.render({
      cursor: 'none',
      menu: { model, center: [0, 0], activeKey: '0' },
      upperStroke: null,
      lowerStroke: null,
    });
    expect(activeCount()).toBe(1);

    // A different activeKey: the changed branch moves the active item.
    renderer.render({
      cursor: 'none',
      menu: { model, center: [0, 0], activeKey: '1' },
      upperStroke: null,
      lowerStroke: null,
    });
    expect(activeCount()).toBe(1);
    expect(parent.querySelector('[data-item-id="1"]')?.classList).toContain(
      'active',
    );

    renderer.dispose();
  });

  it('draws the upper stroke and its novice start-point marker with the configured styling', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();

    const parent = document.createElement('div');
    const renderer = createRenderer({
      parent,
      strokeColor: '#123456',
      strokeWidth: 7,
      strokeStartPointRadius: 12,
    });
    const stroke: Point[] = [
      [0, 0],
      [10, 0],
    ];

    renderer.render({
      cursor: 'none',
      menu: null,
      upperStroke: stroke,
      lowerStroke: null,
    });
    vi.advanceTimersToNextFrame();

    const context = queryCanvasContext(parent);
    expect(context.lineWidth).toBe(7);
    // `drawPoint` runs after `drawStroke` and overwrites `strokeStyle`, so
    // the point's own color (`fillStyle`, defaulting to the line color) is
    // what's left to assert on.
    expect(context.fillStyle).toBe('#123456');
    const arcCall = context.mock.methodCalls.find((c) => c.method === 'arc');
    expect(arcCall?.args).toEqual([0, 0, 12, 0, 360]);
  });

  it('does not draw the start-point marker for the upper stroke outside novice mode', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();

    const parent = document.createElement('div');
    const renderer = createRenderer({ parent });
    const stroke: Point[] = [
      [0, 0],
      [10, 0],
    ];

    renderer.render({
      cursor: 'crosshair',
      menu: null,
      upperStroke: stroke,
      lowerStroke: null,
    });
    vi.advanceTimersToNextFrame();

    const context = queryCanvasContext(parent);
    expect(context.mock.methodCalls.some((c) => c.method === 'arc')).toBe(
      false,
    );
  });

  it('draws the lower stroke with its own configured styling, never a start-point marker', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();

    const parent = document.createElement('div');
    const renderer = createRenderer({
      parent,
      lowerStrokeColor: '#abcdef',
      lowerStrokeWidth: 3,
    });
    const stroke: Point[] = [
      [0, 0],
      [10, 0],
    ];

    renderer.render({
      cursor: 'none',
      menu: null,
      upperStroke: null,
      lowerStroke: stroke,
    });
    vi.advanceTimersToNextFrame();

    const context = queryCanvasContext(parent);
    expect(context.strokeStyle).toBe('#abcdef');
    expect(context.lineWidth).toBe(3);
    expect(context.mock.methodCalls.some((c) => c.method === 'arc')).toBe(
      false,
    );
  });

  it('forwards gesture-feedback styling, using the canceled color only when canceled', () => {
    using _canvases = stubbedCanvasContexts();

    const parent = document.createElement('div');
    const renderer = createRenderer({
      parent,
      gestureFeedbackStrokeColor: '#00ff00',
      gestureFeedbackStrokeWidth: 5,
      gestureFeedbackCanceledStrokeColor: '#ff0000',
    });
    const stroke: Point[] = [
      [0, 0],
      [10, 0],
    ];

    renderer.showFeedback({ stroke, canceled: false });
    const selected = queryCanvasContext(parent);
    expect(selected.strokeStyle).toBe('#00ff00');
    expect(selected.lineWidth).toBe(5);

    renderer.dispose();
  });

  it('paints the lower stroke behind the open menu and the upper stroke in front of it', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();

    const parent = document.createElement('div');
    const renderer = createStackingRenderer(parent);

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
    vi.advanceTimersToNextFrame();

    expect(layerOrder(parent)).toEqual(['lower', 'menu', 'upper']);

    renderer.dispose();
  });

  it('restores the order when a submenu replaces the menu element', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();

    const parent = document.createElement('div');
    const renderer = createStackingRenderer(parent);
    const upperStroke: Point[] = [
      [0, 0],
      [10, 0],
    ];

    renderer.render({
      cursor: 'none',
      menu: { model, center: [0, 0], activeKey: null },
      upperStroke,
      lowerStroke: [
        [0, 0],
        [5, 5],
      ],
    });
    vi.advanceTimersToNextFrame();

    renderer.render({
      cursor: 'none',
      menu: { model: otherModel, center: [10, 0], activeKey: null },
      // Reference-equal, so the layer skips its redraw: the upper stroke
      // must still be moved back in front of the recreated menu.
      upperStroke,
      lowerStroke: [
        [0, 0],
        [5, 5],
        [10, 0],
      ],
    });
    vi.advanceTimersToNextFrame();

    expect(layerOrder(parent)).toEqual(['lower', 'menu', 'upper']);

    renderer.dispose();
  });

  it('keeps a completed-gesture trace in front of a menu that opens before it expires', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();

    const parent = document.createElement('div');
    const renderer = createStackingRenderer(parent);

    renderer.showFeedback({
      stroke: [
        [0, 0],
        [10, 0],
      ],
      canceled: false,
    });
    // Well inside the default feedback duration, so the trace is still up
    // when the next gesture opens its menu.
    vi.advanceTimersByTime(334);

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
    vi.advanceTimersToNextFrame();

    expect(layerOrder(parent)).toEqual(['lower', 'menu', 'feedback', 'upper']);

    renderer.dispose();
  });
});

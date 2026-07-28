import {
  queryCanvasContext,
  stubbedCanvasContexts,
  type MockContext,
} from '../__fixtures__/canvas.js';
import { createStrokeCanvas as stroke } from './stroke.js';

const createDiv = (): HTMLDivElement => {
  const div = document.createElement('div');
  div.getBoundingClientRect = () =>
    ({ width: 50, height: 60 }) as unknown as DOMRect;
  return div;
};

/** A div holding a stroke canvas with the shared test config, and its mock context, calls so far cleared. */
const createTestStroke = (): {
  div: HTMLDivElement;
  strokeCanvas: ReturnType<typeof stroke>;
  mockContext: MockContext;
} => {
  const div = createDiv();
  const strokeCanvas = stroke({
    parent: div,
    doc: document,
    ptSize: 1 / 4,
    pointRadius: 100,
    pointColor: 'mockPointColor',
    lineWidth: 7,
    lineColor: 'mockLineColor',
  });
  const mockContext = queryCanvasContext(div);
  return { div, strokeCanvas, mockContext };
};

describe('stroke', () => {
  it('defaults ptSize to the device pixel ratio', () => {
    using _canvases = stubbedCanvasContexts();
    vi.stubGlobal('devicePixelRatio', 2);
    const dprDiv = createDiv();
    stroke({ parent: dprDiv, doc: document });
    const canvas = dprDiv.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(100);
    expect(queryCanvasContext(dprDiv).mock.methodCalls).toEqual([
      { method: 'scale', args: [2, 2] },
    ]);
    vi.unstubAllGlobals();
  });

  it('defaults ptSize to 1 if there is no device pixel ratio', () => {
    using _canvases = stubbedCanvasContexts();
    vi.stubGlobal('devicePixelRatio', undefined);
    const noDprDiv = createDiv();
    stroke({ parent: noDprDiv, doc: document });
    const canvas = noDprDiv.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(50);
    expect(queryCanvasContext(noDprDiv).mock.methodCalls).toEqual([
      { method: 'scale', args: [1, 1] },
    ]);
    vi.unstubAllGlobals();
  });

  it('creates its DOM and set up the canvas scale', () => {
    using _canvases = stubbedCanvasContexts();
    const { div, mockContext } = createTestStroke();
    expect(div).toMatchSnapshot();
    expect(mockContext.mock.methodCalls).toEqual([
      { method: 'scale', args: [4, 4] },
    ]);
  });

  it('can be removed', () => {
    using _canvases = stubbedCanvasContexts();
    const { div, strokeCanvas } = createTestStroke();
    strokeCanvas.remove();
    expect(div).toMatchSnapshot();
  });

  it('can draw points', () => {
    using _canvases = stubbedCanvasContexts();
    const { strokeCanvas, mockContext } = createTestStroke();
    // Clear the method calls made while setting up the canvas scale.
    mockContext.mock.methodCalls = [];

    strokeCanvas.drawPoint([10, 12]);
    strokeCanvas.drawPoint([5.2, 0]);
    expect(mockContext.mock.methodCalls).toMatchSnapshot();
  });

  it('can draw strokes', () => {
    using _canvases = stubbedCanvasContexts();
    const { strokeCanvas, mockContext } = createTestStroke();
    // Clear the method calls made while setting up the canvas scale.
    mockContext.mock.methodCalls = [];

    strokeCanvas.drawStroke([
      [3, 2],
      [2, 4],
      [5, 1],
      [9, 0],
    ]);
    strokeCanvas.drawStroke([
      [10, 0],
      [0, 0],
      [1, 1],
      [1, 0],
    ]);
    expect(mockContext.mock.methodCalls).toMatchSnapshot();
  });

  it('can be cleared', () => {
    using _canvases = stubbedCanvasContexts();
    const { strokeCanvas, mockContext } = createTestStroke();
    // Clear the method calls made while setting up the canvas scale.
    mockContext.mock.methodCalls = [];
    strokeCanvas.clear();
    expect(mockContext.mock.methodCalls).toMatchSnapshot();
  });
});

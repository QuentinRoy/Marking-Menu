import stroke from './stroke.js';

const docCreateElement = document.createElement;

const createMockContext = () =>
  new Proxy(
    {
      mock: {
        methodCalls: [],
      },
    },
    {
      get(target, name) {
        return Object.hasOwn(target, name)
          ? target[name]
          : (...args) => {
              target.mock.methodCalls.push({
                method: name,
                args,
              });
            };
      },
    },
  );

describe('stroke', () => {
  let strokeCanvas;
  let div;
  let mockContext;

  beforeEach(() => {
    document.createElement = vi.fn((t, ...args) => {
      const elt = docCreateElement.call(document, t, ...args);
      if (t === 'canvas') {
        const context = createMockContext();
        elt.getContext = () => context;
      }

      return elt;
    });

    div = document.createElement('div');
    div.getBoundingClientRect = () => ({ width: 50, height: 60 });
    strokeCanvas = stroke({
      parent: div,
      doc: document,
      ptSize: 1 / 4,
      pointRadius: 100,
      pointColor: 'mockPointColor',
      lineWidth: 7,
      lineColor: 'mockLineColor',
    });
    mockContext = div.querySelector('canvas').getContext();
  });

  afterEach(() => {
    document.createElement = docCreateElement;
    vi.unstubAllGlobals();
  });

  it('defaults ptSize to the device pixel ratio', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const dprDiv = document.createElement('div');
    dprDiv.getBoundingClientRect = () => ({ width: 50, height: 60 });
    stroke({ parent: dprDiv, doc: document });
    const canvas = dprDiv.querySelector('canvas');
    expect(canvas.width).toBe(100);
    expect(canvas.getContext().mock.methodCalls).toEqual([
      { method: 'scale', args: [2, 2] },
    ]);
  });

  it('defaults ptSize to 1 if there is no device pixel ratio', () => {
    vi.stubGlobal('devicePixelRatio', undefined);
    const noDprDiv = document.createElement('div');
    noDprDiv.getBoundingClientRect = () => ({ width: 50, height: 60 });
    stroke({ parent: noDprDiv, doc: document });
    const canvas = noDprDiv.querySelector('canvas');
    expect(canvas.width).toBe(50);
    expect(canvas.getContext().mock.methodCalls).toEqual([
      { method: 'scale', args: [1, 1] },
    ]);
  });

  it('creates its DOM and set up the canvas scale', () => {
    expect(div).toMatchSnapshot();
    expect(div.querySelector('canvas').getContext().mock.methodCalls).toEqual([
      { method: 'scale', args: [4, 4] },
    ]);
  });

  it('can be removed', () => {
    strokeCanvas.remove();
    expect(div).toMatchSnapshot();
  });

  it('can draw points', () => {
    // Clear the method calls.
    mockContext.mock.methodCalls = [];

    strokeCanvas.drawPoint([10, 12]);
    strokeCanvas.drawPoint([5.2, 0]);
    expect(mockContext.mock.methodCalls).toMatchSnapshot();
  });

  it('can draw strokes', () => {
    // Clear the method calls.
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
    // Clear the method calls.
    mockContext.mock.methodCalls = [];
    strokeCanvas.clear();
    expect(mockContext.mock.methodCalls).toMatchSnapshot();
  });
});

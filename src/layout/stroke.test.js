import stroke from './stroke';

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
        return name in target
          ? target[name]
          : (...args) => {
              target.mock.methodCalls.push({
                method: name,
                args,
              });
            };
      },
    }
  );

describe('stroke', () => {
  let strokeCanvas;
  let div;
  let mockContext;

  beforeEach(() => {
    document.createElement = jest.fn((t, ...args) => {
      const elt = docCreateElement.call(document, t, ...args);
      if (t === 'canvas') {
        const context = createMockContext();
        elt.getContext = () => context;
      }
      return elt;
    });

    div = document.createElement('div');
    div.getBoundingClientRect = () => ({ width: 50, height: 60 });
    strokeCanvas = stroke(div, {
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

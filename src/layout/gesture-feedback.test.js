import createGestureFeedback from './gesture-feedback';
import createStrokeCanvas from './stroke';

jest.mock('./stroke');

createStrokeCanvas.mockImplementation(() => ({
  drawStroke: jest.fn(),
  remove: jest.fn()
}));

jest.useFakeTimers();

afterEach(() => {
  jest.clearAllMocks();
});

describe('createGestureFeedback', () => {
  it('creates a gesture feedback instance', () => {
    createGestureFeedback('div', { duration: 50 });
  });
});

describe('createGestureFeedback#draw', () => {
  let gs;
  beforeEach(() => {
    // Create the stroke canvas and show a stroke for 50ms.
    gs = createGestureFeedback('mock-div', {
      duration: 50,
      strokeArg1: 'foo',
      strokeArg2: 'bar'
    });
    gs.show('mock-stroke');
  });

  it('draw a stroke', () => {
    // Expect the stroke canvas to have been properly created.
    expect(createStrokeCanvas).toHaveBeenCalledTimes(1);
    expect(createStrokeCanvas).toHaveBeenCalledWith('mock-div', {
      strokeArg1: 'foo',
      strokeArg2: 'bar'
    });
    const sc = createStrokeCanvas.mock.results[0].value;
    expect(sc.drawStroke).toHaveBeenCalledTimes(1);
    expect(sc.drawStroke).toHaveBeenCalledWith('mock-stroke');
  });

  it('removes the stroke after the given duration', () => {
    const sc = createStrokeCanvas.mock.results[0].value;
    // Expect the stroke canvas not to have been removed yet.
    expect(sc.remove).not.toHaveBeenCalled();
    // Advance the time by 50ms (the callback duration).
    jest.advanceTimersByTime(50);
    // Expect the stroke canvas to have been removed now.
    expect(sc.remove).toHaveBeenCalled();
  });
});

describe('createGestureFeedback#remove', () => {
  let gs;

  it('immediately clear any feedbacks', () => {
    // Create the stroke canvas and show a stroke for 50ms.
    gs = createGestureFeedback('mock-div', {
      duration: 5000,
      strokeArg1: 'foo',
      strokeArg2: 'bar'
    });
    gs.show('mock-stroke-1');
    gs.show('mock-stroke-2');
    gs.show('mock-stroke-3');

    // Sanity check (already tested).
    expect(createStrokeCanvas).toHaveBeenCalledTimes(3);

    const remove1 = createStrokeCanvas.mock.results[0].value.remove;
    const remove2 = createStrokeCanvas.mock.results[1].value.remove;
    const remove3 = createStrokeCanvas.mock.results[2].value.remove;

    // Make sure that no canvas have been removed yet.
    expect(remove1).not.toHaveBeenCalled();
    expect(remove2).not.toHaveBeenCalled();
    expect(remove3).not.toHaveBeenCalled();

    // Clear everything.
    gs.remove();
    expect(remove1).toHaveBeenCalledTimes(1);
    expect(remove2).toHaveBeenCalledTimes(1);
    expect(remove3).toHaveBeenCalledTimes(1);

    // Make sure that we don't remove these several times.
    jest.runAllTimers();
    expect(remove1).toHaveBeenCalledTimes(1);
    expect(remove2).toHaveBeenCalledTimes(1);
    expect(remove3).toHaveBeenCalledTimes(1);
  });
});

import type { Point } from '../utils.js';
import {
  createGestureFeedback,
  type GestureFeedback,
} from './gesture-feedback.js';
import { createStrokeCanvas, type StrokeCanvas } from './stroke.js';

vi.mock('./stroke');

type GestureFeedbackOptions = Parameters<typeof createGestureFeedback>[0];

const mockCreateStrokeCanvas = vi.mocked(createStrokeCanvas);

mockCreateStrokeCanvas.mockImplementation(
  () =>
    ({
      drawStroke: vi.fn(),
      remove: vi.fn(),
    }) as unknown as StrokeCanvas,
);

vi.useFakeTimers();

afterEach(() => {
  vi.clearAllMocks();
});

describe('createGestureFeedback', () => {
  it('creates a gesture feedback instance', () => {
    expect(() =>
      createGestureFeedback({
        parent: 'div',
        duration: 50,
      } as unknown as GestureFeedbackOptions),
    ).not.toThrow();
  });
});

describe('createGestureFeedback#draw', () => {
  let gs: GestureFeedback;
  beforeEach(() => {
    // Create the stroke canvas and show a stroke for 50ms.
    gs = createGestureFeedback({
      parent: 'mock-div',
      duration: 50,
      strokeOptions: {
        strokeArg1: 'arg1',
        strokeArg2: 'arg2',
      },
      canceledStrokeOptions: {
        strokeArg1: 'canceledArg1',
        canceledStrokeArg3: 'canceledArg3',
      },
    } as unknown as GestureFeedbackOptions);
  });

  it('draw a stroke', () => {
    gs.show('mock-stroke' as unknown as readonly Point[]);
    // Expect the stroke canvas to have been properly created.
    expect(createStrokeCanvas).toHaveBeenCalledTimes(1);
    expect(createStrokeCanvas).toHaveBeenCalledWith({
      parent: 'mock-div',
      strokeArg1: 'arg1',
      strokeArg2: 'arg2',
    });
    const sc = mockCreateStrokeCanvas.mock.results[0]?.value as StrokeCanvas;
    expect(sc.drawStroke).toHaveBeenCalledTimes(1);
    expect(sc.drawStroke).toHaveBeenCalledWith('mock-stroke');
  });

  it('draw a canceled stroke', () => {
    gs.show('mock-canceled-stroke' as unknown as readonly Point[], {
      canceled: true,
    });
    // Expect the stroke canvas to have been properly created.
    expect(createStrokeCanvas).toHaveBeenCalledTimes(1);
    expect(createStrokeCanvas).toHaveBeenCalledWith({
      parent: 'mock-div',
      strokeArg1: 'canceledArg1',
      strokeArg2: 'arg2',
      canceledStrokeArg3: 'canceledArg3',
    });
    const sc = mockCreateStrokeCanvas.mock.results[0]?.value as StrokeCanvas;
    expect(sc.drawStroke).toHaveBeenCalledTimes(1);
    expect(sc.drawStroke).toHaveBeenCalledWith('mock-canceled-stroke');
  });

  it('removes the stroke after the given duration', () => {
    gs.show('mock-stroke' as unknown as readonly Point[]);
    const sc = mockCreateStrokeCanvas.mock.results[0]?.value as StrokeCanvas;
    // Expect the stroke canvas not to have been removed yet.
    expect(sc.remove).not.toHaveBeenCalled();
    // Advance the time by 50ms (the callback duration).
    vi.advanceTimersByTime(50);
    // Expect the stroke canvas to have been removed now.
    expect(sc.remove).toHaveBeenCalled();
  });
});

describe('createGestureFeedback#remove', () => {
  let gs: GestureFeedback;

  it('immediately clear any feedbacks', () => {
    // Create the stroke canvas and show a stroke for 50ms.
    gs = createGestureFeedback({
      parent: 'mock-div',
      duration: 5000,
      strokeArg1: 'foo',
      strokeArg2: 'bar',
    } as unknown as GestureFeedbackOptions);
    gs.show('mock-stroke-1' as unknown as readonly Point[]);
    gs.show('mock-stroke-2' as unknown as readonly Point[]);
    gs.show('mock-stroke-3' as unknown as readonly Point[]);

    // Sanity check (already tested).
    expect(createStrokeCanvas).toHaveBeenCalledTimes(3);

    const remove1 = (
      mockCreateStrokeCanvas.mock.results[0]?.value as StrokeCanvas
    ).remove;
    const remove2 = (
      mockCreateStrokeCanvas.mock.results[1]?.value as StrokeCanvas
    ).remove;
    const remove3 = (
      mockCreateStrokeCanvas.mock.results[2]?.value as StrokeCanvas
    ).remove;

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
    vi.runAllTimers();
    expect(remove1).toHaveBeenCalledTimes(1);
    expect(remove2).toHaveBeenCalledTimes(1);
    expect(remove3).toHaveBeenCalledTimes(1);
  });
});

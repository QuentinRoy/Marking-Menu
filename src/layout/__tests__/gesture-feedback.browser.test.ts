import { createGestureFeedback } from '../gesture-feedback.js';

describe('gesture feedback', () => {
  it('keeps concurrent traces until their own timeouts expire', () => {
    vi.useFakeTimers();
    const parent = document.createElement('div');
    const feedback = createGestureFeedback({ parent, duration: 50 });

    feedback.show([
      [0, 0],
      [10, 0],
    ]);
    vi.advanceTimersByTime(25);
    feedback.show(
      [
        [0, 0],
        [0, 10],
      ],
      { canceled: true },
    );

    expect(parent.children).toHaveLength(2);
    vi.advanceTimersByTime(25);
    expect(parent.children).toHaveLength(1);
    vi.advanceTimersByTime(25);
    expect(parent.children).toHaveLength(0);
    vi.useRealTimers();
  });

  it('removes every trace and cancels its timeout', () => {
    vi.useFakeTimers();
    const parent = document.createElement('div');
    const feedback = createGestureFeedback({ parent, duration: 50 });
    feedback.show([[0, 0]]);
    feedback.show([[1, 1]]);

    feedback.remove();

    expect(parent.children).toHaveLength(0);
    vi.runAllTimers();
    expect(parent.children).toHaveLength(0);
    vi.useRealTimers();
  });
});

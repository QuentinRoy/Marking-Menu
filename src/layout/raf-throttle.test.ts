import type { EmptyTuple } from '../utils.js';
import { rafThrottle } from './raf-throttle.js';

// `vi.fn()` alone infers a value-returning signature, which `rafThrottle`'s
// `void` callback parameter rejects.
const voidMock = <Arguments extends readonly unknown[]>() =>
  vi.fn<(...args: Arguments) => void>();

describe('rafThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call the throttled function synchronously', () => {
    const fn = voidMock<[number]>();
    rafThrottle(fn)(1);
    expect(fn).not.toHaveBeenCalled();
  });

  it('calls the throttled function on the next frame', () => {
    const fn = voidMock<[number, number]>();
    rafThrottle(fn)(1, 2);
    vi.advanceTimersToNextFrame();
    expect(fn).toHaveBeenCalledExactlyOnceWith(1, 2);
  });

  it('coalesces calls made within the same frame, keeping the last arguments', () => {
    const fn = voidMock<[string]>();
    const throttled = rafThrottle(fn);

    throttled('a');
    throttled('b');
    throttled('c');
    vi.advanceTimersToNextFrame();

    expect(fn).toHaveBeenCalledExactlyOnceWith('c');
  });

  it('schedules a new frame for calls made after the previous one ran', () => {
    const fn = voidMock<[string]>();
    const throttled = rafThrottle(fn);

    throttled('a');
    vi.advanceTimersToNextFrame();
    throttled('b');
    vi.advanceTimersToNextFrame();

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'a');
    expect(fn).toHaveBeenNthCalledWith(2, 'b');
  });

  it('does nothing when the throttled function is never called', () => {
    const fn = voidMock<EmptyTuple>();
    rafThrottle(fn);
    vi.advanceTimersToNextFrame();
    expect(fn).not.toHaveBeenCalled();
  });

  it('throttles each wrapped function independently', () => {
    const fn1 = voidMock<[string]>();
    const fn2 = voidMock<[string]>();
    const throttled1 = rafThrottle(fn1);
    const throttled2 = rafThrottle(fn2);

    throttled1('a');
    throttled2('b');
    vi.advanceTimersToNextFrame();

    expect(fn1).toHaveBeenCalledExactlyOnceWith('a');
    expect(fn2).toHaveBeenCalledExactlyOnceWith('b');
  });
});

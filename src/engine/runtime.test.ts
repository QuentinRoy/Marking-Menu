import { fakeTimers } from '../__fixtures__/canvas.js';
import { createModel } from '../model.js';
import { createRuntime } from './runtime.js';

const model = createModel({ items: [{ id: 'right', label: 'Right' }] });
const options = {
  movementsThreshold: 5,
  noviceDwellingTime: 300,
  minSelectionDist: 40,
  minMenuSelectionDist: 80,
  submenuOpeningDelay: 200,
};

const createFakeRenderer = () => ({
  render: vi.fn(),
  showFeedback: vi.fn(),
  dispose: vi.fn(),
});

/**
Record every event the runtime emits, in order, by name.
*/
const recordEmitted = (
  runtime: ReturnType<typeof createRuntime<typeof model>>,
): string[] => {
  const emitted: string[] = [];
  for (const type of ['start', 'select', 'cancel'] as const) {
    runtime.on(type, (event) => {
      emitted.push(event.type);
    });
  }

  return emitted;
};

describe('createRuntime', () => {
  it('emits the events the machine produces, in order', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });
    const emitted = recordEmitted(runtime);

    runtime.send({ type: 'pointer.down', position: [0, 0] });
    runtime.send({ type: 'pointer.up', position: [100, 0] });

    expect(emitted).toEqual(['start', 'select']);
  });

  it('throws when sending an input after disposal, to surface implementation bugs', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });

    runtime.dispose();

    expect(() => {
      runtime.send({ type: 'pointer.down', position: [0, 0] });
    }).toThrow();
  });

  it('queues a re-entrant send from within a dispatched listener, and only processes it once the listener returns', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });

    let hasStartListenerReturned = false;
    let wasStartListenerDoneWhenSelectFired = false;

    runtime.on('start', () => {
      // Re-entrant: a listener synthesizing another input, exactly the
      // scenario https://github.com/QuentinRoy/Marking-Menu/issues/153's
      // "Reentrancy" section describes.
      runtime.send({ type: 'pointer.up', position: [100, 0] });
      hasStartListenerReturned = true;
    });
    runtime.on('select', () => {
      wasStartListenerDoneWhenSelectFired = hasStartListenerReturned;
    });

    runtime.send({ type: 'pointer.down', position: [0, 0] });

    expect(wasStartListenerDoneWhenSelectFired).toBe(true);
  });

  it('stops notifying a listener removed with off()', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });

    const started = vi.fn<() => void>();
    runtime.on('start', started);
    runtime.off('start', started);

    runtime.send({ type: 'pointer.down', position: [0, 0] });

    expect(started).not.toHaveBeenCalled();
  });

  it('dispose() is idempotent', () => {
    const renderer = createFakeRenderer();
    const runtime = createRuntime({ model, options, renderer });

    runtime.dispose();
    runtime.dispose();

    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });

  it('emits cancel, not select, for a gesture with no movement at all', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });
    const emitted = recordEmitted(runtime);

    runtime.send({ type: 'pointer.down', position: [0, 0] });
    runtime.send({ type: 'pointer.up', position: [0, 0] });

    expect(emitted).toEqual(['start', 'cancel']);
  });

  it('emits cancel, not select, when the pointer is cancelled mid-gesture', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });
    const emitted = recordEmitted(runtime);

    runtime.send({ type: 'pointer.down', position: [0, 0] });
    runtime.send({ type: 'pointer.move', position: [100, 0] });
    runtime.send({ type: 'pointer.cancel', position: [100, 0] });

    expect(emitted).toEqual(['start', 'cancel']);
  });

  it('dispose() mid-gesture leaves no armed timer and emits no public event', () => {
    using _timers = fakeTimers();
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });
    const emitted = recordEmitted(runtime);

    runtime.send({ type: 'pointer.down', position: [0, 0] });
    expect(vi.getTimerCount()).toBe(1);

    runtime.dispose();

    expect(vi.getTimerCount()).toBe(0);
    expect(emitted).toEqual(['start']);
  });

  it('does not render during teardown: unsubscribing happens before the dispose input is sent', () => {
    const renderer = createFakeRenderer();
    const runtime = createRuntime({ model, options, renderer });

    runtime.send({ type: 'pointer.down', position: [0, 0] });
    const rendersBeforeDispose = renderer.render.mock.calls.length;

    runtime.dispose();

    expect(renderer.render).toHaveBeenCalledTimes(rendersBeforeDispose);
  });

  it('absorbs a throwing consumer listener rather than letting it interrupt the controller', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });
    runtime.on('start', () => {
      throw new Error('boom');
    });

    expect(() => {
      runtime.send({ type: 'pointer.down', position: [0, 0] });
    }).not.toThrow();

    const selected = vi.fn<() => void>();
    runtime.on('select', selected);
    runtime.send({ type: 'pointer.up', position: [100, 0] });

    expect(selected).toHaveBeenCalledTimes(1);
  });

  it('shows the canceled feedback style for cancel, and the normal style for select', () => {
    const renderer = createFakeRenderer();
    const runtime = createRuntime({ model, options, renderer });

    runtime.send({ type: 'pointer.down', position: [0, 0] });
    runtime.send({ type: 'pointer.up', position: [100, 0] });
    expect(renderer.showFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ canceled: false }),
    );

    runtime.send({ type: 'pointer.down', position: [0, 0] });
    runtime.send({ type: 'pointer.up', position: [0, 0] });
    expect(renderer.showFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ canceled: true }),
    );
  });

  describe('internal failure', () => {
    it('tears down, logs, then rethrows, when reacting to the machine own layout output fails', () => {
      const renderer = createFakeRenderer();
      const failure = new Error('boom');
      renderer.render.mockImplementationOnce(() => {
        throw failure;
      });
      const log = { error: vi.fn<(error: Error) => void>() };
      const runtime = createRuntime({ model, options, renderer, log });

      expect(() => {
        runtime.send({ type: 'pointer.down', position: [0, 0] });
      }).toThrow(failure);

      // Torn down through the same path as `dispose()`.
      expect(renderer.dispose).toHaveBeenCalledTimes(1);
      // Logged before the throw reaches the caller above.
      expect(log.error).toHaveBeenCalledExactlyOnceWith(failure);
      // Unrecoverable: further input throws the disposed-controller error,
      // not a repeat of the original failure.
      expect(() => {
        runtime.send({ type: 'pointer.move', position: [1, 0] });
      }).toThrow('disposed');
    });

    it('tears down, logs, then rethrows, when reacting to the machine own feedback output fails', () => {
      const renderer = createFakeRenderer();
      const failure = new Error('boom');
      renderer.showFeedback.mockImplementationOnce(() => {
        throw failure;
      });
      const log = { error: vi.fn<(error: Error) => void>() };
      const runtime = createRuntime({ model, options, renderer, log });

      runtime.send({ type: 'pointer.down', position: [0, 0] });
      expect(() => {
        runtime.send({ type: 'pointer.up', position: [0, 0] });
      }).toThrow(failure);

      expect(renderer.dispose).toHaveBeenCalledTimes(1);
      expect(log.error).toHaveBeenCalledExactlyOnceWith(failure);
    });

    it('logs and suppresses a teardown failure while unwinding a primary failure, and rethrows only the original', () => {
      const renderer = createFakeRenderer();
      const primaryFailure = new Error('primary');
      const teardownFailure = new Error('teardown');
      renderer.render.mockImplementationOnce(() => {
        throw primaryFailure;
      });
      renderer.dispose.mockImplementationOnce(() => {
        throw teardownFailure;
      });
      const log = { error: vi.fn<(error: Error) => void>() };
      const runtime = createRuntime({ model, options, renderer, log });

      expect(() => {
        runtime.send({ type: 'pointer.down', position: [0, 0] });
      }).toThrow(primaryFailure);

      expect(log.error).toHaveBeenNthCalledWith(1, teardownFailure);
      expect(log.error).toHaveBeenNthCalledWith(2, primaryFailure);
      expect(log.error).toHaveBeenCalledTimes(2);
    });

    it('normalizes a non-Error throw before logging and rethrowing it', () => {
      const renderer = createFakeRenderer();
      renderer.render.mockImplementationOnce(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- simulating a non-Error throw on purpose
        throw 'boom';
      });
      const log = { error: vi.fn<(error: Error) => void>() };
      const runtime = createRuntime({ model, options, renderer, log });

      expect(() => {
        runtime.send({ type: 'pointer.down', position: [0, 0] });
      }).toThrow(Error);
      expect(log.error).toHaveBeenCalledTimes(1);
      const loggedError = log.error.mock.calls[0]?.[0];
      expect(loggedError).toBeInstanceOf(Error);
      expect(loggedError?.message).toContain('boom');
    });
  });

  describe('reentrancy and disposal mid-batch', () => {
    it('drops whatever remains of a batch once disposal happens mid-batch', () => {
      const runtime = createRuntime({
        model,
        options,
        renderer: createFakeRenderer(),
      });
      const emitted = recordEmitted(runtime);
      let didSelectFire = false;

      runtime.on('start', () => {
        // Re-entrant, queued behind the current batch (same mechanism the
        // existing reentrancy test above exercises), but this time,
        // disposal happens before it can ever be observed.
        runtime.send({ type: 'pointer.up', position: [100, 0] });
        runtime.dispose();
      });
      runtime.on('select', () => {
        didSelectFire = true;
      });

      runtime.send({ type: 'pointer.down', position: [0, 0] });

      expect(didSelectFire).toBe(false);
      expect(emitted).toEqual(['start']);
    });
  });
});

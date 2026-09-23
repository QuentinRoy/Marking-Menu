import { fakeTimers } from '../__fixtures__/timers.js';
import { createModel } from '../model.js';
import { noOp, type Point } from '../utils.js';
import type { LayoutView } from './layout-view.js';
import type { EngineModelRoot } from './model-node.js';
import { createRuntime as createRuntimeWithResolvedLog } from './runtime.js';

// The suite below exercises the runtime's own behavior, not what a caller's
// logger does with a failure, so every call site gets a no-op logger unless
// it overrides it to assert on it.
const createRuntime = <Model extends EngineModelRoot>(
  options: Omit<
    Parameters<typeof createRuntimeWithResolvedLog<Model>>[0],
    'log'
  > &
    Partial<
      Pick<Parameters<typeof createRuntimeWithResolvedLog<Model>>[0], 'log'>
    >,
) => createRuntimeWithResolvedLog<Model>({ log: { error: noOp }, ...options });

const model = createModel({ items: [{ id: 'right', label: 'Right' }] });
const options = {
  movementsThreshold: 5,
  noviceDwellingTime: 300,
  deadZoneRadius: 40,
  submenuOpeningDelay: 200,
};

const createFakeRenderer = () => ({
  getMenu: () => undefined,
  render: vi.fn(),
  showFeedback: vi.fn(),
  dispose: vi.fn(),
});

/**
Record every event the runtime emits, in order, by name.
*/
const recordEmitted = (
  runtime: Pick<ReturnType<typeof createRuntime<typeof model>>, 'on'>,
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

  it('reports isSending only while a send is on the stack', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });
    expect(runtime.isSending).toBe(false);

    let isDuringSend = false;
    runtime.on('start', () => {
      isDuringSend = runtime.isSending;
    });
    runtime.send({ type: 'pointer.down', position: [0, 0] });

    expect(isDuringSend).toBe(true);
    expect(runtime.isSending).toBe(false);
  });

  it('keeps isSending true through a re-entrant send, until the outer one also unwinds', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });
    let isDuringReentrantSend = false;
    let isAfterReentrantSendReturns = false;

    runtime.on('start', () => {
      runtime.send({ type: 'pointer.up', position: [100, 0] });
      // The re-entrant send above is only queued, not run yet (see the
      // reentrancy test above): what runs it is this listener returning,
      // so `isSending` must still read true right here, mid-listener.
      isAfterReentrantSendReturns = runtime.isSending;
    });
    runtime.on('select', () => {
      isDuringReentrantSend = runtime.isSending;
    });

    runtime.send({ type: 'pointer.down', position: [0, 0] });

    expect(isAfterReentrantSendReturns).toBe(true);
    expect(isDuringReentrantSend).toBe(true);
    expect(runtime.isSending).toBe(false);
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
    it('tears down, logs, then rethrows when the layout output fails', () => {
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

    it('tears down, logs, then rethrows when the feedback output fails', () => {
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

    it('suppresses a teardown failure while unwinding a primary one, rethrows the original', () => {
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
    it('drops the rest of a batch once disposal happens mid-batch', () => {
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

  describe('standalone', () => {
    const menuModel = createModel({
      items: [
        { id: 'first', label: 'First', items: [{ id: 'leaf', label: 'Leaf' }] },
        { id: 'second', label: 'Second' },
      ],
    });
    const createStandaloneRuntime = () => {
      const renderer = createFakeRenderer();
      const runtime = createRuntime({ model: menuModel, options, renderer });
      return { runtime, renderer };
    };

    it('reads its phase from the machine, as idle until something opens', () => {
      const { runtime } = createStandaloneRuntime();
      expect(runtime.phase).toBe('idle');

      runtime.open([10, 20]);
      expect(runtime.phase).toBe('standalone');

      runtime.close();
      expect(runtime.phase).toBe('idle');

      runtime.send({ type: 'pointer.down', position: [0, 0] });
      expect(runtime.phase).toBe('startup');
    });

    it('opens the root, rendering it and announcing it, at the position it is given', () => {
      const { runtime, renderer } = createStandaloneRuntime();
      const rendered: Array<Point | undefined> = [];
      renderer.render.mockImplementation((view: LayoutView) => {
        rendered.push(view.menu?.center);
      });
      const centers: unknown[] = [];
      runtime.on('open', (event) => {
        centers.push(event.menuCenter);
      });

      runtime.open([10, 20]);

      expect(rendered.at(-1)).toEqual([10, 20]);
      expect(centers).toEqual([[10, 20]]);
    });

    it('forwards keyboard intents and focus to the machine', () => {
      const { runtime } = createStandaloneRuntime();
      const changes: unknown[] = [];
      const selections: unknown[] = [];
      runtime.on('change', (event) => {
        changes.push(event.activeItem?.id);
      });
      runtime.on('select', (event) => {
        selections.push(event.selection.id);
      });

      runtime.open([0, 0]);
      runtime.send({ type: 'keyboard', intent: 'last' });
      runtime.send({ type: 'focus', key: menuModel.items[0].key });
      runtime.send({ type: 'keyboard', intent: 'activate' });
      runtime.send({ type: 'keyboard', intent: 'activate' });

      expect(changes).toEqual(['second', 'first', 'leaf']);
      expect(selections).toEqual(['leaf']);
      expect(runtime.phase).toBe('idle');
    });

    it('announces a cancel when it is closed', () => {
      const { runtime } = createStandaloneRuntime();
      const emitted = recordEmitted(runtime);
      runtime.open([0, 0]);

      runtime.close();

      expect(emitted).toEqual(['cancel']);
    });

    it('throws when opening while a gesture or a standalone menu is going on', () => {
      const { runtime } = createStandaloneRuntime();

      runtime.send({ type: 'pointer.down', position: [0, 0] });
      expect(() => {
        runtime.open([0, 0]);
      }).toThrow('idle');

      runtime.send({ type: 'pointer.cancel', position: [0, 0] });
      runtime.open([0, 0]);
      expect(() => {
        runtime.open([0, 0]);
      }).toThrow('idle');
    });

    it('throws when closing anything but a standalone menu', () => {
      const { runtime } = createStandaloneRuntime();

      expect(() => {
        runtime.close();
      }).toThrow('standalone');

      runtime.send({ type: 'pointer.down', position: [0, 0] });
      expect(() => {
        runtime.close();
      }).toThrow('standalone');
    });

    it('throws when opening or closing after disposal', () => {
      const { runtime } = createStandaloneRuntime();
      runtime.dispose();

      expect(() => {
        runtime.open([0, 0]);
      }).toThrow('disposed');
      expect(() => {
        runtime.close();
      }).toThrow('disposed');
    });

    it('announces nothing when disposed mid-interaction', () => {
      const { runtime } = createStandaloneRuntime();
      const emitted = recordEmitted(runtime);
      runtime.open([0, 0]);

      runtime.dispose();

      expect(emitted).toEqual([]);
    });
  });
});

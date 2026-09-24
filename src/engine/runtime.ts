import type { MarkingMenuEventEmitter, MarkingMenuState } from '../events.js';
import type { ModelNode, ModelRoot } from '../types.js';
import type { Point } from '../utils.js';
import { currentMenu } from './layout-view.js';
import type { ResolvedLogger } from './logger.js';
import {
  navigationMachine,
  type NavigationInput,
  type NavigationOptions,
  type NavigationPhase,
} from './machine.js';
import type { EngineModelRoot } from './model-node.js';
import type { LayoutRenderer } from './renderer.js';

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

/**
All an input source needs of the runtime: no events, no model.
*/
export type NavigationInputSink = {
  send: (input: NavigationInput) => void;
};

/**
 The runtime owns the emitter: interpreting the machine's public outputs is
 the only thing that ever originates an event.
 */
export type NavigationRuntime<Model extends ModelNode = ModelRoot> =
  NavigationInputSink &
    MarkingMenuEventEmitter<Model> & {
      /**
      What the machine is doing right now.
      */
      readonly phase: NavigationPhase;
      /**
      What the controller reports as its state.
      */
      readonly state: MarkingMenuState<Model>;
      /**
       Whether a `send` from a source is currently being processed: true for
       the whole synchronous cascade a call triggers, render included, so a
       side effect of that render (for example, focus moving as a menu level
       is swapped in) can be told apart from an unrelated, later one.
       */
      readonly isSending: boolean;
      /**
      Display the root menu on its own, centered at `position` (client
      coordinates). Throws unless the runtime is idle.
      */
      open: (position: Point, options?: { readonly focus?: boolean }) => void;
      /**
      Close a standalone menu. Throws unless one is open.
      */
      close: () => void;
      dispose: () => void;
    };

const toState = (
  current: ReturnType<typeof navigationMachine.start>['current'],
): MarkingMenuState<EngineModelRoot> => {
  const { name, data } = current;
  switch (name) {
    case 'novice': {
      const { menu, active } = data;
      return { mode: name, menu, activeItem: active };
    }

    case 'standalone': {
      const { menus, active } = data;
      return { mode: name, menu: currentMenu(menus), activeItem: active };
    }

    case 'startup':
    case 'expert': {
      return { mode: name };
    }

    // The machine never rests in `recognizing`.
    case 'idle':
    case 'recognizing': {
      return { mode: 'idle' };
    }
  }
};

const publicOutputs = [
  'start',
  'move',
  'open',
  'change',
  'select',
  'cancel',
] as const;

/**
 The runtime owns mutable infrastructure only: starting the host, forwarding
 its outputs, and disposal ordering. It never makes domain decisions: those
 live in `navigationMachine`.

 A consumer listener is never a totorobot `on` listener: a throwing `on`
 listener propagates out of the `emit` call and interrupts the action that
 raised it mid-setup, so every public output is re-announced through a plain
 `EventTarget`, whose `dispatchEvent` absorbs a throwing listener instead.
 */
export function createRuntime<Model extends EngineModelRoot>({
  model,
  options,
  renderer,
  log,
}: {
  model: Model;
  options: NavigationOptions;
  renderer: LayoutRenderer;
  log: ResolvedLogger;
}): NavigationRuntime<Model> {
  const target = new EventTarget();
  // One registration per (type, listener) pair, in registration order, so
  // `off` removes exactly the one `addEventListener` call `on` made for it —
  // mirroring mitt's own on/off contract, which the public API is typed
  // against.
  const registrations = new Map<
    string,
    Array<{ listener: (event: never) => void; wrapper: EventListener }>
  >();

  const host = navigationMachine.start({ model, options });

  /**
   An internal failure (an invariant violation surfacing while reacting to
   the machine's own `layout`/`feedback` outputs, never a consumer's fault)
   tears the controller down through the same path as `dispose()`, logs it,
   then rethrows so it still escapes the pointer listener or dwell timer
   that triggered it. A teardown failure while unwinding is itself logged
   and suppressed: the original error is the one that keeps propagating.
   */
  const handleInternalFailure = (error: unknown): never => {
    const normalized = toError(error);
    try {
      dispose();
    } catch (teardownError) {
      log.error(toError(teardownError));
    }

    log.error(normalized);
    throw normalized;
  };

  const offLayout = host.on('layout', ({ data }) => {
    try {
      renderer.render(data);
    } catch (error) {
      handleInternalFailure(error);
    }
  });
  const offFeedback = host.on('feedback', ({ data }) => {
    try {
      renderer.showFeedback(data);
    } catch (error) {
      handleInternalFailure(error);
    }
  });
  const offPublic = publicOutputs.map((name) =>
    host.on(name, ({ data }) => {
      target.dispatchEvent(new CustomEvent(name, { detail: data }));
    }),
  );

  let isDisposed = false;
  // A depth, not a boolean: a side effect of one send (a native focusout
  // firing as a menu level's DOM is swapped in, say) can itself trigger
  // another before the first returns, and `isSending` must stay true until
  // every nested call has unwound, not just the innermost one.
  let sendDepth = 0;

  const send = (input: NavigationInput): void => {
    if (isDisposed) {
      throw new Error('Cannot send an input to a disposed controller.');
    }

    sendDepth += 1;
    try {
      dispatch(input);
    } finally {
      sendDepth -= 1;
    }
  };

  function dispatch(input: NavigationInput): void {
    switch (input.type) {
      case 'keyboard': {
        if (input.intent === 'dismiss') {
          host.send('dismiss', { source: 'keyboard' });
        } else {
          host.send(input.intent);
        }

        break;
      }

      case 'focus': {
        host.send('focus', { key: input.key });
        break;
      }

      case 'focus-loss': {
        host.send('dismiss', { source: 'focus-loss' });
        break;
      }

      case 'pointer.down': {
        host.send('pointerDown', { position: input.position });
        break;
      }

      case 'pointer.move': {
        host.send('pointerMove', { position: input.position });
        break;
      }

      case 'pointer.up': {
        host.send('pointerUp', { position: input.position });
        break;
      }

      case 'pointer.cancel': {
        host.send('pointerCancel', { position: input.position });
        break;
      }

      case 'standalonePointer.move': {
        host.send('standalonePointerMove', {
          position: input.position,
          itemKey: input.itemKey,
        });
        break;
      }

      case 'standalonePointer.activate': {
        host.send('standalonePointerActivate', {
          position: input.position,
          itemKey: input.itemKey,
        });
        break;
      }

      case 'standalonePointer.cancel': {
        host.send('standalonePointerCancel', { position: input.position });
        break;
      }

      case 'standalonePointer.outside': {
        host.send('standalonePointerOutside', { position: input.position });
        break;
      }
    }
  }

  // The machine declines what does not apply and never throws, so misuse is
  // caught here, where the caller can be told about it. The phase is read at
  // call time: a send made from a listener is queued, so two calls made from
  // one listener can both pass, and the second is silently declined.
  const open = (position: Point, { focus = true } = {}): void => {
    if (isDisposed) {
      throw new Error('Cannot open a disposed controller.');
    }

    if (host.current.name !== 'idle') {
      throw new Error(
        `Cannot open the menu unless the controller is idle (it is ${host.current.name}).`,
      );
    }

    host.send('open', { position, focus });
  };

  const close = (): void => {
    if (isDisposed) {
      throw new Error('Cannot close a disposed controller.');
    }

    if (host.current.name !== 'standalone') {
      throw new Error(
        `Cannot close the menu unless it is standalone (the controller is ${host.current.name}).`,
      );
    }

    host.send('dismiss', { source: 'api' });
  };

  const on = (type: string, listener: (event: never) => void): void => {
    const wrapper: EventListener = (event) => {
      listener((event as CustomEvent).detail as never);
    };

    const list = registrations.get(type) ?? [];
    list.push({ listener, wrapper });
    registrations.set(type, list);
    target.addEventListener(type, wrapper);
  };

  const off = (type: string, listener: (event: never) => void): void => {
    const list = registrations.get(type);
    if (list === undefined) {
      return;
    }

    const index = list.findIndex(
      (registration) => registration.listener === listener,
    );
    if (index === -1) {
      return;
    }

    const [removed] = list.splice(index, 1);
    if (removed !== undefined) {
      target.removeEventListener(type, removed.wrapper);
    }
  };

  const dispose = (): void => {
    if (isDisposed) {
      return;
    }

    isDisposed = true;
    offLayout();
    offFeedback();
    for (const unsubscribe of offPublic) {
      unsubscribe();
    }

    // Unsubscribed first, so this can never reach a listener: the machine
    // still runs its own teardown and wildcard actions, but nothing is left
    // to announce them to, and nothing renders during teardown.
    host.send('dispose');
    renderer.dispose();
  };

  return {
    get isSending() {
      return sendDepth > 0;
    },
    get phase() {
      return host.current.name;
    },
    get state() {
      // The machine is typed over the erased model, the caller's exact type
      // is only known here.
      return toState(host.current) as MarkingMenuState<Model>;
    },
    send,
    open,
    close,
    dispose,
    on,
    off,
  };
}

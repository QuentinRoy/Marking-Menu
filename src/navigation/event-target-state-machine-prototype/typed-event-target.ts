/**
 PROTOTYPE: a strongly typed facade over the DOM's stringly typed
 `EventTarget`.
 
 The native API erases the relationship between an event name and its event
 payload. This class keeps the unavoidable assertion at that boundary so
 consumers and the state machine do not need assertions.
 */

type EventType<Protocol> = Extract<keyof Protocol, string>;

export type ProtocolMessage<
  Protocol,
  Type extends EventType<Protocol> = EventType<Protocol>,
> = {
  [CurrentType in Type]: {
    readonly type: CurrentType;
    readonly detail: Protocol[CurrentType];
  };
}[Type];

export type ProtocolEvent<
  Protocol,
  Type extends EventType<Protocol> = EventType<Protocol>,
> = {
  [CurrentType in Type]: CustomEvent<Protocol[CurrentType]> & {
    readonly type: CurrentType;
  };
}[Type];

export type EventOverflowStrategy = 'drop-oldest' | 'error';

export type AsyncEventOptions = {
  /**
   Async iteration must have an explicit lifetime because an `EventTarget`
   never completes by itself.
   */
  signal: AbortSignal;
  /**
   Pointer movement can outrun an async consumer. Keep that pressure bounded.
   */
  capacity?: number;
  overflow?: EventOverflowStrategy;
};

export class EventQueueOverflowError extends Error {
  constructor(capacity: number) {
    super(`The async event queue exceeded its capacity of ${capacity}.`);
    this.name = 'EventQueueOverflowError';
  }
}

export class TypedEventTarget<Protocol> extends EventTarget {
  readonly #eventTypes: ReadonlyArray<EventType<Protocol>>;

  constructor(eventTypes: ReadonlyArray<EventType<Protocol>>) {
    super();
    this.#eventTypes = eventTypes;
  }

  override addEventListener<Type extends EventType<Protocol>>(
    type: Type,
    callback:
      | ((event: ProtocolEvent<Protocol, Type>) => void)
      | EventListenerObject
      | null,
    options?: AddEventListenerOptions | boolean,
  ): void;

  override addEventListener(
    type: string,
    callback: unknown,
    options?: AddEventListenerOptions | boolean,
  ): void {
    // This assertion is the native boundary: lib.dom cannot express an event
    // map on arbitrary EventTarget subclasses.
    super.addEventListener(
      type,
      callback as EventListenerOrEventListenerObject | null,
      options,
    );
  }

  override removeEventListener<Type extends EventType<Protocol>>(
    type: Type,
    callback:
      | ((event: ProtocolEvent<Protocol, Type>) => void)
      | EventListenerObject
      | null,
    options?: EventListenerOptions | boolean,
  ): void;

  override removeEventListener(
    type: string,
    callback: unknown,
    options?: EventListenerOptions | boolean,
  ): void {
    // See the corresponding assertion in `addEventListener`.
    super.removeEventListener(
      type,
      callback as EventListenerOrEventListenerObject | null,
      options,
    );
  }

  emit<Type extends EventType<Protocol>>(
    type: Type,
    detail: Protocol[Type],
  ): boolean {
    return super.dispatchEvent(new CustomEvent(type, { detail }));
  }

  emitMessage(message: ProtocolMessage<Protocol>): boolean {
    return super.dispatchEvent(
      new CustomEvent(message.type, { detail: message.detail }),
    );
  }

  /**
   Adapt the same public events to an async iterator.
   
   EventTarget remains the source of truth. The iterator is deliberately
   bounded and abortable; it is most suitable for sparse semantic events
   such as `select`, not an unthrottled pointer-move feed.
   */
  async *events({
    signal,
    capacity = 32,
    overflow = 'error',
  }: AsyncEventOptions): AsyncGenerator<ProtocolEvent<Protocol>, void> {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError('Async event capacity must be a positive integer.');
    }

    const queue: Array<ProtocolEvent<Protocol>> = [];
    let wake: (() => void) | undefined;
    let failure: Error | undefined;

    const wakeConsumer = () => {
      wake?.();
      wake = undefined;
    };

    const onEvent = (event: ProtocolEvent<Protocol>) => {
      if (queue.length >= capacity) {
        if (overflow === 'drop-oldest') {
          queue.shift();
        } else {
          failure = new EventQueueOverflowError(capacity);
          wakeConsumer();
          return;
        }
      }

      queue.push(event);
      wakeConsumer();
    };

    const removers = this.#eventTypes.map((type) => {
      this.addEventListener(type, onEvent);
      return () => {
        this.removeEventListener(type, onEvent);
      };
    });
    const onAbort = () => {
      wakeConsumer();
    };

    signal.addEventListener('abort', onAbort, { once: true });

    try {
      while (!signal.aborted) {
        if (failure) {
          throw failure;
        }

        const event = queue.shift();
        if (event) {
          yield event;
          continue;
        }

        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }

      if (failure) {
        throw failure;
      }
    } finally {
      signal.removeEventListener('abort', onAbort);
      for (const remove of removers) {
        remove();
      }
    }
  }
}

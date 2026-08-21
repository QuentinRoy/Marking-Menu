import type { Point } from '../utils.js';

/**
A normalized Pointer Event notification.
*/
export type PointerNotification<E> = {
  canceled?: boolean;
  originalEvent: E;
  position: Point;
  timeStamp: number;
};

/**
Normalize a Pointer Event for the movement and navigation pipeline.
*/
export const createPointerNotification = <
  E extends { clientX: number; clientY: number; timeStamp: number },
>(
  event: E,
): PointerNotification<E> => ({
  originalEvent: event,
  position: [event.clientX, event.clientY],
  timeStamp: event.timeStamp,
});

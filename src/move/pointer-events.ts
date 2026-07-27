import type { Point } from '../utils.js';

/**
 A normalized pointer notification, created from a mouse or touch event.
 */
export type PointerNotification<E> = {
  originalEvent: E;
  position: Point;
  timeStamp: number;
};

/** The properties of a touch point used to compute the pointer position. */
type TouchPoint = { clientX: number; clientY: number };

// Create a custom pointer event from a touch event.
export const createPointerEventFromTouchEvent = <
  E extends { targetTouches: ArrayLike<TouchPoint>; timeStamp: number },
>(
  touchEvt: E,
): PointerNotification<E> => {
  // `targetTouches` is only array-like (not iterable across engines), so it cannot
  // be spread.
  // eslint-disable-next-line unicorn/prefer-spread
  const touchList = Array.from(touchEvt.targetTouches);
  const sumX = touchList.reduce((acc, t) => acc + t.clientX, 0);
  const sumY = touchList.reduce((acc, t) => acc + t.clientY, 0);
  const meanX = sumX / touchList.length;
  const meanY = sumY / touchList.length;
  return {
    originalEvent: touchEvt,
    position: [meanX, meanY],
    timeStamp: touchEvt.timeStamp,
  };
};

// Create a custom pointer from a mouse event.
export const createPointerEventFromMouseEvent = <
  E extends { clientX: number; clientY: number; timeStamp: number },
>(
  mouseEvt: E,
): PointerNotification<E> => ({
  originalEvent: mouseEvt,
  position: [mouseEvt.clientX, mouseEvt.clientY],
  timeStamp: mouseEvt.timeStamp,
});

import { useEffect, useRef, type RefObject } from 'react';

/**
 Keep a value in a ref that always holds the latest render's copy.

 Both surfaces build something imperative once, in an effect, and then hear
 from it long after: a menu controller, a resize observer. Closing over props
 there would mean tearing that down and building it again on every render,
 mid-gesture included, so the handlers read what they need through this ref
 at the moment they run instead.

 @param value - What this render has.
 @returns A ref holding it, updated after every render.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

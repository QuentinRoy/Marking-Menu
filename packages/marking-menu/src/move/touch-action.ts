const PROPERTY = 'touch-action';
const CLAIMED_VALUE = 'none';
const CLAIMED_PRIORITY = 'important';

type TouchActionClaimState = {
  count: number;
  priority: string;
  value: string;
};

const claimStates = new WeakMap<HTMLElement, TouchActionClaimState>();

const isClaimedOnElement = (element: HTMLElement): boolean =>
  element.style.getPropertyValue(PROPERTY) === CLAIMED_VALUE &&
  element.style.getPropertyPriority(PROPERTY) === CLAIMED_PRIORITY;

const setTouchAction = (
  element: HTMLElement,
  { priority, value }: { priority: string; value: string },
): void => {
  if (value === '') {
    element.style.removeProperty(PROPERTY);
  } else {
    element.style.setProperty(PROPERTY, value, priority);
  }
};

/**
 Claim an element's inline `touch-action`, forcing `none !important` on it.

 Claims are reference-counted per element, so several controllers may share a
 single parent. The first claim records the inline value and priority the
 element had; the last release restores them exactly, removing the property
 when there was none.

 The returned release function is idempotent, and restoring is skipped
 altogether when the inline value was changed from outside while claimed.
 */
export const claimTouchAction = (element: HTMLElement): (() => void) => {
  const currentState = claimStates.get(element);
  if (currentState) {
    currentState.count += 1;
  } else {
    claimStates.set(element, {
      count: 1,
      priority: element.style.getPropertyPriority(PROPERTY),
      value: element.style.getPropertyValue(PROPERTY),
    });
    setTouchAction(element, {
      priority: CLAIMED_PRIORITY,
      value: CLAIMED_VALUE,
    });
  }

  let isReleased = false;
  return () => {
    if (isReleased) {
      return;
    }

    isReleased = true;
    const state = claimStates.get(element);
    if (!state) {
      return;
    }

    state.count -= 1;
    if (state.count > 0) {
      return;
    }

    claimStates.delete(element);
    if (!isClaimedOnElement(element)) {
      return;
    }

    setTouchAction(element, state);
  };
};

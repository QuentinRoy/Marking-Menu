type TouchActionClaimState = {
  count: number;
  priority: string;
  value: string;
};

const claimStates = new WeakMap<HTMLElement, TouchActionClaimState>();

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
      priority: element.style.getPropertyPriority('touch-action'),
      value: element.style.getPropertyValue('touch-action'),
    });
    element.style.setProperty('touch-action', 'none', 'important');
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
    if (
      element.style.getPropertyValue('touch-action') !== 'none' ||
      element.style.getPropertyPriority('touch-action') !== 'important'
    ) {
      return;
    }

    if (state.value === '') {
      element.style.removeProperty('touch-action');
    } else {
      element.style.setProperty('touch-action', state.value, state.priority);
    }
  };
};

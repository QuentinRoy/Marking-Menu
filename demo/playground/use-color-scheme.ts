import { useSyncExternalStore } from 'react';

const query = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void): () => void {
  const media = globalThis.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => {
    media.removeEventListener('change', onChange);
  };
}

/**
 The colour scheme the page is being shown in.

 Almost everything on the page follows `prefers-color-scheme` in CSS alone.
 The recognizer overlay is the exception: it is painted onto a canvas, which
 keeps no link to the colours it was painted with, so something has to say
 when a gesture already on screen needs drawing again.

 @returns `'dark'` or `'light'`, changing when the reader's preference does.
 */
export function useColorScheme(): 'dark' | 'light' {
  return useSyncExternalStore(
    subscribe,
    () => (globalThis.matchMedia(query).matches ? 'dark' : 'light'),
    () => 'light',
  );
}

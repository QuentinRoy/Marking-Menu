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
 The live menu is the exception: the library takes its stroke colours as
 options, read once when the menu is created, so something has to say when
 they are stale.

 @returns `'dark'` or `'light'`, changing when the reader's preference does.
 */
export function useColorScheme(): 'dark' | 'light' {
  return useSyncExternalStore(
    subscribe,
    () => (globalThis.matchMedia(query).matches ? 'dark' : 'light'),
    () => 'light',
  );
}

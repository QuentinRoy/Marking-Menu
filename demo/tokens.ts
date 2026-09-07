/*
 Reading the page's own custom properties from script.

 Most of what the library draws follows the reader's colour scheme in CSS
 alone. Its stroke does not: that goes on a canvas, from options passed at
 construction, so both pages have to read those values themselves and hand
 them over (see `demo/color-scheme.css`).
 */

/**
 Read a custom property off the page's root element.

 @param name - The property to read, `--` included.
 @returns Its value, trimmed.
 */
export function token(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/**
 Read a custom property that holds a drawing weight or radius. A canvas takes
 a number, not a length, so these are declared unitless.

 @param name - The property to read, `--` included.
 @returns Its value as a number.
 */
export function tokenNumber(name: string): number {
  return Number(token(name));
}

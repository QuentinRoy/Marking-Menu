import type { Page } from '@playwright/test';
import { expect, test } from '../helpers/fixtures.js';
import {
  moveTo,
  offset,
  pressAt,
  releaseAt,
  SUBMENU_ITEMS,
  surfaceCenter,
  TOP_LEVEL_ITEMS,
  waitForMenuOpen,
  type Point,
} from '../helpers/gestures.js';

// Regression coverage for the built bundle's CSS: menu.css resolves several
// default colors with `light-dark()`, left undeclared (`color-scheme` is the
// consumer's to set, see the README). Lightning CSS, the build's CSS
// minifier, downlevels `light-dark()` for this project's browser target, and
// its downlevel only works when `color-scheme` is declared inside the same
// stylesheet it is compiling. menu.css never declares it (that decision
// belongs to the consumer's own page), so the downlevel always emits `var()`
// references to switching custom properties it never defines here, no
// matter what the consumer's own page declares: that declaration lives in a
// separate stylesheet, compiled separately, and never reaches this one.
// `fill` tolerates the resulting garbage by keeping only its first, valid
// token; `stroke` does not, and resolves to `none`.
//
// A single stroke drawn top to bottom exercises every stroke surface this
// affects: the segment drawn before the menu opens (the lower stroke), the
// segment drawn after, dragged onto an item to activate it (the upper
// stroke and the active wedge outline), and the menu's own default wedge
// outline.
const SELECT_RADIUS = 100;

async function openMenuByDwellingHandoff(page: Page): Promise<Point> {
  const center = await surfaceCenter(page);
  const pauseAt = offset(center, TOP_LEVEL_ITEMS.others.angle, SELECT_RADIUS);
  await pressAt(page, center);
  // A top-to-bottom expert stroke that pauses: the expert-to-novice dwell
  // opens the "Others..." submenu at the pause position, leaving the
  // pre-open movement as the lower stroke.
  await moveTo(page, pauseAt, 3);
  await waitForMenuOpen(page);
  return pauseAt;
}

async function strokeColor(page: Page, selector: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => getComputedStyle(element).stroke);
}

type StrokeColors = {
  lower: string;
  upper: string;
  wedgeOutline: string;
  activeWedgeOutline: string;
};

async function readStrokeColors(page: Page): Promise<StrokeColors> {
  const pauseAt = await openMenuByDwellingHandoff(page);
  const wedgeOutline = await strokeColor(page, '.marking-menu-wedge-outline');

  // Continue the stroke onto a submenu item: the segment drawn since the
  // menu opened is the upper stroke, and dragging onto the item activates
  // it, giving the active wedge outline its own color too.
  await moveTo(
    page,
    offset(pauseAt, SUBMENU_ITEMS['sub-right'].angle, SELECT_RADIUS),
  );

  const colors: StrokeColors = {
    lower: await strokeColor(
      page,
      'svg.marking-menu-stroke--lower .marking-menu-stroke-path',
    ),
    upper: await strokeColor(
      page,
      'svg:not(.marking-menu-stroke--lower) > .marking-menu-stroke-path',
    ),
    wedgeOutline,
    activeWedgeOutline: await strokeColor(
      page,
      '.marking-menu-item.active .marking-menu-wedge-outline',
    ),
  };

  // Ends the gesture so the page is idle again: the dark-mode test reads
  // these colors twice on the same page, once per color scheme.
  await releaseAt(page);
  return colors;
}

test('every stroke surface resolves a color instead of vanishing', async ({
  page,
}) => {
  const colors = await readStrokeColors(page);

  for (const [surface, color] of Object.entries(colors)) {
    expect(color, surface).not.toBe('none');
  }
});

test("every stroke surface's light-dark() color still switches for a consumer who opts in to dark mode", async ({
  page,
}) => {
  // The README's documented contract: `color-scheme` is the consumer's to
  // declare, on their own page, not menu.css's.
  await page.addStyleTag({ content: ':root { color-scheme: light dark; }' });

  await page.emulateMedia({ colorScheme: 'light' });
  const light = await readStrokeColors(page);

  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await readStrokeColors(page);

  for (const surface of Object.keys(light) as Array<keyof StrokeColors>) {
    expect(light[surface], surface).not.toBe('none');
    expect(dark[surface], surface).not.toBe('none');
    expect(dark[surface], surface).not.toBe(light[surface]);
  }
});

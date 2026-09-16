import type { Page } from '@playwright/test';
import { expect, test } from '../helpers/fixtures.js';
import {
  moveTo,
  offset,
  pressAt,
  surfaceCenter,
  TOP_LEVEL_ITEMS,
  waitForMenuOpen,
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
// The wedge outline's stroke is the regression surface here: on the built
// bundle, its color still comes from this same `light-dark()` chain
// regardless of the version under test. The drawn gesture stroke itself
// does not yet, so it would not catch a regression here.
const SELECT_RADIUS = 100;

async function openMenuByDwellingHandoff(page: Page): Promise<void> {
  const center = await surfaceCenter(page);
  const pauseAt = offset(center, TOP_LEVEL_ITEMS.others.angle, SELECT_RADIUS);
  await pressAt(page, center);
  // A top-to-bottom expert stroke that pauses: the expert-to-novice dwell
  // opens the menu at the pause position.
  await moveTo(page, pauseAt, 3);
  await waitForMenuOpen(page);
}

async function wedgeOutlineStroke(page: Page): Promise<string> {
  return page
    .locator('.marking-menu-wedge-outline')
    .first()
    .evaluate((element) => getComputedStyle(element).stroke);
}

test("a wedge outline's default color resolves instead of vanishing", async ({
  page,
}) => {
  await openMenuByDwellingHandoff(page);

  expect(await wedgeOutlineStroke(page)).not.toBe('none');
});

test("a wedge outline's light-dark() color still switches for a consumer who opts in to dark mode", async ({
  page,
}) => {
  // The README's documented contract: `color-scheme` is the consumer's to
  // declare, on their own page, not menu.css's.
  await page.addStyleTag({ content: ':root { color-scheme: light dark; }' });

  await page.emulateMedia({ colorScheme: 'light' });
  await openMenuByDwellingHandoff(page);
  const light = await wedgeOutlineStroke(page);
  expect(light).not.toBe('none');

  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await wedgeOutlineStroke(page);
  expect(dark).not.toBe('none');
  expect(dark).not.toBe(light);
});

import type { Page } from '@playwright/test';
import { expect, test } from '../helpers/fixtures.js';
import { moveTo, pressAt } from '../helpers/gestures.js';

async function setUpSurface(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { createMarkingMenu } = await import('marking-menu');
    const scroller = document.createElement('div');
    scroller.id = 'stroke-scroll-container';
    scroller.style.cssText =
      'position:fixed;left:200px;top:200px;width:200px;height:100px;overflow:auto;';
    const parent = document.createElement('div');
    parent.id = 'stroke-overflow-surface';
    parent.style.cssText =
      'position:relative;width:100px;height:100px;overflow:visible;';
    scroller.append(parent);
    document.body.append(scroller);
    createMarkingMenu({
      items: [
        { id: 'right', label: 'Right' },
        { id: 'left', label: 'Left' },
      ],
      parent,
    });
  });
}

test('an expert stroke paints outside a visible-overflow parent', async ({
  page,
}) => {
  await setUpSurface(page);
  await pressAt(page, { x: 250, y: 250 });
  await moveTo(page, { x: 350, y: 250 }, 2);

  const state = await page
    .locator('#stroke-overflow-surface')
    .evaluate((parent) => {
      const host = parent.querySelector<HTMLElement>('.marking-menu');
      if (host === null) {
        return null;
      }

      const surface = host.shadowRoot?.querySelector<SVGSVGElement>(
        '.marking-menu-stroke-surface',
      );
      const path =
        surface?.querySelector<SVGPathElement>(':scope > path') ?? null;
      if (path === null) {
        return null;
      }

      host.style.pointerEvents = 'auto';
      path.ownerSVGElement?.style.setProperty('pointer-events', 'auto');
      path.style.pointerEvents = 'stroke';
      return {
        hitOutsideParent: document.elementFromPoint(325, 250) === host,
        hostOverflow: getComputedStyle(host).overflow,
        scrollWidth: document.querySelector('#stroke-scroll-container')
          ?.scrollWidth,
      };
    });

  expect(state).toEqual({
    hitOutsideParent: true,
    hostOverflow: 'visible',
    scrollWidth: 200,
  });

  const clipped = await page
    .locator('#stroke-overflow-surface')
    .evaluate((parent) => {
      parent.style.overflow = 'hidden';
      return document.elementFromPoint(325, 250)?.className;
    });
  expect(clipped).not.toBe('marking-menu');
});

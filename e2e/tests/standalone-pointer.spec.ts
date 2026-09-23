import type { FrameLocator, JSHandle, Locator, Page } from '@playwright/test';
import { expect, test } from '../helpers/fixtures.js';

type Nesting = 'iframe' | 'shadow' | 'top';

/**
 Opens a standalone menu with a submenu, through the built package, inside
 `where`'s container: `'top'` appends straight to `document.body`,
 `'shadow'` nests the trigger and surface inside an open shadow root, and
 `'iframe'` builds them inside a same-origin iframe's own document. Each
 `open`, `change`, `select`, and `cancel` event is logged as `type:mode`,
 with the selection's `id` appended for `select`. Returns a handle on that
 log; the caller finds elements through `page` or `page.frameLocator`, both
 of which pierce an open shadow root on their own.
 */
async function openStandaloneMenu(
  page: Page,
  where: Nesting = 'top',
): Promise<JSHandle<string[]>> {
  return page.evaluateHandle(async (nesting: Nesting) => {
    const { createMarkingMenu } = await import('marking-menu');

    let doc = document;
    let root: Document | HTMLElement | ShadowRoot = document.body;
    if (nesting === 'iframe') {
      const iframe = document.createElement('iframe');
      // `position:fixed` so it paints above the fixture's own fixed `#log`
      // and `#snapshot-area` rather than under them: those are earlier in
      // the DOM but, being positioned, still paint over a later plain
      // static element.
      iframe.style.cssText =
        'position:fixed;top:0;left:0;width:400px;height:400px;border:0;';
      document.body.append(iframe);
      const frameDoc = iframe.contentDocument;
      if (!frameDoc) {
        throw new TypeError('Iframe has no document.');
      }

      doc = frameDoc;
      root = frameDoc.body;
    } else if (nesting === 'shadow') {
      const shadowHost = document.createElement('div');
      shadowHost.style.cssText = 'position:fixed;top:0;left:0;';
      document.body.append(shadowHost);
      root = shadowHost.attachShadow({ mode: 'open' });
    }

    const trigger = doc.createElement('button');
    trigger.id = 'standalone-trigger';
    trigger.textContent = 'Open';
    const surface = doc.createElement('div');
    surface.style.cssText =
      'position:fixed;top:0;left:0;width:400px;height:400px;';
    root.append(trigger, surface);

    const mm = createMarkingMenu({
      parent: surface,
      items: [
        // Pinned to the right, so the labels match the ring.
        { id: 'right', label: 'Right', angle: 0 },
        {
          id: 'others',
          label: 'Others',
          items: [
            { id: 'sub-right', label: 'Sub Right', angle: 0 },
            { id: 'sub-left', label: 'Sub Left' },
          ],
        },
        { id: 'left', label: 'Left' },
      ],
    });

    const events: string[] = [];
    for (const type of ['open', 'change', 'select', 'cancel'] as const) {
      mm.on(type, (event) => {
        const detail = 'selection' in event ? `:${event.selection.id}` : '';
        events.push(`${type}:${event.mode}${detail}`);
      });
    }

    trigger.focus();
    mm.open();
    return events;
  }, where);
}

/**
 The rendered `.marking-menu-label` text for `label`, scoped to the open
 menu: the item itself (what `getByRole('menuitem', ...)` resolves) is a
 zero-size positioning anchor Playwright never considers clickable, the same
 reason `e2e/helpers/gestures.ts`'s own `menuItemLabel` targets the label
 instead.
 */
const itemLabel = (root: FrameLocator | Page, label: string): Locator =>
  root.locator('.marking-menu').getByText(label, { exact: true });

/**
 Clicks `item`'s center through `page.mouse`, by explicit viewport
 coordinates rather than Playwright's own element-targeted `.click()`:
 through two nested shadow roots (the page's own plus the component's),
 that hit-tests unreliably, while raw coordinates land exactly where a real
 pointer would, iframe-nested items included (Playwright reports every
 bounding box in top-page viewport coordinates already).
 */
async function clickItem(page: Page, item: Locator): Promise<void> {
  const box = await item.boundingBox();
  if (!box) {
    throw new TypeError('Item has no bounding box.');
  }

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 Sends a synthetic `pointerType`-tagged press and release at `item`'s
 center: the library never branches on `pointerType`, so this exercises the
 exact same code path a real touch or pen contact would, without CDP touch
 dispatch or a `hasTouch` context.
 */
async function tapWithPointerType(
  item: Locator,
  pointerType: 'pen' | 'touch',
): Promise<void> {
  const box = await item.boundingBox();
  if (!box) {
    throw new TypeError('Item has no bounding box.');
  }

  const init = {
    bubbles: true,
    button: 0,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    composed: true,
    isPrimary: true,
    pointerId: 9,
    pointerType,
  };
  await item.dispatchEvent('pointerdown', init);
  await item.dispatchEvent('pointerup', init);
}

test('standalone menu: a mouse click selects a leaf, and on a submenu opens it before a nested leaf is selected', async ({
  page,
}) => {
  const events = await openStandaloneMenu(page);
  await expect(page.getByRole('menuitem', { name: 'Right' })).toBeFocused();

  await clickItem(page, itemLabel(page, 'Others'));
  // A pointer-caused submenu open focuses the level's own container, not
  // any one of its items (unlike Enter from the keyboard).
  await expect(page.getByRole('menu').last()).toBeFocused();
  await expect(itemLabel(page, 'Sub Right')).toBeVisible();

  await clickItem(page, itemLabel(page, 'Sub Left'));
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('#standalone-trigger')).toBeFocused();

  const log = await events.jsonValue();
  expect(log.at(-1)).toBe('select:standalone:sub-left');
});

test('standalone menu: a click outside it cancels without restoring focus to the trigger', async ({
  page,
}) => {
  const events = await openStandaloneMenu(page);
  await expect(page.getByRole('menuitem', { name: 'Right' })).toBeFocused();

  await page.mouse.click(780, 580);

  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('#standalone-trigger')).not.toBeFocused();
  const log = await events.jsonValue();
  expect(log.at(-1)).toBe('cancel:standalone');
});

for (const pointerType of ['touch', 'pen'] as const) {
  test(`standalone menu: a ${pointerType} contact selects a leaf`, async ({
    page,
  }) => {
    const events = await openStandaloneMenu(page);
    await tapWithPointerType(itemLabel(page, 'Right'), pointerType);

    await expect(page.getByRole('menu')).toHaveCount(0);
    const log = await events.jsonValue();
    expect(log.at(-1)).toBe('select:standalone:right');
  });
}

test('standalone menu: a parent nested inside a shadow root still resolves a click on an item', async ({
  page,
}) => {
  const events = await openStandaloneMenu(page, 'shadow');
  await expect(page.getByRole('menuitem', { name: 'Right' })).toBeFocused();

  await clickItem(page, itemLabel(page, 'Right'));

  await expect(page.getByRole('menu')).toHaveCount(0);
  const log = await events.jsonValue();
  expect(log.at(-1)).toBe('select:standalone:right');
});

test('standalone menu: a parent nested inside a shadow root still resolves an outside press', async ({
  page,
}) => {
  const events = await openStandaloneMenu(page, 'shadow');
  await expect(page.getByRole('menuitem', { name: 'Right' })).toBeFocused();

  await page.mouse.click(780, 580);

  await expect(page.getByRole('menu')).toHaveCount(0);
  const log = await events.jsonValue();
  expect(log.at(-1)).toBe('cancel:standalone');
});

test('standalone menu: a parent living in a different document still resolves a click on an item', async ({
  page,
}) => {
  const events = await openStandaloneMenu(page, 'iframe');
  const frame: FrameLocator = page.frameLocator('iframe');
  await expect(frame.getByRole('menuitem', { name: 'Right' })).toBeFocused();

  await clickItem(page, itemLabel(frame, 'Right'));

  await expect(frame.getByRole('menu')).toHaveCount(0);
  const log = await events.jsonValue();
  expect(log.at(-1)).toBe('select:standalone:right');
});

test('standalone menu: a parent living in a different document still resolves an outside press', async ({
  page,
}) => {
  const events = await openStandaloneMenu(page, 'iframe');
  const frame: FrameLocator = page.frameLocator('iframe');
  await expect(frame.getByRole('menuitem', { name: 'Right' })).toBeFocused();

  // Outside the menu but still inside the iframe's own document: the
  // capture listener the adapter installs is on `parent.ownerDocument`,
  // which for a nested parent is the iframe's document, not the top one.
  await frame.locator('body').click({ position: { x: 5, y: 5 } });

  await expect(frame.getByRole('menu')).toHaveCount(0);
  const log = await events.jsonValue();
  expect(log.at(-1)).toBe('cancel:standalone');
});

import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

type BuiltPage = Disposable & {
  readonly iframe: HTMLIFrameElement;
  readonly document: Document;
};

const loadBuiltPage = async (path: string): Promise<BuiltPage> => {
  const iframe = document.createElement('iframe');
  iframe.src = path;
  Object.assign(iframe.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '800px',
    height: '600px',
    border: '0',
  });
  document.body.append(iframe);
  try {
    await expect
      .poll(() => iframe.contentDocument?.location.pathname)
      .toBe(path);
    await expect
      .poll(() => iframe.contentDocument?.readyState)
      .toBe('complete');
    const pageDocument = iframe.contentDocument;
    if (!pageDocument) {
      throw new Error('The built page did not load a document.');
    }

    return {
      iframe,
      document: pageDocument,
      [Symbol.dispose]() {
        iframe.remove();
      },
    };
  } catch (error) {
    iframe.remove();
    throw error;
  }
};

test('the built demo selects a menu item from the keyboard', async () => {
  using page = await loadBuiltPage('/index.html');
  const { iframe, document: doc } = page;

  expect(doc.querySelector('title')?.textContent).toBe(
    'Marking Menu Demonstration',
  );
  iframe.contentWindow?.focus();
  await userEvent.keyboard('k');
  await expect
    .poll(() => doc.querySelector('#main')?.querySelector('.marking-menu'))
    .not.toBeNull();
  await userEvent.keyboard('{End}{Enter}');
  await expect
    .poll(() => doc.querySelector('#toast')?.textContent)
    .toBe('Up-Left');
});

test('the built playground renders its live marking menu', async () => {
  using page = await loadBuiltPage('/playground/index.html');
  const { document: doc } = page;

  expect(doc.querySelector('title')?.textContent).toBe(
    'Marking Menu Playground',
  );
  await expect
    .poll(() => doc.querySelector('#root')?.firstElementChild)
    .not.toBeNull();
  await expect.poll(() => doc.querySelector('.marking-menu')).not.toBeNull();
});

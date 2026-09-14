// PROTOTYPE (#358): grayscale fixes for the default wedge's 1.12:1 contrast
// against a white page, switchable via `?variant=`. Throwaway.
// `ink` is 4.76:1 against white and 4.26:1 against the default fill.

const ink = 'hwb(0 45% 55%)';
const darkFill = 'hwb(0 50% 50%)';

type Variant = {
  key: string;
  name: string;
  fill?: string;
  vars?: Record<string, string>;
  css?: string;
};

const insetOutline = `.marking-menu-wedge-inset { display: inline; stroke: ${ink}; stroke-width: 4px; }`;

const variants: Variant[] = [
  { key: 'current', name: 'Current (1.12:1)' },
  {
    key: 'outline',
    name: 'Inset outline, 2px',
    css: insetOutline,
  },
  {
    key: 'outline-inked',
    name: 'Inset outline, ink connectors, outlined plates',
    vars: { '--mm-outer-connector-color': ink },
    css: `${insetOutline} .marking-menu-plate { box-shadow: inset 0 0 0 2px ${ink}; }`,
  },
  {
    key: 'dark-fill',
    name: 'Darker fill (3.98:1)',
    fill: darkFill,
  },
  {
    key: 'tint-outline',
    name: 'Tinted fill + inset outline',
    fill: 'hwb(0 82% 18%)',
    css: insetOutline,
  },
  {
    key: 'dark-fill-uniform',
    name: 'Darker fill, plates and connectors share it',
    fill: darkFill,
    vars: {
      '--mm-plate-background': darkFill,
      '--mm-outer-connector-color': darkFill,
      '--mm-outer-connector-color-active': 'hwb(0 85% 15%)',
      // 3.98:1, under the 4.5:1 text threshold at this size.
      '--mm-plate-color': 'hwb(0 100% 0%)',
    },
  },
  {
    key: 'tint-outline-inked',
    name: 'Tinted fill + outline, ink connectors, outlined plates',
    fill: 'hwb(0 82% 18%)',
    vars: { '--mm-outer-connector-color': ink },
    css: `${insetOutline} .marking-menu-plate { box-shadow: inset 0 0 0 2px ${ink}; }`,
  },
  {
    key: 'rim',
    name: 'Outer rim, 4px',
    css: `.marking-menu-wedge-rim { display: inline; stroke: ${ink}; stroke-width: 8px; }`,
  },
  {
    key: 'hatch',
    name: 'Hatched fill',
    css: `.marking-menu-wedge-hatch { display: inline; } .marking-menu-wedge-hatch-line { fill: ${ink}; }`,
  },
];

function currentVariant(): Variant {
  const key = new URLSearchParams(location.search).get('variant');
  return variants.find((variant) => variant.key === key) ?? variants[0];
}

function goTo(offset: number) {
  const index = variants.indexOf(currentVariant());
  const next = variants[(index + offset + variants.length) % variants.length];
  const params = new URLSearchParams(location.search);
  params.set('variant', next.key);
  location.search = params.toString();
}

function injectStyle(host: Element, css: string) {
  const root = host.shadowRoot;
  if (root === null || injected.has(root)) {
    return;
  }

  // Adopted sheets cascade after `<style>` elements, so append to them.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  injected.add(root);
}

const injected = new WeakSet<ShadowRoot>();

function renderSwitcher(variant: Variant) {
  const bar = document.createElement('div');
  bar.style.cssText =
    'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:10;' +
    'display:flex;gap:12px;align-items:center;padding:8px 14px;border-radius:999px;' +
    'background:#111;color:#fff;font:14px system-ui;box-shadow:0 2px 8px #0006;white-space:nowrap;';
  const button = (label: string, offset: number) => {
    const element = document.createElement('button');
    element.textContent = label;
    element.style.cssText = 'all:unset;cursor:pointer;padding:0 6px;font-size:18px;';
    element.addEventListener('click', () => goTo(offset));
    return element;
  };
  const label = document.createElement('span');
  const index = variants.indexOf(variant) + 1;
  label.textContent = `${index}/${variants.length} ${variant.name}`;
  bar.append(button('‹', -1), label, button('›', 1));
  document.body.append(bar);

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target.tagName))
    ) {
      return;
    }
    if (event.key === 'ArrowLeft') goTo(-1);
    if (event.key === 'ArrowRight') goTo(1);
  });
}

export function installWedgeContrastPrototype(main: HTMLElement) {
  if (import.meta.env.PROD) {
    return;
  }

  const variant = currentVariant();
  if (variant.fill !== undefined) {
    main.style.setProperty('--mm-wedge-fill', variant.fill);
  }
  for (const [name, value] of Object.entries(variant.vars ?? {})) {
    main.style.setProperty(name, value);
  }

  const { css } = variant;
  if (css !== undefined) {
    const scan = () => {
      for (const child of main.children) injectStyle(child, css);
    };
    scan();
    new MutationObserver(scan).observe(main, { childList: true });
  }

  renderSwitcher(variant);
}

import { createMarkingMenu } from 'marking-menu';

// The menu is created from this top document's script, but `parent` lives in
// the iframe's document: a separate realm with its own `HTMLElement` and
// `CSSStyleSheet` constructors. This is the scenario #330 is about.
const frame = document.querySelector('iframe');
const frameDocument =
  frame instanceof HTMLIFrameElement
    ? (frame.contentDocument ?? undefined)
    : undefined;
if (frameDocument === undefined) {
  throw new TypeError('Fixture markup is missing the iframe.');
}

const log = document.querySelector('#log');
if (!(log instanceof HTMLElement)) {
  throw new TypeError('Fixture markup is missing #log.');
}

Object.assign(frameDocument.body.style, { margin: '0' });
// The theme is read through `getComputedStyle` on the document the menu's
// `parent` belongs to. Setting a different `--mm-stroke-color` here than the
// top document's (see cross-document.html) is what tells the two apart.
frameDocument.documentElement.style.setProperty('--mm-stroke-color', 'blue');

const surface = frameDocument.createElement('div');
surface.id = 'surface';
Object.assign(surface.style, { height: '100%', width: '100%' });
frameDocument.body.append(surface);

// Listed starting from "up": default angles start at the top, so this order
// alone keeps "right" at angle 0.
const mm = createMarkingMenu({
  items: [
    { id: 'up', label: 'Up' },
    { id: 'right', label: 'Right' },
    { id: 'down', label: 'Down' },
    { id: 'left', label: 'Left' },
  ],
  parent: surface,
});

mm.on('select', (event) => {
  log.append(
    `${JSON.stringify({
      mode: event.mode,
      position: event.position,
      selectionId: event.selection.id,
      type: event.type,
    })}\n`,
  );
});

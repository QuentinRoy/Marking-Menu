import MarkingMenu from 'marking-menu';

const toastElement = document.querySelector('#toast');

// Create the menu with a sub-menu at the bottom.
const items = [
  { label: 'Right' },
  { label: 'Down-Right' },
  {
    label: 'Others...',
    children: [
      { label: 'Sub Right' },
      { label: 'Sub Down' },
      { label: 'Sub Left' },
      { label: 'Sub Up' },
    ],
  },
  { label: 'Down-Left' },
  { label: 'Left' },
  { label: 'Up-Left' },
  { label: 'Up' },
  { label: 'Up-Right' },
];
const mm = MarkingMenu({ items, parent: document.querySelector('#main') });

let toastTimeoutId = null;
function toastMessage(message) {
  clearTimeout(toastTimeoutId);
  toastElement.innerHTML = message;
  toastElement.classList.add('shown');
  toastTimeoutId = setTimeout(() => {
    toastElement.classList.remove('shown');
  }, 1000);
}

// Toast the marking menu's selections.
mm.subscribe({
  next(selection) {
    toastMessage(selection.label);
  },
  error(error) {
    console.error(error);
  },
});

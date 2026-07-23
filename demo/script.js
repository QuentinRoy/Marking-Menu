import MarkingMenu from 'marking-menu';

const toastElement = document.querySelector('#toast');

// Create the menu with a sub-menu at the bottom.
const items = [
  'Right',
  'Down-Right',
  {
    name: 'Others...',
    children: ['Sub Right', 'Sub Down', 'Sub Left', 'Sub Up'],
  },
  'Down-Left',
  'Left',
  'Up-Left',
  'Up',
  'Up-Right',
];
const mm = MarkingMenu(items, document.querySelector('#main'));

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
    toastMessage(selection.name);
  },
  error(error) {
    console.error(error);
  },
});

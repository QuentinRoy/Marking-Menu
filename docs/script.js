'use strict';

let mainElt = document.getElementById('main');
let toastElement = document.getElementById('toast');

// Create the menu with a sub-menu at the bottom.
let items = [
  'Item Right',
  {
    name: 'Others...',
    children: ['Sub Right', 'Sub Down', 'Sub Left', 'Sub Top']
  },
  'Item Left',
  'Item Up'
];
let mm = MarkingMenu(items, document.getElementById('main'));

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
let subscription = mm.subscribe({
  next(selection) {
    toastMessage(selection.name);
  },
  error(error) {
    console.error(error);
  }
});

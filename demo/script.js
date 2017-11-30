'use strict';

// Create the menu with a sub-menu at the bottom.
const items = [
  'Item Right',
  {
    name: 'Others...',
    children: [
      'Sub Right',
      'Sub Down',
      'Sub Left',
      'Sub Top'
    ]
  },
  'Item Left',
  'Item Up'
];
const mm = MarkingMenu(items, document.getElementById('main'));

// Create the toast to display selections.
var toastMessage = (function(dom) {
  var timeoutId = null;
  return function(message) {
    clearTimeout(timeoutId);
    dom.innerHTML = message;
    dom.classList.add('shown');
    timeoutId = setTimeout(function() {
      dom.classList.remove('shown');
    }, 1000);
  };
})(document.getElementById('toast'));

// Toast the marking menu's selections.
mm.subscribe({
  next(selection) {
    toastMessage(selection.name);
  },
  error(error) {
    console.error(error);
  }
});

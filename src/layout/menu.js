import './menu.scss';

const template = ({ items, center }, doc) => {
  const main = doc.createElement('div');
  main.className = 'marking-menu';
  main.style.left = `${center[0]}px`;
  main.style.top = `${center[1]}px`;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const elt = doc.createElement('div');
    elt.className = 'marking-menu-item';
    elt.dataset.itemId = item.id;
    elt.dataset.itemAngle = item.angle;
    elt.innerHTML += '<div class="marking-menu-line"></div>';
    elt.innerHTML += `<div class="marking-menu-label">${item.name}</div>`;
    main.appendChild(elt);
  }
  return main;
};

/**
 * Create the Menu display.
 * @param {HTMLElement} parent - The parent node.
 * @param {ItemModel} model - The model of the menu to open.
 * @param {[int, int]} center - The center of the menu.
 * @param {String} [current] - The currently active item.
 * @param {Document} [options] - Menu options.
 * @param {Document} [options.doc=document] - The root document of the menu.
 *                                            Mostly useful for testing purposes.
 * @return {{ setActive, remove }} - The menu controls.
 */
const createMenu = (
  parent,
  model,
  center,
  current,
  { doc = document } = {}
) => {
  // Create the DOM.
  const main = template({ items: model.children, center }, doc);
  parent.appendChild(main);

  // Clear any  active items.
  const clearActiveItems = () => {
    Array.from(main.querySelectorAll('.active')).forEach((itemDom) =>
      itemDom.classList.remove('active')
    );
  };

  // Return an item DOM element from its id.
  const getItemDom = (itemId) =>
    main.querySelector(`.marking-menu-item[data-item-id="${itemId}"]`);

  // Mark an item as active.
  const setActive = (itemId) => {
    // Clear any  active items.
    clearActiveItems();

    // Set the active class.
    if (itemId || itemId === 0) {
      getItemDom(itemId).classList.add('active');
    }
  };

  // Function to remove the menu.
  const remove = () => parent.removeChild(main);

  // Initialize the menu.
  if (current) setActive(current);

  // Create the interface.
  return { setActive, remove };
};

export default createMenu;

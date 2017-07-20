import template from './menu.pug';
import { deltaAngle } from './utils';
import './menu.scss';

/**
 * Create the Menu display.
 * @param {Array<String>} itemList the name of the menu items
 * @param {HTMLElement} parent the parent node
 * @param {[int, int]} the center of the center of the menu
 * @param {String} [current] the current item
 * @param {Document} [doc] the root document of the menu,
 *                         mostly useful for testing purposes.
 */
const createMenu = (itemList, parent, center, current, doc = document) => {
  // Create the model.
  const itemGap = itemList.length > 4 ? 45 : 90;
  const itemEntries = itemList.map((itemName, i) =>
    Object.freeze({
      name: itemName,
      angle: i * itemGap,
      id: i
    })
  );

  // Create the DOM.
  const domStr = template({ itemEntries, center });
  const main = doc.createRange().createContextualFragment(domStr).firstChild;
  parent.appendChild(main);

  // Return an item DOM element from its id.
  const getItemDom = itemId =>
    main.querySelector(`.marking-menu-item[data-item-id="${itemId}"]`);

  const getItemByName = itemName =>
    itemEntries.find(it => it.name === itemName);

  const getNearestItemByAngle = angle =>
    itemEntries.reduce((a, b) => {
      const deltaA = Math.abs(deltaAngle(a.angle, angle));
      const deltaB = Math.abs(deltaAngle(b.angle, angle));
      return deltaA > deltaB ? b : a;
    });

  const setActive = itemEntry => {
    // Clear any previously active items.
    Array.from(main.querySelectorAll('.active')).forEach(itemDom =>
      itemDom.classList.remove('active')
    );
    const itemDom = getItemDom(itemEntry.id);
    // Set the active class.
    itemDom.classList.add('active');
  };

  // Function to set the currently active item.
  const setActiveByName = itemName => {
    setActive(getItemByName(itemName));
  };

  // Function to set the currently active item.
  const setActiveByNearestAngle = itemName => {
    setActive(getNearestItemByAngle(itemName));
  };

  // Function to remove the menu.
  const remove = () => parent.removeChild(main);

  // Initialize the menu.
  if (current) setActive(current);

  // Create the interface.
  return {
    getItemByName,
    getNearestItemByAngle,
    setActiveByName,
    setActiveByNearestAngle,
    remove
  };
};

export default createMenu;

import { deltaAngle } from './utils';

const getAngleRange = items => (items.length > 4 ? 45 : 90);

// Create the model item from a list of items.
const createModelItems = (items, idPrefix = undefined) => {
  // Calculate the angle range for each items.
  const angleRange = getAngleRange(items);
  // Create the frozen list of model items.
  return Object.freeze(
    items.map((item, i) => {
      // Standard item id.
      const stdId = idPrefix ? [idPrefix, i].join('-') : i.toString();
      // Create the item without the children property.
      const base = {
        name: typeof item === 'string' ? item : item.name,
        angle: i * angleRange,
        id: item.id == null ? stdId : item.id
      };
      // Add the children property if the item has children.
      if (item.children) {
        base.children = createModelItems(item.children, stdId);
      }
      return Object.freeze(base);
    })
  );
};

/**
 * Create the marking menu model.
 *
 * @param {List<String|{name,children}>} itemList the list of item names.
 * @return {{items, get, getNearest}}
 */
const createModel = itemList => {
  const modelItemList = createModelItems(itemList);
  const modelItems = Object.freeze(
    Object.assign(...modelItemList.map(it => ({ [it.id]: it })))
  );
  return {
    items: modelItems,
    get(itemId) {
      return modelItems[itemId];
    },
    getByName(itemName) {
      return modelItemList.find(it => it.name === itemName);
    },
    getNearest(angle) {
      return modelItemList.reduce((a, b) => {
        const deltaA = Math.abs(deltaAngle(a.angle, angle));
        const deltaB = Math.abs(deltaAngle(b.angle, angle));
        return deltaA > deltaB ? b : a;
      });
    }
  };
};

export default createModel;

import { deltaAngle } from './utils';

/**
 * Create the marking menu model.
 *
 * @param {List<String>} itemList the list of item names.
 * @return {{items, get, getNearest}}
 */
const createModel = itemNames => {
  const itemGap = itemNames.length > 4 ? 45 : 90;

  const itemList = itemNames.map((itemName, i) =>
    Object.freeze({
      name: itemName,
      angle: i * itemGap,
      id: i
    })
  );

  const items = Object.freeze(
    Object.assign(...itemList.map(it => ({ [it.id]: it })))
  );

  return {
    items,
    get(itemId) {
      return items[itemId];
    },
    getByName(itemName) {
      return itemList.find(it => it.name === itemName);
    },
    getNearest(angle) {
      return itemList.reduce((a, b) => {
        const deltaA = Math.abs(deltaAngle(a.angle, angle));
        const deltaB = Math.abs(deltaAngle(b.angle, angle));
        return deltaA > deltaB ? b : a;
      });
    }
  };
};

export default createModel;

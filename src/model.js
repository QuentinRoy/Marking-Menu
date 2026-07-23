import { deltaAngle } from './utils.js';

const getAngleRange = (items) => (items.length > 4 ? 45 : 90);

/**
 Represents an item of the Marking Menu.
 */
export class MMItem {
  /**
   Create a menu item.

   @param {object} config - The item configuration.
   @param {string} config.id - The item's id. Required except for the root item.
   @param {string} config.label - The item's label. Required except for the root item.
   @param {Integer} config.angle - The item's angle. Required except for the root item.
   @param {ItemModel} [config.parent] - The parent menu of the item.
   @param {List<ItemModel>} [config.children] - The children of the item menu.
   */
  constructor({ id, label, angle, parent, children } = {}) {
    this.id = id;
    this.label = label;
    this.angle = angle;
    this.children = children;
    this.parent = parent;
  }

  isLeaf() {
    return !this.children || this.children.length === 0;
  }

  isRoot() {
    return !this.parent;
  }

  /**
   Retrieve a direct child by its id.

   @param {string} childId - The identifier of the child to look for.
   @returns {Item} the children with the id `childId`.
   */
  getChild(childId) {
    return this.children.find((child) => child.id === childId);
  }

  /**
   Retrieve every direct child matching a given label.

   @param {string} childLabel - The label of the children to look for.
   @returns {Item} the children with the label `childLabel`.
   */
  getChildrenByLabel(childLabel) {
    return this.children.filter((child) => child.label === childLabel);
  }

  /**
   Find the child whose angle is closest to a given angle.

   @param {Integer} angle - The angle to compare the children against.
   @returns {Item} the closest children to the angle `angle`.
   */
  getNearestChild(angle) {
    const [firstChild, ...otherChildren] = this.children;
    let nearest = firstChild;
    let nearestDelta = Math.abs(deltaAngle(nearest.angle, angle));
    for (const child of otherChildren) {
      const delta = Math.abs(deltaAngle(child.angle, angle));
      if (delta < nearestDelta) {
        nearest = child;
        nearestDelta = delta;
      }
    }

    return nearest;
  }

  /**
   Compute the maximum depth of the menu below this item.

   @returns {number} The maximum depth of the menu.
   */
  getMaxDepth() {
    return this.isLeaf()
      ? 0
      : Math.max(0, ...this.children.map((child) => child.getMaxDepth())) + 1;
  }

  /**
   Compute the maximum breadth of the menu below this item.

   @returns {number} The maximum breadth of the menu.
   */
  getMaxBreadth() {
    return this.isLeaf()
      ? 0
      : Math.max(
          this.children.length,
          ...this.children.map((child) => child.getMaxBreadth()),
        );
  }
}

// Create the model item from a list of items.
const recursivelyCreateModelItems = (
  items,
  baseId = undefined,
  parent = undefined,
) => {
  // Calculate the angle range for each items.
  const angleRange = getAngleRange(items);
  // Create the list of model items (frozen).
  return Object.freeze(
    items.map((item, i) => {
      // Standard item id.
      const stdId = baseId ? [baseId, i].join('-') : i.toString();
      // Create the item.
      const mmItem = new MMItem({
        id: item.id ?? stdId,
        label: item.label,
        angle: i * angleRange,
        parent,
      });
      // Add its children if any.
      if (item.children) {
        mmItem.children = recursivelyCreateModelItems(
          item.children,
          stdId,
          mmItem,
        );
      }

      // Return it frozen.
      return Object.freeze(mmItem);
    }),
  );
};

/**
 Create the marking menu model.
 
 @param {List<{label, children}>} itemList - The list of items.
 @returns {MMItem} - The root item of the model.
 */
export default function createModel(itemList) {
  const menu = new MMItem({ id: null, label: null, angle: null });
  menu.children = recursivelyCreateModelItems(itemList, undefined, menu);
  return Object.freeze(menu);
}

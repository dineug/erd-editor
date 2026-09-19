const LIST_SELECTOR = '[data-schema-list]';
const ITEM_SELECTOR = '[data-schema-item]';

function getSchemaItems(list: ParentNode) {
  return Array.from(list.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
}

function getSiblingItems(current: HTMLElement) {
  const list = current.closest(LIST_SELECTOR);
  const items = list ? getSchemaItems(list) : [];
  return { items, index: items.indexOf(current) };
}

/**
 * Focuses the item at an index of the whole list, across date groups; a
 * negative index counts from the end.
 */
export function focusSchemaItem(list: ParentNode, index: number) {
  getSchemaItems(list).at(index)?.focus();
}

/** Moves focus by an offset from the current item, stopping at either end. */
export function focusSiblingSchemaItem(current: HTMLElement, offset: number) {
  const { items, index } = getSiblingItems(current);
  const target = Math.min(items.length - 1, Math.max(0, index + offset));
  items[target]?.focus();
}

/** The item that takes the place of one about to leave the list. */
export function findSuccessorSchemaItem(
  current: HTMLElement
): HTMLElement | undefined {
  const { items, index } = getSiblingItems(current);
  return items[index + 1] ?? items[index - 1];
}

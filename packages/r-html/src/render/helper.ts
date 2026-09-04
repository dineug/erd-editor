import { TAttrType } from '@/constants';
import {
  isArray,
  isBoolean,
  isFunction,
  isObject,
  isUndefined,
} from '@/helpers/is-type';
import { VNodeType } from '@/parser/vNode';
import type { HostAdapter, HostNode } from '@/render/adapter';
import { domAdapter } from '@/render/domAdapter';
import { TAttr, TNode } from '@/template/tNode';

type EventTuple = [
  Function,
  undefined | boolean | AddEventListenerOptions | EventListenerOptions,
];

export const isTruthy = (value?: string | null) =>
  Boolean(value) && value !== 'false';

/**
 * The host operations a Part needs that are derived from adapter methods
 * rather than being one. The adapter's own methods ride along, so one object
 * answers every question a Part asks of its host.
 */
export interface HostHelper extends HostAdapter {
  createNode(tNode: TNode, isSvg?: boolean): HostNode;
  setAttr(node: HostNode, attr: TAttr): void;
  insertBeforeNode(newChild: HostNode, refChild: HostNode): void;
  insertAfterNode(newChild: HostNode, refChild: HostNode): void;
  removeNode(node: HostNode): HostNode | null;
  rangeNodes(startNode: HostNode, endNode: HostNode): HostNode[];
  removeRange(startNode: HostNode, endNode: HostNode): void;
}

export function createHostHelper(adapter: HostAdapter): HostHelper {
  const createNode = ({ type, value }: TNode, isSvg = false): HostNode =>
    type === VNodeType.element
      ? adapter.createElement(value, isSvg)
      : type === VNodeType.text
        ? adapter.createText(value)
        : adapter.createMarker(value);

  const setAttr = (node: HostNode, { type, name, value }: TAttr) => {
    switch (type) {
      case TAttrType.attribute:
        adapter.setAttribute(node, name, value ?? '', false);
        break;
      case TAttrType.boolean:
        isTruthy(value) && adapter.setAttribute(node, name, '', false);
        break;
      case TAttrType.property:
        Reflect.set(node, name, value, node);
        break;
    }
  };

  const insertBeforeNode = (newChild: HostNode, refChild: HostNode) => {
    adapter.insertBefore(newChild, refChild);
  };

  const insertAfterNode = (newChild: HostNode, refChild: HostNode) => {
    const parent = adapter.parentOf(refChild);
    if (!parent) return;

    const nextSibling = adapter.nextSiblingOf(refChild);
    nextSibling
      ? adapter.insertBefore(newChild, nextSibling)
      : adapter.appendChild(parent, newChild);
  };

  const removeNode = (node: HostNode): HostNode | null => {
    if (!adapter.parentOf(node)) return null;

    adapter.removeChild(node);
    return node;
  };

  const rangeNodes = (startNode: HostNode, endNode: HostNode) => {
    const nodes: HostNode[] = [];
    let currentNode = adapter.nextSiblingOf(startNode);

    while (currentNode && currentNode !== endNode) {
      nodes.push(currentNode);
      currentNode = adapter.nextSiblingOf(currentNode);
    }

    return nodes;
  };

  /** Removes every host node a part rendered between its two markers. */
  const removeRange = (startNode: HostNode, endNode: HostNode) => {
    rangeNodes(startNode, endNode).forEach(removeNode);
  };

  return {
    ...adapter,
    createNode,
    setAttr,
    insertBeforeNode,
    insertAfterNode,
    removeNode,
    rangeNodes,
    removeRange,
  };
}

export const domHelper = createHostHelper(domAdapter);

/** The DOM binding, whose narrower return type its callers and specs read. */
export const createNode = (
  tNode: TNode,
  isSvg = false
): HTMLElement | Text | Comment | SVGElement =>
  domHelper.createNode(tNode, isSvg) as
    | HTMLElement
    | Text
    | Comment
    | SVGElement;

export const setAttr = domHelper.setAttr;
export const insertBeforeNode = domHelper.insertBeforeNode;
export const insertAfterNode = domHelper.insertAfterNode;
export const removeNode = domHelper.removeNode;
export const rangeNodes = domHelper.rangeNodes;
export const removeRange = domHelper.removeRange;
export const isHostNode = domHelper.isHostNode;
export const isNode = isHostNode;

export function setProps(props: any, { type, name, value }: TAttr) {
  switch (type) {
    case TAttrType.attribute:
    case TAttrType.property:
      Reflect.set(props, name, value);
      break;
    case TAttrType.boolean:
      Reflect.set(props, name, isTruthy(value));
      break;
  }
}

export const equalValues = (a: any[], b: any[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export function isEqualShallowObject(a: any, b: any) {
  if (a === b) {
    return true;
  }

  const prevValue = isObject(a) ? a : {};
  const newValue = isObject(b) ? b : {};
  const prevKeys = Object.keys(prevValue);
  const newKeys = Object.keys(newValue);

  return (
    prevKeys.length === newKeys.length &&
    newKeys.every(
      key => Reflect.get(prevValue, key) === Reflect.get(newValue, key)
    )
  );
}

export const isEventTuple = (value: EventTuple) =>
  isArray(value) &&
  isFunction(value[0]) &&
  (isUndefined(value[1]) || isBoolean(value[1]) || isObject(value[1]));

export const noop = () => {};

export const isHTMLElement = (value: any): value is HTMLElement =>
  value instanceof HTMLElement;

export const isSvgElement = (value: any): value is SVGElement =>
  value instanceof SVGElement;

export const isPromise = (value: any): value is Promise<any> =>
  value instanceof Promise;

export const kebabCase = (value: string): string =>
  value
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    ?.join('-')
    .toLowerCase() ?? '';

export const camelCase = (value: string): string =>
  value.replace(/^([A-Z])|[\s-_](\w)/g, (_, p1, p2) =>
    p2 ? p2.toUpperCase() : p1.toLowerCase()
  );

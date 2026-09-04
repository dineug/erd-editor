import type { Context } from '@/render/part/node/component/observableComponent';

export type HostNode = object;

/**
 * Host semantics adapter. The clauses it contracts for are written out in
 * packages/r-html/AGENTS.md, under Host adapter contract.
 */
export interface HostAdapter {
  createElement(name: string, isSvg?: boolean): HostNode;
  createText(value: string): HostNode;
  createMarker(value: string): HostNode;
  createFragment(): HostNode;
  createEventBus(): HostNode;

  insertBefore(newChild: HostNode, refChild: HostNode): void;
  appendChild(parent: HostNode, newChild: HostNode): void;
  prependChild(parent: HostNode, newChild: HostNode): void;
  removeChild(node: HostNode): void;
  parentOf(node: HostNode): HostNode | null;
  nextSiblingOf(node: HostNode): HostNode | null;

  setText(node: HostNode, value: string): void;
  setAttribute(
    node: HostNode,
    name: string,
    value: any,
    isSingleMarker: boolean
  ): void;
  removeAttribute(node: HostNode, name: string): void;

  isHostNode(value: any): value is HostNode;
  isMarker(value: any): value is HostNode;
  isText(value: any): value is HostNode;
  isElement(value: any): value is HostNode;
  isFragment(value: any): value is HostNode;

  addEventListener(
    node: HostNode,
    type: string,
    listener: any,
    options?: any
  ): void;
  removeEventListener(
    node: HostNode,
    type: string,
    listener: any,
    options?: any
  ): void;

  getRoot(node: HostNode): HostNode;
  createComponentContext(startNode: HostNode, eventBus: HostNode): Context;
  bridgeFragment(fragment: HostNode, root: HostNode): () => void;
}

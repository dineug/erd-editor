import { fragmentContextBridge } from '@/context/createContext';
import type { HostAdapter } from '@/render/adapter';
import { fragmentHostBridge, getFragmentHost } from '@/render/host';
import type { Context } from '@/render/part/node/component/observableComponent';
import { safeToString } from '@/render/value';

export const domAdapter: HostAdapter = {
  createElement: (name: string, isSvg = false) =>
    isSvg
      ? document.createElementNS('http://www.w3.org/2000/svg', name)
      : document.createElement(name),
  createText: (value: string) => document.createTextNode(value),
  createMarker: (value: string) => document.createComment(value),
  createFragment: () => document.createDocumentFragment(),
  createEventBus: () => document.createElement('div'),

  insertBefore(newChild: Node, refChild: Node) {
    const parent = refChild.parentNode;
    if (!parent) return;

    parent.insertBefore(newChild, refChild);
  },
  appendChild(parent: Node, newChild: Node) {
    parent.appendChild(newChild);
  },
  prependChild(parent: ParentNode, newChild: Node) {
    parent.prepend(newChild);
  },
  removeChild(node: Node) {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  },
  parentOf: (node: Node) => node.parentNode,
  nextSiblingOf: (node: Node) => node.nextSibling,

  setText(node: Text, value: string) {
    node.data = value;
  },
  setAttribute(
    node: Element,
    name: string,
    value: any,
    isSingleMarker: boolean
  ) {
    node.setAttribute(
      name,
      isSingleMarker ? safeToString(value).trim() : value
    );
  },
  removeAttribute(node: Element, name: string) {
    node.removeAttribute(name);
  },

  isHostNode: (value: any): value is Node => value instanceof Node,
  isMarker: (value: any): value is Comment => value instanceof Comment,
  isText: (value: any): value is Text => value instanceof Text,
  isElement: (value: any): value is Element => value instanceof Element,
  isFragment: (value: any): value is DocumentFragment =>
    value instanceof DocumentFragment,

  addEventListener(
    node: EventTarget,
    type: string,
    listener: any,
    options?: any
  ) {
    node.addEventListener(type, listener, options);
  },
  removeEventListener(
    node: EventTarget,
    type: string,
    listener: any,
    options?: any
  ) {
    node.removeEventListener(type, listener, options);
  },

  getRoot: (node: Node) => node.getRootNode(),
  createComponentContext(startNode: Node, eventBus: EventTarget): Context {
    const ctx: Context = {
      host: document.body,
      get parentElement() {
        return startNode.parentElement;
      },
      dispatchEvent: (event: Event) => eventBus.dispatchEvent(event),
    };
    const rootNode = startNode.getRootNode();

    if (rootNode instanceof ShadowRoot) {
      const host = rootNode.host as HTMLElement;
      ctx.host = host;
    } else if (rootNode instanceof DocumentFragment) {
      const host = getFragmentHost(rootNode);
      if (host) {
        ctx.host = host;
      }
    }

    return ctx;
  },
  bridgeFragment(fragment: DocumentFragment, root: Node) {
    const contextBridgeDestroy = fragmentContextBridge(fragment, root);
    const hostBridgeDestroy = fragmentHostBridge(fragment, root);

    return () => {
      contextBridgeDestroy();
      hostBridgeDestroy();
    };
  },
};

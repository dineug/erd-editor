import { fragmentContextBridge } from '@/context/createContext';
import { createNodeDirective } from '@/render/directives/nodeDirective';
import { insertBeforeNode, rangeNodes, removeNode } from '@/render/helper';
import { fragmentHostBridge } from '@/render/host';
import { Part } from '@/render/part';
import { createPart, getPartType } from '@/render/part/node/text/helper';
import { isTemplateLiterals } from '@/template/helper';

interface CachePart {
  part: Part;
  fragment: DocumentFragment;
  destroy: () => void;
}

export const cache = createNodeDirective(
  (value: any) => value,
  ({ startNode, endNode }) => {
    const rootNode = startNode.getRootNode();
    let cache = new Map<any, CachePart>();
    let prevValue: any = null;

    const getKey = (value: any) => {
      return isTemplateLiterals(value) ? value.strings : value;
    };

    const getPart = (value: any): CachePart | null => {
      const key = getKey(value);
      return cache.has(key) ? (cache.get(key) as CachePart) : null;
    };

    const setPart = (value: any, cachePart: CachePart) => {
      cache.set(getKey(value), cachePart);
    };

    const create = (value: any): CachePart => {
      const type = getPartType(value);
      const part = createPart(type, startNode, endNode);
      const fragment = document.createDocumentFragment();
      const contextBridgeDestroy = fragmentContextBridge(fragment, rootNode);
      const hostBridgeDestroy = fragmentHostBridge(fragment, rootNode);

      return {
        part,
        fragment,
        destroy: () => {
          contextBridgeDestroy();
          hostBridgeDestroy();
          part.destroy?.();
        },
      };
    };

    const destroy = () => {
      cache.forEach(({ destroy }) => destroy());
      cache = new Map();
      rangeNodes(startNode, endNode).forEach(removeNode);
    };

    return value => {
      const currentCachePart = getPart(prevValue);
      const oldCachePart = getPart(value);

      if (currentCachePart && getKey(prevValue) !== getKey(value)) {
        rangeNodes(startNode, endNode).forEach(node =>
          currentCachePart.fragment.appendChild(node)
        );
      }

      if (oldCachePart) {
        if (getKey(prevValue) !== getKey(value)) {
          insertBeforeNode(oldCachePart.fragment, endNode);
        }
        oldCachePart.part.commit(value);
      } else {
        const newCachePart = create(value);
        setPart(value, newCachePart);
        newCachePart.part.commit(value);
      }

      prevValue = value;

      return destroy;
    };
  }
);

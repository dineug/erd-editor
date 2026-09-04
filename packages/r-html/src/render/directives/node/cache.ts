import type { HostNode } from '@/render/adapter';
import {
  createNodeDirective,
  NodeDirectiveProps,
} from '@/render/directives/nodeDirective';
import { domHelper } from '@/render/helper';
import { Part } from '@/render/part';
import { createPart, getPartType } from '@/render/part/node/text/helper';
import { isTemplateLiterals } from '@/template/helper';

interface CachePart {
  part: Part;
  fragment: HostNode;
  destroy: () => void;
}

export const cache = createNodeDirective(
  (value: any) => value,
  ({ startNode, endNode, helper = domHelper }: NodeDirectiveProps) => {
    const rootNode = helper.getRoot(startNode);
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
      const part = createPart(type, startNode, endNode, helper);
      const fragment = helper.createFragment();
      const unbridge = helper.bridgeFragment(fragment, rootNode);

      return {
        part,
        fragment,
        destroy: () => {
          unbridge();
          part.destroy?.();
        },
      };
    };

    const destroy = () => {
      cache.forEach(({ destroy }) => destroy());
      cache = new Map();
      helper.removeRange(startNode, endNode);
    };

    return value => {
      const currentCachePart = getPart(prevValue);
      const oldCachePart = getPart(value);

      if (currentCachePart && getKey(prevValue) !== getKey(value)) {
        helper
          .rangeNodes(startNode, endNode)
          .forEach(node => helper.appendChild(currentCachePart.fragment, node));
      }

      if (oldCachePart) {
        if (getKey(prevValue) !== getKey(value)) {
          helper.insertBeforeNode(oldCachePart.fragment, endNode);
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

import type { HostNode } from '@/render/adapter';
import { domHelper, HostHelper } from '@/render/helper';
import { createAttrPart } from '@/render/part/attribute';
import { CommentPart } from '@/render/part/node/comment';
import { ComponentPart } from '@/render/part/node/component';
import { TextPart } from '@/render/part/node/text';
import { TNode } from '@/template/tNode';

export interface Part {
  commit(value: any): void;
  destroy?(): void;
}

export function createElement(
  children: TNode[] = [],
  parentNode: HostNode,
  isSvg = false,
  parts: Part[] = [],
  helper: HostHelper = domHelper
) {
  children.forEach(tNode => {
    if (tNode.isComponent) {
      const node = helper.createMarker('');
      helper.appendChild(parentNode, node);
      parts.push(new ComponentPart(node, tNode, parts, helper));
      return;
    }

    const node = helper.createNode(tNode, tNode.isSvg || isSvg);
    helper.appendChild(parentNode, node);

    if (helper.isMarker(node) && tNode.isMarker) {
      parts.push(new CommentPart(node, tNode, helper));
    }

    if (helper.isText(node) && tNode.isMarkerOnly) {
      parts.push(new TextPart(node, tNode, helper));
    }

    if (helper.isElement(node)) {
      tNode.staticAttrs &&
        tNode.staticAttrs.forEach(attr => helper.setAttr(node, attr));

      tNode.attrs &&
        parts.push(
          ...tNode.attrs.map(attr => createAttrPart(node, attr, helper))
        );

      tNode.children &&
        createElement(
          tNode.children,
          node,
          tNode.isSvg || isSvg,
          parts,
          helper
        );
    }
  });

  return parts;
}

export function createTemplate(
  tNode: TNode,
  isSvg?: boolean
): [DocumentFragment, Array<Part>];
export function createTemplate(
  tNode: TNode,
  isSvg: boolean,
  helper: HostHelper
): [HostNode, Array<Part>];
export function createTemplate(
  tNode: TNode,
  isSvg = false,
  helper: HostHelper = domHelper
): [any, Array<Part>] {
  const fragment = helper.createFragment();
  const parts = createElement(tNode.children, fragment, isSvg, [], helper);
  return [fragment, parts];
}

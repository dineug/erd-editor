import { createNode, setAttr } from '@/render/helper';
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
  parentNode: Element | DocumentFragment,
  isSvg = false,
  parts: Part[] = []
) {
  children.forEach(tNode => {
    if (tNode.isComponent) {
      const node = document.createComment('');
      parentNode.appendChild(node);
      parts.push(new ComponentPart(node, tNode, parts));
      return;
    }

    const node = createNode(tNode, tNode.isSvg || isSvg);
    parentNode.appendChild(node);

    if (node instanceof Comment && tNode.isMarker) {
      parts.push(new CommentPart(node, tNode));
    }

    if (node instanceof Text && tNode.isMarkerOnly) {
      parts.push(new TextPart(node, tNode));
    }

    if (node instanceof Element) {
      tNode.staticAttrs &&
        tNode.staticAttrs.forEach(attr => setAttr(node, attr));

      tNode.attrs &&
        parts.push(...tNode.attrs.map(attr => createAttrPart(node, attr)));

      tNode.children &&
        createElement(tNode.children, node, tNode.isSvg || isSvg, parts);
    }
  });

  return parts;
}

export function createTemplate(
  tNode: TNode,
  isSvg = false
): [DocumentFragment, Array<Part>] {
  const fragment = document.createDocumentFragment();
  const parts = createElement(tNode.children, fragment, isSvg);
  return [fragment, parts];
}

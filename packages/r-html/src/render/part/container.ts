import { TEMPLATE_LITERALS } from '@/constants';
import {
  insertAfterNode,
  insertBeforeNode,
  rangeNodes,
  removeNode,
} from '@/render/helper';
import { createTemplate, Part } from '@/render/part';
import { TemplateLiterals, TemplateLiteralsType } from '@/template';
import { isSVG } from '@/template/helper';

export class ContainerPart implements Part {
  #startNode = document.createComment('');
  #endNode = document.createComment('');
  #fragment: DocumentFragment | null = null;
  #parts: Part[] = [];
  #strings: TemplateStringsArray;
  #isInject = false;

  constructor(
    templateLiterals: TemplateLiterals,
    startNode?: Comment,
    endNode?: Comment
  ) {
    this.#strings = templateLiterals.strings;

    if (
      templateLiterals[TEMPLATE_LITERALS] !== TemplateLiteralsType.html &&
      templateLiterals[TEMPLATE_LITERALS] !== TemplateLiteralsType.svg
    ) {
      return;
    }

    const [fragment, parts] = createTemplate(
      templateLiterals.template.node,
      isSVG(templateLiterals[TEMPLATE_LITERALS])
    );

    this.#fragment = fragment;
    this.#parts = parts;
    if (startNode && endNode) {
      this.#startNode = startNode;
      this.#endNode = endNode;
      this.#isInject = true;
    } else {
      fragment.prepend(this.#startNode);
      fragment.append(this.#endNode);
    }
  }

  equalStrings(strings: TemplateStringsArray) {
    return this.#strings === strings;
  }

  commit(values: any[]) {
    this.#parts.forEach(part => part.commit(values));
  }

  insert(position: 'before' | 'after' | 'children', refNode: Node) {
    if (!this.#fragment) return;
    position === 'before'
      ? insertBeforeNode(this.#fragment, refNode)
      : position === 'after'
        ? insertAfterNode(this.#fragment, refNode)
        : refNode.appendChild(this.#fragment);
    this.#fragment = null;
  }

  destroy() {
    this.#parts.forEach(part => part.destroy?.());
    rangeNodes(this.#startNode, this.#endNode).forEach(removeNode);
    if (!this.#isInject) {
      this.#startNode.remove();
      this.#endNode.remove();
    }
  }
}

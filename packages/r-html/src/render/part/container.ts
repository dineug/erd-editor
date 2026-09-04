import { TEMPLATE_LITERALS } from '@/constants';
import type { HostNode } from '@/render/adapter';
import { domHelper, HostHelper } from '@/render/helper';
import { createTemplate, Part } from '@/render/part';
import { TemplateLiterals, TemplateLiteralsType } from '@/template';
import { isSVG } from '@/template/helper';

export class ContainerPart implements Part {
  #helper: HostHelper;
  #startNode: HostNode;
  #endNode: HostNode;
  #fragment: HostNode | null = null;
  #parts: Part[] = [];
  #strings: TemplateStringsArray;
  #isInject = false;

  constructor(
    templateLiterals: TemplateLiterals,
    startNode?: HostNode,
    endNode?: HostNode,
    helper: HostHelper = domHelper
  ) {
    this.#helper = helper;
    this.#startNode = helper.createMarker('');
    this.#endNode = helper.createMarker('');
    this.#strings = templateLiterals.strings;

    if (
      templateLiterals[TEMPLATE_LITERALS] !== TemplateLiteralsType.html &&
      templateLiterals[TEMPLATE_LITERALS] !== TemplateLiteralsType.svg
    ) {
      return;
    }

    const [fragment, parts] = createTemplate(
      templateLiterals.template.node,
      isSVG(templateLiterals[TEMPLATE_LITERALS]),
      helper
    );

    this.#fragment = fragment;
    this.#parts = parts;
    if (startNode && endNode) {
      this.#startNode = startNode;
      this.#endNode = endNode;
      this.#isInject = true;
    } else {
      helper.prependChild(fragment, this.#startNode);
      helper.appendChild(fragment, this.#endNode);
    }
  }

  equalStrings(strings: TemplateStringsArray) {
    return this.#strings === strings;
  }

  commit(values: any[]) {
    this.#parts.forEach(part => part.commit(values));
  }

  insert(position: 'before' | 'after' | 'children', refNode: HostNode) {
    if (!this.#fragment) return;
    position === 'before'
      ? this.#helper.insertBeforeNode(this.#fragment, refNode)
      : position === 'after'
        ? this.#helper.insertAfterNode(this.#fragment, refNode)
        : this.#helper.appendChild(refNode, this.#fragment);
    this.#fragment = null;
  }

  destroy() {
    this.#parts.forEach(part => part.destroy?.());
    this.#helper.removeRange(this.#startNode, this.#endNode);
    if (!this.#isInject) {
      this.#helper.removeNode(this.#startNode);
      this.#helper.removeNode(this.#endNode);
    }
  }
}

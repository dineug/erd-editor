import type { HostNode } from '@/render/adapter';
import {
  Directive,
  DirectiveCreator,
  DirectiveFunction,
} from '@/render/directives';
import {
  createNodeDirectiveProps,
  NodeDirectiveProps,
} from '@/render/directives/nodeDirective';
import { domHelper, HostHelper } from '@/render/helper';
import { Part } from '@/render/part';
import { isDirective } from '@/render/part/node/text/helper';

export class DirectivePart implements Part {
  #helper: HostHelper;
  #startNode: HostNode;
  #endNode: HostNode;
  #directiveCreator: DirectiveCreator<
    NodeDirectiveProps,
    DirectiveFunction
  > | null = null;
  #directive: Directive<DirectiveFunction> | null = null;
  #directiveDestroy: (() => void) | void = void 0;

  constructor(
    startNode: HostNode,
    endNode: HostNode,
    helper: HostHelper = domHelper
  ) {
    this.#startNode = startNode;
    this.#endNode = endNode;
    this.#helper = helper;
  }

  commit(newValue: any) {
    if (!isDirective(newValue)) return;

    const [value, directiveCreator] = newValue;

    if (this.#directiveCreator !== directiveCreator) {
      this.clear();
      this.#directive = directiveCreator(
        createNodeDirectiveProps(this.#startNode, this.#endNode, this.#helper)
      );
      this.#directiveCreator = directiveCreator;
      this.#directiveDestroy = this.#directive?.(value);
    } else {
      const directiveDestroy = this.#directive?.(value);
      if (this.#directiveDestroy !== directiveDestroy) {
        this.clear();
        this.#directiveDestroy = directiveDestroy;
      }
    }
  }

  clear() {
    this.#directiveDestroy?.();
    this.#helper.removeRange(this.#startNode, this.#endNode);
  }

  destroy() {
    this.clear();
  }
}

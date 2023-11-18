import {
  Directive,
  DirectiveCreator,
  DirectiveFunction,
} from '@/render/directives';
import { NodeDirectiveProps } from '@/render/directives/nodeDirective';
import { rangeNodes, removeNode } from '@/render/helper';
import { Part } from '@/render/part';
import { isDirective } from '@/render/part/node/text/helper';

export class DirectivePart implements Part {
  #startNode: Comment;
  #endNode: Comment;
  #directiveCreator: DirectiveCreator<
    NodeDirectiveProps,
    DirectiveFunction
  > | null = null;
  #directive: Directive<DirectiveFunction> | null = null;
  #directiveDestroy: (() => void) | void;

  constructor(startNode: Comment, endNode: Comment) {
    this.#startNode = startNode;
    this.#endNode = endNode;
  }

  commit(newValue: any) {
    if (!isDirective(newValue)) return;

    const [value, directiveCreator] = newValue;

    if (this.#directiveCreator !== directiveCreator) {
      this.clear();
      this.#directive = directiveCreator({
        startNode: this.#startNode,
        endNode: this.#endNode,
      });
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
    rangeNodes(this.#startNode, this.#endNode).forEach(removeNode);
  }

  destroy() {
    this.clear();
  }
}

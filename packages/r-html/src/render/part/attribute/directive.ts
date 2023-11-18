import { DIRECTIVE } from '@/constants';
import { isArray } from '@/helpers/is-type';
import {
  Directive,
  DirectiveCreator,
  DirectiveFunction,
  DirectiveTuple,
  DirectiveType,
} from '@/render/directives';
import { AttributeDirectiveProps } from '@/render/directives/attributeDirective';
import { Part } from '@/render/part';
import { getMarkers, MarkerTuple } from '@/template/helper';
import { TAttr } from '@/template/tNode';

const isDirective = (
  value: any
): value is DirectiveTuple<AttributeDirectiveProps, DirectiveFunction> =>
  isArray(value) && Reflect.get(value, DIRECTIVE) === DirectiveType.attribute;

export class DirectivePart implements Part {
  #node: any;
  #markerTuple: MarkerTuple;
  #directiveCreator: DirectiveCreator<
    AttributeDirectiveProps,
    DirectiveFunction
  > | null = null;
  #directive: Directive<DirectiveFunction> | null = null;
  #directiveDestroy: (() => void) | void | null = null;

  constructor(node: any, { name }: TAttr) {
    this.#node = node;
    this.#markerTuple = getMarkers(name)[0];
  }

  commit(values: any[]) {
    const [, index] = this.#markerTuple;
    const newValue = values[index];
    if (!isDirective(newValue)) return;

    const [value, directiveCreator] = newValue;

    if (this.#directiveCreator !== directiveCreator) {
      this.#directiveDestroy?.();
      this.#directive = directiveCreator({ node: this.#node });
      this.#directiveCreator = directiveCreator;
      this.#directiveDestroy = this.#directive?.(value);
    } else {
      const directiveDestroy = this.#directive?.(value);
      if (this.#directiveDestroy !== directiveDestroy) {
        this.#directiveDestroy?.();
        this.#directiveDestroy = directiveDestroy;
      }
    }
  }

  destroy() {
    this.#directiveDestroy?.();
  }
}

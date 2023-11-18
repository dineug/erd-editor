import {
  createDirectiveTuple,
  DirectiveCreator,
  DirectiveFunction,
  DirectiveTuple,
  DirectiveType,
} from '@/render/directives';

export interface AttributeDirectiveProps {
  node: any;
}

export function createAttributeDirective<
  F extends DirectiveFunction,
  D extends DirectiveCreator<AttributeDirectiveProps, F> = DirectiveCreator<
    AttributeDirectiveProps,
    F
  >
>(
  f: F,
  directive: D
): (...args: Parameters<F>) => DirectiveTuple<AttributeDirectiveProps, F> {
  return (...args: Parameters<F>) =>
    createDirectiveTuple<AttributeDirectiveProps, F, D>(
      DirectiveType.attribute,
      [f(...args), directive]
    );
}

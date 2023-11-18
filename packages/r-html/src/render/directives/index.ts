import { DIRECTIVE } from '@/constants';

export enum DirectiveType {
  node = 'node',
  attribute = 'attribute',
}

export type DirectiveTuple<P, F extends DirectiveFunction> = [
  ReturnType<F>,
  DirectiveCreator<P, F>
] & {
  [DIRECTIVE]: DirectiveType;
};

export type DirectiveFunction = (...args: any[]) => any;
export type DirectiveCreator<P, F extends DirectiveFunction> = (
  props: P
) => Directive<F>;
export type Directive<F extends DirectiveFunction> = (
  value: ReturnType<F>
) => (() => void) | void;

export function createDirectiveTuple<
  P,
  F extends DirectiveFunction,
  D extends DirectiveCreator<P, F>
>(type: DirectiveType, tuple: [ReturnType<F>, D]): DirectiveTuple<P, F> {
  Reflect.set(tuple, DIRECTIVE, type);
  return tuple as unknown as DirectiveTuple<P, F>;
}

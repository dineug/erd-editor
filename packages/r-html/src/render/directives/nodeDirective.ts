import {
  createDirectiveTuple,
  DirectiveCreator,
  DirectiveFunction,
  DirectiveTuple,
  DirectiveType,
} from '@/render/directives';

export interface NodeDirectiveProps {
  startNode: Comment;
  endNode: Comment;
}

export function createNodeDirective<
  F extends DirectiveFunction,
  D extends DirectiveCreator<NodeDirectiveProps, F> = DirectiveCreator<
    NodeDirectiveProps,
    F
  >
>(
  f: F,
  directive: D
): (...args: Parameters<F>) => DirectiveTuple<NodeDirectiveProps, F> {
  return (...args: Parameters<F>) =>
    createDirectiveTuple<NodeDirectiveProps, F, D>(DirectiveType.node, [
      f(...args),
      directive,
    ]);
}

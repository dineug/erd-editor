import type { HostNode } from '@/render/adapter';
import {
  createDirectiveTuple,
  DirectiveCreator,
  DirectiveFunction,
  DirectiveTuple,
  DirectiveType,
} from '@/render/directives';
import type { HostHelper } from '@/render/helper';

export interface NodeDirectiveProps<T extends HostNode = HostNode> {
  startNode: T;
  endNode: T;
  helper?: HostHelper;
}

/**
 * Props a node directive creator receives. The helper is a non-enumerable
 * capability handle rather than part of the props identity, so the props still
 * compare and serialize as the marker pair they name.
 */
export function createNodeDirectiveProps<T extends HostNode>(
  startNode: T,
  endNode: T,
  helper: HostHelper
): NodeDirectiveProps<T> {
  const props: NodeDirectiveProps<T> = { startNode, endNode };
  Reflect.defineProperty(props, 'helper', { value: helper });
  return props;
}

/**
 * Builds a directive factory. The marker type is a parameter rather than the
 * props default because a creator names the host it was written for, and the
 * DOM is the one this package can name without asking.
 */
export function createNodeDirective<
  F extends DirectiveFunction,
  T extends HostNode = Comment,
  D extends DirectiveCreator<NodeDirectiveProps<T>, F> = DirectiveCreator<
    NodeDirectiveProps<T>,
    F
  >,
>(
  f: F,
  directive: D
): (...args: Parameters<F>) => DirectiveTuple<NodeDirectiveProps<T>, F> {
  return (...args: Parameters<F>) =>
    createDirectiveTuple<NodeDirectiveProps<T>, F, D>(DirectiveType.node, [
      f(...args),
      directive,
    ]);
}

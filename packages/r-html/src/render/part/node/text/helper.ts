import { DIRECTIVE } from '@/constants';
import { isArray, isFunction, isPrimitive } from '@/helpers/is-type';
import {
  DirectiveFunction,
  DirectiveTuple,
  DirectiveType,
} from '@/render/directives';
import { NodeDirectiveProps } from '@/render/directives/nodeDirective';
import { isNode } from '@/render/helper';
import { Part } from '@/render/part';
import { ArrayPart } from '@/render/part/node/text/array';
import { DirectivePart } from '@/render/part/node/text/directive';
import { FunctionPart } from '@/render/part/node/text/function';
import { NodePart } from '@/render/part/node/text/node';
import { ObjectPart } from '@/render/part/node/text/object';
import { PrimitivePart } from '@/render/part/node/text/primitive';
import { TemplateLiteralsPart } from '@/render/part/node/text/templateLiterals';
import { isTemplateLiterals } from '@/template/helper';

export enum PartType {
  primitive = 'primitive',
  templateLiterals = 'templateLiterals',
  array = 'array',
  node = 'node',
  object = 'object',
  function = 'function',
  directive = 'directive',
}

export const isDirective = (
  value: any
): value is DirectiveTuple<NodeDirectiveProps, DirectiveFunction> =>
  isArray(value) && Reflect.get(value, DIRECTIVE) === DirectiveType.node;

const createInstanceof = (type: Function) => (value: any) =>
  value instanceof type;
export const isPrimitivePart = createInstanceof(PrimitivePart);
export const isTemplateLiteralsPart = createInstanceof(TemplateLiteralsPart);
export const isArrayPart = createInstanceof(ArrayPart);
export const isNodePart = createInstanceof(NodePart);
export const isObjectPart = createInstanceof(ObjectPart);
export const isFunctionPart = createInstanceof(FunctionPart);
export const isDirectivePart = createInstanceof(DirectivePart);

export const getPartType = (value: any): PartType =>
  isPrimitive(value)
    ? PartType.primitive
    : isTemplateLiterals(value)
    ? PartType.templateLiterals
    : isDirective(value)
    ? PartType.directive
    : isArray(value)
    ? PartType.array
    : isNode(value)
    ? PartType.node
    : isFunction(value)
    ? PartType.function
    : PartType.object;

const isPartMap: Record<PartType, ReturnType<typeof createInstanceof>> = {
  [PartType.primitive]: isPrimitivePart,
  [PartType.templateLiterals]: isTemplateLiteralsPart,
  [PartType.array]: isArrayPart,
  [PartType.node]: isNodePart,
  [PartType.function]: isFunctionPart,
  [PartType.object]: isObjectPart,
  [PartType.directive]: isDirectivePart,
};

const partMap: Record<PartType, any> = {
  [PartType.primitive]: PrimitivePart,
  [PartType.templateLiterals]: TemplateLiteralsPart,
  [PartType.array]: ArrayPart,
  [PartType.node]: NodePart,
  [PartType.function]: FunctionPart,
  [PartType.object]: ObjectPart,
  [PartType.directive]: DirectivePart,
};

export const isPart = (type: PartType, part: Part | null) =>
  isPartMap[type](part);

export const createPart = (
  type: PartType,
  startNode: Comment,
  endNode: Comment
): Part => new partMap[type](startNode, endNode);

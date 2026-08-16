import { describe, expect, it } from 'vite-plus/test';

import { DIRECTIVE } from '@/constants';
import { createDirectiveTuple, DirectiveType } from '@/render/directives';
import { createNodeDirective } from '@/render/directives/nodeDirective';
import {
  createPart,
  getPartType,
  isArrayPart,
  isDirective,
  isDirectivePart,
  isFunctionPart,
  isNodePart,
  isObjectPart,
  isPart,
  isPrimitivePart,
  isTemplateLiteralsPart,
  PartType,
} from '@/render/part/node/text/helper';
import { html } from '@/template/html';

const nodeDirective = createNodeDirective(
  (value: string) => value,
  () => () => {}
);

const createNodes = (): [Comment, Comment] => {
  const container = document.createElement('div');
  const startNode = document.createComment('');
  const endNode = document.createComment('');
  container.append(startNode, endNode);
  return [startNode, endNode];
};

const allTypes = [
  PartType.primitive,
  PartType.templateLiterals,
  PartType.array,
  PartType.node,
  PartType.function,
  PartType.object,
  PartType.directive,
];

describe('render/part/node/text/helper isDirective', () => {
  it('accepts an array tagged with the node directive symbol', () => {
    expect(isDirective(nodeDirective('a'))).toBe(true);
  });

  it('rejects an array tagged as an attribute directive', () => {
    const tuple = createDirectiveTuple(DirectiveType.attribute, [
      'a',
      () => () => {},
    ]);

    expect(Reflect.get(tuple, DIRECTIVE)).toBe(DirectiveType.attribute);
    expect(isDirective(tuple)).toBe(false);
  });

  it('rejects plain arrays and non-arrays', () => {
    expect(isDirective([1, 2])).toBe(false);
    expect(isDirective({})).toBe(false);
    expect(isDirective(null)).toBe(false);
    expect(isDirective('a')).toBe(false);
  });
});

describe('render/part/node/text/helper getPartType', () => {
  it.each([
    ['string', 'a'],
    ['number', 1],
    ['boolean', false],
    ['bigint', BigInt(1)],
    ['symbol', Symbol('a')],
    ['null', null],
    ['undefined', undefined],
  ])('maps %s to primitive', (_name, value) => {
    expect(getPartType(value)).toBe(PartType.primitive);
  });

  it('maps template literals to templateLiterals', () => {
    expect(getPartType(html`<div></div>`)).toBe(PartType.templateLiterals);
  });

  it('maps a node directive tuple to directive before array', () => {
    expect(getPartType(nodeDirective('a'))).toBe(PartType.directive);
  });

  it('maps a plain array to array', () => {
    expect(getPartType([1, 2, 3])).toBe(PartType.array);
    expect(getPartType([])).toBe(PartType.array);
  });

  it('maps a DOM node to node', () => {
    expect(getPartType(document.createElement('div'))).toBe(PartType.node);
    expect(getPartType(document.createTextNode('a'))).toBe(PartType.node);
  });

  it('maps a function to function', () => {
    expect(getPartType(() => {})).toBe(PartType.function);
  });

  it('maps anything else to object', () => {
    expect(getPartType({})).toBe(PartType.object);
    expect(getPartType(new Map())).toBe(PartType.object);
  });
});

describe('render/part/node/text/helper createPart', () => {
  it.each([
    [PartType.primitive, 'PrimitivePart'],
    [PartType.templateLiterals, 'TemplateLiteralsPart'],
    [PartType.array, 'ArrayPart'],
    [PartType.node, 'NodePart'],
    [PartType.function, 'FunctionPart'],
    [PartType.object, 'ObjectPart'],
    [PartType.directive, 'DirectivePart'],
  ])('creates the %s part implementation', (type, name) => {
    const [startNode, endNode] = createNodes();

    const part = createPart(type, startNode, endNode);

    expect(part.constructor.name).toBe(name);
    expect(typeof part.commit).toBe('function');
  });

  it('creates a distinct instance on every call', () => {
    const [startNode, endNode] = createNodes();

    const a = createPart(PartType.object, startNode, endNode);
    const b = createPart(PartType.object, startNode, endNode);

    expect(a).not.toBe(b);
    expect(a.constructor).toBe(b.constructor);
  });
});

describe('render/part/node/text/helper isPart', () => {
  it('matches only the part created for the same type', () => {
    allTypes.forEach(type => {
      const [startNode, endNode] = createNodes();
      const part = createPart(type, startNode, endNode);

      allTypes.forEach(other => {
        expect(isPart(other, part)).toBe(other === type);
      });
    });
  });

  it('returns false for null parts', () => {
    allTypes.forEach(type => {
      expect(isPart(type, null)).toBe(false);
    });
  });
});

describe('render/part/node/text/helper instanceof guards', () => {
  it('narrows each concrete part implementation', () => {
    const [startNode, endNode] = createNodes();
    const guards = [
      [PartType.primitive, isPrimitivePart],
      [PartType.templateLiterals, isTemplateLiteralsPart],
      [PartType.array, isArrayPart],
      [PartType.node, isNodePart],
      [PartType.function, isFunctionPart],
      [PartType.object, isObjectPart],
      [PartType.directive, isDirectivePart],
    ] as const;

    guards.forEach(([type, guard]) => {
      expect(guard(createPart(type, startNode, endNode))).toBe(true);
      expect(guard(null)).toBe(false);
      expect(guard({})).toBe(false);
    });

    expect(
      isPrimitivePart(createPart(PartType.object, startNode, endNode))
    ).toBe(false);
  });
});

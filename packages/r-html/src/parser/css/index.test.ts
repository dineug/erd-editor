import { describe, expect, it } from 'vitest';

import { MARKER } from '@/constants';
import { cssParser, parser } from '@/parser/css';
import { Token, TokenType } from '@/parser/css/tokenizer';
import { VCNode, VCNodeType } from '@/parser/vcNode';

type PlainNode = {
  type: VCNodeType;
  value?: string;
  properties?: Array<{ name: string; value: string }>;
  children?: PlainNode[];
};

const toPlain = (node: VCNode): PlainNode => ({
  type: node.type,
  value: node.value,
  properties: node.properties,
  children: node.children?.map(toPlain),
});

describe('cssParser', () => {
  it('returns an empty style root for an empty source', () => {
    const ast = cssParser('');

    expect(ast).toBeInstanceOf(VCNode);
    expect(ast.type).toBe(VCNodeType.style);
    expect(ast.parent).toBeNull();
    expect(ast.value).toBeUndefined();
    expect(ast.children).toBeUndefined();
    expect(ast.properties).toBeUndefined();
  });

  it('parses a class rule into a child node with properties', () => {
    const ast = cssParser('.a { color: red; }');

    expect(toPlain(ast)).toEqual({
      type: VCNodeType.style,
      children: [
        {
          type: VCNodeType.style,
          value: '.a',
          properties: [{ name: 'color', value: 'red' }],
        },
      ],
    });
  });

  it('links every child node back to its parent', () => {
    const ast = cssParser('.a { color: red; }');
    const child = ast.children?.[0] as VCNode;

    expect(child.parent).toBe(ast);
    expect([...child.iterParent()]).toEqual([child, ast]);
    expect([...ast]).toEqual([ast, child]);
  });

  it('parses sibling rules with type and id selectors', () => {
    const ast = cssParser('div { color: red; } #id { width: 1px; }');

    expect(toPlain(ast).children).toEqual([
      {
        type: VCNodeType.style,
        value: 'div',
        properties: [{ name: 'color', value: 'red' }],
      },
      {
        type: VCNodeType.style,
        value: '#id',
        properties: [{ name: 'width', value: '1px' }],
      },
    ]);
  });

  it('keeps the whitespace of a combinator selector but trims the edges', () => {
    const ast = cssParser('a > b { color: red; }');

    expect(ast.children?.[0].value).toBe('a > b');
  });

  it('collects several properties of one rule', () => {
    const ast = cssParser('.a { color: red; width: 1px; }');

    expect(ast.children?.[0].properties).toEqual([
      { name: 'color', value: 'red' },
      { name: 'width', value: '1px' },
    ]);
  });

  it('parses nested rules', () => {
    const ast = cssParser('.a { .b { color: red; } }');

    expect(toPlain(ast).children).toEqual([
      {
        type: VCNodeType.style,
        value: '.a',
        children: [
          {
            type: VCNodeType.style,
            value: '.b',
            properties: [{ name: 'color', value: 'red' }],
          },
        ],
      },
    ]);
  });

  describe('at rule', () => {
    it('parses a block at rule as an atRule node holding its rules', () => {
      const ast = cssParser('@media screen { .a { color: red; } }');

      expect(toPlain(ast).children).toEqual([
        {
          type: VCNodeType.atRule,
          value: '@media screen',
          children: [
            {
              type: VCNodeType.style,
              value: '.a',
              properties: [{ name: 'color', value: 'red' }],
            },
          ],
        },
      ]);
    });

    it('parses a statement at rule and keeps its semicolon', () => {
      const ast = cssParser('@import x;');

      expect(toPlain(ast).children).toEqual([
        { type: VCNodeType.atRule, value: '@import x;' },
      ]);
    });

    it('produces an empty atRule node when the block is never opened', () => {
      const ast = cssParser('@media screen');

      expect(toPlain(ast).children).toEqual([
        { type: VCNodeType.atRule, value: '@media screen' },
      ]);
    });
  });

  describe('comments', () => {
    it('parses a multi line comment into a comment node', () => {
      const ast = cssParser('/* hi */');

      expect(toPlain(ast).children).toEqual([
        { type: VCNodeType.comment, value: '/* hi */' },
      ]);
    });

    it('parses a single line comment without its line break', () => {
      const ast = cssParser('// bye\n');

      expect(toPlain(ast).children).toEqual([
        { type: VCNodeType.comment, value: '// bye' },
      ]);
    });

    it('parses a single line comment that ends with the source', () => {
      const ast = cssParser('// bye');

      expect(toPlain(ast).children).toEqual([
        { type: VCNodeType.comment, value: '// bye' },
      ]);
    });

    it('parses comments mixed with rules', () => {
      const ast = cssParser('/* hi */\n// bye\n.a { color: red; }');

      expect(toPlain(ast).children).toEqual([
        { type: VCNodeType.comment, value: '/* hi */' },
        { type: VCNodeType.comment, value: '// bye' },
        {
          type: VCNodeType.style,
          value: '.a',
          properties: [{ name: 'color', value: 'red' }],
        },
      ]);
    });

    it('throws on an unterminated multi line comment (known bug)', () => {
      expect(() => cssParser('/* hi')).toThrow(TypeError);
    });
  });

  describe('dynamic marker', () => {
    it('parses a marker terminated by a semicolon into a property', () => {
      const ast = cssParser(`.a { ${MARKER}_0_; }`);

      expect(ast.children?.[0].properties).toEqual([
        { name: `${MARKER}_0_`, value: `${MARKER}_0_` },
      ]);
    });

    it('parses a marker terminated by a line break into a property', () => {
      const ast = cssParser(`.a {\n  ${MARKER}_3_\n}`);

      expect(ast.children?.[0].properties).toEqual([
        { name: `${MARKER}_3_`, value: `${MARKER}_3_` },
      ]);
    });

    it('parses a marker used as a selector', () => {
      const ast = cssParser(`${MARKER}_1_ { color: red; }`);

      expect(toPlain(ast).children).toEqual([
        {
          type: VCNodeType.style,
          value: `${MARKER}_1_`,
          properties: [{ name: 'color', value: 'red' }],
        },
      ]);
    });
  });

  it('stops the current node on an unmatched closing brace', () => {
    const ast = cssParser('} .a { color: red; }');

    expect(ast.children).toBeUndefined();
  });
});

describe('parser', () => {
  it('adds a top level declaration to the root node', () => {
    const tokens: Token[] = [
      { type: TokenType.string, value: 'color' },
      { type: TokenType.colon, value: ':' },
      { type: TokenType.whiteSpace, value: ' ' },
      { type: TokenType.string, value: 'red' },
      { type: TokenType.semicolon, value: ';' },
    ];

    const ast = parser(tokens);

    expect(ast.parent).toBeNull();
    expect(ast.properties).toEqual([{ name: 'color', value: 'red' }]);
    expect(ast.children).toBeUndefined();
  });

  it('skips tokens that start no known construct', () => {
    const tokens: Token[] = [
      { type: TokenType.whiteSpace, value: ' ' },
      { type: TokenType.nextLine, value: '\n' },
      { type: TokenType.comma, value: ',' },
    ];

    expect(toPlain(parser(tokens))).toEqual({ type: VCNodeType.style });
  });
});

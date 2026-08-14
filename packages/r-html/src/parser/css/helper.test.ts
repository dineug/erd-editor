import { describe, expect, it } from 'vitest';

import { MARKER } from '@/constants';
import {
  addChild,
  addProperty,
  isAdjacentSiblingCombinator,
  isAmpersandToken,
  isAsteriskToken,
  isAtRule,
  isAttributeSelector,
  isChildCombinator,
  isClassSelector,
  isColonToken,
  isCombinator,
  isCommaToken,
  isCommercialAtToken,
  isDynamicProperty,
  isDynamicSelector,
  isEndMultiCommentValue,
  isEndSingleCommentValue,
  isEqualToken,
  isGeneralSiblingCombinator,
  isGtToken,
  isIdSelector,
  isLeftBraceToken,
  isLeftBracketToken,
  isLeftParentToken,
  isNextLineToken,
  isPeriodToken,
  isPlusToken,
  isProperty,
  isPseudoClass,
  isRightBraceToken,
  isRightBracketToken,
  isRightParentToken,
  isSelector,
  isSemicolonToken,
  isSharpToken,
  isSingleSelector,
  isStartMultiCommentValue,
  isStartSingleCommentValue,
  isStringToken,
  isTildeToken,
  isTypeSelector,
  isUniversalSelector,
  isWhiteSpaceToken,
} from '@/parser/css/helper';
import { Token, TokenType } from '@/parser/css/tokenizer';
import { VCNode, VCNodeType } from '@/parser/vcNode';

type Predicate = (tokens: Token[]) => (pos: number) => boolean;

const t = (type: TokenType, value = 'x'): Token => ({ type, value });

const markerValue = `${MARKER.replace('@@', '')}_0_`;

const at = () => t(TokenType.commercialAt, '@');
const str = (value = 'x') => t(TokenType.string, value);
const ws = () => t(TokenType.whiteSpace, ' ');

describe('token type predicates', () => {
  const cases: Array<[string, Predicate, TokenType]> = [
    ['isStringToken', isStringToken, TokenType.string],
    ['isWhiteSpaceToken', isWhiteSpaceToken, TokenType.whiteSpace],
    ['isNextLineToken', isNextLineToken, TokenType.nextLine],
    ['isEqualToken', isEqualToken, TokenType.equal],
    ['isTildeToken', isTildeToken, TokenType.tilde],
    ['isPlusToken', isPlusToken, TokenType.plus],
    ['isSharpToken', isSharpToken, TokenType.sharp],
    ['isAsteriskToken', isAsteriskToken, TokenType.asterisk],
    ['isCommercialAtToken', isCommercialAtToken, TokenType.commercialAt],
    ['isAmpersandToken', isAmpersandToken, TokenType.ampersand],
    ['isPeriodToken', isPeriodToken, TokenType.period],
    ['isCommaToken', isCommaToken, TokenType.comma],
    ['isColonToken', isColonToken, TokenType.colon],
    ['isSemicolonToken', isSemicolonToken, TokenType.semicolon],
    ['isGtToken', isGtToken, TokenType.gt],
    ['isLeftBraceToken', isLeftBraceToken, TokenType.leftBrace],
    ['isRightBraceToken', isRightBraceToken, TokenType.rightBrace],
    ['isLeftBracketToken', isLeftBracketToken, TokenType.leftBracket],
    ['isRightBracketToken', isRightBracketToken, TokenType.rightBracket],
    ['isLeftParentToken', isLeftParentToken, TokenType.leftParent],
    ['isRightParentToken', isRightParentToken, TokenType.rightParent],
  ];

  it.each(cases)(
    '%s matches only its own token type',
    (_name, predicate, type) => {
      const other =
        type === TokenType.string ? TokenType.whiteSpace : TokenType.string;

      expect(predicate([t(type)])(0)).toBe(true);
      expect(predicate([t(other)])(0)).toBe(false);
    }
  );

  it.each(cases)(
    '%s is false when there is no token at pos',
    (_name, predicate, type) => {
      expect(predicate([])(0)).toBe(false);
      expect(predicate([t(type)])(1)).toBe(false);
      expect(predicate([t(type)])(-1)).toBe(false);
    }
  );
});

describe('comment value predicates', () => {
  it('matches the multi line comment open value', () => {
    expect(isStartMultiCommentValue([str('/*')])(0)).toBe(true);
    expect(isStartMultiCommentValue([str('/**')])(0)).toBe(false);
    expect(isStartMultiCommentValue([])(0)).toBe(false);
  });

  it('matches the multi line comment close value', () => {
    expect(isEndMultiCommentValue([str('*/')])(0)).toBe(true);
    expect(isEndMultiCommentValue([str('/*')])(0)).toBe(false);
  });

  it('matches the single line comment open value', () => {
    expect(isStartSingleCommentValue([str('//')])(0)).toBe(true);
    expect(isStartSingleCommentValue([str('/')])(0)).toBe(false);
  });

  it('ends a single line comment on a nextLine token', () => {
    expect(isEndSingleCommentValue).toBe(isNextLineToken);
    expect(isEndSingleCommentValue([t(TokenType.nextLine, '\n')])(0)).toBe(
      true
    );
    expect(isEndSingleCommentValue([str()])(0)).toBe(false);
  });

  it('ignores the token type and only compares the value', () => {
    expect(isStartMultiCommentValue([t(TokenType.whiteSpace, '/*')])(0)).toBe(
      true
    );
  });
});

describe('isProperty', () => {
  const tokens = [
    str('color'),
    t(TokenType.colon, ':'),
    ws(),
    str('red'),
    t(TokenType.semicolon, ';'),
  ];

  it('matches string colon whiteSpace string semicolon', () => {
    expect(isProperty(tokens)(0)).toBe(true);
  });

  it('does not match when the trailing semicolon is missing', () => {
    expect(isProperty(tokens.slice(0, 4))(0)).toBe(false);
  });

  it('does not match when the colon is not followed by whiteSpace', () => {
    expect(
      isProperty([
        str('a'),
        t(TokenType.colon, ':'),
        str('hover'),
        str('red'),
        t(TokenType.semicolon, ';'),
      ])(0)
    ).toBe(false);
  });

  it('does not match when it does not start with a string token', () => {
    expect(isProperty([ws(), ...tokens])(0)).toBe(false);
  });
});

describe('isDynamicProperty', () => {
  it('matches @@marker terminated by a semicolon', () => {
    expect(
      isDynamicProperty([
        at(),
        at(),
        str(markerValue),
        t(TokenType.semicolon, ';'),
      ])(0)
    ).toBe(true);
  });

  it('matches @@marker terminated by a line break', () => {
    expect(
      isDynamicProperty([
        at(),
        at(),
        str(markerValue),
        t(TokenType.nextLine, '\n'),
      ])(0)
    ).toBe(true);
  });

  it('does not match a string that is not a marker', () => {
    expect(
      isDynamicProperty([
        at(),
        at(),
        str('media'),
        t(TokenType.semicolon, ';'),
      ])(0)
    ).toBe(false);
  });

  it('does not match a single commercialAt', () => {
    expect(
      isDynamicProperty([at(), str(markerValue), t(TokenType.semicolon, ';')])(
        0
      )
    ).toBe(false);
  });

  it('does not match when the marker is not terminated', () => {
    expect(isDynamicProperty([at(), at(), str(markerValue), ws()])(0)).toBe(
      false
    );
  });

  it('does not throw when the token after @@ is missing', () => {
    expect(isDynamicProperty([at(), at()])(0)).toBe(false);
  });
});

describe('selector predicates', () => {
  it('isAtRule matches @ followed by a string', () => {
    expect(isAtRule([at(), str('media')])(0)).toBe(true);
    expect(isAtRule([at(), ws()])(0)).toBe(false);
    expect(isAtRule([str('media'), str('media')])(0)).toBe(false);
  });

  it('isPseudoClass matches a colon followed by a string', () => {
    expect(isPseudoClass([t(TokenType.colon, ':'), str('hover')])(0)).toBe(
      true
    );
    expect(isPseudoClass([t(TokenType.colon, ':'), ws()])(0)).toBe(false);
    expect(isPseudoClass([str('hover')])(0)).toBe(false);
  });

  it('exposes combinator aliases', () => {
    expect(isChildCombinator).toBe(isGtToken);
    expect(isGeneralSiblingCombinator).toBe(isTildeToken);
    expect(isAdjacentSiblingCombinator).toBe(isPlusToken);
    expect(isTypeSelector).toBe(isStringToken);
    expect(isUniversalSelector).toBe(isAsteriskToken);
  });

  it('isCombinator matches >, ~ and +', () => {
    expect(isCombinator([t(TokenType.gt, '>')])(0)).toBe(true);
    expect(isCombinator([t(TokenType.tilde, '~')])(0)).toBe(true);
    expect(isCombinator([t(TokenType.plus, '+')])(0)).toBe(true);
    expect(isCombinator([t(TokenType.comma, ',')])(0)).toBe(false);
  });

  it('isDynamicSelector matches @@marker without a terminator', () => {
    expect(isDynamicSelector([at(), at(), str(markerValue)])(0)).toBe(true);
    expect(isDynamicSelector([at(), at(), str('nope')])(0)).toBe(false);
    expect(isDynamicSelector([at(), str(markerValue)])(0)).toBe(false);
  });

  it('isSingleSelector matches type, universal, ampersand and dynamic selectors', () => {
    expect(isSingleSelector([str('div')])(0)).toBe(true);
    expect(isSingleSelector([t(TokenType.asterisk, '*')])(0)).toBe(true);
    expect(isSingleSelector([t(TokenType.ampersand, '&')])(0)).toBe(true);
    expect(isSingleSelector([at(), at(), str(markerValue)])(0)).toBe(true);
    expect(isSingleSelector([t(TokenType.period, '.')])(0)).toBe(false);
  });

  it('isClassSelector matches a period followed by a string', () => {
    expect(isClassSelector([t(TokenType.period, '.'), str('a')])(0)).toBe(true);
    expect(isClassSelector([t(TokenType.period, '.'), ws()])(0)).toBe(false);
    expect(isClassSelector([str('a')])(0)).toBe(false);
  });

  it('isIdSelector matches a sharp followed by a string', () => {
    expect(isIdSelector([t(TokenType.sharp, '#'), str('a')])(0)).toBe(true);
    expect(isIdSelector([t(TokenType.sharp, '#'), ws()])(0)).toBe(false);
    expect(isIdSelector([str('a')])(0)).toBe(false);
  });

  describe('isAttributeSelector', () => {
    const bracket = t(TokenType.leftBracket, '[');
    const closing = t(TokenType.rightBracket, ']');
    const equal = t(TokenType.equal, '=');

    it('matches a value-less attribute selector', () => {
      expect(
        isAttributeSelector([str('a'), bracket, str('disabled'), closing])(0)
      ).toBe(true);
    });

    it('matches an attribute selector with a value', () => {
      expect(
        isAttributeSelector([
          str('input'),
          bracket,
          str('type'),
          equal,
          str('text'),
          closing,
        ])(0)
      ).toBe(true);
    });

    it('does not match when the bracket is never closed', () => {
      expect(
        isAttributeSelector([
          str('input'),
          bracket,
          str('type'),
          equal,
          str('text'),
        ])(0)
      ).toBe(false);
    });

    it('does not match without a leading single selector', () => {
      expect(isAttributeSelector([bracket, str('disabled'), closing])(0)).toBe(
        false
      );
    });
  });

  describe('isSelector', () => {
    it('matches every selector shape', () => {
      expect(isSelector([str('div')])(0)).toBe(true);
      expect(isSelector([t(TokenType.period, '.'), str('a')])(0)).toBe(true);
      expect(isSelector([t(TokenType.sharp, '#'), str('a')])(0)).toBe(true);
      expect(isSelector([at(), str('media')])(0)).toBe(true);
      expect(isSelector([t(TokenType.colon, ':'), str('hover')])(0)).toBe(true);
    });

    it('does not match a brace or a lone punctuation token', () => {
      expect(isSelector([t(TokenType.leftBrace, '{')])(0)).toBe(false);
      expect(isSelector([t(TokenType.comma, ',')])(0)).toBe(false);
      expect(isSelector([])(0)).toBe(false);
    });
  });
});

describe('addProperty / addChild', () => {
  it('creates the properties array on first add and appends afterwards', () => {
    const node = new VCNode({ type: VCNodeType.style });
    expect(node.properties).toBeUndefined();

    addProperty(node)({ name: 'color', value: 'red' });
    expect(node.properties).toEqual([{ name: 'color', value: 'red' }]);

    addProperty(node)({ name: 'width', value: '1px' });
    expect(node.properties).toEqual([
      { name: 'color', value: 'red' },
      { name: 'width', value: '1px' },
    ]);
  });

  it('ignores a nullish property', () => {
    const node = new VCNode({ type: VCNodeType.style });

    addProperty(node)(null);
    expect(node.properties).toBeUndefined();

    addProperty(node)({ name: 'color', value: 'red' });
    addProperty(node)(null);
    expect(node.properties).toHaveLength(1);
  });

  it('creates the children array on first add and appends afterwards', () => {
    const parent = new VCNode({ type: VCNodeType.style });
    const first = new VCNode({ type: VCNodeType.style, value: '.a', parent });
    const second = new VCNode({
      type: VCNodeType.comment,
      value: '//',
      parent,
    });

    expect(parent.children).toBeUndefined();

    addChild(parent)(first);
    expect(parent.children).toEqual([first]);

    addChild(parent)(second);
    expect(parent.children).toEqual([first, second]);
  });

  it('ignores a nullish child', () => {
    const parent = new VCNode({ type: VCNodeType.style });

    addChild(parent)(null);
    expect(parent.children).toBeUndefined();
  });
});

import {
  isCharacterSet,
  isColumnKeywordValue,
  isCommaToken,
  isConstraintState,
  isLeftParentToken,
  isRightBracketToken,
  isRightParentToken,
  isSemicolonToken,
  requote,
  toStringLiteral,
} from '@/parser/helper';
import { DatabaseVendor, RefPos } from '@/parser/statement';
import { Token, TokenType } from '@/parser/tokenizer';

type PieceKind =
  | 'open'
  | 'close'
  | 'comma'
  | 'period'
  | 'cast'
  | 'bracket'
  | 'string'
  | 'word';

// One unit of the expression as it is written back: a token, or one side of
// a PostgreSQL cast, which the lexer leaves glued to its neighbours (0::int).
type Piece = {
  kind: PieceKind;
  text: string;
  token?: Token;
};

// Words a PostgreSQL type name never holds: after one, the :: casts a part of
// the expression, not the whole of it.
const ExpressionWords: ReadonlyArray<string> = [
  'AND',
  'AT',
  'BETWEEN',
  'COLLATE',
  'ILIKE',
  'IN',
  'IS',
  'LIKE',
  'NOT',
  'OR',
  'OVERLAPS',
  'SIMILAR',
];

// Column options of one vendor that end a default too, though ColumnKeywords
// leaves them out, since it also decides where a column's type stands.
const VendorColumnWords: ReadonlyArray<string> = [
  'COLUMN_FORMAT',
  'INDEX',
  'MASK',
  'ROWGUIDCOL',
  'SPARSE',
  'STORAGE',
];

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const TYPE_WORD = /^(?:[a-z_][\w$]*|"(?:[^"]|"")*")$/i;
const ARRAY_DIMENSION = /^\[\d*\]$/;

const word = (token: Token | undefined) =>
  token && token.type === TokenType.string && !token.quoted
    ? token.value.toUpperCase()
    : '';

/**
 * How many tokens the DEFAULT expression at pos spans: up to the next column
 * keyword, comma, closing paren or unpaired closing bracket at depth 0, or to
 * a semicolon at any depth.
 */
export const matchDefaultExpression = (tokens: Token[]) => {
  const isComma = isCommaToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isRightBracket = isRightBracketToken(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isColumnKeyword = isColumnKeywordValue(tokens);
  const constraintState = isConstraintState(tokens);
  const characterSet = isCharacterSet(tokens);

  const isTimeZone = (pos: number): boolean =>
    word(tokens[pos]) === 'LOCAL'
      ? isTimeZone(pos + 1)
      : word(tokens[pos]) === 'TIME' && word(tokens[pos + 1]) === 'ZONE';

  // FOR ends a default, except in the sequence call NEXT VALUE FOR s that SQL
  // Server and MariaDB take as one, and so do WITH and WITHOUT, except before
  // the [LOCAL] TIME ZONE of a cast; TAG ends one only before its list.
  const endsAt = (pos: number) => {
    const keyword = word(tokens[pos]);

    if (keyword === 'FOR') {
      return !(
        word(tokens[pos - 1]) === 'VALUE' && word(tokens[pos - 2]) === 'NEXT'
      );
    }

    if (keyword === 'WITH' || keyword === 'WITHOUT') {
      return !isTimeZone(pos + 1);
    }
    if (keyword === 'TAG') return isLeftParent(pos + 1);

    return (
      isColumnKeyword(pos) ||
      VendorColumnWords.includes(keyword) ||
      constraintState(pos) ||
      characterSet(pos)
    );
  };

  // CASE opens a level its END closes, as a paren does, so the keywords inside
  // it end nothing: CASE WHEN x IS NULL THEN 0 END, and END::text too.
  const isCase = (pos: number) => word(tokens[pos]) === 'CASE';
  const isEnd = (pos: number) => /^END(?:::|$)/.test(word(tokens[pos]));

  return (pos: number) => {
    let depth = 0;
    let cursor = pos;

    for (; cursor < tokens.length && !isSemicolon(cursor); cursor++) {
      if (isLeftParent(cursor) || isCase(cursor)) {
        depth++;
      } else if (isRightParent(cursor)) {
        if (depth === 0) break;
        depth--;
      } else if (depth > 0 && isEnd(cursor)) {
        depth--;
      } else if (depth > 0) {
        continue;
      } else if (isComma(cursor) || isRightBracket(cursor)) {
        break;
      } else if (cursor > pos && endsAt(cursor)) {
        // The first token is the value whatever it is: DEFAULT NULL.
        break;
      }
    }

    return cursor - pos;
  };
};

const toPieces = (tokens: Token[], database?: DatabaseVendor) =>
  tokens.flatMap((token): Piece[] => {
    switch (token.type) {
      case TokenType.leftParent:
        return [{ kind: 'open', text: '(' }];
      case TokenType.rightParent:
        return [{ kind: 'close', text: ')' }];
      case TokenType.comma:
        return [{ kind: 'comma', text: ',' }];
      case TokenType.period:
        return [{ kind: 'period', text: '.' }];
    }

    if (token.quoted) {
      const kind =
        token.quoted === "'"
          ? 'string'
          : token.quoted === '['
            ? 'bracket'
            : 'word';
      return [{ kind, text: requote(token, database), token }];
    }

    return token.value
      .split('::')
      .flatMap((part, index): Piece[] => [
        ...(index ? [{ kind: 'cast' as const, text: '::' }] : []),
        ...(part ? [{ kind: 'word' as const, text: part }] : []),
      ]);
  });

// A sign or an operator, a word holding no letter, digit or quote: +, ||, =.
const isOperator = (piece: Piece) =>
  piece.kind === 'word' && !/[\p{L}\p{N}_$#@'"`]/u.test(piece.text);

// Brackets that subscript or size what they follow, ARRAY[1, 2] and text[],
// not a T-SQL name in them: NEXT VALUE FOR [dbo].[seq].
const isSubscript = (prev: Piece, next: Piece) =>
  /^ARRAY$/i.test(prev.text) || !/^\[[\p{L}_@#]/u.test(next.text);

// The lexer cuts =, so >=, <=, !=, <=>, == and => come in two or three pieces.
const isSplitOperator = (prev: Piece, next: Piece) =>
  prev.kind === 'word' &&
  next.kind === 'word' &&
  ((next.text === '=' && /[<>!=]$/.test(prev.text)) ||
    (prev.text === '=' && next.text.startsWith('>')));

// No space inside parens, around . and ::, before a comma, inside an operator
// the lexer cut, or before an argument list or subscript unless an operator
// stands before it; one after a comma, before a bracketed name, one elsewhere.
const spaceBetween = (prev: Piece, next: Piece) => {
  if (['close', 'comma', 'period', 'cast'].includes(next.kind)) return false;
  if (['open', 'period', 'cast'].includes(prev.kind)) return false;
  if (prev.kind === 'comma') return true;
  if (isSplitOperator(prev, next)) return false;
  if (next.kind === 'bracket' && !isSubscript(prev, next)) return true;
  if (next.kind === 'open' || next.kind === 'bracket') return isOperator(prev);
  return true;
};

const render = (pieces: Piece[]) =>
  pieces.reduce(
    (text, piece, index) =>
      index && spaceBetween(pieces[index - 1], piece)
        ? `${text} ${piece.text}`
        : text + piece.text,
    ''
  );

// The index of the paren closing the one at start, -1 where none does.
const closeOf = (pieces: Piece[], start: number) => {
  let depth = 0;

  for (let index = start; index < pieces.length; index++) {
    if (pieces[index].kind === 'open') {
      depth++;
    } else if (pieces[index].kind === 'close' && --depth === 0) {
      return index;
    }
  }

  return -1;
};

// Drops every pair of parens around the whole expression: ((0)) is 0.
const unwrap = (pieces: Piece[]) => {
  let inner = pieces;

  while (
    inner.length > 1 &&
    inner[0].kind === 'open' &&
    closeOf(inner, 0) === inner.length - 1
  ) {
    inner = inner.slice(1, -1);
  }

  return inner;
};

const isTypeName = (pieces: Piece[]) => {
  let depth = 0;

  return (
    pieces.length > 0 &&
    pieces[0].kind === 'word' &&
    pieces.every(({ kind, text }) => {
      if (kind === 'open') return ++depth > 0;
      if (kind === 'close') return --depth >= 0;
      if (depth > 0 || kind === 'period') return true;
      if (kind === 'bracket') return ARRAY_DIMENSION.test(text);

      return (
        kind === 'word' &&
        TYPE_WORD.test(text) &&
        !ExpressionWords.includes(text.toUpperCase())
      );
    })
  );
};

const isLiteral = (pieces: Piece[]) => {
  if (pieces.length === 1 && pieces[0].kind === 'string') return true;

  const text = render(pieces);
  return NUMBER.test(text) || /^(?:null|true|false)$/i.test(text);
};

// Drops a cast of the whole expression off a literal, as pg_dump writes one:
// 'draft'::character varying is 'draft'. Off anything else, ARRAY[]::text[]
// or ('now'::text)::date, the cast is part of what the default means.
const uncast = (pieces: Piece[]) => {
  let depth = 0;
  let cast = -1;

  pieces.forEach(({ kind }, index) => {
    if (kind === 'open') {
      depth++;
    } else if (kind === 'close') {
      depth--;
    } else if (depth === 0 && kind === 'cast') {
      cast = index;
    }
  });

  if (cast === -1 || !isTypeName(pieces.slice(cast + 1))) return pieces;

  const operand = unwrap(pieces.slice(0, cast));
  return isLiteral(operand) ? operand : pieces;
};

/**
 * Reads the DEFAULT expression at $pos as raw SQL, without the parens around
 * the whole of it or a cast of a literal, and leaves $pos on what ends it.
 */
export function defaultExpressionParser(
  tokens: Token[],
  $pos: RefPos,
  database?: DatabaseVendor
): string {
  const span = matchDefaultExpression(tokens)($pos.value);
  const pieces = uncast(
    unwrap(toPieces(tokens.slice($pos.value, $pos.value + span), database))
  );
  $pos.value += span;

  // A lone quoted value is a string literal in any quotes, MySQL's "x" too:
  // the lexer has stripped them, and PENDING would read back as a name.
  const [first] = pieces;
  if (pieces.length === 1 && first.token) {
    const { value, prefix = '' } = first.token;
    return prefix + toStringLiteral(value, database);
  }

  return render(pieces);
}

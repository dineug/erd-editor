export interface Token {
  type: TokenType;
  value: string;
}

export enum TokenType {
  string = 'string',
  whiteSpace = 'whiteSpace',
  lt = 'lt',
  gt = 'gt',
  slash = 'slash',
  equal = 'equal',
}

enum NodeType {
  element = 'element',
  text = 'text',
  comment = 'comment',
}

const pattern = {
  doubleQuote: `"`,
  singleQuote: `'`,
  whiteSpace: /\s/,
  string: /\S/,
  breakString: /<|>|=/,
  lt: '<',
  gt: '>',
  slash: '/',
  equal: '=',
  hyphen: '-',
  exclamationPoint: '!',
};

const createEqual = (type: string) => (char: string) => type === char;
const createTest = (regexp: RegExp) => (char: string) => regexp.test(char);

const match = {
  doubleQuote: createEqual(pattern.doubleQuote),
  singleQuote: createEqual(pattern.singleQuote),
  whiteSpace: createTest(pattern.whiteSpace),
  string: createTest(pattern.string),
  breakString: createTest(pattern.breakString),
  lt: createEqual(pattern.lt),
  gt: createEqual(pattern.gt),
  slash: createEqual(pattern.slash),
  equal: createEqual(pattern.equal),
  hyphen: createEqual(pattern.hyphen),
  exclamationPoint: createEqual(pattern.exclamationPoint),
};

const isStartCommentTag = (source: string) => (pos: number) =>
  match.lt(source[pos]) &&
  match.exclamationPoint(source[pos + 1]) &&
  match.hyphen(source[pos + 2]) &&
  match.hyphen(source[pos + 3]);

export function tokenizer(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  const isChar = () => pos < source.length;
  const startCommentTag = isStartCommentTag(source);

  const walk = (nodeType = NodeType.text) => {
    while (isChar()) {
      let char = source[pos];

      if (match.whiteSpace(char)) {
        let value = '';

        while (isChar() && match.whiteSpace(char)) {
          value += char;
          char = source[++pos];
        }

        nodeType !== NodeType.element &&
          tokens.push({ type: TokenType.whiteSpace, value });
        continue;
      }

      if (nodeType === NodeType.element) {
        if (match.lt(char)) {
          tokens.push({ type: TokenType.lt, value: char });
          pos++;
          continue;
        }

        if (match.gt(char)) {
          tokens.push({ type: TokenType.gt, value: char });
          pos++;
          break;
        }

        if (match.slash(char)) {
          tokens.push({ type: TokenType.slash, value: char });
          pos++;
          continue;
        }

        if (match.equal(char)) {
          tokens.push({ type: TokenType.equal, value: char });
          pos++;
          continue;
        }

        if (match.doubleQuote(char)) {
          let value = '';
          char = source[++pos];

          while (isChar() && !match.doubleQuote(char)) {
            value += char;
            char = source[++pos];
          }

          tokens.push({ type: TokenType.string, value });
          pos++;
          continue;
        }

        if (match.singleQuote(char)) {
          let value = '';
          char = source[++pos];

          while (isChar() && !match.singleQuote(char)) {
            value += char;
            char = source[++pos];
          }

          tokens.push({ type: TokenType.string, value });
          pos++;
          continue;
        }
      } else if (nodeType === NodeType.comment) {
        if (match.lt(char)) {
          tokens.push({ type: TokenType.lt, value: char });
          pos++;
          continue;
        }

        if (match.gt(char)) {
          tokens.push({ type: TokenType.gt, value: char });
          pos++;
          break;
        }
      } else {
        if (match.lt(char)) {
          walk(startCommentTag(pos) ? NodeType.comment : NodeType.element);
          continue;
        }
      }

      if (match.string(char)) {
        let value = '';

        while (isChar() && match.string(char) && !match.breakString(char)) {
          value += char;
          char = source[++pos];
        }

        tokens.push({ type: TokenType.string, value });
        continue;
      }

      pos++;
    }
  };

  walk();

  return tokens;
}

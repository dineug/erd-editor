export interface Token {
  type: TokenType;
  value: string;
}

export enum TokenType {
  string = 'string',
  whiteSpace = 'whiteSpace',
  nextLine = 'nextLine',
  equal = 'equal',
  tilde = 'tilde',
  plus = 'plus',
  sharp = 'sharp',
  asterisk = 'asterisk',
  commercialAt = 'commercialAt',
  ampersand = 'ampersand',
  period = 'period',
  comma = 'comma',
  colon = 'colon',
  semicolon = 'semicolon',
  gt = 'gt',
  leftBrace = 'leftBrace',
  rightBrace = 'rightBrace',
  leftBracket = 'leftBracket',
  rightBracket = 'rightBracket',
  leftParent = 'leftParent',
  rightParent = 'rightParent',
}

enum NodeType {
  style = 'style',
  multiComment = 'multiComment',
  singleComment = 'singleComment',
}

const pattern = {
  doubleQuote: `"`,
  singleQuote: `'`,
  whiteSpace: /\s/,
  string: /\S/,
  breakString: /:|;|{|&|#|@|,|>|~|\(|\)|\[|\.|\+/,
  nextLine: '\n',
  slash: '/',
  equal: '=',
  tilde: '~',
  plus: '+',
  sharp: '#',
  asterisk: '*',
  commercialAt: '@',
  ampersand: '&',
  period: '.',
  comma: ',',
  colon: ':',
  semicolon: ';',
  gt: '>',
  leftBrace: '{',
  rightBrace: '}',
  leftBracket: '[',
  rightBracket: ']',
  leftParent: '(',
  rightParent: ')',
};

const createEqual = (type: string) => (char: string) => type === char;
const createTest = (regexp: RegExp) => (char: string) => regexp.test(char);

const match = {
  doubleQuote: createEqual(pattern.doubleQuote),
  singleQuote: createEqual(pattern.singleQuote),
  whiteSpace: createTest(pattern.whiteSpace),
  string: createTest(pattern.string),
  breakString: createTest(pattern.breakString),
  nextLine: createEqual(pattern.nextLine),
  slash: createEqual(pattern.slash),
  equal: createEqual(pattern.equal),
  tilde: createEqual(pattern.tilde),
  plus: createEqual(pattern.plus),
  sharp: createEqual(pattern.sharp),
  asterisk: createEqual(pattern.asterisk),
  commercialAt: createEqual(pattern.commercialAt),
  ampersand: createEqual(pattern.ampersand),
  period: createEqual(pattern.period),
  comma: createEqual(pattern.comma),
  colon: createEqual(pattern.colon),
  semicolon: createEqual(pattern.semicolon),
  gt: createEqual(pattern.gt),
  leftBrace: createEqual(pattern.leftBrace),
  rightBrace: createEqual(pattern.rightBrace),
  leftBracket: createEqual(pattern.leftBracket),
  rightBracket: createEqual(pattern.rightBracket),
  leftParent: createEqual(pattern.leftParent),
  rightParent: createEqual(pattern.rightParent),
};

const isStartMultiComment = (source: string) => (pos: number) =>
  match.slash(source[pos]) && match.asterisk(source[pos + 1]);

const isEndMultiComment = (source: string) => (pos: number) =>
  match.asterisk(source[pos]) && match.slash(source[pos + 1]);

const isStartSingleComment = (source: string) => (pos: number) =>
  match.slash(source[pos]) && match.slash(source[pos + 1]);

export function tokenizer(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  const isChar = () => pos < source.length;
  const startMultiComment = isStartMultiComment(source);
  const endMultiComment = isEndMultiComment(source);
  const startSingleComment = isStartSingleComment(source);

  const walk = (nodeType = NodeType.style) => {
    while (isChar()) {
      let char = source[pos];

      if (match.nextLine(char)) {
        tokens.push({ type: TokenType.nextLine, value: char });
        pos++;

        if (nodeType === NodeType.singleComment) {
          break;
        }

        continue;
      }

      if (match.whiteSpace(char)) {
        let value = '';

        while (isChar() && match.whiteSpace(char) && !match.nextLine(char)) {
          value += char;
          char = source[++pos];
        }

        tokens.push({ type: TokenType.whiteSpace, value });
        continue;
      }

      if (nodeType === NodeType.style) {
        if (startMultiComment(pos)) {
          walk(NodeType.multiComment);
          continue;
        }

        if (startSingleComment(pos)) {
          walk(NodeType.singleComment);
          continue;
        }

        if (match.colon(char)) {
          tokens.push({ type: TokenType.colon, value: char });

          let value = '';
          char = source[++pos];

          if (match.whiteSpace(char)) {
            value = '';

            while (isChar() && match.whiteSpace(char)) {
              value += char;
              char = source[++pos];
            }

            tokens.push({ type: TokenType.whiteSpace, value });
            value = '';
          } else {
            continue;
          }

          while (isChar() && !match.semicolon(char)) {
            value += char;
            char = source[++pos];
          }

          tokens.push({ type: TokenType.string, value });
          continue;
        }

        if (match.leftBracket(char)) {
          tokens.push({ type: TokenType.leftBracket, value: char });

          let value = '';
          char = source[++pos];

          while (isChar() && !match.equal(char) && !match.rightBracket(char)) {
            value += char;
            char = source[++pos];
          }
          tokens.push({ type: TokenType.string, value });

          if (match.equal(char)) {
            tokens.push({ type: TokenType.equal, value: char });
            char = source[++pos];
          }

          if (match.doubleQuote(char)) {
            let value = '';
            char = source[++pos];

            while (isChar() && !match.doubleQuote(char)) {
              value += char;
              char = source[++pos];
            }

            tokens.push({ type: TokenType.string, value });
            char = source[++pos];
          }

          if (match.singleQuote(char)) {
            let value = '';
            char = source[++pos];

            while (isChar() && !match.singleQuote(char)) {
              value += char;
              char = source[++pos];
            }

            tokens.push({ type: TokenType.string, value });
            char = source[++pos];
          }

          if (match.rightBracket(char)) {
            tokens.push({ type: TokenType.rightBracket, value: char });
            pos++;
          }

          continue;
        }

        if (match.commercialAt(char)) {
          tokens.push({ type: TokenType.commercialAt, value: char });
          pos++;
          continue;
        }

        if (match.gt(char)) {
          tokens.push({ type: TokenType.gt, value: char });
          pos++;
          continue;
        }

        if (match.tilde(char)) {
          tokens.push({ type: TokenType.tilde, value: char });
          pos++;
          continue;
        }

        if (match.plus(char)) {
          tokens.push({ type: TokenType.plus, value: char });
          pos++;
          continue;
        }

        if (match.sharp(char)) {
          tokens.push({ type: TokenType.sharp, value: char });
          pos++;
          continue;
        }

        if (match.asterisk(char)) {
          tokens.push({ type: TokenType.asterisk, value: char });
          pos++;
          continue;
        }

        if (match.ampersand(char)) {
          tokens.push({ type: TokenType.ampersand, value: char });
          pos++;
          continue;
        }

        if (match.period(char)) {
          tokens.push({ type: TokenType.period, value: char });
          pos++;
          continue;
        }

        if (match.comma(char)) {
          tokens.push({ type: TokenType.comma, value: char });
          pos++;
          continue;
        }

        if (match.semicolon(char)) {
          tokens.push({ type: TokenType.semicolon, value: char });
          pos++;
          continue;
        }

        if (match.leftBrace(char)) {
          tokens.push({ type: TokenType.leftBrace, value: char });
          pos++;
          continue;
        }

        if (match.rightBrace(char)) {
          tokens.push({ type: TokenType.rightBrace, value: char });
          pos++;
          continue;
        }

        if (match.leftParent(char)) {
          let value = '';

          while (isChar() && !match.rightParent(char)) {
            value += char;
            char = source[++pos];
          }
          value += char;

          tokens.push({ type: TokenType.string, value });
          pos++;
          continue;
        }
      } else if (nodeType === NodeType.multiComment) {
        if (endMultiComment(pos)) {
          tokens.push({ type: TokenType.string, value: '*/' });
          pos += 2;
          break;
        }
      } else if (nodeType === NodeType.singleComment) {
        if (match.nextLine(char)) {
          tokens.push({ type: TokenType.nextLine, value: char });
          pos++;
          break;
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

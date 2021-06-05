import { Statement, Token } from '@@types/index';

import { alterTableAddForeignKey } from './sqlParser/alter.table.add.foreignKey';
import { alterTableAddPrimaryKey } from './sqlParser/alter.table.add.primaryKey';
import { alterTableAddUnique } from './sqlParser/alter.table.add.unique';
import { createIndex } from './sqlParser/create.index';
import { createTable } from './sqlParser/create.table';
import { createUniqueIndex } from './sqlParser/create.unique.index';
import {
  isAlterTableAddForeignKey,
  isAlterTableAddPrimaryKey,
  isAlterTableAddUnique,
  isCreateIndex,
  isCreateTable,
  isCreateUniqueIndex,
  isExtraString,
  isNewStatement,
  isSemicolon,
  isStringKeyword,
  tokenMatch,
} from './sqlParser/SQLParserHelper';

/**
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */
export function tokenizer(input: string): Token[] {
  let current = 0;

  const tokens: Token[] = [];

  while (current < input.length) {
    let char = input[current];

    if (tokenMatch.whiteSpace.test(char)) {
      current++;
      continue;
    }

    if (char === tokenMatch.leftParen) {
      tokens.push({
        type: 'leftParen',
        value: '(',
      });
      current++;
      continue;
    }

    if (char === tokenMatch.rightParen) {
      tokens.push({
        type: 'rightParen',
        value: ')',
      });
      current++;
      continue;
    }

    if (char === tokenMatch.comma) {
      tokens.push({
        type: 'comma',
        value: ',',
      });
      current++;
      continue;
    }

    if (char === tokenMatch.period) {
      tokens.push({
        type: 'period',
        value: '.',
      });
      current++;
      continue;
    }

    if (char === tokenMatch.equal) {
      tokens.push({
        type: 'equal',
        value: '=',
      });
      current++;
      continue;
    }

    if (char === tokenMatch.semicolon) {
      tokens.push({
        type: 'semicolon',
        value: ';',
      });
      current++;
      continue;
    }

    if (char === tokenMatch.doubleQuote) {
      let value = '';

      char = input[++current];

      while (char !== tokenMatch.doubleQuote) {
        value += char;
        char = input[++current];
      }

      char = input[++current];

      tokens.push({ type: 'doubleQuoteString', value });

      continue;
    }

    if (char === tokenMatch.singleQuote) {
      let value = '';

      char = input[++current];

      while (char !== tokenMatch.singleQuote) {
        value += char;
        char = input[++current];
      }

      char = input[++current];

      tokens.push({ type: 'singleQuoteString', value });

      continue;
    }

    if (char === tokenMatch.backtick) {
      let value = '';

      char = input[++current];

      while (char !== tokenMatch.backtick) {
        value += char;
        char = input[++current];
      }

      char = input[++current];

      tokens.push({ type: 'backtickString', value });

      continue;
    }

    if (tokenMatch.string.test(char)) {
      let value = '';

      while (tokenMatch.string.test(char)) {
        value += char;
        char = input[++current];
      }

      tokens.push({ type: 'string', value });

      continue;
    }

    if (tokenMatch.unknown.test(char)) {
      let value = '';

      while (tokenMatch.unknown.test(char)) {
        value += char;
        char = input[++current];
      }

      tokens.push({ type: 'unknown', value });

      continue;
    }

    current++;
  }

  tokens.forEach(token => {
    if (isExtraString(token)) {
      token.type = 'string';
    } else if (isStringKeyword(token)) {
      token.type = 'keyword';
    }
  });

  return tokens;
}

export function parser(tokens: Token[]): Statement[] {
  let current = 0;

  const tokenStatements: Array<Array<Token>> = [];
  const statements: Statement[] = [];

  while (current < tokens.length) {
    let token = tokens[current];

    if (isNewStatement(token)) {
      const statement: Token[] = [];

      statement.push(token);
      token = tokens[++current];

      while (
        current < tokens.length &&
        !isNewStatement(token) &&
        !isSemicolon(token)
      ) {
        statement.push(token);
        token = tokens[++current];
      }

      tokenStatements.push(statement);
    }

    if (token && isNewStatement(token)) {
      continue;
    }

    current++;
  }

  tokenStatements.forEach(tokenStatement => {
    if (isCreateTable(tokenStatement)) {
      statements.push(createTable(tokenStatement));
    } else if (isCreateIndex(tokenStatement)) {
      statements.push(createIndex(tokenStatement));
    } else if (isCreateUniqueIndex(tokenStatement)) {
      statements.push(createUniqueIndex(tokenStatement));
    } else if (isAlterTableAddPrimaryKey(tokenStatement)) {
      statements.push(alterTableAddPrimaryKey(tokenStatement));
    } else if (isAlterTableAddForeignKey(tokenStatement)) {
      statements.push(alterTableAddForeignKey(tokenStatement));
    } else if (isAlterTableAddUnique(tokenStatement)) {
      statements.push(alterTableAddUnique(tokenStatement));
    }
  });

  return statements;
}

export function DDLParser(input: string): Statement[] {
  const tokens = tokenizer(input);
  return parser(tokens);
}

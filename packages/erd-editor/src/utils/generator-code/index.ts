import { Language } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';

import {
  createCode as createCodeCsharp,
  formatTable as formatTableCsharp,
} from './csharp';
import {
  createCode as createCodeDrizzle,
  formatTable as formatTableDrizzle,
} from './drizzle';
import { createCode as createCodeGo, formatTable as formatTableGo } from './go';
import {
  createCode as createCodeGraphql,
  formatTable as formatTableGraphql,
} from './graphql';
import {
  createCode as createCodeJava,
  formatTable as formatTableJava,
} from './java';
import {
  createCode as createCodeJPA,
  formatTable as formatTableJPA,
} from './jpa';
import {
  createCode as createCodeKotlin,
  formatTable as formatTableKotlin,
} from './kotlin';
import {
  createCode as createCodeScala,
  formatTable as formatTableScala,
} from './scala';
import {
  createCode as createCodeSequelize,
  formatTable as formatTableSequelize,
} from './sequelize';
import {
  createCode as createCodeSQLAlchemy,
  formatTable as formatTableSQLAlchemy,
} from './sqlalchemy';
import {
  createCode as createCodeTypeORM,
  formatTable as formatTableTypeORM,
} from './typeorm';
import {
  createCode as createCodeTypescript,
  formatTable as formatTableTypescript,
} from './typescript';

export function createGeneratorCode(state: RootState): string {
  const {
    settings: { language },
  } = state;

  switch (language) {
    case Language.GraphQL:
      return createCodeGraphql(state);
    case Language.JPA:
      return createCodeJPA(state);
    case Language.TypeScript:
      return createCodeTypescript(state);
    case Language.csharp:
      return createCodeCsharp(state);
    case Language.Java:
      return createCodeJava(state);
    case Language.Kotlin:
      return createCodeKotlin(state);
    case Language.Scala:
      return createCodeScala(state);
    case Language.Go:
      return createCodeGo(state);
    case Language.SQLAlchemy:
      return createCodeSQLAlchemy(state);
    case Language.TypeORM:
      return createCodeTypeORM(state);
    case Language.Sequelize:
      return createCodeSequelize(state);
    case Language.Drizzle:
      return createCodeDrizzle(state);
  }

  return '';
}

export function createGeneratorCodeTable(
  state: RootState,
  table: Table
): string {
  const buffer: string[] = [''];
  const {
    settings: { language },
  } = state;

  switch (language) {
    case Language.GraphQL:
      formatTableGraphql(state, { buffer, table });
      buffer.push('');
      break;
    case Language.JPA:
      formatTableJPA(state, { buffer, table });
      buffer.push('');
      break;
    case Language.TypeScript:
      formatTableTypescript(state, { buffer, table });
      buffer.push('');
      break;
    case Language.csharp:
      formatTableCsharp(state, { buffer, table });
      buffer.push('');
      break;
    case Language.Java:
      formatTableJava(state, { buffer, table });
      buffer.push('');
      break;
    case Language.Kotlin:
      formatTableKotlin(state, { buffer, table });
      buffer.push('');
      break;
    case Language.Scala:
      formatTableScala(state, { buffer, table });
      buffer.push('');
      break;
    case Language.Go:
      formatTableGo(state, { buffer, table });
      buffer.push('');
      break;
    case Language.SQLAlchemy:
      formatTableSQLAlchemy(state, { buffer, table });
      buffer.push('');
      break;
    case Language.TypeORM:
      formatTableTypeORM(state, { buffer, table });
      buffer.push('');
      break;
    case Language.Sequelize:
      formatTableSequelize(state, { buffer, table });
      buffer.push('');
      break;
    case Language.Drizzle:
      formatTableDrizzle(state, { buffer, table });
      buffer.push('');
      break;
  }

  return buffer.join('\n');
}

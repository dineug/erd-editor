import { Store } from '@@types/engine/store';
import { Table } from '@@types/engine/store/table.state';

import {
  createCode as createCodeCsharp,
  formatTable as formatTableCsharp,
} from './csharp';
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
} from './JPA';
import {
  createCode as createCodeKotlin,
  formatTable as formatTableKotlin,
} from './kotlin';
import {
  createCode as createCodeScla,
  formatTable as formatTableScala,
} from './scala';
import {
  createCode as createCodeTypescript,
  formatTable as formatTableTypescript,
} from './typescript';

export function createGeneratorCode(store: Store): string {
  const { language } = store.canvasState;
  switch (language) {
    case 'GraphQL':
      return createCodeGraphql(store);
    case 'C#':
      return createCodeCsharp(store);
    case 'Java':
      return createCodeJava(store);
    case 'Kotlin':
      return createCodeKotlin(store);
    case 'TypeScript':
      return createCodeTypescript(store);
    case 'JPA':
      return createCodeJPA(store);
    case 'Scala':
      return createCodeScla(store);
  }
  return '';
}

export function createGeneratorCodeTable(store: Store, table: Table): string {
  const stringBuffer: string[] = [''];
  const { language, database, tableCase, columnCase } = store.canvasState;
  const { tables } = store.tableState;
  const { relationships } = store.relationshipState;
  switch (language) {
    case 'GraphQL':
      formatTableGraphql(
        table,
        stringBuffer,
        database,
        relationships,
        tables,
        tableCase,
        columnCase
      );
      stringBuffer.push('');
      break;
    case 'C#':
      formatTableCsharp(table, stringBuffer, database, tableCase, columnCase);
      stringBuffer.push('');
      break;
    case 'Java':
      formatTableJava(table, stringBuffer, database, tableCase, columnCase);
      stringBuffer.push('');
      break;
    case 'Kotlin':
      formatTableKotlin(table, stringBuffer, database, tableCase, columnCase);
      stringBuffer.push('');
      break;
    case 'TypeScript':
      formatTableTypescript(
        table,
        stringBuffer,
        database,
        tableCase,
        columnCase
      );
      stringBuffer.push('');
      break;
    case 'JPA':
      formatTableJPA(
        table,
        stringBuffer,
        database,
        relationships,
        tables,
        tableCase,
        columnCase
      );
      stringBuffer.push('');
      break;
    case 'Scala':
      formatTableScala(table, stringBuffer, database, tableCase, columnCase);
      stringBuffer.push('');
      break;
  }
  return stringBuffer.join('\n');
}

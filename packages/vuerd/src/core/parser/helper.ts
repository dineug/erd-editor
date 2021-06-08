import { Table, Column, Index } from '@@types/engine/store/table.state';
import { Relationship } from '@@types/engine/store/relationship.state';
import { RelationshipState } from '@@types/engine/store/relationship.state';
import { TableState } from '@@types/engine/store/table.state';
import { Statement } from '@/core/parser/index';
import { translations } from './translations';

export type Dialect = 'postgresql' | 'oracle' | 'mssql';
export type DialectFrom = 'postgresql';

export interface FormatTableOptions {
  table: Table;
  dialect: Dialect;
}

export interface FormatColumnOptions {
  column: Column;
  dialect: Dialect;
}

export interface Constraints {
  primaryKey: boolean;
  nullable: boolean;
  unique: boolean;
}

export interface FormatRelationOptions {
  tables: Table[];
  relationship: Relationship;
}

export interface FormatIndexOptions {
  table: Table;
  index: Index;
}

export interface Name {
  id: string;
  name: string;
}

export interface Author {
  id: string;
  name: string;
}

export interface FormatChangeSet {
  dialect: Dialect;
  author: Author;
  tableState: TableState;
  relationshipState: RelationshipState;
}

export interface KeyColumn {
  start: Column[];
  end: Column[];
}

export interface ParserCallback {
  (element: Element, statements: Statement[]): void;
}

export function formatNames<T extends { name: string }>(list: T[]): string {
  const buf: string[] = [];
  list.forEach((v, i) => {
    buf.push(v.name);
    if (list.length !== i + 1) {
      buf.push(', ');
    }
  });
  return buf.join('');
}

/**
 * Translation between dialects for liquibase
 * @param dialectFrom Source dialect
 * @param dialectTo Destination dialect
 * @param value Value to be translated
 * @returns Translated string
 */
export const translate = (
  dialectFrom: DialectFrom,
  dialectTo: Dialect,
  value: string
): string => {
  switch (dialectFrom) {
    case 'postgresql':
      const retVal = translateFromPostgreSQL(dialectTo, value);
      if (!retVal)
        alert(
          `Error translating "${value}" from ${dialectFrom} to ${dialectTo}`
        );
      return retVal;
    default:
      return '';
  }
};

export const translateFromPostgreSQL = (
  dialectTo: Dialect,
  value: string
): string => {
  const searchValue = translations.find(
    trans => trans.PostgresDatabase.toLowerCase() === value.toLowerCase()
  );

  switch (dialectTo) {
    case 'postgresql':
      return searchValue?.PostgresDatabase || '';
    case 'mssql':
      return searchValue?.MSSQLDatabase || '';
    case 'oracle':
      return searchValue?.OracleDatabase || '';
    default:
      return '';
  }
};

export interface Attribute {
  name: string;
  value: string;
}

export interface XMLNode {
  name: string;
  attributes: Attribute[];
  children: XMLNode[];
}

/**
 * Converts array of XML nodes to string
 * @param xmlNodes Array of XMLNodes that will be converted to string
 * @returns XML in string form
 */
export const createXMLString = (xmlNodes: XMLNode[]): string => {
  let xmlSerializer = new XMLSerializer();
  var parser = new DOMParser();
  var root = parser.parseFromString('</>', 'text/xml');
  var stringBuffer: string[] = [];

  xmlNodes.forEach(node => {
    stringBuffer.push(xmlSerializer.serializeToString(createNode(node, root)));
  });

  return stringBuffer.join('\n');
};

/**
 * Recursive function, that traverses all nodes
 * @param xmlNode One node that will be converted to string
 * @param root Root html element used to create elements
 * @returns Node converted to XML in string form
 */
const createNode = (xmlNode: XMLNode, root: Document): HTMLElement => {
  let element = root.createElement(xmlNode.name);

  xmlNode.attributes.forEach(attr => {
    element.setAttribute(attr.name, attr.value);
  });

  xmlNode.children.forEach(child => {
    if (child.name)
      element.insertAdjacentElement('beforeend', createNode(child, root));
  });

  return element;
};

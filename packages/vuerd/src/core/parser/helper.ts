import { Diff } from '@/core/diff';
import { Logger } from '@/core/logger';
import { Statement } from '@/core/parser/index';
import { Translation, translations } from '@/core/parser/translations';
import { Relationship } from '@@types/engine/store/relationship.state';
import { RelationshipState } from '@@types/engine/store/relationship.state';
import { Column, Index, Table } from '@@types/engine/store/table.state';
import { TableState } from '@@types/engine/store/table.state';

export type Dialect = keyof Translation;
export type Operation =
  | 'createTable'
  | 'createIndex'
  | 'addForeignKeyConstraint'
  | 'addPrimaryKey'
  | 'addColumn'
  | 'dropColumn'
  | 'dropTable'
  | 'dropForeignKeyConstraint'
  | 'addUniqueConstraint';

export const supportedDialects: Dialect[] = ['oracle', 'postgresql', 'mssql'];

export interface FormatTableOptions {
  table: Table;
  dialect: Dialect;
}

export interface FormatColumnOptions {
  table: Table;
  column: Column;
  dialect: Dialect;
}

export interface Constraints {
  primaryKey: boolean;
  nullable: boolean;
  unique: boolean;
}

export interface FormatRelationOptions {
  startTable: Table;
  endTable: Table;
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

export interface FormatTableDiff {
  author: Author;
  diffs: Diff[];
}

export interface KeyColumn {
  start: Column[];
  end: Column[];
}

export interface ParserCallback {
  (element: Element, statements: Statement[], dialect?: Dialect): void;
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
  dialectFrom: Dialect,
  dialectTo: Dialect,
  value: string
): string => {
  var translation: Translation | undefined;
  value = value.trim();

  translation = findTranslation(value, dialectFrom);

  if (!translation) {
    Logger.log(
      `Error translating "${value}" from ${dialectFrom} to ${dialectTo}`
    );
    return value;
  }

  return translation[dialectTo];
};

export const findTranslation = (
  value: string,
  dialect: Dialect
): Translation | undefined => {
  return translations.find(
    trans => trans[dialect].toLowerCase() === value.toLowerCase()
  );
};

export interface Attribute {
  name: string;
  value: string;
}

export interface IXMLNode {
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

export class XMLNode implements IXMLNode {
  name: string;
  attributes: Attribute[];
  children: XMLNode[];

  constructor(
    name: string,
    attributes: Attribute[] = [],
    children: XMLNode[] = []
  ) {
    this.name = name;
    this.attributes = attributes;
    this.children = children;
  }

  addAttribute(...attributes: Attribute[]) {
    attributes.forEach(attr => {
      this.attributes.push({ name: attr.name, value: attr.value.trim() });
    });
  }

  addChildren(...children: XMLNode[]) {
    this.children.push(...children);
  }
}

export const generateSeqName = (
  tableName: string,
  columnName: string
): string => {
  return `${tableName}_${columnName}_seq`.toLowerCase();
};

export const getIdChangeSet = (author: Author): string => {
  return author.id.replace(/\\/g, '/').split('/').pop() || '';
};

export const changeSetAttributes = ({
  author,
  dialect,
  suffix,
}: {
  author: Author;
  dialect?: Dialect;
  suffix?: string;
}): Attribute[] => {
  const attr: Attribute[] = [
    {
      name: 'id',
      value: `${getIdChangeSet(author)}${suffix ? `-${suffix}` : ''}`,
    },
    { name: 'author', value: author.name },
  ];
  if (dialect) attr.push({ name: 'dbms', value: dialect });

  return attr;
};

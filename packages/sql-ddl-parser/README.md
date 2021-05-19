# sql-ddl-parser

> Permissive SQL DDL Parser

[![npm version](https://img.shields.io/npm/v/@vuerd/sql-ddl-parser.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@vuerd/sql-ddl-parser) [![GitHub](https://img.shields.io/github/license/vuerd/vuerd?style=flat-square&color=blue)](https://github.com/vuerd/vuerd/blob/master/LICENSE)

## Document

- [Import SQL DDL support syntax](https://github.com/dineug/sql-ddl-parser/blob/master/src/SQL_DDL_Test_Case.md)

## interface

```typescript
export function tokenizer(input: string): Token[];
export function parser(tokens: Token[]): Statement[];
export function DDLParser(input: string): Statement[];
```

| Name      | Type     |
| --------- | -------- |
| tokenizer | Function |
| parser    | Function |
| DDLParser | Function |

## Install

```bash
$ yarn add @vuerd/sql-ddl-parser
or
$ npm install @vuerd/sql-ddl-parser
```

## Usage

```javascript
import { DDLParser } from "@vuerd/sql-ddl-parser";

const statements = DDLParser("sql ddl...");
```

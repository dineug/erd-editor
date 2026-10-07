import { describe, expect, it } from 'vite-plus/test';

import {
  ARG_COPY,
  describeArg,
  describeTool,
  SERVER_INSTRUCTIONS,
  TOOL_COPY,
} from '@/tools/copy';
import { actionTools } from '@/tools/registry';
import { SESSION_TOOL_NAMES } from '@/tools/toolkit';

/** Every tool the server lists, with the arguments its input schema has. */
const SURFACE: Array<{ name: string; args: string[] }> = [
  { name: 'erd_list_documents', args: [] },
  { name: 'erd_open_document', args: ['path', 'create'] },
  {
    name: 'erd_read',
    args: [
      'path',
      'format',
      'vendor',
      'statements',
      'header',
      'tableIds',
      'tableNames',
    ],
  },
  {
    name: 'erd_list',
    args: ['path', 'query', 'offset', 'limit', 'namesOnly'],
  },
  {
    name: 'erd_get',
    args: [
      'path',
      'tableIds',
      'tableNames',
      'relationshipIds',
      'indexIds',
      'memoIds',
    ],
  },
  { name: 'erd_save', args: ['path'] },
  { name: 'erd_undo', args: ['path'] },
  { name: 'erd_redo', args: ['path'] },
  ...actionTools.map(({ name, args }) => ({
    name,
    args: ['path', ...args.map(arg => arg.name)],
  })),
  { name: 'erd_batch', args: ['path', 'operations'] },
];

describe('the prose table covers the surface exactly', () => {
  it('names the session tools the surface above lists', () => {
    expect(SURFACE.slice(0, 8).map(({ name }) => name)).toEqual([
      ...SESSION_TOOL_NAMES,
    ]);
  });

  it.each(SURFACE.map(({ name, args }) => [name, args] as const))(
    '%s and each of its arguments have prose',
    (name, args) => {
      expect(describeTool(name).length).toBeGreaterThan(10);
      for (const arg of args) {
        expect(describeArg(name, arg).length).toBeGreaterThan(3);
      }
    }
  );

  it('has no tool entry for a tool the server does not list', () => {
    expect(Object.keys(TOOL_COPY).sort()).toEqual(
      SURFACE.map(({ name }) => name).sort()
    );
  });

  it('has no tool argument entry for an argument that tool does not take', () => {
    for (const { name, args } of SURFACE) {
      for (const arg of Object.keys(TOOL_COPY[name].args ?? {})) {
        expect(args, `${name}.${arg}`).toContain(arg);
      }
    }
  });

  it('has no shared argument entry that no tool falls back to', () => {
    const fallbacks = new Set(
      SURFACE.flatMap(({ name, args }) =>
        args.filter(arg => !TOOL_COPY[name].args?.[arg])
      )
    );
    expect(Object.keys(ARG_COPY).sort()).toEqual([...fallbacks].sort());
  });

  it('throws for a tool or argument the table misses, so registration fails loudly', () => {
    expect(() => describeTool('erd_unknown')).toThrow(/erd_unknown/);
    expect(() => describeArg('erd_add_table', 'bogus')).toThrow(/bogus/);
  });

  it('keeps every description in plain sentences, no markdown', () => {
    for (const { description, args } of Object.values(TOOL_COPY)) {
      for (const prose of [description, ...Object.values(args ?? {})]) {
        expect(prose).not.toMatch(/[`*#]|\n/);
      }
    }
  });
});

describe('the words sent before any editor is found', () => {
  const liveTexts = [
    SERVER_INSTRUCTIONS,
    describeTool('erd_list_documents'),
    describeTool('erd_open_document'),
    describeTool('erd_save'),
  ];

  it('names the three editors a document can be live in, none left out', () => {
    for (const text of liveTexts) {
      expect(text).toContain('VS Code');
      expect(text).toContain('Obsidian');
      expect(text).toContain('JetBrains IDE');
    }
  });

  it('says VS Code keeps agent edits unsaved until erd_save and Obsidian and JetBrains IDEs save them themselves', () => {
    for (const text of [SERVER_INSTRUCTIONS, describeTool('erd_save')]) {
      expect(text).toMatch(/VS Code keeps (them|edits) unsaved until/);
      expect(text).toMatch(
        /Obsidian and JetBrains IDEs save them as they save the user’s edits/
      );
    }
  });

  it('keeps the server instructions in plain sentences too', () => {
    expect(SERVER_INSTRUCTIONS).not.toMatch(/[`*#]|\n/);
  });
});

describe('the words on a color', () => {
  it('say on both color tools that an empty string removes the color', () => {
    for (const name of ['erd_change_table_color', 'erd_change_memo_color']) {
      expect(describeArg(name, 'color')).toContain(
        'an empty string removes the color'
      );
    }
  });
});

describe('the words on a referential action', () => {
  const ACTION_ARGS = ['onDelete', 'onUpdate'];
  const texts = [
    describeTool('erd_change_relationship_on_delete'),
    describeTool('erd_change_relationship_on_update'),
    ...actionTools.flatMap(({ name, args }) =>
      args
        .filter(arg => ACTION_ARGS.includes(arg.name))
        .map(arg => describeArg(name, arg.name))
    ),
  ];

  it('reach both change tools and the six arguments that take an action', () => {
    expect(texts).toHaveLength(8);
  });

  it('say an editor released before referential actions drops them, so the user updates it', () => {
    for (const text of texts) {
      expect(text).toContain(
        'An ERD Editor extension or plugin released before referential actions ignores this setting, so the user should update it.'
      );
    }
  });

  it('name no release, which the next one would make wrong', () => {
    for (const text of texts) {
      expect(text).not.toMatch(/\d+\.\d+/);
    }
  });
});

describe('the words on a foreign key data type', () => {
  it('give erd_add_relationship the integer each serial key copies as', () => {
    const text = describeTool('erd_add_relationship');

    for (const phrase of [
      'serial4 integer',
      'smallserial and serial2 smallint',
      'bigserial and serial8 bigint',
      'serial integer under PostgreSQL',
      'bigint unsigned under MySQL and MariaDB',
      'serial elsewhere',
    ]) {
      expect(text).toContain(phrase);
    }
  });

  it('say the sync of erd_change_column_data_type runs both ways and stops at a serial key', () => {
    const text = describeTool('erd_change_column_data_type');

    expect(text).toContain('both ways');
    expect(text).toContain('into the foreign keys that copy the column');
    expect(text).toContain('from a foreign key back to the key it copies');
    expect(text).toContain(
      'except a serial key, which keeps its type and stops the change there'
    );
  });
});

describe('the words on an import', () => {
  const schemaImports = [
    'erd_import_sql',
    'erd_import_graphql',
    'erd_import_dbml',
    'erd_import_aml',
  ];

  it('say the four schema imports keep the settings but the view, and none that it discards the document', () => {
    for (const name of schemaImports) {
      const text = describeTool(name);

      expect(text, name).toContain(
        'Replaces every table, relationship, index and memo of the document'
      );
      expect(text, name).toContain(
        'keeping its settings but the view, which goes to the start of the canvas'
      );
      expect(describeArg(name, 'mode'), name).toContain(
        'keeps the settings but the view, which goes to the start of the canvas'
      );
    }
    for (const { description, args } of Object.values(TOOL_COPY)) {
      for (const prose of [description, ...Object.values(args ?? {})]) {
        expect(prose).not.toMatch(/discard/i);
      }
    }
  });

  it('say erd_import_json takes the settings and locks it carries, and how to keep this document’s', () => {
    const text = describeTool('erd_import_json');

    expect(text).toContain('its settings included');
    expect(text).toContain(
      'one without lockSettings turns every lock on and puts the view at the start of the canvas'
    );
    expect(text).toContain(
      "To keep this document's settings, start from the text erd_read json gives."
    );
    expect(describeArg('erd_import_json', 'mode')).toContain(
      'its settings included'
    );
  });
});

describe('the words on a Schema SQL script', () => {
  const text = describeTool('erd_set_ddl_script');

  it('say where each script goes, that it goes in as is, and how to remove it', () => {
    expect(text).toContain('before, written ahead of the tables');
    expect(text).toContain('after, written past the generated DDL');
    expect(text).toContain(
      'The text goes as is into the DDL of every database'
    );
    expect(text).toContain(
      'SQL Server output gets GO after a script that does not end with GO'
    );
    expect(text).toContain('An empty string removes it.');
    expect(describeArg('erd_set_ddl_script', 'sql')).toContain(
      'an empty string removes it'
    );
  });

  it('give the longest script a call takes', () => {
    expect(describeArg('erd_set_ddl_script', 'sql')).toContain(
      'at most 10,000 characters'
    );
    expect(describeArg('erd_set_ddl_script', 'position')).toBe(
      'before or after the generated tables.'
    );
  });

  it('say erd_read sql shows the script where it goes', () => {
    expect(text).toContain(
      'An empty string removes it. erd_read sql shows it in place. An ERD Editor'
    );
  });

  it('say an editor released before the scripts loses them, so the user updates it, naming no release', () => {
    expect(text).toContain(
      'An ERD Editor extension or plugin released before scripts neither shows nor keeps them, so the user should update it.'
    );
    expect(text).not.toMatch(/\d+\.\d+/);
  });
});

describe('the words on how erd_read writes the DDL', () => {
  it('say the whole document’s DDL carries its scripts', () => {
    expect(describeTool('erd_read')).toContain(
      "The sql format of the whole document includes the document's before and after scripts."
    );
  });

  it('name each statements value, where IF NOT EXISTS is written and what recreate does', () => {
    const text = describeArg('erd_read', 'statements');

    expect(text).toMatch(
      /^For the sql format: create \(default\), ifNotExists/
    );
    expect(text).toContain(
      'CREATE TABLE IF NOT EXISTS on MySQL, MariaDB, PostgreSQL, SQLite and Databricks and falls back to create elsewhere'
    );
    expect(text).toContain('recreate, which drops the tables first');
    expect(text).toContain('(Snowflake writes CREATE OR REPLACE TABLE)');
  });

  it('name each header value, the databases short of one and when none is written', () => {
    const text = describeArg('erd_read', 'header');

    expect(text).toMatch(/^For the sql format: none \(default\), use/);
    expect(text).toContain('createAndUse, which creates it first');
    expect(text).toContain(
      'Oracle has use alone, PostgreSQL createAndUse alone and SQLite neither'
    );
    expect(text).toContain(
      'no header is written while the database name is empty or not a plain identifier'
    );
  });
});

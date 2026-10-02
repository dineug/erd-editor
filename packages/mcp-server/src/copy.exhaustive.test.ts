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
    args: ['path', 'format', 'vendor', 'tableIds', 'tableNames'],
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

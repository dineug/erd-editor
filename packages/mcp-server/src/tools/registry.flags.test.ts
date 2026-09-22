import { StreamActionTypes } from '@dineug/erd-editor/peer.js';
import { describe, expect, it } from 'vite-plus/test';

import { actionTools, type ExpectedCount } from '@/tools/registry';

const TOOL_NAME = /^erd_[a-z]+(?:_[a-z]+)*$/;
const ARG_NAME = /^[a-z]+(?:[A-Z][a-z]*)*$/;

const validCount = (count: ExpectedCount) =>
  typeof count === 'number'
    ? Number.isInteger(count) && count >= 0
    : Number.isInteger(count.min) &&
      Number.isInteger(count.max) &&
      0 <= count.min &&
      count.min <= count.max;

describe('registry shape', () => {
  it('names each tool once, with the erd_ prefix in snake case', () => {
    const names = actionTools.map(({ name }) => name);

    expect(new Set(names).size).toBe(names.length);
    expect(names.filter(name => !TOOL_NAME.test(name))).toEqual([]);
    expect(names).toHaveLength(53);
  });

  it('names each argument once per tool, in camel case', () => {
    for (const tool of actionTools) {
      const names = tool.args.map(({ name }) => name);

      expect(new Set(names).size, tool.name).toBe(names.length);
      expect(
        names.filter(name => !ARG_NAME.test(name)),
        tool.name
      ).toEqual([]);
    }
  });

  it('points focus, parents and snapshot paths at arguments the tool takes', () => {
    for (const tool of actionTools) {
      const names = new Set(tool.args.map(({ name }) => name));
      const referenced = [
        ...(tool.focus
          ? [tool.focus.tableArg, tool.focus.columnArg ?? tool.focus.tableArg]
          : []),
        ...tool.args.flatMap(({ kind }) =>
          'parentArg' in kind && kind.parentArg ? [kind.parentArg] : []
        ),
        ...tool.snapshotPaths.flatMap(path =>
          [...path.matchAll(/\[(\w+)\]/g)].map(([, name]) => name)
        ),
      ];

      expect(
        referenced.filter(name => !names.has(name)),
        tool.name
      ).toEqual([]);
      expect(tool.snapshotPaths.length, tool.name).toBeGreaterThan(0);
    }
  });

  it('gives a reason wherever the engine makes no undo entry', () => {
    for (const tool of actionTools) {
      expect(Boolean(tool.undoableReason), tool.name).toBe(!tool.undoable);
    }
  });

  it('declares counts that can be met', () => {
    for (const tool of actionTools) {
      expect(validCount(tool.expectedBatches), tool.name).toBe(true);
      expect(validCount(tool.expectedHistory), tool.name).toBe(true);
    }
  });
});

describe('registry flags (AC-E9′)', () => {
  it('marks a tool stream exactly when it emits a stream action type', () => {
    for (const tool of actionTools) {
      const streams = tool.actionTypes.some(type =>
        StreamActionTypes.includes(type)
      );

      expect(tool.stream, tool.name).toBe(streams);
    }
  });
});

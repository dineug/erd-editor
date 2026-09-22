// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { TOOL_SCENARIOS } from '@/__test-utils__/agentScenarios';
import { createSeedValue } from '@/__test-utils__/agentSeed';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';
import { actionTools, type ExpectedCount } from '@/agent/registry';
import { StreamActionTypes } from '@/engine/actions';

const dispatches = vi.hoisted(() => ({ count: 0 }));

// Counts the calls into the store's own dispatch, the one seam a call has.
vi.mock('@/engine/rx-store', async importOriginal => {
  const actual = await importOriginal<typeof import('@/engine/rx-store')>();

  return {
    ...actual,
    createRxStore: (...args: Parameters<typeof actual.createRxStore>) => {
      const store = actual.createRxStore(...args);
      return Object.freeze({
        ...store,
        dispatchSync: (...actions: Parameters<typeof store.dispatchSync>) => {
          dispatches.count++;
          store.dispatchSync(...actions);
        },
      });
    },
  };
});

const peers: AgentPeer[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

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

  it.each(actionTools.map(({ name }) => name))(
    '%s is one dispatch that lands inside its declared counts',
    async name => {
      const peer = createAgentPeer({ nickname: 'agent', presence: false });
      peers.push(peer);
      peer.setInitialValue(createSeedValue());
      const tool = actionTools.find(tool => tool.name === name)!;

      expect(Array.isArray(tool.toActions({ ...TOOL_SCENARIOS[name] }))).toBe(
        true
      );

      dispatches.count = 0;
      const run = await peer.runTool(name, TOOL_SCENARIOS[name]);

      expect(dispatches.count).toBe(1);
      expect(run.mismatch).toBeUndefined();
    }
  );
});

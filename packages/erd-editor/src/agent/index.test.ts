// @vitest-environment node

import { describe, expect, it } from 'vite-plus/test';

import * as agent from '@/agent';
import { AgentToolError, AgentToolErrorCode } from '@/agent/errors';
import { createAgentPeer } from '@/agent/peer';
import {
  EXCLUSION_REASONS,
  NO_DEDICATED_TOOL,
  NOT_EMITTED,
} from '@/agent/reachability';
import { READ_FORMATS, readDocument, SQL_VENDORS } from '@/agent/read';
import { actionTools, PENDING_COVERAGE, toolByName } from '@/agent/registry';
import { toAgentSnapshot } from '@/agent/snapshot';

describe('agent barrel (AC-E1)', () => {
  it('exposes the peer factory, the registry and its gates, the readers, and nothing else', () => {
    expect(Object.keys(agent).sort()).toEqual([
      'AgentToolError',
      'AgentToolErrorCode',
      'EXCLUSION_REASONS',
      'NOT_EMITTED',
      'NO_DEDICATED_TOOL',
      'PENDING_COVERAGE',
      'READ_FORMATS',
      'SQL_VENDORS',
      'actionTools',
      'createAgentPeer',
      'readDocument',
      'toAgentSnapshot',
      'toolByName',
    ]);
  });

  it('re-exports each name from the module that owns it', () => {
    expect(agent.createAgentPeer).toBe(createAgentPeer);
    expect(agent.AgentToolError).toBe(AgentToolError);
    expect(agent.AgentToolErrorCode).toBe(AgentToolErrorCode);
    expect(agent.actionTools).toBe(actionTools);
    expect(agent.toolByName).toBe(toolByName);
    expect(agent.PENDING_COVERAGE).toBe(PENDING_COVERAGE);
    expect(agent.NOT_EMITTED).toBe(NOT_EMITTED);
    expect(agent.NO_DEDICATED_TOOL).toBe(NO_DEDICATED_TOOL);
    expect(agent.EXCLUSION_REASONS).toBe(EXCLUSION_REASONS);
    expect(agent.readDocument).toBe(readDocument);
    expect(agent.READ_FORMATS).toBe(READ_FORMATS);
    expect(agent.SQL_VENDORS).toBe(SQL_VENDORS);
    expect(agent.toAgentSnapshot).toBe(toAgentSnapshot);
  });

  it('builds a working peer through the barrel', async () => {
    const peer = agent.createAgentPeer({ nickname: 'agent', presence: false });
    peer.setInitialValue('');

    const run = await peer.runTool('erd_add_table', {});

    expect(run.createdIds).toHaveLength(1);
    expect(JSON.parse(peer.value).doc.tableIds).toEqual(run.createdIds);

    peer.destroy();
  });
});

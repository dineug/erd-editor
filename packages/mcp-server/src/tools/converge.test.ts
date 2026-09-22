import { afterEach, describe, expect, it } from 'vite-plus/test';

import { comparable, settle } from '@/__test-utils__/mcp';
import { TOOL_SCENARIOS } from '@/__test-utils__/scenarios';
import { createPeerSession, type PeerSession } from '@/__test-utils__/seed';
import { actionTools } from '@/tools/registry';
import { runTool } from '@/tools/run';

const sessions: PeerSession[] = [];

afterEach(() => {
  sessions.splice(0).forEach(session => session.destroy());
});

/** The hooks a load or an edit schedules land on timers of a few milliseconds. */
const quiet = () => settle(30);

/**
 * Two peer stores take each other's batches through receive and converge; the
 * convergence with the element side's store is kept by erd-editor's
 * engine/peer-store.converge.test.ts.
 */
describe('two peers converge over every tool (AC-E5)', () => {
  it.each(actionTools.map(({ name }) => name))(
    'after %s both sides serialize the same document',
    async name => {
      const session = createPeerSession();
      sessions.push(session);
      await quiet();

      const run = runTool(session.agent, name, TOOL_SCENARIOS[name]);
      await quiet();

      expect(run.batches).toBeGreaterThan(0);
      expect(comparable(session.agent.value)).toEqual(
        comparable(session.other.value)
      );
    }
  );
});

import { Effect } from 'effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { stubSessions } from '@/__test-utils__/effect';
import { connectLayer, RpcError } from '@/__test-utils__/mcp';
import { layerWithSessions } from '@/server';
import { ReadParams } from '@/tools/read.tool';
import { toolInputSchema } from '@/tools/schema';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the input schema of a hand-added tool', () => {
  it('is one closed object with erd_read arguments', () => {
    expect(toolInputSchema('erd_read', ReadParams, true)).toMatchObject({
      type: 'object',
      required: ['path', 'format'],
      additionalProperties: false,
    });
  });
});

describe('a call that fails unexpectedly', () => {
  it('answers erd_read with an internal error for a defect, logged, and keeps serving', async () => {
    const mcp = await connectLayer(
      layerWithSessions(
        stubSessions({ read: () => Effect.die(new TypeError('bug')) })
      ),
      { clientName: 'stub' }
    );

    const error = await mcp
      .call('erd_read', { path: '/work/a.erd.json', format: 'snapshot' })
      .catch((reason: unknown) => reason);

    // The dated protocols carry every tool error, an internal one too, as -32602.
    expect(error).toBeInstanceOf(RpcError);
    expect(error).toMatchObject({
      code: -32602,
      message: 'Tool execution failed due to an internal server error.',
    });
    expect(console.error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      'a tool call failed',
      expect.stringContaining('TypeError: bug')
    );
    expect((await mcp.listTools()).tools).toHaveLength(62);
    await mcp.close();
  });

  it('answers an edit tool with the internal code for a rejection that is no refusal, logged', async () => {
    const mcp = await connectLayer(
      layerWithSessions(
        stubSessions({ runTool: () => Effect.fail(new TypeError('bug')) })
      )
    );

    const refused = await mcp.call('erd_add_table', {
      path: '/work/a.erd.json',
    });

    expect(refused.isError).toBe(true);
    expect(refused.json).toEqual({
      error: { code: 'internal', message: 'bug' },
    });
    expect(console.error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      'a tool call failed',
      expect.any(TypeError)
    );
    await mcp.close();
  });
});

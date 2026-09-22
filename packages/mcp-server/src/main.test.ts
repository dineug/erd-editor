import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

const startStdioServer = vi.hoisted(() => vi.fn());

vi.mock('@/server', () => ({ startStdioServer }));

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('the entry point', () => {
  it('starts the stdio server', async () => {
    startStdioServer.mockResolvedValueOnce({});
    await import('@/main');
    expect(startStdioServer).toHaveBeenCalledWith();
  });

  it('logs a failed start to stderr and exits non-zero', async () => {
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    startStdioServer.mockRejectedValueOnce(new Error('no stdin'));

    await import('@/main');
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      'could not start',
      expect.any(Error)
    );
  });
});

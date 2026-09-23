import { Effect } from 'effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { layer, warnUnsafe } from '@/hub/services/HubLogger';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the hub logger', () => {
  it('prefixes what it is handed, whatever its shape', () => {
    warnUnsafe('a message', { code: 1 });

    expect(console.warn).toHaveBeenCalledWith('[erd-editor hub]', 'a message', {
      code: 1,
    });
  });

  it('carries a message of one part and of several to the same console', async () => {
    const error = new Error('EACCES');

    await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          yield* Effect.logWarning('alone');
          yield* Effect.logWarning('with a cause', error);
        }),
        layer
      )
    );

    expect(console.warn).toHaveBeenNthCalledWith(
      1,
      '[erd-editor hub]',
      'alone'
    );
    expect(console.warn).toHaveBeenNthCalledWith(
      2,
      '[erd-editor hub]',
      'with a cause',
      error
    );
  });
});

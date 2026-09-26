import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
import { Effect } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import { assertErdFile, erdFileProblem } from '@/index';

// The extensions, the waits, every refusal text and stripBom are vectors of
// __fixtures__/conformance.json, which the Kotlin hub is held to as well.
describe('the files a hub serves', () => {
  it('fails an effect with the refusal of erdFileProblem, and passes an ERD file', async () => {
    await expect(
      Effect.runPromise(assertErdFile('/ws/a.erd.json'))
    ).resolves.toBeUndefined();
    await expect(
      Effect.runPromise(assertErdFile('/ws/schema.sql'))
    ).rejects.toMatchObject({
      code: HubErrorCode.badRequest,
      message: erdFileProblem('/ws/schema.sql')?.message,
    });
  });
});

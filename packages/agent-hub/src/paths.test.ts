import { Effect } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import { runTest } from '@/__test-utils__/effect';
import { authorize } from '@/paths';
import { HubErrorCode, HubRequestError } from '@/protocol';

// The path tables, authorize's included, are vectors of __fixtures__/conformance.json;
// what stays here is the Effect around them: its value, its error class, when it reads.
describe('authorize', () => {
  it('succeeds with no value, and fails with a HubRequestError an adapter answers as is', async () => {
    await expect(
      runTest(authorize(['/ws'], [], '/ws/model.erd', 'linux'))
    ).resolves.toBeUndefined();

    const caught = await runTest(
      Effect.flip(authorize(['/ws'], ['/open.erd'], '/etc/model.erd', 'linux'))
    );

    expect(caught).toBeInstanceOf(HubRequestError);
    expect(caught.code).toBe(HubErrorCode.outsideWorkspace);
  });

  it('checks the folders and documents as they are when it runs', async () => {
    const folders: string[] = [];
    const check = authorize(folders, [], '/ws/model.erd', 'linux');

    await expect(runTest(Effect.flip(check))).resolves.toBeInstanceOf(
      HubRequestError
    );
    folders.push('/ws');
    await expect(runTest(check)).resolves.toBeUndefined();
  });
});

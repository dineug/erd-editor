import { HubErrorCode, HubRequestError } from '@dineug/erd-editor-agent-hub';
import { Effect } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import {
  assertErdFile,
  closedBeforeSave,
  closedDuringJoin,
  createNeedsInitialValue,
  editorCouldNotOpen,
  ERD_FILE_EXTENSIONS,
  erdFileProblem,
  fileMissing,
  folderMissing,
  JOIN_QUIET_CAP_MS,
  notJoined,
  notOpenInEditor,
  notReadyForActions,
  OPEN_READY_TIMEOUT_MS,
  openTimedOut,
  SAVE_QUIET_CAP_MS,
  stripBom,
  unsettledSave,
} from '@/index';

const REFUSAL =
  '/ws/schema.sql is not an ERD file; the hub serves .erd, .vuerd, .erd.json, .vuerd.json only';

describe('the files a hub serves', () => {
  it('admits every ERD extension whatever its case', () => {
    expect(ERD_FILE_EXTENSIONS).toEqual([
      'erd',
      'vuerd',
      'erd.json',
      'vuerd.json',
    ]);
    for (const name of [
      '/ws/a.erd',
      '/ws/a.vuerd',
      '/ws/a.erd.json',
      '/ws/a.vuerd.json',
      '/ws/A.ERD.JSON',
    ]) {
      expect(erdFileProblem(name)).toBeNull();
    }
  });

  it('refuses any other file with badRequest, naming what it serves', () => {
    const problem = erdFileProblem('/ws/schema.sql');

    expect(problem).toBeInstanceOf(HubRequestError);
    expect(problem).toMatchObject({
      code: HubErrorCode.badRequest,
      message: REFUSAL,
    });
    expect(erdFileProblem('/ws/erd')).not.toBeNull();
    expect(erdFileProblem('/ws/a.json')).not.toBeNull();
  });

  it('fails an effect with that refusal, and passes an ERD file', async () => {
    await expect(
      Effect.runPromise(assertErdFile('/ws/a.erd.json'))
    ).resolves.toBeUndefined();
    await expect(
      Effect.runPromise(assertErdFile('/ws/schema.sql'))
    ).rejects.toMatchObject({
      code: HubErrorCode.badRequest,
      message: REFUSAL,
    });
  });

  it('waits longer to save than to join, and longest for an editor to open', () => {
    expect(SAVE_QUIET_CAP_MS).toBe(2_000);
    expect(OPEN_READY_TIMEOUT_MS).toBe(5_000);
    expect(JOIN_QUIET_CAP_MS).toBeLessThan(SAVE_QUIET_CAP_MS);
  });
});

describe('the refusals every host words alike', () => {
  const path = '/ws/a.erd';

  it('answers each with its code and its one text', () => {
    const refusals = [
      [fileMissing(path), HubErrorCode.notFound, '/ws/a.erd does not exist'],
      [
        folderMissing(path),
        HubErrorCode.notFound,
        'The folder of /ws/a.erd does not exist',
      ],
      [
        createNeedsInitialValue(),
        HubErrorCode.badRequest,
        'openDocument with create needs a string initialValue, the bytes of an empty document',
      ],
      [
        editorCouldNotOpen('Obsidian', path, 'no leaf'),
        HubErrorCode.notOpen,
        'Obsidian could not open /ws/a.erd in the ERD editor: no leaf',
      ],
      [
        openTimedOut(path),
        HubErrorCode.notOpen,
        'No ERD editor on /ws/a.erd reported ready within 5000 ms',
      ],
      [
        notReadyForActions(path),
        HubErrorCode.notOpen,
        '/ws/a.erd is not open in an ERD editor that is ready; open it with openDocument, then join',
      ],
      [
        notJoined(path),
        HubErrorCode.notOpen,
        'Join /ws/a.erd before applying actions to it',
      ],
      [
        notOpenInEditor(path),
        HubErrorCode.notOpen,
        '/ws/a.erd is not open in an ERD editor',
      ],
      [
        closedBeforeSave(path),
        HubErrorCode.notOpen,
        '/ws/a.erd closed before it could be saved',
      ],
      [
        closedDuringJoin(path),
        HubErrorCode.notOpen,
        '/ws/a.erd closed, or the peer left it, before the join finished',
      ],
    ] as const;

    for (const [error, code, message] of refusals) {
      expect(error).toBeInstanceOf(HubRequestError);
      expect(error).toMatchObject({ code, message });
    }
  });

  it('logs a save the replicas never settled, naming the cap', () => {
    expect(unsettledSave(path)).toBe(
      '/ws/a.erd has an edit no replica saved within 2000 ms; its bytes may lack it, so nothing was saved'
    );
  });

  it('drops a leading byte order mark only', () => {
    expect(stripBom('\uFEFF{"doc":{}}')).toBe('{"doc":{}}');
    expect(stripBom('{"doc":"\uFEFF"}')).toBe('{"doc":"\uFEFF"}');
    expect(stripBom('')).toBe('');
  });
});

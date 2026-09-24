import { tableActions$ } from '@dineug/erd-editor/peer.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  documentWith,
  settle,
  USERS_DOCUMENT,
} from '@/__test-utils__/driveDocument';
import { createFakeDrive, type FakeDrive } from '@/__test-utils__/gdrive';
import { createDriveClient } from '@/services/gdrive/driveClient';
import type { SaveState } from '@/services/gdrive/fileChannel';
import {
  createSaveQueue,
  DEBOUNCE_MS,
  MAX_WAIT_MS,
  type SaveBroadcast,
  STEAL_SETTLE_MS,
} from '@/services/gdrive/saveQueue';
import {
  type TokenStatus,
  TokenUnavailableError,
} from '@/services/gdrive/tokenManager';
import { toDriveFingerprint } from '@/utils/documentFingerprint';

const EDITED = documentWith(store => {
  store.setInitialValue(USERS_DOCUMENT);
  store.dispatch([tableActions$.addTableAction$()]);
});
const EDITED_AGAIN = documentWith(store => {
  store.setInitialValue(EDITED);
  store.dispatch([tableActions$.addTableAction$()]);
});

/** The same document, zoomed and scrolled: view state, no edit. */
function viewed(value: string) {
  const json = JSON.parse(value);
  json.settings.zoomLevel = 0.5;
  json.settings.originX += 40;
  return JSON.stringify(json);
}

type Setup = {
  canEdit?: boolean;
  leader?: boolean;
  pendingAttempt?: { attemptId: string; fingerprint: string } | null;
  state?: Parameters<typeof createSaveQueue>[1]['state'];
};

let drive: FakeDrive;
let queues: Array<{ dispose(): void }> = [];

function setup({
  canEdit = true,
  leader = true,
  pendingAttempt = null,
  state,
}: Setup = {}) {
  const file = drive.add({
    id: 'file-1',
    name: 'shop.erd',
    content: USERS_DOCUMENT,
    mimeType: 'application/octet-stream',
  });
  const token: { status: TokenStatus | null } = { status: null };
  const client = createDriveClient({
    fetch: drive.fetch,
    getAccessToken: async () => {
      if (token.status) throw new TokenUnavailableError(token.status);
      return 'drive-token-1';
    },
    onUnauthorized: async () => {
      throw new TokenUnavailableError('signed-out');
    },
  });
  const tab = {
    value: USERS_DOCUMENT as string | null,
    leader,
    stillLeader: true,
  };
  const broadcasts: SaveBroadcast[] = [];
  const states: SaveState[] = [];
  const requestSave = vi.fn();
  let attempts = 0;

  const queue = createSaveQueue(
    {
      drive: client,
      fileId: 'file-1',
      getValue: () => tab.value,
      isLeader: () => tab.leader,
      isStillLeader: async () => tab.leader && tab.stillLeader,
      requestSave,
      broadcast: message => broadcasts.push(message),
      onState: next => states.push(next),
      createId: () => `attempt-${++attempts}`,
      retry: { random: () => 0 },
    },
    {
      base: {
        modifiedTime: file.modifiedTime,
        fingerprint: toDriveFingerprint(USERS_DOCUMENT),
      },
      pendingAttempt,
      canEdit,
      state,
    }
  );
  queues.push(queue);

  const edit = (value = EDITED) => {
    tab.value = value;
    queue.notifyChange();
  };
  const requests = () =>
    drive.calls.map(
      call => `${call.method} ${call.url.pathname.replace('/file-1', '')}`
    );
  return {
    queue,
    file,
    tab,
    token,
    broadcasts,
    states,
    requestSave,
    edit,
    requests,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  drive = createFakeDrive();
});

afterEach(() => {
  queues.forEach(queue => queue.dispose());
  queues = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('debounce', () => {
  it('saves two seconds after the last change', async () => {
    const { edit, requests } = setup();

    edit();
    await settle(DEBOUNCE_MS - 1);
    edit(EDITED_AGAIN);
    await settle(DEBOUNCE_MS - 1);
    expect(requests()).toEqual([]);

    await settle(1);
    expect(requests()).toEqual([
      'GET /drive/v3/files',
      'PATCH /upload/drive/v3/files',
    ]);
  });

  it('saves within ten seconds while the edits keep coming', async () => {
    const { edit, requests } = setup();

    for (let at = 0; at < MAX_WAIT_MS; at += 1500) {
      edit(at % 3000 ? EDITED : EDITED_AGAIN);
      await settle(1500);
    }

    expect(requests()).toContain('PATCH /upload/drive/v3/files');
    expect(drive.callsTo('PATCH')[0]).toBeDefined();
  });

  it('sends nothing for view state, zoom and scroll alone', async () => {
    const { edit, requests, states } = setup();

    edit(viewed(USERS_DOCUMENT));
    await settle(MAX_WAIT_MS);

    expect(requests()).toEqual([]);
    expect(states).toEqual([]);
  });

  it('has a follower ask its leader instead of saving', async () => {
    const { edit, requests, requestSave } = setup({ leader: false });

    edit();
    await settle(DEBOUNCE_MS);

    expect(requestSave).toHaveBeenCalledTimes(1);
    expect(requests()).toEqual([]);
  });
});

describe('a save cycle', () => {
  it('checks the metadata, then PATCHes with the file’s own mimeType', async () => {
    const { queue, edit, file, broadcasts, states } = setup();

    edit();
    await queue.flush();

    const [get] = drive.callsTo('GET');
    const [patch] = drive.callsTo('PATCH');
    expect(get.url.searchParams.get('fields')).toBe(
      'id,name,mimeType,modifiedTime,size,trashed,parents,capabilities(canEdit,canRename)'
    );
    expect(patch.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(patch.url.searchParams.get('fields')).toBe('id,modifiedTime');
    expect(file.content).toBe(EDITED);
    expect(broadcasts).toEqual([
      {
        type: 'saving',
        attemptId: 'attempt-1',
        fingerprint: toDriveFingerprint(EDITED),
      },
      {
        type: 'saved',
        attemptId: 'attempt-1',
        modifiedTime: file.modifiedTime,
        fingerprint: toDriveFingerprint(EDITED),
      },
    ]);
    expect(states).toEqual(['saving', 'saved']);
    expect(queue.getBase()).toEqual({
      modifiedTime: file.modifiedTime,
      fingerprint: toDriveFingerprint(EDITED),
    });
    expect(queue.hasUnsavedChanges()).toBe(false);
  });

  it('stops on a remote change and sends no PATCH, then or later', async () => {
    const { queue, edit, states } = setup();
    drive.bumpRemote('file-1');

    edit();
    await queue.flush();
    edit(EDITED_AGAIN);
    await settle(MAX_WAIT_MS);

    expect(drive.callsTo('PATCH')).toHaveLength(0);
    expect(drive.callsTo('GET')).toHaveLength(1);
    expect(states).toEqual(['saving', 'conflict']);
    expect(queue.hasUnsavedChanges()).toBe(true);
  });

  it('stops as unconfirmed when an attempt it cannot account for may have moved the file', async () => {
    const { queue, edit } = setup({
      pendingAttempt: { attemptId: 'lost', fingerprint: 'x' },
    });
    drive.bumpRemote('file-1');

    edit();
    await queue.flush();

    expect(queue.getState()).toBe('unconfirmed');
    expect(drive.callsTo('PATCH')).toHaveLength(0);
  });

  it('drops an attempt the file shows never landed', async () => {
    const { queue, edit } = setup({
      pendingAttempt: { attemptId: 'lost', fingerprint: 'x' },
    });

    edit();
    await queue.flush();

    expect(queue.getState()).toBe('saved');
    expect(queue.getPendingAttempt()).toBeNull();
    expect(drive.callsTo('PATCH')).toHaveLength(1);
  });

  it('runs one cycle at a time, and one more for what came during it', async () => {
    const { queue, edit, tab } = setup();
    const release = drive.hold('GET');

    edit();
    const first = queue.flush();
    await settle();
    tab.value = EDITED_AGAIN;
    const second = queue.flush();
    const third = queue.flush();
    expect(third).toBe(second);
    await settle();
    expect(drive.callsTo('GET')).toHaveLength(1);

    release();
    await Promise.all([first, second]);

    expect(drive.callsTo('GET')).toHaveLength(2);
    expect(drive.callsTo('PATCH').map(call => call.body)).toEqual([
      EDITED,
      EDITED_AGAIN,
    ]);
  });

  it('retries the whole cycle after a network error, from the metadata on', async () => {
    const { queue, edit, requests } = setup();
    drive.failNetworkNext('GET');

    edit();
    const done = queue.flush();
    await settle(1000);
    await done;

    expect(requests()).toEqual([
      'GET /drive/v3/files',
      'GET /drive/v3/files',
      'PATCH /upload/drive/v3/files',
    ]);
    expect(queue.getState()).toBe('saved');
  });

  it('reads a lost PATCH answer as unconfirmed on the retry, never PATCHing twice', async () => {
    const { queue, edit, broadcasts } = setup();
    drive.loseNextResponse('PATCH');

    edit();
    const done = queue.flush();
    await settle(1000);
    await done;

    expect(drive.callsTo('PATCH')).toHaveLength(1);
    expect(queue.getState()).toBe('unconfirmed');
    expect(queue.getPendingAttempt()).toEqual({
      attemptId: 'attempt-1',
      fingerprint: toDriveFingerprint(EDITED),
    });
    expect(broadcasts.map(message => message.type)).toEqual(['saving']);
  });

  it('PATCHes again after a 5xx the file shows did not land', async () => {
    const { queue, edit } = setup();
    drive.failNext('PATCH', 503);

    edit();
    const done = queue.flush();
    await settle(1000);
    await done;

    expect(drive.callsTo('PATCH')).toHaveLength(2);
    expect(queue.getState()).toBe('saved');
  });

  it('gives up after three retries and tries again on the next change', async () => {
    const { queue, edit, file } = setup();
    for (let i = 0; i < 4; i++) drive.failNext('GET', 500);

    edit();
    const done = queue.flush();
    await settle(1000 + 2000 + 4000);
    await done;
    expect(queue.getState()).toBe('failed');
    expect(drive.callsTo('GET')).toHaveLength(4);

    edit(EDITED_AGAIN);
    await settle(DEBOUNCE_MS);
    expect(queue.getState()).toBe('saved');
    expect(file.content).toBe(EDITED_AGAIN);
  });

  it('tries a failed save again on resume', async () => {
    const { queue, edit } = setup();
    drive.failNext('PATCH', 400, 'badRequest');
    edit();
    await queue.flush();
    expect(queue.getState()).toBe('failed');

    queue.resume();
    await settle();

    expect(queue.getState()).toBe('saved');
    expect(drive.callsTo('PATCH')).toHaveLength(2);
  });

  it('tells the other tabs of a PATCH Drive refused', async () => {
    const { queue, edit, broadcasts } = setup();
    drive.failNext('PATCH', 400, 'badRequest');

    edit();
    await queue.flush();

    expect(broadcasts.map(message => message.type)).toEqual([
      'saving',
      'failed',
    ]);
    expect(queue.getState()).toBe('failed');
    expect(queue.getPendingAttempt()).toBeNull();
  });

  it.each<[string, () => void, SaveState]>([
    [
      'a file gone from Drive',
      () => drive.failNext('GET', 404, 'notFound'),
      'deleted',
    ],
    [
      'a file in the trash',
      () => (drive.files.get('file-1')!.trashed = true),
      'deleted',
    ],
    [
      'a file shared read-only since',
      () => (drive.files.get('file-1')!.canEdit = false),
      'readonly',
    ],
    [
      'a PATCH refused for its permissions',
      () => drive.failNext('PATCH', 403, 'insufficientFilePermissions'),
      'readonly',
    ],
    [
      'a token without drive.file',
      () => drive.failNext('GET', 403, 'insufficientPermissions'),
      'scope-missing',
    ],
    ['an expired token Drive refuses', () => drive.tokens.clear(), 'paused'],
  ])('stops on %s', async (_name, arrange, expected) => {
    const { queue, edit } = setup();
    arrange();

    edit();
    await queue.flush();

    expect(queue.getState()).toBe(expected);
  });

  it('never saves a file this account may only read', async () => {
    const { queue, edit, requests, states } = setup({ canEdit: false });

    expect(queue.getState()).toBe('readonly');
    edit();
    await settle(MAX_WAIT_MS);

    expect(requests()).toEqual([]);
    expect(states).toEqual([]);
  });

  it('saves at once on flush, as a hidden leader does', async () => {
    const { queue, edit } = setup();

    edit();
    await queue.flush();

    expect(drive.callsTo('PATCH')).toHaveLength(1);
    await settle(DEBOUNCE_MS);
    expect(drive.callsTo('PATCH')).toHaveLength(1);
  });

  it('waits for an editor and a baseline before it compares', async () => {
    const { queue, tab } = setup();
    tab.value = null;

    await queue.flush();
    expect(drive.calls).toHaveLength(0);
    expect(queue.hasUnsavedChanges()).toBe(false);
  });
});

describe('a token that runs out in the fallback', () => {
  it('holds the edits, then saves them once after Reconnect Google', async () => {
    const { queue, edit, token, requests } = setup();
    token.status = 'fallback-expired';

    edit();
    await settle(DEBOUNCE_MS);
    edit(EDITED_AGAIN);
    await settle(MAX_WAIT_MS);
    expect(queue.getState()).toBe('paused');
    expect(requests()).toEqual([]);

    token.status = null;
    queue.resume();
    await settle();

    expect(requests()).toEqual([
      'GET /drive/v3/files',
      'PATCH /upload/drive/v3/files',
    ]);
    expect(drive.files.get('file-1')!.content).toBe(EDITED_AGAIN);
    expect(queue.getState()).toBe('saved');
  });

  it.each<[TokenStatus, SaveState]>([
    ['account-changed', 'account-changed'],
    ['scope-missing', 'scope-missing'],
    ['signed-out', 'paused'],
  ])('reads a token that is %s as %s', async (status, expected) => {
    const { queue, edit, token } = setup();
    token.status = status;

    edit();
    await queue.flush();

    expect(queue.getState()).toBe(expected);
  });

  it('saves once the grant is back after a missing scope, and never for another account', async () => {
    const { queue, edit, token, states } = setup();
    token.status = 'scope-missing';
    edit();
    await queue.flush();
    expect(queue.getState()).toBe('scope-missing');

    token.status = null;
    queue.resume();
    await settle();
    expect(queue.getState()).toBe('saved');
    expect(drive.callsTo('PATCH')).toHaveLength(1);
    expect(states).toEqual([
      'saving',
      'scope-missing',
      'paused',
      'saving',
      'saved',
    ]);

    token.status = 'account-changed';
    edit(EDITED_AGAIN);
    await queue.flush();
    token.status = null;
    queue.resume();
    await settle();
    expect(queue.getState()).toBe('account-changed');
    expect(drive.callsTo('PATCH')).toHaveLength(1);
  });

  it('resumes nothing that is not paused or failed', async () => {
    const { queue } = setup();

    queue.resume();
    await settle();

    expect(drive.calls).toHaveLength(0);
  });
});

describe('fencing a leader that lost its lock', () => {
  it('sends nothing when the lock is gone as the cycle starts', async () => {
    const { queue, edit, tab, requests } = setup();
    tab.stillLeader = false;

    edit();
    await queue.flush();

    expect(requests()).toEqual([]);
  });

  it('sends no PATCH when the lock went while the metadata was on its way', async () => {
    const { queue, edit, tab, broadcasts } = setup();
    const release = drive.hold('GET');

    edit();
    const done = queue.flush();
    await settle();
    tab.stillLeader = false;
    release();
    await done;

    expect(drive.callsTo('GET')).toHaveLength(1);
    expect(drive.callsTo('PATCH')).toHaveLength(0);
    expect(broadcasts).toEqual([]);
    expect(queue.getState()).toBe('saved');
  });

  it('announces a PATCH that went out, whoever leads by the time it lands', async () => {
    const { queue, edit, tab, broadcasts } = setup();
    const release = drive.hold('PATCH');

    edit();
    const done = queue.flush();
    await settle();
    tab.leader = false;
    release();
    await done;

    expect(broadcasts.map(message => message.type)).toEqual([
      'saving',
      'saved',
    ]);
  });
});

describe('saves from other tabs', () => {
  it('moves the base to one it never heard of, and saves over it when its content differs', async () => {
    const { queue, tab, file } = setup();
    tab.value = EDITED_AGAIN;
    drive.bumpRemote('file-1', EDITED);

    queue.onSaved({
      type: 'saved',
      attemptId: 'elsewhere',
      modifiedTime: file.modifiedTime,
      fingerprint: toDriveFingerprint(EDITED),
    });
    await settle();

    expect(drive.callsTo('PATCH')).toHaveLength(1);
    expect(file.content).toBe(EDITED_AGAIN);
    expect(queue.getState()).toBe('saved');
  });

  it('leaves the saving to the leader in a follower', async () => {
    const { queue, tab, file } = setup({ leader: false });
    tab.value = EDITED_AGAIN;

    queue.onSaved({
      type: 'saved',
      attemptId: 'elsewhere',
      modifiedTime: 'later',
      fingerprint: toDriveFingerprint(EDITED),
    });
    await settle();

    expect(queue.getBase()).toEqual({
      modifiedTime: 'later',
      fingerprint: toDriveFingerprint(EDITED),
    });
    expect(drive.calls).toHaveLength(0);
    expect(file.content).toBe(USERS_DOCUMENT);
  });

  it('keeps its base when a save it hears of is older than it, settling the attempt alone', async () => {
    const { queue } = setup();
    const base = queue.getBase();
    queue.onSaving({ attemptId: 'stale', fingerprint: 'f1' });

    queue.onSaved({
      type: 'saved',
      attemptId: 'stale',
      modifiedTime: '2026-09-25T08:59:00.000Z',
      fingerprint: toDriveFingerprint(EDITED),
    });
    await settle();

    expect(queue.getBase()).toBe(base);
    expect(queue.getPendingAttempt()).toBeNull();
    expect(queue.getState()).toBe('saved');
    expect(drive.calls).toHaveLength(0);
  });

  it('tracks the attempts it hears of until they settle', () => {
    const { queue } = setup({ leader: false });

    queue.onSaving({ attemptId: 'a1', fingerprint: 'f1' });
    expect(queue.getPendingAttempt()).toEqual({
      attemptId: 'a1',
      fingerprint: 'f1',
    });
    queue.onFailed({ attemptId: 'other' });
    expect(queue.getPendingAttempt()).not.toBeNull();
    queue.onFailed({ attemptId: 'a1' });
    expect(queue.getPendingAttempt()).toBeNull();
  });

  it('clears a conflict once a save it learns of moves the base', async () => {
    const { queue, edit, file } = setup();
    drive.bumpRemote('file-1', EDITED);
    edit(EDITED);
    await queue.flush();
    expect(queue.getState()).toBe('conflict');

    queue.onSaved({
      type: 'saved',
      attemptId: 'elsewhere',
      modifiedTime: file.modifiedTime,
      fingerprint: toDriveFingerprint(EDITED),
    });

    expect(queue.getState()).toBe('saved');
  });

  it('follows a rename that moved the base', () => {
    const { queue, file } = setup({ leader: false });

    queue.onRenamed('elsewhere', 'later');
    expect(queue.getBase().modifiedTime).toBe(file.modifiedTime);
    queue.onRenamed(file.modifiedTime, 'later');
    expect(queue.getBase().modifiedTime).toBe('later');
  });
});

describe('checkUnconfirmed (Check Drive)', () => {
  async function unconfirmed(landed: string) {
    const context = setup({
      pendingAttempt: {
        attemptId: 'lost',
        fingerprint: toDriveFingerprint(EDITED),
      },
      state: 'unconfirmed',
    });
    drive.bumpRemote('file-1', landed);
    return context;
  }

  it('resumes when Drive holds what the attempt sent, moving only the base', async () => {
    const { queue, tab, file, broadcasts } = await unconfirmed(EDITED);
    tab.value = EDITED;

    expect(await queue.checkUnconfirmed()).toBe('resumed');

    expect(queue.getState()).toBe('saved');
    expect(queue.getBase()).toEqual({
      modifiedTime: file.modifiedTime,
      fingerprint: toDriveFingerprint(EDITED),
    });
    expect(broadcasts).toEqual([
      {
        type: 'saved',
        attemptId: 'lost',
        modifiedTime: file.modifiedTime,
        fingerprint: toDriveFingerprint(EDITED),
      },
    ]);
    expect(drive.callsTo('PATCH')).toHaveLength(0);
  });

  it('saves what was edited since, once resumed', async () => {
    const { queue, tab, file } = await unconfirmed(EDITED);
    tab.value = EDITED_AGAIN;

    await queue.checkUnconfirmed();
    await settle();

    expect(file.content).toBe(EDITED_AGAIN);
  });

  it('turns into a conflict when Drive holds anything else', async () => {
    const { queue, file } = await unconfirmed(EDITED_AGAIN);

    expect(await queue.checkUnconfirmed()).toBe('conflict');
    expect(queue.getState()).toBe('conflict');
    expect(file.content).toBe(EDITED_AGAIN);
  });

  it('reads content that is no document as a conflict', async () => {
    const { queue } = await unconfirmed('not json');

    expect(await queue.checkUnconfirmed()).toBe('conflict');
  });

  it('stays unconfirmed when Drive cannot be read', async () => {
    const { queue } = await unconfirmed(EDITED);
    drive.failNext('GET', 404, 'notFound');

    expect(await queue.checkUnconfirmed()).toBe('failed');
    expect(queue.getState()).toBe('unconfirmed');
  });

  it('turns into a conflict once the attempt it waited on fails, in the leader alone', async () => {
    const pendingAttempt = { attemptId: 'old', fingerprint: 'x' };
    const follower = setup({
      leader: false,
      pendingAttempt,
      state: 'unconfirmed',
    });
    follower.queue.onFailed({ attemptId: 'old' });
    expect(follower.queue.getState()).toBe('unconfirmed');

    const { queue } = setup({ pendingAttempt, state: 'unconfirmed' });
    queue.onFailed({ attemptId: 'other' });
    expect(queue.getState()).toBe('unconfirmed');
    queue.onFailed({ attemptId: 'old' });
    expect(queue.getState()).toBe('conflict');
  });

  it('reads unconfirmed with no attempt left as a conflict, reading nothing', async () => {
    const { queue } = setup({ state: 'unconfirmed' });

    expect(await queue.checkUnconfirmed()).toBe('conflict');
    expect(queue.getState()).toBe('conflict');
    expect(drive.calls).toHaveLength(0);
  });

  it('skips a queue that is not unconfirmed', async () => {
    const { queue } = setup();

    expect(await queue.checkUnconfirmed()).toBe('skipped');
    expect(drive.calls).toHaveLength(0);
  });
});

describe('afterElection', () => {
  it('saves at once what the old leader left unsaved', async () => {
    const { queue, tab } = setup();
    tab.value = EDITED;

    await queue.afterElection(false);

    expect(drive.callsTo('PATCH')).toHaveLength(1);
  });

  it('waits after a steal for the attempt announced, then checks Drive', async () => {
    const { queue, file, tab } = setup({
      pendingAttempt: {
        attemptId: 'old',
        fingerprint: toDriveFingerprint(EDITED),
      },
    });
    tab.value = EDITED;
    const done = queue.afterElection(true);
    await settle(1000);
    expect(drive.calls).toHaveLength(0);

    drive.bumpRemote('file-1', EDITED);
    queue.onSaved({
      type: 'saved',
      attemptId: 'old',
      modifiedTime: file.modifiedTime,
      fingerprint: toDriveFingerprint(EDITED),
    });
    await done;

    expect(drive.callsTo('GET')).toHaveLength(1);
    expect(queue.getState()).toBe('saved');
  });

  it('stops as unconfirmed when no answer came and the file moved', async () => {
    const { queue } = setup({
      pendingAttempt: {
        attemptId: 'old',
        fingerprint: toDriveFingerprint(EDITED),
      },
    });
    drive.bumpRemote('file-1', EDITED);

    const done = queue.afterElection(true);
    await settle(STEAL_SETTLE_MS);
    await done;

    expect(queue.getState()).toBe('unconfirmed');
    expect(drive.callsTo('PATCH')).toHaveLength(0);
  });

  it('carries on when the attempt failed and the file never moved', async () => {
    const { queue, tab } = setup({
      pendingAttempt: {
        attemptId: 'old',
        fingerprint: toDriveFingerprint(EDITED),
      },
    });
    tab.value = EDITED;

    const done = queue.afterElection(true);
    queue.onFailed({ attemptId: 'old' });
    await done;

    expect(drive.callsTo('PATCH')).toHaveLength(1);
    expect(queue.getState()).toBe('saved');
  });

  it('reads a failed check after a steal by its error', async () => {
    const { queue } = setup({
      pendingAttempt: { attemptId: 'old', fingerprint: 'x' },
    });
    drive.failNext('GET', 404, 'notFound');

    const done = queue.afterElection(true);
    await settle(STEAL_SETTLE_MS);
    await done;

    expect(queue.getState()).toBe('deleted');
  });
});

describe('rename', () => {
  it('waits for the save under way, then moves the base with the rename', async () => {
    const { queue, edit, file } = setup();
    const release = drive.hold('PATCH');

    edit();
    const saving = queue.flush();
    await settle();
    const renaming = queue.rename('orders.erd');
    await settle();
    expect(drive.callsTo('PATCH').map(call => call.url.pathname)).toEqual([
      '/upload/drive/v3/files/file-1',
    ]);

    release();
    await saving;
    const result = await renaming;

    expect(file.name).toBe('orders.erd');
    expect(result).toEqual({
      name: 'orders.erd',
      from: expect.any(String),
      to: file.modifiedTime,
    });
    expect(queue.getBase().modifiedTime).toBe(file.modifiedTime);

    edit(EDITED_AGAIN);
    await queue.flush();
    expect(queue.getState()).toBe('saved');
  });

  it('keeps the base where it was when the file had moved already', async () => {
    const { queue, file } = setup();
    const base = queue.getBase().modifiedTime;
    drive.bumpRemote('file-1');

    const result = await queue.rename('orders.erd');

    expect(result.from).not.toBe(base);
    expect(queue.getBase().modifiedTime).toBe(base);
    expect(file.name).toBe('orders.erd');
  });
});

describe('the queue’s own state', () => {
  it('keeps what a stopped predecessor stopped on, and nothing else', () => {
    const { queue, states } = setup({ leader: false });

    queue.inherit('saving');
    queue.inherit(null);
    expect(queue.getState()).toBe('saved');
    queue.inherit('conflict');
    expect(states).toEqual(['conflict']);
  });

  it('starts over on a reset, readonly when the file is', () => {
    const { queue } = setup({ state: 'conflict' });

    queue.reset({
      base: { modifiedTime: 'later', fingerprint: 'f' },
      pendingAttempt: null,
      canEdit: false,
    });

    expect(queue.getState()).toBe('readonly');
    expect(queue.getBase()).toEqual({
      modifiedTime: 'later',
      fingerprint: 'f',
    });
  });

  it('sets its baseline once the editor has the document', () => {
    const { queue } = setup();

    queue.setBaseFingerprint('f');

    expect(queue.getBase().fingerprint).toBe('f');
  });

  it('does nothing once disposed', async () => {
    const { queue, edit } = setup();

    queue.dispose();
    edit();
    await queue.flush();
    await settle(MAX_WAIT_MS);

    expect(drive.calls).toHaveLength(0);
  });

  it('counts a full Drive as a failed save', async () => {
    const { queue, edit } = setup();
    drive.failNext('PATCH', 403, 'storageQuotaExceeded');

    edit();
    await queue.flush();

    expect(queue.getState()).toBe('failed');
  });

  it('counts an error of no known kind as a failed save', async () => {
    const { queue, tab } = setup();
    tab.value = '{"doc":';

    await queue.flush();

    expect(queue.getState()).toBe('failed');
    expect(drive.calls).toHaveLength(0);
  });
});

import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import * as discovery from '@/discovery';
import * as framing from '@/framing';
import * as publicApi from '@/index';
import * as lock from '@/lock';
import * as paths from '@/paths';
import * as protocol from '@/protocol';

describe('public api surface', () => {
  it('exports exactly the runtime members of the barrel', () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [
        'assertAuthorized',
        'createFrameDecoder',
        'encodeFrame',
        'HUB_NOTIFICATION_METHODS',
        'HUB_PROTOCOL_VERSION',
        'HUB_REQUEST_METHODS',
        'HubErrorCode',
        'HubRequestError',
        'isAuthorized',
        'isInside',
        'isSamePath',
        'LOCK_DIR_MODE',
        'LOCK_FILE_MODE',
        'lockDirPath',
        'lockFilePath',
        'lockFilePid',
        'longestPrefixIndex',
        'MAX_FRAME_BYTES',
        'MAX_PIPE_PATH_BYTES',
        'parseLock',
        'pipePath',
        'pipePathFits',
        'protocolMismatchMessage',
        'selectHub',
        'serializeLock',
        'toSegments',
      ].sort()
    );
  });

  it('re-exports the message types, direction types included', () => {
    expectTypeOf<publicApi.PeerToHubMessage>().toEqualTypeOf<protocol.PeerToHubMessage>();
    expectTypeOf<publicApi.HubToPeerMessage>().toEqualTypeOf<protocol.HubToPeerMessage>();
    expectTypeOf<publicApi.HubRequestParams['applyActions']>().toEqualTypeOf<
      protocol.HubRequestParams['applyActions']
    >();
  });

  it('re-exports every runtime member of every module by identity', () => {
    for (const module of [discovery, framing, lock, paths, protocol]) {
      for (const [name, value] of Object.entries(module)) {
        expect(publicApi[name as keyof typeof publicApi]).toBe(value);
      }
    }
  });
});

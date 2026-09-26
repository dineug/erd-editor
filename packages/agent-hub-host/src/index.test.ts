import { describe, expect, it } from 'vite-plus/test';

import * as publicApi from '@/index';
import * as lockFile from '@/lockFile';
import * as documentHub from '@/services/DocumentHub';
import * as hubEnvironment from '@/services/HubEnvironment';
import * as hubListener from '@/services/HubListener';
import * as hubLogger from '@/services/HubLogger';
import * as nativeFileSystem from '@/services/nativeFileSystem';

describe('public api surface', () => {
  it('exports exactly the runtime members of the barrel', () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [
        'actionType',
        'actionVersion',
        'assertErdFile',
        'authorizePath',
        'choosePipePath',
        'closedBeforeSave',
        'closedDuringJoin',
        'createNeedsInitialValue',
        'createQuietState',
        'DocumentHub',
        'documentHubLayer',
        'drainJoinQueue',
        'dropRecipient',
        'editorCouldNotOpen',
        'ERD_FILE_EXTENSIONS',
        'erdFileProblem',
        'fileMissing',
        'filterJoinQueue',
        'folderMissing',
        'fromNetSocket',
        'hasChangeAction',
        'HubDocuments',
        'HubEnvError',
        'HubEnvironment',
        'hubEnvironmentLayer',
        'HubHandlerService',
        'HubHost',
        'HubListener',
        'hubListenerLayer',
        'HubListenError',
        'hubLoggerLayer',
        'JOIN_QUIET_CAP_MS',
        'LockFile',
        'lockFileLayer',
        'makeNodeEnvironment',
        'maxVersion',
        'nativeFileSystemLayer',
        'nodeHubServices',
        'noteChange',
        'noteSave',
        'notJoined',
        'notOpenInEditor',
        'notReadyForActions',
        'OPEN_READY_TIMEOUT_MS',
        'openTimedOut',
        'realpathOrSelf',
        'REPLICA_DEBOUNCE_MS',
        'resolveRealPath',
        'SAVE_QUIET_CAP_MS',
        'serveConnection',
        'socketFilePaths',
        'stripBom',
        'tmpPipePath',
        'unsettledSave',
        'waitForQuiet',
        'warnUnsafe',
        'withDocumentHub',
        'withNativeRealPath',
      ].sort()
    );
  });

  it('renames each module layer after its service, since six modules call theirs layer', () => {
    expect(publicApi.lockFileLayer).toBe(lockFile.layer);
    expect(publicApi.documentHubLayer).toBe(documentHub.layer);
    expect(publicApi.hubEnvironmentLayer).toBe(hubEnvironment.layer);
    expect(publicApi.hubListenerLayer).toBe(hubListener.layer);
    expect(publicApi.hubLoggerLayer).toBe(hubLogger.layer);
    expect(publicApi.nativeFileSystemLayer).toBe(nativeFileSystem.layer);
  });
});

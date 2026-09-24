export {
  browserStorage,
  type RelayToken,
  type RelayTokenResult,
} from '@/services/gdrive/authMode';
export {
  type Availability,
  checkAvailability,
  configuredClientId,
  isFramed,
  isSupportedOrigin,
  PRODUCTION_ORIGIN,
  readClientId,
} from '@/services/gdrive/availability';
export {
  createDriveClient,
  type DriveClient,
  type DriveClientDeps,
  DriveError,
  type DriveErrorKind,
  type DriveFile,
  type DriveRenameResult,
  type DriveSaveResult,
  type NewDriveFile,
  withRetry,
} from '@/services/gdrive/driveClient';
export {
  DRIVE_EXTENSIONS,
  type DriveFileName,
  isDriveDocumentName,
  NEW_FILE_EXTENSION,
  NEW_FILE_MIME_TYPE,
  renameKeepingExtension,
  splitDriveFileName,
  toDownloadFileName,
  toNewFileName,
} from '@/services/gdrive/driveFileName';
export {
  GisBlockedError,
  type GisOAuth2,
  loadGis,
} from '@/services/gdrive/gis';
export type { PopupWindowLike } from '@/services/gdrive/oauthPopup';
export {
  type DriveState,
  isStateForAccount,
  type ParsedDriveState,
  parseDriveState,
} from '@/services/gdrive/stateParam';
export {
  createTokenManager,
  type GoogleAccount,
  type RelayMode,
  type SignInResult,
  type TokenManager,
  type TokenManagerDeps,
  type TokenSnapshot,
  type TokenStatus,
  TokenUnavailableError,
} from '@/services/gdrive/tokenManager';
export type {
  ChannelLike,
  CreateChannel,
  FetchLike,
  LockManagerLike,
  StorageLike,
} from '@/services/gdrive/types';

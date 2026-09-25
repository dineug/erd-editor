export { browserStorage } from '@/services/gdrive/authMode';
export {
  checkAvailability,
  configuredClientId,
  isFramed,
} from '@/services/gdrive/availability';
export type {
  DocumentController,
  DocumentSnapshot,
  EditorAdapter,
} from '@/services/gdrive/documentController';
export { createDriveClient } from '@/services/gdrive/driveClient';
export { toNewFileName } from '@/services/gdrive/driveFileName';
export type {
  DocumentRejection,
  SaveState,
} from '@/services/gdrive/fileChannel';
export { browserLocks } from '@/services/gdrive/fileLeader';
export { loadGis } from '@/services/gdrive/gis';
export {
  createGdriveSession,
  type CreateRequest,
  type GdriveSession,
  type LeaveRequest,
  type SessionLocation,
  type SessionNotice,
  type SessionSnapshot,
} from '@/services/gdrive/session';
export {
  AUTH_CONTROL_ATTRIBUTE,
  createTokenManager,
  type TokenSnapshot,
} from '@/services/gdrive/tokenManager';
export type { FetchLike } from '@/services/gdrive/types';

import { ExportedStore } from '.';

export interface Snapshot {
  metadata?: SnapshotMetadata;
  data: ExportedStore;
}

export interface SnapshotMetadata {
  filename: string;
  type: 'before-import' | 'after-import' | 'before-export' | 'after-export';
}

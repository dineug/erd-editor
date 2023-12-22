import { Statement } from '@/core/parser';

import { ExportedStore } from '.';

export interface Snapshot {
  metadata?: SnapshotMetadata;
  data: ExportedStore;
}

export interface SnapshotMetadata {
  filename: string;
  type:
    | 'before-import'
    | 'after-import'
    | 'before-export'
    | 'after-export'
    | 'user';
  statements?: Statement[];
}

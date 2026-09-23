import { createSharedStreamActionsCompressor } from '@/engine/rx-operators/createSharedStreamActionsCompressor';

/** The editor's compressor: a 200 ms quiet period closes each stream group. */
export const sharedStreamActionsCompressor =
  createSharedStreamActionsCompressor();

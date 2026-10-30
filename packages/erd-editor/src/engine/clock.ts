import { isNumber } from 'es-toolkit';

/** The low bits of a version, which hold its writer's slot under the counter. */
export const VERSION_SLOT_BITS = 22;

/** One step of the counter: a version is the counter times this, plus a slot. */
export const SLOT_BASE = 2 ** VERSION_SLOT_BITS;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * The slot an editor's versions carry: the low 22 bits of the FNV-1a hash of
 * its id, so two editors writing at one counter rarely write one version. It
 * names nobody, since two ids can share a slot, and nothing reads it back.
 */
export function slotOf(editorId: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < editorId.length; index++) {
    hash ^= editorId.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash & (SLOT_BASE - 1);
}

export class Clock {
  #version = 0;
  #slot = 0;

  /**
   * The highest version merged, slot bits and all. A stamp merges nothing: a
   * store merges the versions of its own batches once it has reduced them.
   */
  readonly getVersion = (): number => {
    return this.#version;
  };

  /** The counter above the one the highest version seen holds, with this clock's slot. */
  readonly getNextVersion = (): number => {
    return (
      (Math.floor(this.getVersion() / SLOT_BASE) + 1) * SLOT_BASE + this.#slot
    );
  };

  /** Sets the slot the next versions carry; one outside the slot bits is ignored. */
  readonly setSlot = (slot: number): this => {
    if (Number.isInteger(slot) && 0 <= slot && slot < SLOT_BASE) {
      this.#slot = slot;
    }

    return this;
  };

  readonly merge = (remoteVersion?: number): this => {
    if (!isNumber(remoteVersion) || !Number.isInteger(remoteVersion))
      return this;

    if (this.getVersion() < remoteVersion) {
      this.#version = remoteVersion;
    }

    return this;
  };
}

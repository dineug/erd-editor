import { describe, expect, it, vi } from 'vite-plus/test';

import {
  currentValue,
  exitSave,
  hasUnsavedValue,
  seedValue,
  type TabSaveState,
  viewData,
} from '@/tabSave';

const OPENED = '{"doc":"opened"}';
const EDITED = '{"doc":"edited"}';
const WRITTEN = '{"doc":"written by the tab that closed"}';
const RUNTIME = '{"doc":"edited","removed":"kept for an undo"}';

const disk = (text: string | null) => vi.fn(() => text);

const writer: TabSaveState = {
  unreadable: false,
  seeding: false,
  writer: true,
  loaded: OPENED,
  replica: null,
  saved: OPENED,
};

describe('viewData', () => {
  it('hands back the loaded text until the replica sends a value, so opening never rewrites the file', () => {
    expect(viewData(writer)).toBe(OPENED);
    expect(hasUnsavedValue(writer)).toBe(false);
  });

  it("hands back the writer's replica value, which then differs from what the file holds", () => {
    const edited = { ...writer, replica: EDITED };
    expect(viewData(edited)).toBe(EDITED);
    expect(currentValue(edited)).toBe(EDITED);
    expect(hasUnsavedValue(edited)).toBe(true);
  });

  it('hands back what the file holds from a tab that is not the writer, so two tabs never write', () => {
    const second = {
      ...writer,
      writer: false,
      replica: EDITED,
      saved: WRITTEN,
    };
    expect(viewData(second)).toBe(WRITTEN);
    expect(hasUnsavedValue(second)).toBe(false);
    expect(viewData({ ...second, saved: null })).toBe(OPENED);
  });

  it('hands back the text of an unreadable file, never an empty diagram, and has nothing to save', () => {
    const broken = {
      ...writer,
      unreadable: true,
      loaded: '<<<<<<<',
      saved: '<<<<<<<',
    };
    expect(viewData(broken)).toBe('<<<<<<<');
    expect(hasUnsavedValue({ ...broken, saved: 'other' })).toBe(false);
  });

  it('has nothing to save before Obsidian loaded the file', () => {
    expect(hasUnsavedValue({ ...writer, replica: EDITED, saved: null })).toBe(
      false
    );
  });
});

describe('a tab still waiting to load that became the writer', () => {
  // The first tab closed during the wait and wrote the file; Obsidian's modify
  // handler moved saved to that text, while the tab's own text is from when it opened.
  const waiting: TabSaveState = {
    ...writer,
    seeding: true,
    loaded: OPENED,
    saved: WRITTEN,
  };

  it('hands back what the file holds, never its open-time text, so closing writes nothing', () => {
    expect(viewData(waiting)).toBe(WRITTEN);
    expect(viewData(waiting)).not.toBe(OPENED);
  });

  it('reports no unsaved value, so quitting adds no quit task', () => {
    expect(hasUnsavedValue(waiting)).toBe(false);
  });

  it('holds what the file holds, so erd_save finds nothing left to write', () => {
    expect(currentValue(waiting)).toBe(WRITTEN);
    expect(currentValue({ ...waiting, saved: null })).toBe(OPENED);
  });

  it('writes again once loaded, from its replica', () => {
    const loaded = {
      ...waiting,
      seeding: false,
      loaded: WRITTEN,
      replica: EDITED,
    };
    expect(viewData(loaded)).toBe(EDITED);
    expect(hasUnsavedValue(loaded)).toBe(true);
  });
});

describe('exitSave', () => {
  const edited: TabSaveState = { ...writer, replica: EDITED };

  it('has nothing to write, and reads no file, for a tab with no unsaved value', () => {
    const readFile = disk(OPENED);
    for (const state of [
      writer,
      { ...edited, writer: false },
      { ...edited, seeding: true, saved: WRITTEN },
      { ...edited, unreadable: true },
      { ...edited, saved: null },
    ]) {
      expect(exitSave(state, false, readFile)).toBe('none');
    }
    expect(readFile).not.toHaveBeenCalled();
  });

  it('leaves the value to a quit task while a write is under way, without reading the file', () => {
    const readFile = disk(OPENED);
    expect(exitSave(edited, true, readFile)).toBe('defer');
    expect(readFile).not.toHaveBeenCalled();
  });

  it('writes when the file holds exactly what the tab last loaded or saved', () => {
    expect(exitSave(edited, false, disk(OPENED))).toBe('write');
  });

  it('reads a file opened with a byte order mark as what Obsidian handed the tab, which lacks it', () => {
    expect(exitSave(edited, false, disk(`﻿${OPENED}`))).toBe('write');
    expect(exitSave(edited, false, disk(`﻿﻿${OPENED}`))).toBe('conflict');
  });

  it('leaves an outside change, or a write not yet done, as the file holds it', () => {
    expect(exitSave(edited, false, disk(WRITTEN))).toBe('conflict');
    expect(exitSave(edited, false, disk(OPENED.slice(0, 5)))).toBe('conflict');
  });

  it('leaves the value to a quit task when the file cannot be read', () => {
    expect(exitSave(edited, false, disk(null))).toBe('defer');
  });
});

describe('seedValue', () => {
  const sources = {
    runtimeValue: null,
    peer: undefined,
    handed: undefined,
    file: null,
    opened: OPENED,
  };

  it("keeps another tab's replica value first as the loaded text", () => {
    expect(
      seedValue({ ...sources, peer: EDITED, handed: WRITTEN, file: OPENED })
        .loaded
    ).toBe(EDITED);
  });

  it('with no other tab holding the document, keeps what the last writer handed Obsidian, ahead of a modify event still on its way', () => {
    expect(
      seedValue({ ...sources, handed: WRITTEN, file: OPENED }).loaded
    ).toBe(WRITTEN);
  });

  it('else the text Obsidian last gave the tab, else the one it opened with', () => {
    expect(seedValue({ ...sources, file: WRITTEN }).loaded).toBe(WRITTEN);
    expect(seedValue(sources).loaded).toBe(OPENED);
  });

  it('starts the editor from the loaded text while no replica has saved a runtime value', () => {
    expect(seedValue({ ...sources, peer: EDITED })).toEqual({
      loaded: EDITED,
      initialValue: EDITED,
    });
  });

  it("starts the editor from the runtime value the file's tabs last saved, and keeps the file form as the loaded text", () => {
    expect(
      seedValue({ ...sources, runtimeValue: RUNTIME, peer: EDITED })
    ).toEqual({ loaded: EDITED, initialValue: RUNTIME });
  });

  it('leaves a tab seeded from the runtime value nothing but the file form to hand back, as the writer too', () => {
    const { loaded } = seedValue({
      ...sources,
      runtimeValue: RUNTIME,
      peer: EDITED,
    });
    // The first tab closed after writing the file, which made this one the writer.
    const seeded = { ...writer, loaded, saved: WRITTEN };

    expect(viewData(seeded)).toBe(EDITED);
    expect(currentValue(seeded)).toBe(EDITED);
    expect(viewData({ ...seeded, writer: false })).toBe(WRITTEN);
    expect(exitSave(seeded, false, disk(WRITTEN))).toBe('write');
  });
});

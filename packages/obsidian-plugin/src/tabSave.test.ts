import { describe, expect, it } from 'vite-plus/test';

import {
  currentValue,
  hasUnsavedValue,
  seedValue,
  type TabSaveState,
  viewData,
} from '@/tabSave';

const OPENED = '{"doc":"opened"}';
const EDITED = '{"doc":"edited"}';
const WRITTEN = '{"doc":"written by the tab that closed"}';

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

describe('seedValue', () => {
  it("starts from another tab's replica value first", () => {
    expect(
      seedValue({ peer: EDITED, handed: WRITTEN, file: OPENED, opened: OPENED })
    ).toBe(EDITED);
  });

  it('with no other tab holding the document, starts from what the last writer handed Obsidian, ahead of a modify event still on its way', () => {
    expect(
      seedValue({
        peer: undefined,
        handed: WRITTEN,
        file: OPENED,
        opened: OPENED,
      })
    ).toBe(WRITTEN);
  });

  it('else from the text Obsidian last gave the tab, else the one it opened with', () => {
    expect(
      seedValue({
        peer: undefined,
        handed: undefined,
        file: WRITTEN,
        opened: OPENED,
      })
    ).toBe(WRITTEN);
    expect(
      seedValue({
        peer: undefined,
        handed: undefined,
        file: null,
        opened: OPENED,
      })
    ).toBe(OPENED);
  });
});

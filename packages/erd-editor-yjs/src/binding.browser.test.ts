import type { ErdEditorElement } from '@dineug/erd-editor';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

// The element declares its shadow root closed; opened here, before the tag is
// defined, the spec reaches the canvas, the tabs and the zoom it presses.
const attachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function (init: ShadowRootInit) {
  return attachShadow.call(this, { ...init, mode: 'open' });
};

// yjs complains as a second copy of it loads, so whatever reaches it loads once
// the spy listens: the binding, the fake room and the provider the dev page uses.
const consoleError = vi.spyOn(console, 'error');
const Y = await import('yjs');
const { createFakeRoom } = await import('@/__test-utils__/fakeProvider');
await import('y-websocket');
const { addTable } = await import('@/__test-utils__/edits');
const { sortedValue } = await import('@/__test-utils__/scenarios');
const { bindErdEditor, bindPeerStore } = await import('@/binding');
const { isLogged, isTracker } = await import('@/classify');
const { getLog, isLogEntry } = await import('@/log');
const { getSnapshotMap, readSnapshot } = await import('@/snapshot');
const { AWARENESS_FIELD } = await import('@/awareness');
const { createPeerStore } = await import('@dineug/erd-editor/peer.js');
await import('@dineug/erd-editor/erd-editor.js');

const MOUSE_TRACKER = 'editor.sharedMouseTracker';

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

const later = (cleanup: () => void) => cleanups.push(cleanup);

function mountEditor(): ErdEditorElement {
  const editor = document.createElement('erd-editor');
  editor.systemDarkMode = false;
  editor.enableThemeBuilder = false;
  editor.enableLocalePicker = false;
  editor.enableWelcomeScreen = false;
  editor.setAttribute('style', 'display: block; width: 900px; height: 600px;');
  document.body.append(editor);
  later(() => editor.remove());
  return editor;
}

const shadowOf = (editor: ErdEditorElement): ShadowRoot => editor.shadowRoot!;

/** The listed tables of a value; the file form leaves out a list that holds nothing. */
const tableIdsIn = (value: string): string[] =>
  JSON.parse(value).doc.tableIds ?? [];

const tableIdsOf = (editor: ErdEditorElement): string[] =>
  tableIdsIn(editor.value);

/** Presses the editor's own shortcut for a new table, as a reader does. */
async function pressAddTable(editor: ErdEditorElement) {
  const count = tableIdsOf(editor).length;
  editor.focus();
  await userEvent.keyboard('{Alt>}n{/Alt}');
  await expect.poll(() => tableIdsOf(editor)).toHaveLength(count + 1);
}

const entryTypesOf = (doc: InstanceType<typeof Y.Doc>): string[] =>
  getLog(doc)
    .toArray()
    .filter(isLogEntry)
    .flatMap(entry => entry.actions.map(action => action.type));

const zoomReadout = (editor: ErdEditorElement) =>
  shadowOf(editor).querySelector('.zoom-level')?.textContent ?? null;

const tabButton = (editor: ErdEditorElement, title: string) =>
  shadowOf(editor).querySelector<HTMLElement>(`.toolbar [title="${title}"]`)!;

const ERD_TAB = 'Entity Relationship Diagram';
const DICTIONARY_TAB = 'Dictionary';

describe('an element bound in a real browser', () => {
  it('AC-A5 loads one copy of yjs for the binding, the room and the provider', () => {
    const messages = consoleError.mock.calls.map(args => args.join(' '));
    expect(
      messages.filter(text => /Yjs was already imported/.test(text))
    ).toEqual([]);
  });

  it('AC-A5 an edit on one element shows on another bound through a second Y.Doc', async () => {
    const room = createFakeRoom();
    later(room.destroy);
    const left = room.join();
    const right = room.join();
    const a = mountEditor();
    const b = mountEditor();
    const bindingA = bindErdEditor(a, left.doc, { awareness: left.awareness });
    later(bindingA.destroy);
    expect(bindingA.seed()).toBe(true);
    const bindingB = bindErdEditor(b, right.doc, {
      awareness: right.awareness,
    });
    later(bindingB.destroy);

    await pressAddTable(a);
    await expect.poll(() => tableIdsOf(b)).toEqual(tableIdsOf(a));
    await expect.poll(() => sortedValue(b.value)).toEqual(sortedValue(a.value));
    expect(entryTypesOf(right.doc)).toContain('table.add');
  });

  it('AC-A5 a Y.Doc restored with its log, as a persistence provider hands it back, opens a new element on that content', async () => {
    const first = new Y.Doc();
    later(() => first.destroy());
    const writer = mountEditor();
    const writing = bindErdEditor(writer, first);
    expect(writing.seed()).toBe(true);
    await pressAddTable(writer);
    await pressAddTable(writer);
    writing.destroy();

    const restored = new Y.Doc();
    later(() => restored.destroy());
    Y.applyUpdate(restored, Y.encodeStateAsUpdate(first));
    // The seed held no table, so both are entries of the log alone.
    const read = readSnapshot(getSnapshotMap(restored));
    expect(read).toMatchObject({ state: 'ready', snapshot: { generation: 0 } });
    expect(entryTypesOf(restored)).toEqual(['table.add', 'table.add']);

    const reader = mountEditor();
    const reading = bindErdEditor(reader, restored);
    later(reading.destroy);
    expect(reading.seed()).toBe(false);
    await expect.poll(() => tableIdsOf(reader)).toHaveLength(2);
    expect(sortedValue(reader.value)).toEqual(sortedValue(writer.value));
  });

  it('AC-A5 a mouse move on the element leaves as its cursor through Awareness alone, never the log', async () => {
    const room = createFakeRoom();
    later(room.destroy);
    const left = room.join();
    const right = room.join();
    const a = mountEditor();
    const bindingA = bindErdEditor(a, left.doc, {
      awareness: left.awareness,
      getNickname: () => 'left',
    });
    later(bindingA.destroy);
    expect(bindingA.seed()).toBe(true);

    const canvasOf = () =>
      shadowOf(a).querySelector<HTMLElement>('[data-testid="erd-canvas"]');
    await expect.poll(canvasOf).not.toBeNull();
    await userEvent.hover(canvasOf()!, { position: { x: 200, y: 160 } });
    await userEvent.hover(canvasOf()!, { position: { x: 320, y: 240 } });

    const sentBy = (state: Record<string, any> | null | undefined) =>
      state?.[AWARENESS_FIELD]?.trackers?.[MOUSE_TRACKER];
    await expect
      .poll(() => sentBy(left.awareness.getLocalState()))
      .toMatchObject({
        type: MOUSE_TRACKER,
        payload: { x: expect.any(Number) },
      });
    await expect
      .poll(() => sentBy(right.awareness.getStates().get(left.doc.clientID)))
      .toMatchObject({ type: MOUSE_TRACKER });

    expect(isTracker(MOUSE_TRACKER)).toBe(true);
    expect(isLogged(MOUSE_TRACKER)).toBe(false);
    expect(entryTypesOf(left.doc)).not.toContain(MOUSE_TRACKER);
    expect(entryTypesOf(right.doc)).not.toContain(MOUSE_TRACKER);
  });

  it("AC-A3 an element away through a compaction reopens on the snapshot with the batch it made away, its zoom and tab kept and its value the peer's", async () => {
    const room = createFakeRoom();
    later(room.destroy);
    const away = room.join();
    const online = room.join();
    const peer = createPeerStore({ nickname: 'compactor', presence: false });
    later(peer.destroy);
    const compactor = bindPeerStore(peer, online.doc, {
      synced: Promise.resolve(),
    });
    later(compactor.destroy);
    expect(compactor.seed()).toBe(true);

    const editor = mountEditor();
    const binding = bindErdEditor(editor, away.doc);
    later(binding.destroy);
    const rejoins: string[] = [];
    binding.on('rejoin', reason => rejoins.push(reason));

    await expect.poll(() => zoomReadout(editor)).toBe('100%');
    await userEvent.click(
      shadowOf(editor).querySelector<HTMLElement>('[title^="Zoom in"]')!
    );
    await expect.poll(() => zoomReadout(editor)).toBe('104%');

    away.disconnect();
    await pressAddTable(editor);
    const [madeAway] = tableIdsOf(editor);
    await userEvent.click(tabButton(editor, DICTIONARY_TAB));
    await expect
      .poll(() =>
        tabButton(editor, DICTIONARY_TAB).classList.contains('active')
      )
      .toBe(true);
    const fromPeer = addTable(peer, 'while away');
    expect(compactor.compact()).toMatchObject({ compacted: true });
    expect(entryTypesOf(online.doc)).toEqual([]);

    away.connect();
    expect(rejoins).toEqual(['snapshot']);
    // The batch made away stays, replayed over the snapshot that lacks it.
    expect(tableIdsIn(peer.value).sort()).toEqual([madeAway, fromPeer].sort());
    await expect
      .poll(() => sortedValue(editor.value))
      .toEqual(sortedValue(peer.value));
    expect(tabButton(editor, DICTIONARY_TAB).classList.contains('active')).toBe(
      true
    );

    await userEvent.click(tabButton(editor, ERD_TAB));
    await expect.poll(() => zoomReadout(editor)).toBe('104%');
  });
});

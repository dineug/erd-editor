import { AnyAction } from '@dineug/r-html';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vite-plus/test';

import { Open } from '@/constants/open';
import {
  EditStateOpenActionTypes,
  opensEditDialog,
  ReadonlyIgnoreActionTypes,
} from '@/engine/actions';
import { readonlyIgnoreFilter } from '@/engine/rx-operators/readonlyIgnoreFilter';
import { Tag } from '@/engine/tag';

const action = (type: string, tags?: number): AnyAction => ({
  type,
  payload: {},
  ...(tags === undefined ? {} : { tags }),
});

const openMap = (payload: Record<string, boolean>, tags?: number) => ({
  ...action('editor.changeOpenMap', tags),
  payload,
});

/** A readonly filter as the editor element's store builds it, and what it lets through. */
function editorPipe(readonly = () => true) {
  const source$ = new Subject<Array<AnyAction>>();
  const emitted: Array<Array<AnyAction>> = [];
  source$
    .pipe(
      readonlyIgnoreFilter(
        readonly,
        [Tag.shared],
        EditStateOpenActionTypes,
        opensEditDialog
      )
    )
    .subscribe(actions => emitted.push(actions));
  return { source$, emitted };
}

const CLOSING_TYPES = [
  'editor.editTableEnd',
  'editor.editMemoEnd',
  'editor.editTableGroupEnd',
  'editor.drawEndRelationship',
  'editor.focusTableEnd',
  'editor.unselectAll',
  'editor.changeHandTool',
];

const RAISING_TYPES = [
  'table.changeZIndex',
  'memo.changeZIndex',
  'tableGroup.changeZIndex',
];

// table.add mutates the document, so it is blocked in readonly mode.
const BLOCKED = 'table.add';
// zoom / scroll style actions are deliberately excluded from the ignore list.
const ALLOWED = 'settings.changeZoomLevel';

describe('readonlyIgnoreFilter', () => {
  it('exposes an ignore list that excludes viewport-only settings actions', () => {
    expect(ReadonlyIgnoreActionTypes).toContain(BLOCKED);
    expect(ReadonlyIgnoreActionTypes).not.toContain(ALLOWED);
  });

  it('passes every action through when not readonly', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(readonlyIgnoreFilter(() => false))
      .subscribe(actions => emitted.push(actions));

    const batch = [
      action(BLOCKED),
      action(ALLOWED),
      action('editor.selectAll'),
    ];
    source$.next(batch);

    expect(emitted).toEqual([batch]);
    expect(emitted[0]).toBe(batch);
  });

  it('drops document-changing actions when readonly', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(readonlyIgnoreFilter(() => true))
      .subscribe(actions => emitted.push(actions));

    const allowed = action(ALLOWED);
    source$.next([action(BLOCKED), allowed]);

    expect(emitted).toEqual([[allowed]]);
  });

  it('does not emit when readonly removes every action', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(readonlyIgnoreFilter(() => true))
      .subscribe(actions => emitted.push(actions));

    source$.next([action(BLOCKED), action('memo.add')]);

    expect(emitted).toEqual([]);
  });

  it('lets a blocked action through when it carries a pass tag', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(readonlyIgnoreFilter(() => true, [Tag.shared]))
      .subscribe(actions => emitted.push(actions));

    const shared = action(BLOCKED, Tag.shared);
    const localOnly = action(BLOCKED, Tag.following);
    const untagged = action(BLOCKED);
    source$.next([shared, localOnly, untagged]);

    expect(emitted).toEqual([[shared]]);
  });

  it('re-reads the readonly flag on every emission', () => {
    let readonly = false;
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(readonlyIgnoreFilter(() => readonly))
      .subscribe(actions => emitted.push(actions));

    source$.next([action(BLOCKED)]);
    readonly = true;
    source$.next([action(BLOCKED)]);
    readonly = false;
    source$.next([action(BLOCKED)]);

    expect(emitted).toEqual([[action(BLOCKED)], [action(BLOCKED)]]);
  });

  it('drops each extra type it is given, and only while readonly', () => {
    let readonly = true;
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(readonlyIgnoreFilter(() => readonly, [], ['editor.select']))
      .subscribe(actions => emitted.push(actions));

    const zoom = action(ALLOWED);
    source$.next([action('editor.select'), action(BLOCKED), zoom]);
    readonly = false;
    const writable = [action('editor.select'), action(BLOCKED)];
    source$.next(writable);

    expect(emitted).toEqual([[zoom], writable]);
  });

  it('drops each action the extra predicate names, beside its lists', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    const named = action('editor.select');
    named.payload = { drop: true };
    source$
      .pipe(
        readonlyIgnoreFilter(
          () => true,
          [],
          [],
          ({ payload }) => payload?.drop === true
        )
      )
      .subscribe(actions => emitted.push(actions));

    const kept = action('editor.select');
    source$.next([named, action(BLOCKED), kept]);

    expect(emitted).toEqual([[kept]]);
  });

  it('keeps every action that opens an edit without the extra list', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(readonlyIgnoreFilter(() => true, [Tag.shared]))
      .subscribe(actions => emitted.push(actions));

    const batch = [
      ...EditStateOpenActionTypes.map(type => action(type)),
      openMap({ [Open.mapColumns]: true }),
    ];
    source$.next(batch);

    expect(emitted).toEqual([batch]);
  });

  describe('as the editor element builds it', () => {
    it.each(EditStateOpenActionTypes)('drops %s while readonly', type => {
      const { source$, emitted } = editorPipe();
      const zoom = action(ALLOWED);

      source$.next([action(type), zoom]);

      expect(emitted).toEqual([[zoom]]);
    });

    it('lets each action that closes an edit through, so turning readonly ends what is open', () => {
      const { source$, emitted } = editorPipe();
      const batch = CLOSING_TYPES.map(type => action(type));

      source$.next(batch);

      expect(emitted).toEqual([batch]);
    });

    it('lets a table, a memo or a group be raised, which writes no document', () => {
      const { source$, emitted } = editorPipe();
      const batch = RAISING_TYPES.map(type => action(type));

      source$.next(batch);

      expect(emitted).toEqual([batch]);
    });

    it.each([Open.mapColumns, Open.automaticTablePlacement, Open.timeTravel])(
      'drops the open map change that opens %s, and passes the one that closes it',
      key => {
        const { source$, emitted } = editorPipe();
        const close = openMap({ [key]: false });

        source$.next([openMap({ [key]: true }), close]);

        expect(emitted).toEqual([[close]]);
      }
    );

    it.each([Open.tableProperties, Open.diffViewer, Open.exportImage])(
      'lets the open map change that opens %s through, a dialog that only reads',
      key => {
        const { source$, emitted } = editorPipe();
        const open = openMap({ [key]: true });

        source$.next([open]);

        expect(emitted).toEqual([[open]]);
      }
    );

    it('drops an open map change that opens a dialog that writes beside one that reads', () => {
      const { source$, emitted } = editorPipe();
      const closeAll = openMap({
        [Open.mapColumns]: false,
        [Open.automaticTablePlacement]: false,
        [Open.timeTravel]: false,
      });

      source$.next([
        openMap({ [Open.tableProperties]: true, [Open.timeTravel]: true }),
        closeAll,
      ]);

      expect(emitted).toEqual([[closeAll]]);
    });

    it('lets a shared-tagged action through, an opening one included', () => {
      const { source$, emitted } = editorPipe();
      const sharedEdit = action('editor.editMemo', Tag.shared);
      const sharedOpen = openMap({ [Open.mapColumns]: true }, Tag.shared);
      const sharedChange = action(BLOCKED, Tag.shared);

      source$.next([
        sharedEdit,
        action('editor.editMemo', Tag.following),
        sharedOpen,
        sharedChange,
      ]);

      expect(emitted).toEqual([[sharedEdit, sharedOpen, sharedChange]]);
    });

    it('keeps every edit while the editor is writable', () => {
      const { source$, emitted } = editorPipe(() => false);
      const batch = [
        ...EditStateOpenActionTypes.map(type => action(type)),
        openMap({ [Open.mapColumns]: true }),
        action(BLOCKED),
      ];

      source$.next(batch);

      expect(emitted).toEqual([batch]);
      expect(emitted[0]).toBe(batch);
    });
  });

  it('propagates errors and completion', () => {
    const error$ = new Subject<Array<AnyAction>>();
    const onError = vi.fn();
    error$.pipe(readonlyIgnoreFilter(() => true)).subscribe({ error: onError });
    const err = new Error('boom');
    error$.error(err);
    expect(onError).toHaveBeenCalledWith(err);

    const complete$ = new Subject<Array<AnyAction>>();
    const onComplete = vi.fn();
    complete$
      .pipe(readonlyIgnoreFilter(() => true))
      .subscribe({ complete: onComplete });
    complete$.complete();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

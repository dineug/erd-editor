import { createEditorContext } from "@src/core/EditorContext";
import { getData } from "@src/core/Helper";
import {
  addMemo,
  moveMemo,
  removeMemo,
  selectMemo,
  selectEndMemo,
  selectAllMemo,
  changeMemoValue,
  resizeMemo,
  dragSelectMemo,
  loadMemo,
} from "@src/core/command/memo";
import { MemoModel } from "@src/core/model/MemoModel";

describe("command: memo", () => {
  it("memo.add", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { memoState } = store;

    // when
    store.dispatch(addMemo(store));

    // then
    store.observe(memoState.memos, () => {
      expect(1).toBe(memoState.memos.length);
      done();
    });
  });

  it("memo.move", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { memoState } = store;
    const command = addMemo(store);

    // when
    const movementX = 1;
    const movementY = 2;
    store.dispatch(
      command,
      moveMemo(store, false, movementX, movementY, command.data.id)
    );

    // then
    store.observe(memoState.memos, () => {
      const memo = getData(memoState.memos, command.data.id);
      expect(command.data.ui.top + movementY).toBe(memo?.ui.top);
      expect(command.data.ui.left + movementX).toBe(memo?.ui.left);
      done();
    });
  });

  it("memo.remove", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { memoState } = store;
    memoState.memos.push(
      new MemoModel({ addMemo: addMemo(store).data }),
      new MemoModel({ addMemo: addMemo(store).data })
    );
    const memo = memoState.memos[0];

    // when
    store.dispatch(removeMemo(store, memo.id));

    // then
    store.observe(memoState.memos, () => {
      expect(1).toBe(memoState.memos.length);
      done();
    });
  });

  it("memo.select", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { memoState } = store;
    memoState.memos.push(
      new MemoModel({ addMemo: addMemo(store).data }),
      new MemoModel({ addMemo: addMemo(store).data })
    );
    const memo = memoState.memos[0];
    const memo2 = memoState.memos[1];

    // when
    store.dispatch(selectMemo(store, false, memo.id));

    // then
    store.observe(memo2.ui, () => {
      expect(true).toBe(memo.ui.active);
      expect(false).toBe(memo2.ui.active);
      done();
    });
  });

  it("memo.selectEnd", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { memoState } = store;
    memoState.memos.push(new MemoModel({ addMemo: addMemo(store).data }));
    const memo = memoState.memos[0];

    // when
    store.dispatch(selectEndMemo());

    // then
    store.observe(memo.ui, () => {
      expect(false).toBe(memo.ui.active);
      done();
    });
  });

  it("memo.selectAll", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { memoState } = store;
    memoState.memos.push(
      new MemoModel({ addMemo: addMemo(store).data }),
      new MemoModel({ addMemo: addMemo(store).data })
    );
    const memo = memoState.memos[0];
    const memo2 = memoState.memos[1];

    // when
    store.dispatch(selectAllMemo());

    // then
    store.observe(memo2.ui, () => {
      expect(true).toBe(memo.ui.active);
      expect(true).toBe(memo2.ui.active);
      done();
    });
  });

  it("memo.changeValue", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { memoState } = store;
    memoState.memos.push(new MemoModel({ addMemo: addMemo(store).data }));
    const memo = memoState.memos[0];

    // when
    const value = "test";
    store.dispatch(changeMemoValue(memo.id, value));

    // then
    store.observe(memo, () => {
      expect(value).toBe(memo.value);
      done();
    });
  });

  it("memo.resize", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { memoState } = store;
    memoState.memos.push(new MemoModel({ addMemo: addMemo(store).data }));
    const memo = memoState.memos[0];

    // when
    const top = 10;
    const left = 20;
    const width = 200;
    const height = 300;
    store.dispatch(resizeMemo(memo.id, top, left, width, height));

    // then
    store.observe(memo.ui, () => {
      expect(top).toBe(memo.ui.top);
      expect(left).toBe(memo.ui.left);
      expect(width).toBe(memo.ui.width);
      expect(height).toBe(memo.ui.height);
      done();
    });
  });

  it("memo.dragSelect", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { memoState } = store;
    memoState.memos.push(
      new MemoModel({ addMemo: addMemo(store).data }),
      new MemoModel({ addMemo: addMemo(store).data })
    );
    const memo = memoState.memos[0];
    const memo2 = memoState.memos[1];
    memo.ui.top = 200;
    memo.ui.left = 200;
    memo2.ui.top = 400;
    memo2.ui.left = 400;

    // when
    store.dispatch(
      dragSelectMemo(
        {
          x: 100,
          y: 100,
        },
        {
          x: 300,
          y: 300,
        }
      )
    );

    // then
    store.observe(memo2.ui, () => {
      expect(true).toBe(memo.ui.active);
      expect(false).toBe(memo2.ui.active);
      done();
    });
  });

  it("memo.load", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { memoState } = store;

    // when
    const memo = new MemoModel({ addMemo: addMemo(store).data });
    store.dispatch(loadMemo(memo));

    // then
    store.observe(memoState.memos, () => {
      const targetMemo = getData(memoState.memos, memo.id);
      expect(memo.id).toBe(targetMemo?.id);
      done();
    });
  });
});

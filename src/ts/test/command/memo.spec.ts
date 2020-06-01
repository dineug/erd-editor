import { createEditorContext } from "@src/core/EditorContext";
import { getData } from "@src/core/Helper";
import {
  addMemo,
  addOnlyMemo,
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
      expect(memoState.memos.length).toBe(1);
      done();
    });
  });

  it("memo.addOnly", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { memoState } = store;

    // when
    store.dispatch(addOnlyMemo(store));

    // then
    store.observe(memoState.memos, () => {
      expect(memoState.memos.length).toBe(1);
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
      expect(memo?.ui.top).toBe(command.data.ui.top + movementY);
      expect(memo?.ui.left).toBe(command.data.ui.left + movementX);
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
      expect(memoState.memos.length).toBe(1);
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
      expect(memo.ui.active).toBe(true);
      expect(memo2.ui.active).toBe(false);
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
      expect(memo.ui.active).toBe(false);
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
      expect(memo.ui.active).toBe(true);
      expect(memo2.ui.active).toBe(true);
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
      expect(memo.value).toBe(value);
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
      expect(memo.ui.top).toBe(top);
      expect(memo.ui.left).toBe(left);
      expect(memo.ui.width).toBe(width);
      expect(memo.ui.height).toBe(height);
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
      expect(memo.ui.active).toBe(true);
      expect(memo2.ui.active).toBe(false);
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
      expect(targetMemo?.id).toBe(memo.id);
      done();
    });
  });
});

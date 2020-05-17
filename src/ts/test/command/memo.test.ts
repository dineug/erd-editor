import { createEditorContext } from "../../core/EditorContext";
import { getData } from "../../core/Helper";
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
} from "../../core/command/memo";
import { MemoModel } from "../../core/model/MemoModel";

test("command: memo.add", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { memoState } = store;

  // when
  const command = addMemo(store);
  store.dispatch(command);

  // then
  store.observe(memoState.memos, () => {
    const memo = getData(memoState.memos, command.data.id);
    expect(command.data.id).toBe(memo?.id);
    done();
  });
});

test("command: memo.move", (done) => {
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

test("command: memo.remove", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { memoState } = store;

  // when
  const command = addMemo(store);
  store.dispatch(command, addMemo(store), removeMemo(store, command.data.id));

  // then
  store.observe(memoState.memos, () => {
    expect(1).toBe(memoState.memos.length);
    done();
  });
});

test("command: memo.select", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { memoState } = store;

  // when
  const addMemoCommand = addMemo(store);
  const addMemoCommand2 = addMemo(store);
  store.dispatch(
    addMemoCommand,
    addMemoCommand2,
    selectMemo(store, false, addMemoCommand.data.id)
  );

  // then
  store.observe(memoState.memos, () => {
    const memo = getData(memoState.memos, addMemoCommand.data.id);
    const memo2 = getData(memoState.memos, addMemoCommand2.data.id);
    expect(true).toBe(memo?.ui.active);
    expect(false).toBe(memo2?.ui.active);
    done();
  });
});

test("command: memo.selectEnd", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { memoState } = store;

  // when
  const command = addMemo(store);
  store.dispatch(command, selectEndMemo());

  // then
  store.observe(memoState.memos, () => {
    const memo = getData(memoState.memos, command.data.id);
    expect(false).toBe(memo?.ui.active);
    done();
  });
});

test("command: memo.selectAll", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { memoState } = store;

  // when
  const addMemoCommand = addMemo(store);
  const addMemoCommand2 = addMemo(store);
  store.dispatch(addMemoCommand, addMemoCommand2, selectAllMemo());

  // then
  store.observe(memoState.memos, () => {
    const memo = getData(memoState.memos, addMemoCommand.data.id);
    const memo2 = getData(memoState.memos, addMemoCommand2.data.id);
    expect(true).toBe(memo?.ui.active);
    expect(true).toBe(memo2?.ui.active);
    done();
  });
});

test("command: memo.changeValue", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { memoState } = store;

  // when
  const command = addMemo(store);
  const value = "test";
  store.dispatch(command, changeMemoValue(command.data.id, value));

  // then
  store.observe(memoState.memos, () => {
    const memo = getData(memoState.memos, command.data.id);
    expect(value).toBe(memo?.value);
    done();
  });
});

test("command: memo.resize", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { memoState } = store;

  // when
  const command = addMemo(store);
  const top = 10;
  const left = 20;
  const width = 200;
  const height = 300;
  store.dispatch(
    command,
    resizeMemo(command.data.id, top, left, width, height)
  );

  // then
  store.observe(memoState.memos, () => {
    const memo = getData(memoState.memos, command.data.id);
    expect(top).toBe(memo?.ui.top);
    expect(left).toBe(memo?.ui.left);
    expect(width).toBe(memo?.ui.width);
    expect(height).toBe(memo?.ui.height);
    done();
  });
});

test("command: memo.dragSelect", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { memoState } = store;

  // when
  const addMemoCommand = addMemo(store);
  const addMemoCommand2 = addMemo(store);
  store.dispatch(
    addMemoCommand,
    addMemoCommand2,
    resizeMemo(
      addMemoCommand.data.id,
      200,
      200,
      addMemoCommand.data.ui.width,
      addMemoCommand.data.ui.height
    ),
    resizeMemo(
      addMemoCommand2.data.id,
      400,
      400,
      addMemoCommand2.data.ui.width,
      addMemoCommand2.data.ui.height
    ),
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
  store.observe(memoState.memos, () => {
    const memo = getData(memoState.memos, addMemoCommand.data.id);
    const memo2 = getData(memoState.memos, addMemoCommand2.data.id);
    expect(true).toBe(memo?.ui.active);
    expect(false).toBe(memo2?.ui.active);
    done();
  });
});

test("command: memo.load", (done) => {
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

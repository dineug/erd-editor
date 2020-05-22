import { createEditorContext } from "@src/core/EditorContext";
import {
  moveCanvas,
  resizeCanvas,
  changeCanvasShow,
  changeDatabase,
  changeDatabaseName,
  changeCanvasType,
  changeLanguage,
  changeTableCase,
  changeColumnCase,
} from "@src/core/command/canvas";

describe("command: canvas", () => {
  it("canvas.move", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { canvasState } = store;

    // when
    const scrollTop = 100;
    const scrollLeft = 200;
    store.dispatch(moveCanvas(scrollTop, scrollLeft));

    // then
    store.observe(canvasState, () => {
      expect(canvasState.scrollTop).toBe(scrollTop);
      expect(canvasState.scrollLeft).toBe(scrollLeft);
      done();
    });
  });

  it("canvas.resize", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { canvasState } = store;

    // when
    const width = 3000;
    const height = 4000;
    store.dispatch(resizeCanvas(width, height));

    // then
    store.observe(canvasState, () => {
      expect(canvasState.width).toBe(width);
      expect(canvasState.height).toBe(height);
      done();
    });
  });

  it("canvas.changeShow", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { canvasState } = store;
    const { show } = canvasState;

    // when
    store.dispatch(
      changeCanvasShow(store, "tableComment"),
      changeCanvasShow(store, "columnComment"),
      changeCanvasShow(store, "columnDataType"),
      changeCanvasShow(store, "columnDefault"),
      changeCanvasShow(store, "columnAutoIncrement"),
      changeCanvasShow(store, "columnPrimaryKey"),
      changeCanvasShow(store, "columnUnique"),
      changeCanvasShow(store, "columnNotNull"),
      changeCanvasShow(store, "relationship")
    );

    // then
    store.observe(show, () => {
      expect(show.tableComment).toBe(false);
      expect(show.columnComment).toBe(false);
      expect(show.columnDataType).toBe(false);
      expect(show.columnDefault).toBe(false);
      expect(show.columnAutoIncrement).toBe(false);
      expect(show.columnPrimaryKey).toBe(false);
      expect(show.columnUnique).toBe(false);
      expect(show.columnNotNull).toBe(false);
      expect(show.relationship).toBe(false);
      done();
    });
  });

  it("canvas.changeDatabase", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { canvasState } = store;

    // when
    const database = "PostgreSQL";
    store.dispatch(changeDatabase(database));

    // then
    store.observe(canvasState, () => {
      expect(canvasState.database).toBe(database);
      done();
    });
  });

  it("canvas.changeDatabaseName", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { canvasState } = store;

    // when
    const databaseName = "vuerd";
    store.dispatch(changeDatabaseName(databaseName));

    // then
    store.observe(canvasState, () => {
      expect(canvasState.databaseName).toBe(databaseName);
      done();
    });
  });

  it("canvas.changeCanvasType", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { canvasState } = store;

    // when
    const canvasType = "Grid";
    store.dispatch(changeCanvasType(canvasType));

    // then
    store.observe(canvasState, () => {
      expect(canvasState.canvasType).toBe(canvasType);
      done();
    });
  });

  it("canvas.changeLanguage", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { canvasState } = store;

    // when
    const language = "JPA";
    store.dispatch(changeLanguage(language));

    // then
    store.observe(canvasState, () => {
      expect(canvasState.language).toBe(language);
      done();
    });
  });

  it("canvas.changeTableCase", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { canvasState } = store;

    // when
    const caseName = "none";
    store.dispatch(changeTableCase(caseName));

    // then
    store.observe(canvasState, () => {
      expect(canvasState.tableCase).toBe(caseName);
      done();
    });
  });

  it("canvas.changeColumnCase", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { canvasState } = store;

    // when
    const caseName = "none";
    store.dispatch(changeColumnCase(caseName));

    // then
    store.observe(canvasState, () => {
      expect(canvasState.columnCase).toBe(caseName);
      done();
    });
  });
});

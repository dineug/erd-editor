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
      expect(scrollTop).toBe(canvasState.scrollTop);
      expect(scrollLeft).toBe(canvasState.scrollLeft);
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
      expect(width).toBe(canvasState.width);
      expect(height).toBe(canvasState.height);
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
      expect(false).toBe(show.tableComment);
      expect(false).toBe(show.columnComment);
      expect(false).toBe(show.columnDataType);
      expect(false).toBe(show.columnDefault);
      expect(false).toBe(show.columnAutoIncrement);
      expect(false).toBe(show.columnPrimaryKey);
      expect(false).toBe(show.columnUnique);
      expect(false).toBe(show.columnNotNull);
      expect(false).toBe(show.relationship);
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
    store.observe(canvasState, (name) => {
      if (name === "database") {
        expect(database).toBe(canvasState.database);
        done();
      }
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
    store.observe(canvasState, (name) => {
      if (name === "databaseName") {
        expect(databaseName).toBe(canvasState.databaseName);
        done();
      }
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
    store.observe(canvasState, (name) => {
      if (name === "canvasType") {
        expect(canvasType).toBe(canvasState.canvasType);
        done();
      }
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
    store.observe(canvasState, (name) => {
      if (name === "language") {
        expect(language).toBe(canvasState.language);
        done();
      }
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
    store.observe(canvasState, (name) => {
      if (name === "tableCase") {
        expect(caseName).toBe(canvasState.tableCase);
        done();
      }
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
    store.observe(canvasState, (name) => {
      if (name === "columnCase") {
        expect(caseName).toBe(canvasState.columnCase);
        done();
      }
    });
  });
});

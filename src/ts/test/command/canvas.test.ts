import { createEditorContext } from "../../core/EditorContext";
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
} from "../../core/command/canvas";

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
    let callCount = 0;
    store.observe(canvasState, (name) => {
      if (name === "scrollTop") {
        expect(scrollTop).toBe(canvasState.scrollTop);
      } else if (name === "scrollLeft") {
        expect(scrollLeft).toBe(canvasState.scrollLeft);
      }
      if (++callCount === 2) {
        done();
      }
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
    let callCount = 0;
    store.observe(canvasState, (name) => {
      if (name === "width") {
        expect(width).toBe(canvasState.width);
      } else if (name === "height") {
        expect(height).toBe(canvasState.height);
      }
      if (++callCount === 2) {
        done();
      }
    });
  });

  it("canvas.changeShow", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { canvasState } = store;

    // when
    store.dispatch(changeCanvasShow(store, "tableComment"));
    store.dispatch(changeCanvasShow(store, "columnComment"));
    store.dispatch(changeCanvasShow(store, "columnDataType"));
    store.dispatch(changeCanvasShow(store, "columnDefault"));
    store.dispatch(changeCanvasShow(store, "columnAutoIncrement"));
    store.dispatch(changeCanvasShow(store, "columnPrimaryKey"));
    store.dispatch(changeCanvasShow(store, "columnUnique"));
    store.dispatch(changeCanvasShow(store, "columnNotNull"));
    store.dispatch(changeCanvasShow(store, "relationship"));

    // then
    let callCount = 0;
    store.observe(canvasState.show, (name) => {
      switch (name) {
        case "tableComment":
        case "columnComment":
        case "columnDataType":
        case "columnDefault":
        case "columnAutoIncrement":
        case "columnPrimaryKey":
        case "columnUnique":
        case "columnNotNull":
        case "relationship":
          expect(false).toBe(canvasState.show[name]);
          break;
      }
      if (++callCount === 9) {
        done();
      }
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
